import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { connectDB } from "@/lib/db";
import { auth } from "@/lib/auth";
import { USER_ROLES } from "@/config/app.config";
import { InventoryLocation } from "@/models/inventory-location.model";
import { getDemoModeMutationResponse } from "@/lib/demo-mode";

/**
 * Restrict access to privileged (non-customer) users. Admin, staff, and vendor
 * dashboards (product form, POS, transfers, settings) all read/write inventory
 * locations, so any signed-in non-customer is allowed — but anonymous and
 * customer accounts are not. Returns ok, or a NextResponse to return on failure.
 */
async function requirePrivilegedSession(): Promise<
  | { ok: true }
  | { ok: false; response: NextResponse }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 },
      ),
    };
  }
  const roles = session.user.roles ?? [session.user.role];
  const isPrivileged = roles.some(
    (role) => role && role !== USER_ROLES.CUSTOMER,
  );
  if (!isPrivileged) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "You do not have permission to manage locations" },
        { status: 403 },
      ),
    };
  }
  return { ok: true };
}

export async function GET(request: Request) {
  try {
    const authResult = await requirePrivilegedSession();
    if (!authResult.ok) return authResult.response;

    await connectDB();

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const filter = includeInactive ? {} : { isActive: true };
    const locations = await InventoryLocation.find(filter)
      .sort({ isDefault: -1, name: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: locations,
    });
  } catch (error) {
    console.error("Failed to fetch locations:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch locations" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requirePrivilegedSession();
    if (!authResult.ok) return authResult.response;
    const demoBlock = getDemoModeMutationResponse();
    if (demoBlock) return demoBlock;

    await connectDB();

    const body = await request.json();
    const { name, address, isDefault } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: "Location name is required" },
        { status: 400 }
      );
    }

    const location = await InventoryLocation.create({
      name: name.trim(),
      address: address?.trim() || "",
      isDefault: Boolean(isDefault),
      isActive: true,
    });

    return NextResponse.json(
      {
        success: true,
        data: location.toObject(),
        message: "Location created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create location:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create location" },
      { status: 500 }
    );
  }
}
