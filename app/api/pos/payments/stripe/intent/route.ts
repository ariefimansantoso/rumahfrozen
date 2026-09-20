import { z } from "zod";
import { withApi } from "@/lib/api/handler";
import { validateBody } from "@/lib/api/validate";
import { successResponse } from "@/lib/api/response";
import { AuthorizationError, ValidationError } from "@/lib/api/errors";
import { Product, getSettings } from "@/models";
import { USER_ROLES } from "@/config/app.config";
import { isStaffRole } from "@/lib/staff-role";
import { canAccessPOS } from "@/lib/rbac";
import { requireApprovedVendorByUserId } from "@/lib/vendor-guard";
import { getStripeForSecretKey, isStripeSecretKeyConfigured } from "@/lib/stripe";
import { resolveStripeCredentials } from "@/lib/credentials";
import { getEnabledPOSPaymentMethods } from "@/lib/pos/payment";
import { calculatePOSOrderTotals } from "@/lib/pos/order-totals";

const POSOrderItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  name: z.string().min(1),
  sku: z.string().optional().default(""),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  image: z.string().optional(),
  vendorId: z.string().min(1),
  lineTotal: z.number().optional(),
  lineDiscount: z
    .object({
      type: z.enum(["percent", "amount"]),
      value: z.number().nonnegative(),
      amount: z.number().nonnegative().optional(),
    })
    .optional(),
  lineNote: z.string().optional(),
});

const POSStripeIntentBodySchema = z.object({
  items: z.array(POSOrderItemSchema).min(1),
  customerId: z.string().optional(),
  posLocationId: z.string().optional(),
  discount: z
    .object({
      type: z.enum(["percent", "amount"]),
      value: z.number().nonnegative(),
      amount: z.number().nonnegative(),
      reason: z.string().optional(),
      note: z.string().optional(),
    })
    .optional(),
});

export const POST = withApi(
  {
    auth: "user",
    rateLimit: { action: "pos:stripe-intent", preset: "strict" },
  },
  async ({ request, session }) => {
    const role = session.user.role;
    if (
      role !== USER_ROLES.ADMIN &&
      role !== USER_ROLES.VENDOR &&
      !isStaffRole(role)
    ) {
      throw new AuthorizationError();
    }

    const settings = await getSettings();
    if (!(await canAccessPOS(session.user))) {
      throw new AuthorizationError();
    }

    const body = await validateBody(request, POSStripeIntentBodySchema);
    let items = body.items;

    if (!getEnabledPOSPaymentMethods(settings.pos?.checkout?.paymentMethods).includes("card")) {
      throw new ValidationError("Card payment is not enabled for POS");
    }

    if (role === USER_ROLES.VENDOR) {
      const vendor = await requireApprovedVendorByUserId(session.user.id);
      const vendorId = vendor._id.toString();
      const productIds = Array.from(
        new Set(items.map((item) => item.productId).filter(Boolean)),
      );
      const ownedProducts = await Product.find({
        _id: { $in: productIds },
        vendorId: vendor._id,
      })
        .select("_id")
        .lean();

      if (ownedProducts.length !== productIds.length) {
        throw new AuthorizationError("Vendors can only sell their own products");
      }

      items = items.map((item) => ({ ...item, vendorId }));
    }

    const stripeSettings = settings.payment?.stripe;
    if (!stripeSettings?.enabled) {
      throw new ValidationError("Stripe is disabled");
    }
    const stripeCredentials = resolveStripeCredentials(stripeSettings);
    if (!isStripeSecretKeyConfigured(stripeCredentials.secretKey)) {
      throw new ValidationError("Stripe is not configured");
    }

    const { total, subtotal, tax, totalDiscount } = calculatePOSOrderTotals({
      items,
      discount: body.discount,
      taxRate: settings.orders?.taxRate ?? 0,
    });
    if (total <= 0) {
      throw new ValidationError("Order total must be greater than zero");
    }

    const currency = (settings.general?.defaultCurrency || "USD").toLowerCase();
    const paymentIntent = await getStripeForSecretKey(
      stripeCredentials.secretKey,
    ).paymentIntents.create({
      amount: Math.round(total * 100),
      currency,
      payment_method_types: ["card"],
      metadata: {
        channel: "pos",
        staffId: session.user.id,
        customerId: body.customerId || "",
        posLocationId: body.posLocationId || "",
        subtotal: String(subtotal),
        tax: String(tax),
        discount: String(totalDiscount),
        total: String(total),
      },
    });

    if (!paymentIntent.client_secret) {
      throw new ValidationError("Failed to initialize Stripe payment");
    }

    return successResponse({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
    });
  },
);
