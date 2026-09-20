import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Cart, Product } from "@/models";
import {
  successResponse,
  createdResponse,
  notFoundResponse,
} from "@/lib/api/response";
import { ValidationError, handleApiError } from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { rateLimitByIP, rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import { validateBody } from "@/lib/api/validate";
import { CartAddItemSchema, CartUpdateItemSchema } from "@/lib/validations";
import { PRODUCT_STATUS } from "@/config/app.config";
import {
  isStorefrontMultiVendorEnabled,
  isStorefrontProductSourceAllowed,
} from "@/lib/product-visibility";

// Cart item type for type annotations
interface CartItem {
  productId: { toString: () => string };
  variantId?: { toString: () => string };
  quantity: number;
  price: number;
  name: string;
  image: string;
}

type StoredCartItem = CartItem & Record<string, unknown>;

type LeanVariant = {
  _id: { toString: () => string };
  name: string;
  price: number;
  stock: number;
  image?: string;
  mediaId?: string;
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
};

async function filterAvailableCartItems(
  items: StoredCartItem[],
): Promise<StoredCartItem[]> {
  if (!items.length) return items;

  const isMultiVendorEnabled = await isStorefrontMultiVendorEnabled();
  const productIds = Array.from(
    new Set(
      items
        .map((item) => item.productId?.toString())
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const products = await Product.find({ _id: { $in: productIds } })
    .select("status productSource")
    .lean<Array<{ _id: { toString: () => string }; status?: string; productSource?: unknown }>>();
  const visibleProductIds = new Set(
    products
      .filter(
        (product) =>
          product.status === PRODUCT_STATUS.ACTIVE &&
          isStorefrontProductSourceAllowed(
            product.productSource,
            isMultiVendorEnabled,
          ),
      )
      .map((product) => product._id.toString()),
  );

  return items.filter((item) => visibleProductIds.has(item.productId.toString()));
}

/**
 * GET /api/cart
 * Get current user's cart
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // Get session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const userId = session?.user?.id;
    const sessionId = request.cookies.get("cart_session")?.value;

    if (userId) {
      rateLimitByUser(
        request,
        userId,
        "cart:get",
        "lenient",
        session?.user?.role
      );
    } else {
      rateLimitByIP(request, "lenient");
    }

    if (!userId && !sessionId) {
      return successResponse({ items: [], totalItems: 0, subtotal: 0 });
    }

    const query = userId ? { userId } : { sessionId };
    const cart = await Cart.findOne(query).lean();

    if (!cart) {
      return successResponse({ items: [], totalItems: 0, subtotal: 0 });
    }

    const visibleItems = await filterAvailableCartItems(
      cart.items as StoredCartItem[],
    );
    if (visibleItems.length !== cart.items.length) {
      await Cart.updateOne(query, { $set: { items: visibleItems } });
    }

    // Calculate totals
    const totalItems = visibleItems.reduce(
      (sum: number, item: { quantity: number }) => sum + item.quantity,
      0
    );
    const subtotal = visibleItems.reduce(
      (sum: number, item: { price: number; quantity: number }) =>
        sum + item.price * item.quantity,
      0
    );

    return successResponse({
      ...cart,
      items: visibleItems,
      totalItems,
      subtotal,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/cart
 * Add item to cart
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // Get session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const userId = session?.user?.id;
    let sessionId = request.cookies.get("cart_session")?.value;

    if (userId) {
      rateLimitByUser(
        request,
        userId,
        "cart:add",
        "moderate",
        session?.user?.role
      );
    } else {
      rateLimitByIP(request, "moderate");
    }

    const { productId, quantity, variantId } =
      await validateBody(request, CartAddItemSchema);

    // Generate session ID for guest users
    if (!userId && !sessionId) {
      sessionId = crypto.randomUUID();
    }

    const isMultiVendorEnabled = await isStorefrontMultiVendorEnabled();
    const product = await Product.findById(productId).lean<LeanProduct>();
    if (!product) {
      return notFoundResponse("Product");
    }
    if (
      product.status !== PRODUCT_STATUS.ACTIVE ||
      !isStorefrontProductSourceAllowed(
        product.productSource,
        isMultiVendorEnabled,
      )
    ) {
      throw new ValidationError("Product is not available");
    }

    const selectedVariant = variantId
      ? product.variants?.find((v) => v._id.toString() === variantId)
      : undefined;

    if (variantId && !selectedVariant) {
      return notFoundResponse("Variant");
    }

    const availableStock = selectedVariant ? selectedVariant.stock : product.stock;
    if (availableStock <= 0 || quantity > availableStock) {
      throw new ValidationError("Insufficient stock");
    }

    const price = selectedVariant ? selectedVariant.price : product.price;
    const name = product.name;
    const variantName = selectedVariant?.name;
    const image =
      selectedVariant?.image ||
      (selectedVariant?.mediaId
        ? product.media?.find((m) => m._id === selectedVariant.mediaId)?.url
        : undefined) ||
      product.images?.[0] ||
      product.media?.[0]?.url ||
      "";

    const query = userId ? { userId } : { sessionId };

    // Find or create cart
    let cart = await Cart.findOne(query);

    if (!cart) {
      cart = new Cart({
        userId: userId || undefined,
        sessionId: userId ? undefined : sessionId,
        items: [],
      });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      (item: CartItem) =>
        item.productId.toString() === productId &&
        (variantId ? item.variantId?.toString() === variantId : !item.variantId)
    );

    if (existingItemIndex > -1) {
      // Update quantity
      const nextQuantity = cart.items[existingItemIndex].quantity + quantity;
      if (nextQuantity > availableStock) {
        throw new ValidationError("Insufficient stock");
      }
      cart.items[existingItemIndex].quantity = nextQuantity;
      cart.items[existingItemIndex].price = price;
      cart.items[existingItemIndex].name = name;
      cart.items[existingItemIndex].variantName = variantName;
      cart.items[existingItemIndex].image = image;
    } else {
      // Add new item
      cart.items.push({
        productId,
        variantId,
        quantity,
        price,
        name,
        variantName,
        image,
      });
    }

    cart.lastActionAt = new Date();
    cart.status = "active";
    await cart.save();

    // Return response with cookie for guest users
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
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/cart
 * Update cart item quantity
 */
export async function PUT(request: NextRequest) {
  try {
    await connectDB();

    // Get session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const userId = session?.user?.id;
    const sessionId = request.cookies.get("cart_session")?.value;

    if (userId) {
      rateLimitByUser(
        request,
        userId,
        "cart:update",
        "moderate",
        session?.user?.role
      );
    } else {
      rateLimitByIP(request, "moderate");
    }

    const { productId, quantity, variantId } = await validateBody(
      request,
      CartUpdateItemSchema,
    );

    if (!userId && !sessionId) {
      return notFoundResponse("Cart");
    }

    const query = userId ? { userId } : { sessionId };
    const cart = await Cart.findOne(query);

    if (!cart) {
      return notFoundResponse("Cart");
    }

    // Find item
    const itemIndex = cart.items.findIndex(
      (item: CartItem) =>
        item.productId.toString() === productId &&
        (!variantId || item.variantId?.toString() === variantId)
    );

    if (itemIndex === -1) {
      return notFoundResponse("Item not found in cart");
    }

    if (quantity <= 0) {
      // Remove item
      cart.items.splice(itemIndex, 1);
    } else {
      // Update quantity
      cart.items[itemIndex].quantity = quantity;
    }

    cart.lastActionAt = new Date();
    cart.status = "active";
    await cart.save();

    return successResponse(cart);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/cart
 * Clear cart or remove specific item
 */
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get("productId");
    const variantId = searchParams.get("variantId");
    const clearAll = searchParams.get("clearAll") === "true";
    const shouldClearAll = clearAll || !productId;

    // Get session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const userId = session?.user?.id;
    const sessionId = request.cookies.get("cart_session")?.value;

    if (userId) {
      rateLimitByUser(
        request,
        userId,
        "cart:delete",
        "moderate",
        session?.user?.role
      );
    } else {
      rateLimitByIP(request, "moderate");
    }

    if (!userId && !sessionId) {
      return notFoundResponse("Cart");
    }

    const query = userId ? { userId } : { sessionId };

    if (shouldClearAll) {
      await Cart.deleteOne(query);
      return successResponse({ message: "Cart cleared" });
    }

    const cart = await Cart.findOne(query);

    if (!cart) {
      return notFoundResponse("Cart");
    }

    // Remove specific item
    cart.items = cart.items.filter(
      (item: CartItem) =>
        !(
          item.productId.toString() === productId &&
          (!variantId || item.variantId?.toString() === variantId)
        )
    );

    await cart.save();

    return successResponse(cart);
  } catch (error) {
    return handleApiError(error);
  }
}
