import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { connectDB } from "@/lib/db";
import { auth } from "@/lib/auth";
import { USER_ROLES } from "@/config/app.config";
import { InventoryLocation } from "@/models/inventory-location.model";
import { getDemoModeMutationResponse } from "@/lib/demo-mode";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Restrict access to privileged (non-customer) users. Mirrors the guard on the
 * collection route so inventory locations cannot be read or mutated by
 * anonymous or customer accounts.
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

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const authResult = await requirePrivilegedSession();
    if (!authResult.ok) return authResult.response;

    await connectDB();
    const { id } = await params;

    const location = await InventoryLocation.findById(id).lean();

    if (!location) {
      return NextResponse.json(
        { success: false, message: "Location not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: location,
    });
  } catch (error) {
    console.error("Failed to fetch location:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch location" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const authResult = await requirePrivilegedSession();
    if (!authResult.ok) return authResult.response;
    const demoBlock = getDemoModeMutationResponse();
    if (demoBlock) return demoBlock;

    await connectDB();
    const { id } = await params;
    const body = await request.json();

    const { name, address, isDefault, isActive } = body;

    // Find existing location
    const existing = await InventoryLocation.findById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Location not found" },
        { status: 404 }
      );
    }

    // Validate name if provided
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { success: false, message: "Location name cannot be empty" },
          { status: 400 }
        );
      }
      existing.name = name.trim();
    }

    // Update address if provided
    if (address !== undefined) {
      existing.address = address?.trim() || "";
    }

    // Update isActive if provided
    if (isActive !== undefined) {
      existing.isActive = Boolean(isActive);
    }

    // Handle isDefault change
    if (isDefault !== undefined) {
      if (isDefault) {
        // Setting this as default - clear other defaults
        await InventoryLocation.updateMany(
          { _id: { $ne: id } },
          { isDefault: false }
        );
        existing.isDefault = true;
      } else {
        // Prevent unsetting default if it's the only one
        const defaultCount = await InventoryLocation.countDocuments({
          isDefault: true,
        });
        if (defaultCount <= 1 && existing.isDefault) {
          return NextResponse.json(
            {
              success: false,
              message: "Cannot unset the only default location",
            },
            { status: 400 }
          );
        }
        existing.isDefault = false;
      }
    }

    await existing.save();

    return NextResponse.json({
      success: true,
      data: existing.toObject(),
      message: "Location updated successfully",
    });
  } catch (error) {
    console.error("Failed to update location:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update location" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const authResult = await requirePrivilegedSession();
    if (!authResult.ok) return authResult.response;
    const demoBlock = getDemoModeMutationResponse();
    if (demoBlock) return demoBlock;

    await connectDB();
    const { id } = await params;

    const location = await InventoryLocation.findById(id);

    if (!location) {
      return NextResponse.json(
        { success: false, message: "Location not found" },
        { status: 404 }
      );
    }

    // Prevent deleting the default location
    if (location.isDefault) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Cannot delete the default location. Set another location as default first.",
        },
        { status: 400 }
      );
    }

    await InventoryLocation.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: "Location deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete location:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete location" },
      { status: 500 }
    );
  }
}
