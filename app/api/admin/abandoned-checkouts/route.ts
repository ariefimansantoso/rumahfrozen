import { AbandonedCheckout, Cart } from "@/models";
import { paginatedResponse } from "@/lib/api/response";
import { getCheckoutSubtotal } from "@/lib/abandoned-checkouts";
import { withApi } from "@/lib/api/handler";

const SORT_FIELDS = new Set([
  "abandonedAt",
  "updatedAt",
  "checkoutStartedAt",
  "totalPrice",
  "recoveryEmailStatus",
  "recoveryStatus",
]);

export const GET = withApi(
  { auth: "admin" },
  async ({ request }) => {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10)),
    );
    const skip = (page - 1) * limit;
    const search = searchParams.get("search")?.trim();
    const view = searchParams.get("view") || "all";
    const emailStatus = searchParams.get("emailStatus") || "all";
    const sortBy = SORT_FIELDS.has(searchParams.get("sortBy") || "")
      ? searchParams.get("sortBy") || "abandonedAt"
      : "abandonedAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;

    const snapshotQuery: Record<string, unknown> = {
      status: { $in: ["open", "recovered"] },
      checkoutStartedAt: { $exists: true },
      abandonedAt: { $exists: true },
      "items.0": { $exists: true },
    };

    if (view === "open") {
      snapshotQuery.recoveryStatus = { $ne: "recovered" };
    } else if (view === "recovered") {
      snapshotQuery.recoveryStatus = "recovered";
    }

    if (emailStatus !== "all") {
      snapshotQuery.recoveryEmailStatus = emailStatus;
    }

    const cartQuery: Record<string, unknown> = {
      status: { $in: ["abandoned", "recovered"] },
      "items.0": { $exists: true },
      $or: [
        { checkoutStartedAt: { $exists: true } },
        { abandonedAt: { $exists: true } },
      ],
    };
    if (view === "open") {
      cartQuery.recoveryStatus = { $ne: "recovered" };
    } else if (view === "recovered") {
      cartQuery.recoveryStatus = "recovered";
    }
    if (emailStatus !== "all") {
      cartQuery.recoveryEmailStatus = emailStatus;
    }

    const [snapshotDocs, cartDocs] = await Promise.all([
      AbandonedCheckout.find(snapshotQuery)
        .sort({ [sortBy]: sortOrder, updatedAt: -1 })
        .lean(),
      Cart.find(cartQuery).sort({ abandonedAt: -1, updatedAt: -1 }).lean(),
    ]);

    const seen = new Set<string>();
    const rows = [
      ...snapshotDocs.map((checkout) => {
        const key = String(checkout.checkoutToken || checkout.cartId || checkout._id);
        seen.add(key);
        return {
          ...checkout,
          _id: String(checkout._id),
          subtotalPrice: checkout.subtotalPrice ?? 0,
          totalPrice: checkout.totalPrice ?? checkout.subtotalPrice ?? 0,
          itemCount: getItemCount(checkout.items),
        };
      }),
      ...cartDocs
        .filter((cart) => {
          const key = String(cart.checkoutToken || cart._id);
          return !seen.has(key);
        })
        .map((cart) => ({
          ...cart,
          _id: String(cart._id),
          cartId: String(cart._id),
          status: cart.recoveryStatus === "recovered" ? "recovered" : "open",
          recoveryStatus: cart.recoveryStatus || "not_recovered",
          recoveryEmailStatus: cart.recoveryEmailStatus || "not_sent",
          abandonedAt: cart.abandonedAt || cart.updatedAt,
          checkoutStartedAt: cart.checkoutStartedAt || cart.createdAt,
          subtotalPrice: cart.subtotalPrice ?? getCheckoutSubtotal(cart),
          totalPrice:
            cart.totalPrice ?? cart.subtotalPrice ?? getCheckoutSubtotal(cart),
          itemCount: getItemCount(cart.items),
        })),
    ]
      .filter((row) => {
        if (!search) return true;
        const needle = search.toLowerCase();
        return [
          row.email,
          row.phone,
          row.customerName,
          ...(row.items || []).map((item: { name?: string }) => item.name),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      })
      .sort((a, b) => compareRows(a, b, sortBy, sortOrder));

    const total = rows.length;
    const pageRows = rows.slice(skip, skip + limit);

    return paginatedResponse(pageRows, page, limit, total);
  },
);

function getItemCount(items?: Array<{ quantity?: number }>) {
  return (items || []).reduce(
    (sum: number, item: { quantity?: number }) => sum + Number(item.quantity || 0),
    0,
  );
}

function compareRows(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  sortBy: string,
  sortOrder: 1 | -1,
) {
  const av = a[sortBy];
  const bv = b[sortBy];

  if (sortBy.endsWith("At") || av instanceof Date || bv instanceof Date) {
    return (
      (new Date(String(av || 0)).getTime() -
        new Date(String(bv || 0)).getTime()) *
      sortOrder
    );
  }

  if (typeof av === "number" || typeof bv === "number") {
    return (Number(av || 0) - Number(bv || 0)) * sortOrder;
  }

  return String(av || "").localeCompare(String(bv || "")) * sortOrder;
}
