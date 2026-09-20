import { z } from "zod";
import { ObjectId } from "mongodb";
import { mongoose } from "@/lib/db";
import { successResponse } from "@/lib/api/response";
import { ValidationError } from "@/lib/api/errors";
import { validateBody } from "@/lib/api/validate";
import { AddressSchema } from "@/lib/validations";
import { withApi } from "@/lib/api/handler";

const AddAddressBodySchema = z.object({
  address: AddressSchema,
});

const UpdateAddressBodySchema = z.object({
  index: z.coerce.number().int().min(0),
  address: AddressSchema,
});

const DeleteAddressBodySchema = z.object({
  index: z.coerce.number().int().min(0),
});

/**
 * GET /api/user/addresses
 * Get user's addresses
 */
export const GET = withApi(
  { auth: "user" },
  async ({ session }) => {
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database not connected");

    const user = await db
      .collection("user")
      .findOne({ _id: new ObjectId(session.user.id) });

    return successResponse({ addresses: user?.addresses || [] });
  },
);

/**
 * POST /api/user/addresses
 * Add new address
 */
export const POST = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database not connected");

    const { address } = await validateBody(request, AddAddressBodySchema);

    const user = await db.collection("user").findOne(
      { _id: new ObjectId(session.user.id) },
      { projection: { addresses: 1 } },
    );

    const currentAddresses = Array.isArray((user as any)?.addresses)
      ? ((user as any).addresses as any[])
      : [];

    const normalizedAddress = {
      ...address,
      label: address.label || "home",
      isDefault: Boolean(address.isDefault),
    };

    const addresses =
      currentAddresses.length === 0
        ? [{ ...normalizedAddress, isDefault: true }]
        : normalizedAddress.isDefault
          ? [
              ...currentAddresses.map((a) => ({ ...a, isDefault: false })),
              normalizedAddress,
            ]
          : [...currentAddresses, { ...normalizedAddress, isDefault: false }];

    await db
      .collection("user")
      .updateOne(
        { _id: new ObjectId(session.user.id) },
        { $set: { addresses } },
      );

    return successResponse({ addresses }, "Address added successfully");
  },
);

/**
 * PUT /api/user/addresses
 * Update existing address
 */
export const PUT = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database not connected");

    const { index, address } = await validateBody(request, UpdateAddressBodySchema);

    const user = await db.collection("user").findOne(
      { _id: new ObjectId(session.user.id) },
      { projection: { addresses: 1 } },
    );

    const addresses = Array.isArray((user as any)?.addresses)
      ? (((user as any).addresses as any[]).map((a) => ({ ...a })) as any[])
      : [];

    if (!addresses[index]) {
      throw new ValidationError({ index: ["Invalid address index"] });
    }

    const existing = addresses[index];
    const updated = {
      ...existing,
      ...address,
      label: address.label || existing.label || "home",
    };

    addresses[index] = updated;

    if (updated.isDefault) {
      for (let i = 0; i < addresses.length; i++) {
        addresses[i] = { ...addresses[i], isDefault: i === index };
      }
    }

    if (!addresses.some((a) => a.isDefault) && addresses.length > 0) {
      addresses[0] = { ...addresses[0], isDefault: true };
    }

    await db
      .collection("user")
      .updateOne(
        { _id: new ObjectId(session.user.id) },
        { $set: { addresses } },
      );

    return successResponse({ addresses }, "Address updated successfully");
  },
);

/**
 * DELETE /api/user/addresses
 * Delete address by index
 */
export const DELETE = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database not connected");

    const { index } = await validateBody(request, DeleteAddressBodySchema);

    // Get current addresses
    const user = await db
      .collection("user")
      .findOne({ _id: new ObjectId(session.user.id) });

    if (!user?.addresses) {
      return successResponse({ addresses: [] }, "No addresses to delete");
    }

    if (!user.addresses[index]) {
      throw new ValidationError({ index: ["Invalid address index"] });
    }

    const removedWasDefault = Boolean(user.addresses[index]?.isDefault);

    const updatedAddresses = user.addresses.filter((_: unknown, i: number) => i !== index);

    if (
      removedWasDefault &&
      updatedAddresses.length > 0 &&
      !updatedAddresses.some((a: any) => a?.isDefault)
    ) {
      updatedAddresses[0] = { ...updatedAddresses[0], isDefault: true };
    }

    await db
      .collection("user")
      .updateOne(
        { _id: new ObjectId(session.user.id) },
        { $set: { addresses: updatedAddresses } },
      );

    return successResponse(
      { addresses: updatedAddresses },
      "Address deleted successfully",
    );
  },
);
