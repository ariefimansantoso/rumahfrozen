import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Order } from "@/models";
import { connectDB } from "@/lib/db";
import { OrderHeader } from "@/components/admin/order-details/order-header";
import { OrderItems } from "@/components/admin/order-details/order-items";
import { OrderCustomer } from "@/components/admin/order-details/order-customer";
import { OrderTimeline } from "@/components/admin/order-details/order-timeline";
import { requireStaffAreaAccess } from "@/lib/staff-area-guard";
import { STAFF_PERMISSIONS } from "@/config/permissions.config";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

async function getOrder(id: string) {
  await connectDB();
  const order = await Order.findById(id)
    .populate("customerId", "name email phone image")
    .lean();

  if (!order) return null;
  return JSON.parse(JSON.stringify(order));
}

export default async function StaffOrderDetailsPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const access = await requireStaffAreaAccess({
    locale,
    required: [STAFF_PERMISSIONS.VIEW_ORDERS],
  });
  const readOnly = !(
    access.staffPermissions.includes(STAFF_PERMISSIONS.MANAGE_ORDERS) ||
    access.staffPermissions.includes(STAFF_PERMISSIONS.EDIT_ORDERS) ||
    access.staffPermissions.includes(STAFF_PERMISSIONS.DELETE_ORDERS)
  );

  const order = await getOrder(id);
  if (!order) notFound();

  return (
    <div className="space-y-6">
      <OrderHeader order={order} locale={locale} readOnly={readOnly} />
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
