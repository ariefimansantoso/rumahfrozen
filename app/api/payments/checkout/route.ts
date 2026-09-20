import { after, NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Cart, Product, Order, Vendor } from "@/models";
import {
  getStripeForSecretKey,
  isStripeSecretKeyConfigured,
} from "@/lib/stripe";
import { getSettings } from "@/models/settings.model";
import {
  resolvePayPalCredentials,
  resolveStripeCredentials,
} from "@/lib/credentials";
import { createPayPalOrder } from "@/lib/paypal";
import {
  createRazorpayOrder,
  getRazorpayCredentials,
} from "@/lib/razorpay";
import {
  getPaystackCredentials,
  initializePaystackTransaction,
} from "@/lib/paystack";
import { sendOrderConfirmationEmail } from "@/lib/order-emails";
import {
  decrementInventory,
  InsufficientStockError,
  restoreInventory,
} from "@/lib/inventory";
import { markOrderInventoryReserved } from "@/lib/order-inventory";
import {
  getOrderPreorderLines,
  getPreorderReleaseDateForOrder,
  markOrderPreorderReserved,
  PREORDER_ITEM_STATUS,
  PURCHASE_TYPE,
  releasePreorderQuantity,
  reservePreorderQuantity,
  resolvePurchaseType,
  type PreorderSettingsShape,
} from "@/lib/preorders";
import { getNextOnlineOrderNumber } from "@/lib/order-number";
import {
  DEFAULT_FREE_SHIPPING_THRESHOLD,
  DEFAULT_ORDER_SHIPPING_COST,
  DEFAULT_ORDER_TAX_RATE,
} from "@/lib/order-settings";
import {
  applyCouponUsageForOrder,
  validateAndCalculateCoupon,
} from "@/lib/coupons";
import {
  SHIPPING_UNAVAILABLE_MESSAGE,
  type ShippingSettings,
} from "@/lib/shipping";
import {
  resolveCheckoutShipping,
  allocateSubOrderShipping,
  buildShippingMetadata,
} from "@/lib/checkout-shipping";
import { calculateCheckoutTotals } from "@/lib/discounts";
import {
  handleApiError,
  ValidationError,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { ORDER_STATUS, PAYMENT_STATUS, VENDOR_STATUS } from "@/config/app.config";
import {
  rateLimitByIP,
  rateLimitBySession,
  rateLimitByUser,
} from "@/lib/api/rate-limit-middleware";
import { validateBody } from "@/lib/api/validate";
import { CheckoutSchema } from "@/lib/validations";
import { isStorefrontProductSourceAllowed } from "@/lib/product-visibility";
import {
  buildVendorSubOrders,
  getOrderItemVendorId,
  groupItemsByOrderVendor,
  resolveOrderVendorContext,
} from "@/lib/order-vendors";
import { ensurePendingChargeTransaction } from "@/lib/payment-transactions";
import {
  markCheckoutRecovered,
  updateCheckoutSnapshot,
} from "@/lib/abandoned-checkouts";
import { notifyOrderCreatedParticipants } from "@/lib/notifications";
import { assertStorefrontWriteAllowed } from "@/lib/maintenance";
import {
  buildOrderItemCustomsSnapshot,
  resolveItemShipping,
  type ProductShippingData,
  type VariantShippingData,
} from "@/lib/product-shipping";
import { revalidateProductContent } from "@/lib/cache-invalidation";
import { getPostHogClient } from "@/lib/posthog-server";

interface CartItem {
  productId: {
    _id: string;
    name: string;
    price: number;
    images?: string[];
    vendorId: string | { _id: string };
    sku?: string;
    slug?: string;
    shipping?: ProductShippingData;
    variants?: Array<VariantShippingData & { _id: { toString: () => string } }>;
  };
  variantId?: string;
  quantity: number;
  price: number;
  purchaseType?: string;
  preorderReleaseDate?: Date;
  preorderMessage?: string;
  preorderPaymentMode?: "full" | "deposit" | "pay_later";
  preorderDepositAmount?: number;
  preorderOutstandingAmount?: number;
  preorderSupplierEta?: Date;
  preorderBatchName?: string;
}

type StockCheckVariant = {
  _id: { toString: () => string };
  stock?: number;
  sku?: string;
  weight?: number;
  weightUnit?: "g" | "kg" | "lb" | "oz";
  requiresShipping?: boolean;
  preorder?: PreorderSettingsShape;
};

type StockCheckProduct = {
  stock?: number;
  sku?: string;
  status?: string;
  productSource?: unknown;
  category?: string | { toString: () => string };
  variants?: StockCheckVariant[];
  preorder?: PreorderSettingsShape;
  shipping?: ProductShippingData;
};

type CheckoutShippingAddress = {
  fullName: string;
  firstName?: string;
  lastName?: string;
  street: string;
  apartment?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
};

/**
 * POST /api/payments/checkout
 * Create checkout payment session/order
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const cartSessionId = request.cookies?.get("cart_session")?.value;

    if (session?.user?.id) {
      rateLimitByUser(
        request,
        session.user.id,
        "payments:checkout",
        "strict",
        session.user.role
      );
    } else if (cartSessionId) {
      rateLimitBySession(
        request,
        cartSessionId,
        "payments:checkout",
        "strict",
      );
    } else {
      rateLimitByIP(request, "strict");
    }

    await connectDB();

    const {
      shippingAddress,
      billingAddress,
      paymentMethod,
      locale,
      email,
      couponCode,
      preorderAcknowledged,
      selectedShippingOptionId,
      vendorShippingSelections,
    } = await validateBody(
      request,
      CheckoutSchema,
    );
    const customerEmail =
      typeof email === "string" && email.trim().length > 0
        ? email.trim()
        : session?.user?.email;

    if (!session?.user?.id && !customerEmail) {
      throw new ValidationError({
        email: ["Email is required for guest checkout"],
      });
    }

    const normalizedShippingAddress = {
      ...shippingAddress,
      state: shippingAddress.state?.trim() || "N/A",
    };
    const normalizedBillingAddress = billingAddress
      ? {
          ...billingAddress,
          state: billingAddress.state?.trim() || "N/A",
        }
      : normalizedShippingAddress;

    const settings = await getSettings();
    assertStorefrontWriteAllowed(settings.maintenance, settings.general?.storeName);
    const isMultiVendorEnabled = Boolean(settings.multiVendorMode?.enabled);

    const paymentSettings = settings.payment || {};
    const stripeSettings = paymentSettings.stripe;
    const paypalSettings = paymentSettings.paypal;
    const razorpaySettings = paymentSettings.razorpay;
    const paystackSettings = paymentSettings.paystack;
    const codSettings = paymentSettings.cod;

    const cartQuery = session?.user?.id
      ? { userId: session.user.id }
      : cartSessionId
        ? { sessionId: cartSessionId }
        : null;

    if (!cartQuery) {
      throw new ValidationError({ cart: ["Cart is empty"] });
    }

    // Get current cart (customer or guest)
    const cart = await Cart.findOne(cartQuery)
      .populate({
        path: "items.productId",
        select: "name price images vendorId stock sku slug shipping variants",
        populate: { path: "vendorId", select: "_id" },
      })
      .lean();

    if (!cart || !cart.items || cart.items.length === 0) {
      throw new ValidationError({ cart: ["Cart is empty"] });
    }

    const items = cart.items as unknown as CartItem[];
    const customerId = session?.user?.id || String(cart._id);
    const purchaseTypes = new Set(
      items.map((item) => item.purchaseType || PURCHASE_TYPE.STANDARD),
    );
    if (purchaseTypes.size > 1) {
      throw new ValidationError({
        cart: [
          "Pre-order items must be checked out separately from regular items",
        ],
      });
    }
    const hasPreorder = purchaseTypes.has(PURCHASE_TYPE.PREORDER);
    if (hasPreorder && preorderAcknowledged !== true) {
      throw new ValidationError({
        preorderAcknowledged: ["Please confirm the pre-order shipping terms"],
      });
    }

    if (isMultiVendorEnabled) {
      const vendorIds = Array.from(
        new Set(
          items
            .map((item) => String((item.productId.vendorId as { _id?: string })?._id || item.productId.vendorId || ""))
            .filter(Boolean),
        ),
      );
      const approvedVendorCount = await Vendor.countDocuments({
        _id: { $in: vendorIds },
        status: VENDOR_STATUS.APPROVED,
      });
      if (approvedVendorCount !== vendorIds.length) {
        throw new ValidationError({
          cart: ["One or more products are no longer available"],
        });
      }
    }

    const couponCartItems: Array<{
      productId: string;
      price: number;
      quantity: number;
      categoryId?: string;
    }> = [];

    // Accumulate shippable weight (in the store's weight unit) overall and per
    // vendor, so the rate engine can price weight-based and per-vendor shipping.
    let totalWeight = 0;
    const vendorAgg = new Map<
      string,
      {
        subtotal: number;
        shippableSubtotal: number;
        weight: number;
        shippableItemCount: number;
      }
    >();
    const itemVendorId = (item: CartItem) =>
      String(
        (item.productId.vendorId as { _id?: string })?._id ||
          item.productId.vendorId ||
          "",
      );

    // Validate stock against selected variant (when present) to match inventory decrement rules.
    // Fetch every cart product in one query instead of one round-trip per item.
    const stockCheckProducts = await Product.find({
      _id: { $in: items.map((item) => item.productId._id) },
    }).lean<Array<StockCheckProduct & { _id: { toString: () => string } }>>();
    const stockCheckProductById = new Map(
      stockCheckProducts.map((product) => [product._id.toString(), product]),
    );
    for (const item of items) {
      const product = stockCheckProductById.get(String(item.productId._id));
      if (!product) {
        throw new ValidationError({
          stock: [
            `${item.productId.name} is out of stock or has insufficient quantity`,
          ],
        });
      }
      const hasExplicitStatus = typeof product.status === "string";
      const hasExplicitProductSource =
        product.productSource !== undefined && product.productSource !== null;
      const isUnavailableByStatus =
        hasExplicitStatus && product.status !== "active";
      const isUnavailableByProductSource =
        hasExplicitProductSource &&
        !isStorefrontProductSourceAllowed(
          product.productSource,
          isMultiVendorEnabled,
        );

      // Keep compatibility with legacy products that may not have status/source fields.
      if (isUnavailableByStatus || isUnavailableByProductSource) {
        throw new ValidationError({
          stock: [
            `${item.productId.name} is out of stock or has insufficient quantity`,
          ],
        });
      }

      const purchase = resolvePurchaseType({
        product,
        variantId: item.variantId,
        requestedQuantity: item.quantity,
      });
      const expectedPurchaseType = item.purchaseType || PURCHASE_TYPE.STANDARD;
      if (!purchase || purchase.purchaseType !== expectedPurchaseType) {
        throw new ValidationError({
          stock: [
            `${item.productId.name} is out of stock or has insufficient quantity`,
          ],
        });
      }

      const variantSku = item.variantId
        ? product.variants?.find(
            (variant) => variant._id.toString() === String(item.variantId),
          )?.sku
        : undefined;
      if (!item.productId.sku && !variantSku) {
        throw new ValidationError({
          sku: [`Missing SKU for product "${item.productId.name}"`],
        });
      }

      couponCartItems.push({
        productId: String(item.productId._id),
        price: item.price,
        quantity: item.quantity,
        categoryId: product.category ? String(product.category) : undefined,
      });

      const selectedVariant = item.variantId
        ? product.variants?.find(
            (variant) => variant._id.toString() === String(item.variantId),
          )
        : undefined;
      const itemShipping = resolveItemShipping({
        productShipping: product.shipping,
        variantShipping: selectedVariant,
        quantity: item.quantity,
        targetWeightUnit: "kg",
      });
      const lineWeight = itemShipping.totalWeight;
      totalWeight += lineWeight;

      const vId = itemVendorId(item);
      const agg = vendorAgg.get(vId) || {
        subtotal: 0,
        shippableSubtotal: 0,
        weight: 0,
        shippableItemCount: 0,
      };
      agg.subtotal += item.price * item.quantity;
      agg.weight += lineWeight;
      if (itemShipping.requiresShipping) {
        agg.shippableItemCount += item.quantity;
        agg.shippableSubtotal += item.price * item.quantity;
      }
      vendorAgg.set(vId, agg);
    }

    // Calculate totals
    const subtotal = items.reduce(
      (sum: number, item: CartItem) => sum + item.price * item.quantity,
      0,
    );
    const orderSettings = settings.orders || {};
    const freeShippingThreshold =
      orderSettings.freeShippingThreshold ?? DEFAULT_FREE_SHIPPING_THRESHOLD;
    const defaultShippingCost =
      orderSettings.defaultShippingCost ?? DEFAULT_ORDER_SHIPPING_COST;
    const taxRate = orderSettings.taxRate ?? DEFAULT_ORDER_TAX_RATE;

    let appliedCoupon:
      | {
          couponId: string;
          code: string;
          type: string;
          value: number;
          discount: number;
          maxDiscount?: number;
        }
      | undefined;
    const destination = {
      country: normalizedShippingAddress.country,
      state: normalizedShippingAddress.state,
    };
    const platformShipping = settings.shipping as ShippingSettings | undefined;
    const legacyOrders = { freeShippingThreshold, defaultShippingCost };

    // Single source of truth for cost, selected method, per-vendor allocation,
    // and duties — shared with the Stripe paths so they cannot diverge.
    const shippingResolution = await resolveCheckoutShipping({
      subtotal,
      totalWeight,
      vendorAgg,
      destination,
      platformShipping,
      orders: legacyOrders,
      isMultiVendorEnabled,
      selectedShippingOptionId,
      vendorShippingSelections,
    });
    if (!shippingResolution.available) {
      throw new ValidationError(SHIPPING_UNAVAILABLE_MESSAGE);
    }
    const shippingCost = shippingResolution.shippingCost;
    const selectedShippingMethod = shippingResolution.selectedShippingMethod;
    const vendorShippingCosts = shippingResolution.vendorShippingCosts;
    const customsEstimate = shippingResolution.customs;
    const dutyAmount = customsEstimate.dutyAmount;

    if (couponCode) {
      appliedCoupon = await validateAndCalculateCoupon({
        code: couponCode,
        subtotal,
        shippingCost,
        cartItems: couponCartItems,
        userId: session?.user?.id,
      });
    }

    const totals = calculateCheckoutTotals({
      subtotal,
      shippingCost,
      taxRate,
      coupon: appliedCoupon,
    });
    const discount = totals.discount;
    const tax = totals.tax;
    const total = totals.total + dutyAmount;
    const preorderOutstandingAmount = items.reduce(
      (sum, item) => sum + Number(item.preorderOutstandingAmount || 0),
      0,
    );
    const paymentDueNow = Math.max(0, total - preorderOutstandingAmount);

    if (!paymentMethod) {
      throw new ValidationError({
        paymentMethod: ["Payment method is required"],
      });
    }

    const activeLocale =
      typeof locale === "string" && locale.length > 0 ? locale : "en";

    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const cartDoc = await Cart.findById(cart._id);
    if (cartDoc) {
      await updateCheckoutSnapshot(cartDoc, {
        origin,
        locale: activeLocale,
        email: customerEmail,
        phone: normalizedShippingAddress.phone,
        customerName: normalizedShippingAddress.fullName,
        customerLocale: activeLocale,
        shippingAddress: normalizedShippingAddress,
        billingAddress: normalizedBillingAddress,
        gateway: paymentMethod,
        subtotalPrice: subtotal,
        shippingPrice: shippingCost,
        totalTax: tax,
        totalDiscounts: discount,
        totalPrice: total,
        presentmentCurrency: settings.general?.defaultCurrency || "USD",
        paymentEvent: {
          gateway: paymentMethod,
          status: "created",
          message: "Checkout payment started",
        },
      });
    }

    // Handle COD (Cash on Delivery)
    if (paymentMethod === "cod") {
      if (codSettings?.enabled === false) {
        throw new ValidationError("Cash on Delivery is disabled");
      }
      if (
        typeof codSettings?.minOrderAmount === "number" &&
        total < codSettings.minOrderAmount
      ) {
        throw new ValidationError(
          `Minimum order amount for Cash on Delivery is ${codSettings.minOrderAmount}`,
        );
      }
      if (
        typeof codSettings?.maxOrderAmount === "number" &&
        codSettings.maxOrderAmount > 0 &&
        total > codSettings.maxOrderAmount
      ) {
        throw new ValidationError(
          `Maximum order amount for Cash on Delivery is ${codSettings.maxOrderAmount}`,
        );
      }

      const inventoryLines = items
        .filter(
          (item) =>
            (item.purchaseType || PURCHASE_TYPE.STANDARD) ===
            PURCHASE_TYPE.STANDARD,
        )
        .map((item) => ({
          productId: String(item.productId._id),
          variantId: item.variantId,
          quantity: item.quantity,
        }));
      const preorderLines = getOrderPreorderLines(items);

      try {
        if (hasPreorder) {
          await reservePreorderQuantity(preorderLines);
        } else {
          await decrementInventory(inventoryLines);
        }
      } catch (err) {
        if (err instanceof InsufficientStockError) {
          const failedItem = items.find(
            (item) => String(item.productId._id) === String(err.line.productId),
          );
          const failedName = failedItem?.productId.name || "Product";
          throw new ValidationError({
            stock: [
              `${failedName} is out of stock or has insufficient quantity`,
            ],
          });
        }
        throw err;
      }
      revalidateProductContent({
        slugs: items
          .map((item) => item.productId?.slug)
          .filter(
            (slug): slug is string =>
              typeof slug === "string" && slug.length > 0,
          ),
      });

      let order: Awaited<ReturnType<typeof createOrder>>;
      try {
        order = await createOrder({
          customerId,
          items,
          shippingAddress: normalizedShippingAddress,
          billingAddress: normalizedBillingAddress,
          paymentMethod: "cod",
          shippingMethod: selectedShippingMethod,
          customs: customsEstimate,
          vendorShippingCosts,
          paymentStatus: PAYMENT_STATUS.PENDING,
          subtotal,
          discount,
          shippingCost,
          tax,
          total,
          coupon: appliedCoupon
            ? {
                code: appliedCoupon.code,
                type: appliedCoupon.type,
                value: appliedCoupon.value,
                couponId: appliedCoupon.couponId,
              }
            : undefined,
          isMultiVendorEnabled,
          orderPrefix: orderSettings.prefix,
        });
      } catch (err) {
        if (hasPreorder) {
          await releasePreorderQuantity(preorderLines).catch(() => undefined);
        } else {
          await restoreInventory(inventoryLines).catch(() => undefined);
        }
        throw err;
      }

      if (hasPreorder) {
        await markOrderPreorderReserved(String(order._id)).catch((err) =>
          console.error("Failed to mark preorder reserved on COD order:", err),
        );
      } else {
        // Mark sub-orders as having inventory reserved so cancel/refund paths
        // know which lines to restore.
        await markOrderInventoryReserved(String(order._id)).catch((err) =>
          console.error("Failed to mark inventory reserved on COD order:", err),
        );
      }

      // Clear cart only after order + inventory succeed.
      await Cart.findByIdAndUpdate(cart._id, { $set: { items: [] } });

      // Bookkeeping, confirmation email (PDF invoice + SMTP), and
      // notifications run after the response streams so the customer
      // isn't held on the success redirect while they complete.
      after(async () => {
        await ensurePendingChargeTransaction({
          _id: String(order._id),
          orderNumber: order.orderNumber,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          paymentId: order.paymentId,
          stripePaymentIntentId: order.stripePaymentIntentId,
          paypalCaptureId: order.paypalCaptureId,
          subtotal: order.subtotal,
          shippingCost: order.shippingCost,
          tax: order.tax,
          discount: order.discount,
          total: order.total,
          currency: settings.general?.defaultCurrency,
          channel: "online",
          createdAt: order.createdAt,
        }).catch((err) => {
          console.error("Failed to sync pending COD payment transaction:", err);
        });

        await markCheckoutRecovered({
          cartId: cart._id,
          orderId: order._id,
          paymentEvent: {
            gateway: "cod",
            status: "succeeded",
            message: "Cash on delivery order placed",
          },
        }).catch((err) =>
          console.error("Failed to mark abandoned checkout recovered:", err),
        );

        if (customerEmail) {
          await sendOrderConfirmationEmail(
            {
              orderNumber: order.orderNumber,
              customerName: normalizedShippingAddress.fullName,
              customerEmail,
              items: order.items.map(
                (i: {
                  name: string;
                  quantity: number;
                  price: number;
                  image?: string;
                }) => ({
                  name: i.name,
                  quantity: i.quantity,
                  price: i.price,
                  image: i.image,
                }),
              ),
              subtotal: order.subtotal,
              discount: order.discount,
              shipping: order.shippingCost,
              tax: order.tax,
              total: order.total,
              shippingAddress: order.shippingAddress,
              paymentMethod: order.paymentMethod,
            },
            settings,
          ).catch((err) =>
            console.error("Failed to send COD order confirmation email:", err),
          );
        }

        await notifyOrderCreatedParticipants(order).catch((err) =>
          console.error("Failed to create COD order notifications:", err),
        );
      });

      return NextResponse.json({
        success: true,
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentMethod: "cod",
          redirectUrl: `${origin}/${activeLocale}/checkout/success?order=${order.orderNumber}`,
        },
      });
    }

    if (hasPreorder && paymentDueNow <= 0) {
      const preorderLines = getOrderPreorderLines(items);
      await reservePreorderQuantity(preorderLines);
      let order: Awaited<ReturnType<typeof createOrder>>;
      try {
        order = await createOrder({
          customerId,
          items,
          shippingAddress: normalizedShippingAddress,
          billingAddress: normalizedBillingAddress,
          paymentMethod: "pay_later",
          shippingMethod: selectedShippingMethod,
          customs: customsEstimate,
          vendorShippingCosts,
          paymentStatus: PAYMENT_STATUS.PENDING,
          subtotal,
          discount,
          shippingCost,
          tax,
          total,
          coupon: appliedCoupon
            ? {
                code: appliedCoupon.code,
                type: appliedCoupon.type,
                value: appliedCoupon.value,
                couponId: appliedCoupon.couponId,
              }
            : undefined,
          isMultiVendorEnabled,
          orderPrefix: orderSettings.prefix,
        });
      } catch (err) {
        await releasePreorderQuantity(preorderLines).catch(() => undefined);
        throw err;
      }
      await markOrderPreorderReserved(String(order._id)).catch((err) =>
        console.error("Failed to mark pay-later preorder reserved:", err),
      );
      await Cart.findByIdAndUpdate(cart._id, { $set: { items: [] } });
      after(async () => {
        await notifyOrderCreatedParticipants(order).catch((err) =>
          console.error(
            "Failed to create pay-later preorder notifications:",
            err,
          ),
        );
      });
      return NextResponse.json({
        success: true,
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentMethod: "pay_later",
          redirectUrl: `${origin}/${activeLocale}/checkout/success?order=${order.orderNumber}`,
        },
      });
    }

    if (paymentMethod === "paypal") {
      if (!paypalSettings?.enabled)
        throw new ValidationError("PayPal is disabled");
      const paypalCreds = resolvePayPalCredentials(paypalSettings);
      if (!paypalCreds.clientId || !paypalCreds.clientSecret) {
        throw new ValidationError("PayPal is not configured");
      }

      const { orderId: paypalOrderId, approvalUrl } = await createPayPalOrder({
        creds: {
          clientId: paypalCreds.clientId,
          clientSecret: paypalCreds.clientSecret,
          mode: paypalCreds.mode,
        },
        currency: (settings.general?.defaultCurrency || "USD").toUpperCase(),
        total: paymentDueNow,
        returnUrl: `${origin}/${activeLocale}/checkout/success`,
        cancelUrl: `${origin}/${activeLocale}/checkout?canceled=true`,
        referenceId: String(cart._id),
      });

      const order = await createOrder({
        customerId,
        items,
        shippingAddress: normalizedShippingAddress,
        billingAddress: normalizedBillingAddress,
        paymentMethod: "paypal",
        shippingMethod: selectedShippingMethod,
        customs: customsEstimate,
        vendorShippingCosts,
        paymentStatus: PAYMENT_STATUS.PENDING,
        subtotal,
        discount,
        shippingCost,
        tax,
        total,
        coupon: appliedCoupon
          ? {
              code: appliedCoupon.code,
              type: appliedCoupon.type,
              value: appliedCoupon.value,
              couponId: appliedCoupon.couponId,
            }
          : undefined,
        paypalOrderId,
        isMultiVendorEnabled,
        orderPrefix: orderSettings.prefix,
      });

      return NextResponse.json({
        success: true,
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentMethod: "paypal",
          paypalOrderId,
          url: approvalUrl,
        },
      });
    }

    if (paymentMethod === "razorpay") {
      if (!razorpaySettings?.enabled) {
        throw new ValidationError("Razorpay is disabled");
      }

      const razorpayCreds = getRazorpayCredentials({
        keyId: razorpaySettings.keyId,
        keySecret: razorpaySettings.keySecret,
      });
      const currency = (settings.general?.defaultCurrency || "INR").toUpperCase();

      const razorpayOrder = await createRazorpayOrder({
        creds: razorpayCreds,
        amount: paymentDueNow,
        currency,
        receipt: `cart_${String(cart._id).slice(-18)}_${Date.now().toString(36)}`,
        notes: {
          cartId: String(cart._id),
          customerId,
          locale: activeLocale,
        },
      });

      const order = await createOrder({
        customerId,
        items,
        shippingAddress: normalizedShippingAddress,
        billingAddress: normalizedBillingAddress,
        paymentMethod: "razorpay",
        shippingMethod: selectedShippingMethod,
        customs: customsEstimate,
        vendorShippingCosts,
        paymentStatus: PAYMENT_STATUS.PENDING,
        subtotal,
        discount,
        shippingCost,
        tax,
        total,
        coupon: appliedCoupon
          ? {
              code: appliedCoupon.code,
              type: appliedCoupon.type,
              value: appliedCoupon.value,
              couponId: appliedCoupon.couponId,
            }
          : undefined,
        razorpayOrderId: razorpayOrder.id,
        isMultiVendorEnabled,
        orderPrefix: orderSettings.prefix,
      });

      return NextResponse.json({
        success: true,
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentMethod: "razorpay",
          keyId: razorpayCreds.keyId,
          razorpayOrderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          name: settings.general?.storeName || "Store",
          description: `Order ${order.orderNumber}`,
        },
      });
    }

    if (paymentMethod === "paystack") {
      if (!paystackSettings?.enabled) {
        throw new ValidationError("Paystack is disabled");
      }
      if (!customerEmail) {
        throw new ValidationError({
          email: ["Email is required for Paystack checkout"],
        });
      }

      const paystackCreds = getPaystackCredentials({
        publicKey: paystackSettings.publicKey,
        secretKey: paystackSettings.secretKey,
      });
      const currency = (settings.general?.defaultCurrency || "NGN").toUpperCase();
      const paystackReference = `ps-${String(cart._id)}-${Date.now().toString(36)}`;
      const callbackUrl = `${origin}/${activeLocale}/checkout/success?paystack_reference=${encodeURIComponent(paystackReference)}`;

      const transaction = await initializePaystackTransaction({
        creds: paystackCreds,
        email: customerEmail,
        amount: paymentDueNow,
        currency,
        reference: paystackReference,
        callbackUrl,
        metadata: {
          cartId: String(cart._id),
          customerId,
          locale: activeLocale,
        },
      });

      const order = await createOrder({
        customerId,
        items,
        shippingAddress: normalizedShippingAddress,
        billingAddress: normalizedBillingAddress,
        paymentMethod: "paystack",
        shippingMethod: selectedShippingMethod,
        customs: customsEstimate,
        vendorShippingCosts,
        paymentStatus: PAYMENT_STATUS.PENDING,
        subtotal,
        discount,
        shippingCost,
        tax,
        total,
        coupon: appliedCoupon
          ? {
              code: appliedCoupon.code,
              type: appliedCoupon.type,
              value: appliedCoupon.value,
              couponId: appliedCoupon.couponId,
            }
          : undefined,
        paystackReference,
        isMultiVendorEnabled,
        orderPrefix: orderSettings.prefix,
      });

      return NextResponse.json({
        success: true,
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentMethod: "paystack",
          paystackReference,
          accessCode: transaction.access_code,
          url: transaction.authorization_url,
        },
      });
    }

    if (paymentMethod !== "card") {
      throw new ValidationError("Unsupported payment method");
    }

    if (discount > 0) {
      throw new ValidationError(
        "Discounted card checkout is handled via Payment Intent flow",
      );
    }

    if (!stripeSettings?.enabled)
      throw new ValidationError("Stripe is disabled");
    const stripeSecretKey = resolveStripeCredentials(stripeSettings).secretKey;
    if (!isStripeSecretKeyConfigured(stripeSecretKey)) {
      throw new ValidationError(
        "Stripe is enabled but not configured. Please add Stripe Secret Key in Admin → Settings → Payments.",
      );
    }

    // Create Stripe line items
    const lineItems = items
      .map((item: CartItem) => {
        const lineDueNow =
          item.purchaseType === PURCHASE_TYPE.PREORDER &&
          typeof item.preorderDepositAmount === "number"
            ? item.preorderDepositAmount
            : item.price * item.quantity;
        if (lineDueNow <= 0) return null;
        return {
          price_data: {
            currency: (settings.general?.defaultCurrency || "USD").toLowerCase(),
            product_data: {
              name: item.productId.name,
              images: item.productId.images?.slice(0, 1) || [],
            },
            unit_amount: Math.round((lineDueNow / item.quantity) * 100),
          },
          quantity: item.quantity,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    // Add shipping if applicable
    if (shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: (settings.general?.defaultCurrency || "USD").toLowerCase(),
          product_data: {
            name: "Shipping",
            images: [],
          },
          unit_amount: Math.round(shippingCost * 100),
        },
        quantity: 1,
      });
    }

    // Add tax
    if (tax > 0) {
      lineItems.push({
        price_data: {
          currency: (settings.general?.defaultCurrency || "USD").toLowerCase(),
          product_data: {
            name: "Tax",
            images: [],
          },
          unit_amount: Math.round(tax * 100),
        },
        quantity: 1,
      });
    }

    // Add estimated import duties (DDP) so the charged amount matches `total`.
    if (dutyAmount > 0) {
      lineItems.push({
        price_data: {
          currency: (settings.general?.defaultCurrency || "USD").toLowerCase(),
          product_data: {
            name: "Estimated duties",
            images: [],
          },
          unit_amount: Math.round(dutyAmount * 100),
        },
        quantity: 1,
      });
    }

    // Create Stripe checkout session
    const checkoutSession = await getStripeForSecretKey(
      stripeSecretKey,
    ).checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      metadata: {
        userId: customerId,
        cartId: String(cart._id),
        shippingAddress: JSON.stringify(normalizedShippingAddress),
        billingAddress: JSON.stringify(normalizedBillingAddress),
        customerEmail: customerEmail || "",
        subtotal: String(subtotal),
        tax: String(tax),
        discount: String(discount),
        total: String(total),
        couponCode: appliedCoupon?.code || "",
        couponType: appliedCoupon?.type || "",
        couponValue: appliedCoupon ? String(appliedCoupon.value) : "",
        couponId: appliedCoupon?.couponId || "",
        ...buildShippingMetadata(shippingResolution),
      },
      customer_email: customerEmail,
      success_url: `${origin}/${activeLocale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${activeLocale}/checkout?canceled=true`,
    });

    return NextResponse.json({
      success: true,
      data: {
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Helper to create order
 */
async function createOrder(params: {
  customerId: string;
  items: CartItem[];
  shippingAddress: CheckoutShippingAddress;
  billingAddress: CheckoutShippingAddress;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  discount: number;
  shippingCost: number;
  tax: number;
  total: number;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  paypalOrderId?: string;
  razorpayOrderId?: string;
  paystackReference?: string;
  coupon?: {
    code: string;
    type: string;
    value: number;
    couponId: string;
  };
  isMultiVendorEnabled: boolean;
  orderPrefix?: string;
  shippingMethod?: {
    name?: string;
    optionId?: string;
    minDays?: number;
    maxDays?: number;
  };
  customs?: {
    dutyAmount: number;
    dutyMode?: "DDP" | "DDU";
    international?: boolean;
    collectedAtCheckout?: boolean;
  };
  vendorShippingCosts?: Map<
    string,
    {
      cost: number;
      method: { name?: string; optionId?: string; minDays?: number; maxDays?: number };
    }
  >;
}) {
  const {
    customerId,
    items,
    shippingAddress,
    billingAddress,
    paymentMethod,
    paymentStatus,
    subtotal,
    discount,
    shippingCost,
    tax,
    total,
    stripeSessionId,
    stripePaymentIntentId,
    paypalOrderId,
    razorpayOrderId,
    paystackReference,
    coupon,
    isMultiVendorEnabled,
    orderPrefix,
    shippingMethod,
    customs,
    vendorShippingCosts,
  } = params;

  // Generate order number atomically (seeds from max(existing) on first call)
  const orderNumber = await getNextOnlineOrderNumber(orderPrefix);

  const vendorContext = await resolveOrderVendorContext({
    isMultiVendorEnabled,
  });
  const vendorGroups = groupItemsByOrderVendor(
    items,
    vendorContext,
    (item) => item.productId.vendorId,
  );
  const subOrders = await buildVendorSubOrders(vendorGroups, {
    getProductId: (item) => item.productId._id,
    getVariantId: (item) => item.variantId,
    getName: (item) => item.productId.name,
    getSku: (item) => item.productId.sku,
    getQuantity: (item) => item.quantity,
    getPrice: (item) => item.price,
    getImage: (item) => item.productId.images?.[0],
    getPurchaseType: (item) => item.purchaseType || PURCHASE_TYPE.STANDARD,
    getPreorderReleaseDate: (item) => item.preorderReleaseDate,
    getPreorderMessage: (item) => item.preorderMessage,
    getPreorderStatus: (item) =>
      item.purchaseType === PURCHASE_TYPE.PREORDER
        ? PREORDER_ITEM_STATUS.RESERVED
        : undefined,
    getPreorderPaymentMode: (item) => item.preorderPaymentMode,
    getPreorderDepositAmount: (item) => item.preorderDepositAmount,
    getPreorderOutstandingAmount: (item) => item.preorderOutstandingAmount,
    getPreorderSupplierEta: (item) => item.preorderSupplierEta,
    getPreorderBatchName: (item) => item.preorderBatchName,
    getCustoms: (item) => {
      const variant = item.variantId
        ? item.productId.variants?.find(
            (candidate) =>
              candidate._id.toString() === String(item.variantId),
          )
        : undefined;
      return buildOrderItemCustomsSnapshot({
        productShipping: item.productId.shipping,
        variantShipping: variant,
      });
    },
    status: items.some((item) => item.purchaseType === PURCHASE_TYPE.PREORDER)
      ? ORDER_STATUS.PREORDERED
      : ORDER_STATUS.PENDING,
  });

  // Allocate shipping to each sub-order (per-vendor map, or the whole cost to
  // the sole sub-order for single shipments). Shared with the Stripe paths.
  allocateSubOrderShipping(
    subOrders as Array<{
      vendorId: { toString: () => string };
      shippingCost?: number;
      shippingMethod?: unknown;
    }>,
    {
      vendorShippingCosts: vendorShippingCosts ?? new Map(),
      orderShippingCost: shippingCost,
      orderShippingMethod: shippingMethod,
    },
  );

  const hasPreorder = items.some(
    (item) => item.purchaseType === PURCHASE_TYPE.PREORDER,
  );
  const preorderReleaseDate = getPreorderReleaseDateForOrder(items);
  const preorderItems = items.filter(
    (item) => item.purchaseType === PURCHASE_TYPE.PREORDER,
  );
  const preorderPaymentModes = new Set(
    preorderItems.map((item) => item.preorderPaymentMode || "full"),
  );
  const preorderPaymentMode =
    preorderPaymentModes.size === 1
      ? Array.from(preorderPaymentModes)[0]
      : hasPreorder
        ? "full"
        : undefined;
  const preorderDepositAmount = preorderItems.reduce(
    (sum, item) => sum + Number(item.preorderDepositAmount || 0),
    0,
  );
  const preorderOutstandingAmount = preorderItems.reduce(
    (sum, item) => sum + Number(item.preorderOutstandingAmount || 0),
    0,
  );

  // Create order. The coupon's usedCount is intentionally NOT incremented
  // here — that is deferred to the capture/verify path so an abandoned
  // payment doesn't burn a coupon use. The exception is COD, where the order
  // itself is the commitment and there is no separate capture step; that
  // increment happens just below.
  const order = await Order.create({
    customerId,
    orderNumber,
    items: items.map((item: CartItem) => ({
      productId: item.productId._id,
      variantId: item.variantId,
      vendorId: getOrderItemVendorId(item.productId.vendorId, vendorContext),
      name: item.productId.name,
      sku: item.productId.sku || "",
      quantity: item.quantity,
      price: item.price,
        image: item.productId.images?.[0],
        purchaseType: item.purchaseType || PURCHASE_TYPE.STANDARD,
        preorderReleaseDate: item.preorderReleaseDate,
        preorderMessage: item.preorderMessage,
        preorderStatus:
          item.purchaseType === PURCHASE_TYPE.PREORDER
            ? PREORDER_ITEM_STATUS.RESERVED
            : undefined,
        preorderPaymentMode: item.preorderPaymentMode,
        preorderDepositAmount: item.preorderDepositAmount,
        preorderOutstandingAmount: item.preorderOutstandingAmount,
        preorderSupplierEta: item.preorderSupplierEta,
        preorderBatchName: item.preorderBatchName,
        customs: buildOrderItemCustomsSnapshot({
          productShipping: item.productId.shipping,
          variantShipping: item.variantId
            ? item.productId.variants?.find(
                (candidate) =>
                  candidate._id.toString() === String(item.variantId),
              )
            : undefined,
        }),
      })),
    subOrders,
    shippingAddress,
    billingAddress,
    paymentMethod,
    paymentStatus,
    stripeSessionId,
    stripePaymentIntentId,
    paypalOrderId,
    razorpayOrderId,
    paystackReference,
    subtotal,
    shippingCost,
    shippingMethod,
    customs: customs
      ? {
          dutyAmount: customs.dutyAmount,
          dutyMode: customs.dutyMode,
          international: customs.international,
          collectedAtCheckout: customs.collectedAtCheckout,
        }
      : undefined,
    tax,
    discount,
    coupon: coupon
      ? {
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          couponId: coupon.couponId,
          usageIncremented: false,
        }
      : undefined,
    total,
    hasPreorder,
    preorderStatus: hasPreorder ? PREORDER_ITEM_STATUS.RESERVED : undefined,
    preorderReleaseDate,
    preorderAcknowledgedAt: hasPreorder ? new Date() : undefined,
    preorderPaymentMode,
    preorderDepositAmount,
    preorderOutstandingAmount,
    status: hasPreorder ? ORDER_STATUS.PREORDERED : ORDER_STATUS.PENDING,
  });

  if (coupon?.couponId && paymentMethod === "cod") {
    await applyCouponUsageForOrder(String(order._id)).catch((err) =>
      console.error("Failed to apply coupon usage for COD order:", err),
    );
  }

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: customerId,
    event: "order_placed_server",
    properties: {
      order_id: String(order._id),
      order_number: orderNumber,
      payment_method: paymentMethod,
      subtotal,
      shipping_cost: shippingCost,
      tax,
      discount,
      total,
      item_count: items.length,
      coupon_code: coupon?.code,
      has_preorder: hasPreorder,
    },
  });

  return order;
}
