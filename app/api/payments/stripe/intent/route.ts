import { z } from "zod";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Cart, Product } from "@/models";
import { getSettings } from "@/models/settings.model";
import {
  SHIPPING_UNAVAILABLE_MESSAGE,
  type ShippingSettings,
} from "@/lib/shipping";
import {
  resolveCheckoutShipping,
  buildShippingMetadata,
} from "@/lib/checkout-shipping";
import { calculateCheckoutTotals } from "@/lib/discounts";
import { getStripeForSecretKey, isStripeSecretKeyConfigured } from "@/lib/stripe";
import { resolveStripeCredentials } from "@/lib/credentials";
import { validateAndCalculateCoupon } from "@/lib/coupons";
import { validateBody } from "@/lib/api/validate";
import { PRODUCT_STATUS } from "@/config/app.config";
import { isStorefrontProductSourceAllowed } from "@/lib/product-visibility";
import {
  PURCHASE_TYPE,
  resolvePurchaseType,
  type PreorderSettingsShape,
} from "@/lib/preorders";
import {
  rateLimitByIP,
  rateLimitBySession,
  rateLimitByUser,
} from "@/lib/api/rate-limit-middleware";
import { ValidationError } from "@/lib/api/errors";
import { updateCheckoutSnapshot } from "@/lib/abandoned-checkouts";
import { assertStorefrontWriteAllowed } from "@/lib/maintenance";
import {
  DEFAULT_FREE_SHIPPING_THRESHOLD,
  DEFAULT_ORDER_SHIPPING_COST,
  DEFAULT_ORDER_TAX_RATE,
} from "@/lib/order-settings";
import {
  resolveItemShipping,
  type ProductShippingData,
} from "@/lib/product-shipping";
import { withApi } from "@/lib/api/handler";

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

const CreateStripeIntentBodySchema = z.object({
  shippingAddress: z.object({
    fullName: z.string().min(1),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    street: z.string().min(1),
    apartment: z.string().optional(),
    city: z.string().min(1),
    state: z.string().optional().default(""),
    postalCode: z.string().min(1),
    country: z.string().min(1),
    phone: z.string().optional(),
  }),
  billingAddress: z
    .object({
      fullName: z.string().min(1),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      street: z.string().min(1),
      apartment: z.string().optional(),
      city: z.string().min(1),
      state: z.string().optional().default(""),
      postalCode: z.string().min(1),
      country: z.string().min(1),
      phone: z.string().optional(),
    })
    .optional(),
  locale: z.string().optional(),
  email: z.string().email().optional(),
  couponCode: z.string().min(3).max(20).optional(),
  preorderAcknowledged: z.boolean().optional(),
  selectedShippingOptionId: z.string().max(100).optional(),
  vendorShippingSelections: z.record(z.string(), z.string().max(100)).optional(),
});

interface CartItem {
  productId: {
    _id: string;
    name: string;
    price: number;
    images?: string[];
    vendorId: string | { _id: string };
    sku?: string;
    shipping?: ProductShippingData;
  };
  variantId?: string;
  quantity: number;
  price: number;
  purchaseType?: string;
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

/**
 * POST /api/payments/stripe/intent
 * Create Stripe PaymentIntent for inline card payment
 */
export const POST = withApi(
  { auth: "optional" },
  async ({ request, session }) => {
    const cartSessionId = request.cookies?.get("cart_session")?.value;

    if (session?.user?.id) {
      rateLimitByUser(
        request,
        session.user.id,
        "payments:stripe-intent",
        "strict",
        session.user.role
      );
    } else if (cartSessionId) {
      rateLimitBySession(
        request,
        cartSessionId,
        "payments:stripe-intent",
        "strict",
      );
    } else {
      rateLimitByIP(request, "strict");
    }

    await connectDB();

    const {
      shippingAddress,
      billingAddress,
      locale,
      email,
      couponCode,
      preorderAcknowledged,
      selectedShippingOptionId,
      vendorShippingSelections,
    } = await validateBody(request, CreateStripeIntentBodySchema);
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
    const customerEmail =
      typeof email === "string" && email.trim().length > 0
        ? email.trim()
        : session?.user?.email;

    if (!session?.user?.id && !customerEmail) {
      throw new ValidationError({
        email: ["Email is required for guest checkout"],
      });
    }

    const settings = await getSettings();
    assertStorefrontWriteAllowed(settings.maintenance, settings.general?.storeName);
    const isMultiVendorEnabled = Boolean(settings.multiVendorMode?.enabled);
    const paymentSettings = settings.payment || {};
    const stripeSettings = paymentSettings.stripe;

    if (!stripeSettings?.enabled) {
      throw new ValidationError("Stripe is disabled");
    }
    const stripeSecretKey = resolveStripeCredentials(stripeSettings).secretKey;
    if (!isStripeSecretKeyConfigured(stripeSecretKey)) {
      throw new ValidationError(
        "Stripe is enabled but not configured. Please add Stripe Secret Key in Admin → Settings → Payments.",
      );
    }

    const cartQuery = session?.user?.id
      ? { userId: session.user.id }
      : cartSessionId
        ? { sessionId: cartSessionId }
        : null;

    if (!cartQuery) {
      throw new ValidationError({ cart: ["Cart is empty"] });
    }

    const cart = await Cart.findOne(cartQuery)
      .populate({
        path: "items.productId",
        select: "name price images vendorId stock sku shipping variants",
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

    const couponCartItems: Array<{
      productId: string;
      price: number;
      quantity: number;
      categoryId?: string;
    }> = [];

    // Accumulate shippable weight overall and per vendor so the shared resolver
    // can rate weight-based and per-vendor shipping (parity with checkout).
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
      if (
        product.status !== PRODUCT_STATUS.ACTIVE ||
        !isStorefrontProductSourceAllowed(
          product.productSource,
          isMultiVendorEnabled,
        )
      ) {
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
    // Same shared resolver as the online-checkout route — keeps the card path
    // in parity (weight-based, selected rate, per-vendor split, duties).
    const shippingResolution = await resolveCheckoutShipping({
      subtotal,
      totalWeight,
      vendorAgg,
      destination,
      platformShipping: settings.shipping as ShippingSettings | undefined,
      orders: { freeShippingThreshold, defaultShippingCost },
      isMultiVendorEnabled,
      selectedShippingOptionId,
      vendorShippingSelections,
    });
    if (!shippingResolution.available) {
      throw new ValidationError(SHIPPING_UNAVAILABLE_MESSAGE);
    }
    const shippingCost = shippingResolution.shippingCost;
    const dutyAmount = shippingResolution.customs.dutyAmount;
    if (couponCode) {
      appliedCoupon = await validateAndCalculateCoupon({
        code: couponCode,
        subtotal,
        shippingCost,
        cartItems: couponCartItems,
        userId: session?.user?.id,
      });
    }

    // Coupons/discounts are computed from the selected shipping cost; duties are
    // added on top of the discounted total (never discounted).
    const totals = calculateCheckoutTotals({
      subtotal,
      shippingCost,
      taxRate,
      coupon: appliedCoupon,
    });
    const discount = totals.discount;
    const tax = totals.tax;
    const total = totals.total + dutyAmount;

    const activeLocale =
      typeof locale === "string" && locale.length > 0 ? locale : "en";
    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const stripe = getStripeForSecretKey(stripeSecretKey);
    const currency = (settings.general?.defaultCurrency || "USD").toLowerCase();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency,
      payment_method_types: ["card"],
      receipt_email: customerEmail,
      metadata: {
        userId: customerId,
        cartId: String(cart._id),
        customerEmail: customerEmail || "",
        locale: activeLocale,
        shippingAddress: JSON.stringify(
          normalizedShippingAddress as CheckoutShippingAddress,
        ),
        billingAddress: JSON.stringify(
          normalizedBillingAddress as CheckoutShippingAddress,
        ),
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
    });

    if (!paymentIntent.client_secret) {
      return NextResponse.json(
        { success: false, message: "Failed to create payment intent" },
        { status: 500 },
      );
    }

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
        gateway: "card",
        subtotalPrice: subtotal,
        shippingPrice: shippingCost,
        totalTax: tax,
        totalDiscounts: discount,
        totalPrice: total,
        presentmentCurrency: currency,
        paymentEvent: {
          gateway: "card",
          status: "created",
          paymentId: paymentIntent.id,
          message: "Stripe PaymentIntent created",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
      },
    });
  },
);
