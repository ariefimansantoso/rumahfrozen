import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { StaffPermission } from "@/config/permissions.config";
import { assertAdminOrStaffPermissions } from "@/lib/staff-authz";

export async function requireAdminOrStaffPageAccess(options: {
  locale: string;
  required?: StaffPermission[];
  mode?: "any" | "all";
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`/${options.locale}/login`);

  try {
    const { staffPermissions, staffScope } = await assertAdminOrStaffPermissions(
      session as unknown as { user: { id: string; role: string } },
      options.required,
      options.mode || "any",
    );
    return { session, staffPermissions, staffScope };
  } catch {
    redirect(`/${options.locale}/forbidden`);
  }
}
