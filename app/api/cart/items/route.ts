import { Cart, Product } from "@/models";
import { createdResponse, notFoundResponse } from "@/lib/api/response";
import { ValidationError } from "@/lib/api/errors";
import {
  rateLimitBySession,
  rateLimitByUser,
} from "@/lib/api/rate-limit-middleware";
import { validateBody } from "@/lib/api/validate";
import { CartAddByIdSchema } from "@/lib/validations";
import {
  isStorefrontMultiVendorEnabled,
  isStorefrontProductSourceAllowed,
} from "@/lib/product-visibility";
import {
  calculatePreorderDeposit,
  getPreorderSettings,
  PURCHASE_TYPE,
  resolvePurchaseType,
  type PreorderSettingsShape,
} from "@/lib/preorders";
import { withApi } from "@/lib/api/handler";

type LeanVariant = {
  _id: { toString: () => string };
  name: string;
  price: number;
  stock: number;
  image?: string;
  mediaId?: string;
  preorder?: PreorderSettingsShape;
};

type LeanProduct = {
  name: string;
  price: number;
  stock: number;
  status?: string;
  productSource?: unknown;
  images?: string[];
  media?: { _id: string; url: string }[];
  variants?: LeanVariant[];
  preorder?: PreorderSettingsShape;
};

export const POST = withApi(
  { auth: "optional" },
  async ({ request, session }) => {
    const userId = session?.user?.id;
    let sessionId = request.cookies.get("cart_session")?.value;

    if (userId) {
      rateLimitByUser(
        request,
        userId,
        "cart:addItem",
        "moderate",
        session?.user?.role
      );
    } else if (sessionId) {
      rateLimitBySession(request, sessionId, "cart:addItem", "moderate");
    } else {
      // Create a guest session id before rate limiting to avoid shared
      // "ip:unknown" buckets in local/proxied environments.
      sessionId = crypto.randomUUID();
      rateLimitBySession(request, sessionId, "cart:addItem", "moderate");
    }

    const { productId, variantId, quantity } = await validateBody(
      request,
      CartAddByIdSchema,
    );
    const isMultiVendorEnabled = await isStorefrontMultiVendorEnabled();

    const product = await Product.findById(productId).lean<LeanProduct>();
    if (!product) {
      return notFoundResponse("Product");
    }
    if (
      product.status !== "active" ||
      !isStorefrontProductSourceAllowed(
        product.productSource,
        isMultiVendorEnabled,
      )
    ) {
      throw new ValidationError("Product is not available");
    }

    const selectedVariant = variantId
      ? product.variants?.find((v: LeanVariant) => v._id.toString() === variantId)
      : undefined;

    if (variantId && !selectedVariant) {
      return notFoundResponse("Variant");
    }

    const purchase = resolvePurchaseType({
      product,
      variantId,
      requestedQuantity: quantity,
    });
    if (!purchase) {
      throw new ValidationError("Insufficient stock");
    }

    const price = selectedVariant ? selectedVariant.price : product.price;
    const name = product.name;
    const variantName = selectedVariant?.name;
    const image =
      (selectedVariant && selectedVariant.image) ||
      (selectedVariant?.mediaId
        ? product.media?.find((m) => m._id === selectedVariant.mediaId)?.url
        : undefined) ||
      product.images?.[0] ||
      product.media?.[0]?.url ||
      "";

    const query = userId ? { userId } : { sessionId };

    let cart = await Cart.findOne(query);
    if (!cart) {
      cart = new Cart({
        userId: userId || undefined,
        sessionId: userId ? undefined : sessionId,
        items: [],
      });
    }

    const requestedPurchaseType = purchase.purchaseType;
    const mixedItem = cart.items.find(
      (item: { purchaseType?: string }) =>
        (item.purchaseType || PURCHASE_TYPE.STANDARD) !== requestedPurchaseType,
    );
    if (mixedItem) {
      throw new ValidationError(
        requestedPurchaseType === PURCHASE_TYPE.PREORDER
          ? "Pre-order items must be checked out separately from regular items"
          : "Regular items must be checked out separately from pre-order items",
      );
    }

    const existingItemIndex = cart.items.findIndex(
      (item: { productId: { toString: () => string }; variantId?: { toString: () => string } }) =>
        item.productId.toString() === productId &&
        (variantId ? item.variantId?.toString() === variantId : !item.variantId)
    );

    if (existingItemIndex > -1) {
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      const nextPurchase = resolvePurchaseType({
        product,
        variantId,
        requestedQuantity: newQuantity,
      });
      if (!nextPurchase || nextPurchase.purchaseType !== requestedPurchaseType) {
        throw new ValidationError("Insufficient stock");
      }
      const preorderTerms =
        nextPurchase.purchaseType === PURCHASE_TYPE.PREORDER
          ? calculatePreorderDeposit({
              unitPrice: price,
              quantity: newQuantity,
              settings: getPreorderSettings(product, variantId),
            })
          : undefined;
      cart.items[existingItemIndex].quantity = newQuantity;
      cart.items[existingItemIndex].price = price;
      cart.items[existingItemIndex].name = name;
      cart.items[existingItemIndex].variantName = variantName;
      cart.items[existingItemIndex].image = image;
      cart.items[existingItemIndex].purchaseType = requestedPurchaseType;
      cart.items[existingItemIndex].preorderReleaseDate =
        "preorderReleaseDate" in nextPurchase
          ? nextPurchase.preorderReleaseDate
          : undefined;
      cart.items[existingItemIndex].preorderMessage =
        "preorderMessage" in nextPurchase
          ? nextPurchase.preorderMessage
          : undefined;
      cart.items[existingItemIndex].preorderPaymentMode =
        preorderTerms?.paymentMode;
      cart.items[existingItemIndex].preorderDepositAmount =
        preorderTerms?.depositAmount;
      cart.items[existingItemIndex].preorderOutstandingAmount =
        preorderTerms?.outstandingAmount;
      cart.items[existingItemIndex].preorderSupplierEta =
        "preorderSupplierEta" in nextPurchase
          ? nextPurchase.preorderSupplierEta
          : undefined;
      cart.items[existingItemIndex].preorderBatchName =
        "preorderBatchName" in nextPurchase
          ? nextPurchase.preorderBatchName
          : undefined;
    } else {
      const preorderTerms =
        purchase.purchaseType === PURCHASE_TYPE.PREORDER
          ? calculatePreorderDeposit({
              unitPrice: price,
              quantity,
              settings: getPreorderSettings(product, variantId),
            })
          : undefined;
      cart.items.push({
        productId,
        variantId: variantId || undefined,
        quantity,
        price,
        name,
        variantName,
        image,
        purchaseType: requestedPurchaseType,
        preorderReleaseDate:
          "preorderReleaseDate" in purchase
            ? purchase.preorderReleaseDate
            : undefined,
        preorderMessage:
          "preorderMessage" in purchase ? purchase.preorderMessage : undefined,
        preorderPaymentMode: preorderTerms?.paymentMode,
        preorderDepositAmount: preorderTerms?.depositAmount,
        preorderOutstandingAmount: preorderTerms?.outstandingAmount,
        preorderSupplierEta:
          "preorderSupplierEta" in purchase ? purchase.preorderSupplierEta : undefined,
        preorderBatchName:
          "preorderBatchName" in purchase ? purchase.preorderBatchName : undefined,
      });
    }

    await cart.save();

    const response = createdResponse(cart);
    if (!userId && sessionId) {
      response.headers.set(
        "Set-Cookie",
        `cart_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
          60 * 60 * 24 * 30
        }`
      );
    }

    return response;
  },
);
