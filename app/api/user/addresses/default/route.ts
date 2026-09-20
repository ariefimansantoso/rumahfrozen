import { mongoose } from "@/lib/db";
import { ObjectId } from "mongodb";
import { successResponse } from "@/lib/api/response";
import { ValidationError } from "@/lib/api/errors";
import { z } from "zod";
import { validateBody } from "@/lib/api/validate";
import { withApi } from "@/lib/api/handler";

const SetDefaultAddressBodySchema = z.object({
  index: z.coerce.number().int().min(0),
});

/**
 * PUT /api/user/addresses/default
 * Set default address
 */
export const PUT = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database not connected");

    const { index } = await validateBody(request, SetDefaultAddressBodySchema);

    // Get current addresses
    const user = await db
      .collection("user")
      .findOne({ _id: new ObjectId(session.user.id) });

    if (!user?.addresses) {
      return successResponse({ addresses: [] }, "No addresses found");
    }

    if (!user.addresses[index]) {
      throw new ValidationError({ index: ["Invalid address index"] });
    }

    // Update all addresses, setting only the selected one as default
    const updatedAddresses = user.addresses.map(
      (addr: { isDefault?: boolean }, i: number) => ({
        ...addr,
        isDefault: i === index,
      }),
    );

    await db
      .collection("user")
      .updateOne(
        { _id: new ObjectId(session.user.id) },
        { $set: { addresses: updatedAddresses } },
      );

    return successResponse(
      { addresses: updatedAddresses },
      "Default address updated",
    );
  },
);
