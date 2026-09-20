import { ObjectId } from "mongodb";
import type { UserRole } from "@/config/app.config";
import { connectDB, mongoose } from "@/lib/db";

export async function setUserRole(userId: string, role: UserRole) {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database not connected");

  const _id = new ObjectId(userId);

  const result = await db.collection("user").updateOne(
    { _id },
    {
      $set: {
        role,
        roles: [role],
        emailVerificationAudience: role === "vendor" ? "vendor" : "customer",
        updatedAt: new Date(),
      },
    },
  );

  if (result.matchedCount === 0) {
    throw new Error("User not found");
  }
}

