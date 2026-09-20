import { Order } from "@/models";
import { connectDB } from "@/lib/db";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";
import { requireAdminOrStaffPageAccess } from "@/lib/staff-page-guard";
import { OrderItems } from "@/components/admin/order-details/order-items";
import { OrderHeader } from "@/components/admin/order-details/order-header";
import { OrderCustomer } from "@/components/admin/order-details/order-customer";
import { OrderTimeline } from "@/components/admin/order-details/order-timeline";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

async function getOrder(id: string) {
  await connectDB();
  const order = await Order.findById(id)
    .populate("customerId", "name email phone image")
    .lean();
  
  if (!order) return null;
  
  // Serialize Mongo IDs
  return JSON.parse(JSON.stringify(order));
}

export default async function OrderDetailsPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const access = await requireAdminOrStaffPageAccess({
    locale,
    required: [STAFF_PERMISSIONS.VIEW_ORDERS],
  });
  const canEditOrder =
    !access?.staffPermissions ||
    access.staffPermissions.includes(STAFF_PERMISSIONS.EDIT_ORDERS) ||
    access.staffPermissions.includes(STAFF_PERMISSIONS.MANAGE_ORDERS);
  const canRefund =
    !access?.staffPermissions;

  const order = await getOrder(id);

  if (!order) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <OrderHeader
        order={order}
        locale={locale}
        readOnly={!canEditOrder}
        canRefund={canRefund}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <OrderItems order={order} />
          <OrderTimeline orderId={order._id} />
        </div>
        
        <div className="lg:col-span-1">
          <OrderCustomer order={order} />
        </div>
      </div>
    </div>
  );
}
