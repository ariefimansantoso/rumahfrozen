import mongoose from "mongoose";

/**
 * Database Reset Script
 * Drops all collections to start fresh
 */

async function resetDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI;
  const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;

  if (!MONGODB_URI) {
    console.error("❌ Missing MONGODB_URI in environment.");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      ...(MONGODB_DB_NAME ? { dbName: MONGODB_DB_NAME } : {}),
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log("✓ Connected to MongoDB");

    const db = mongoose.connection.db;
    if (!db) {
      console.error("❌ Database connection not available");
      process.exit(1);
    }

    console.log("\n🗑️  Starting database reset...\n");

    const COLLECTIONS = [
      "user",
      "users",
      "account",
      "accounts",
      "session",
      "sessions",
      "verification",
      "verifications",
      "twofactor",
      "twofactors",
      "customerprofiles",
      "customer-profiles",
      "adminprofiles",
      "admin-profiles",
      "staffprofiles",
      "staff-profiles",
      "vendors",
      "categories",
      "products",
      "collections",
      "carts",
      "abandonedcheckouts",
      "abandoned-checkouts",
      "orders",
      "reviews",
      "wishlists",
      "coupons",
      "inventorylocations",
      "inventory-locations",
      "transfers",
      "paymenttransactions",
      "payment-transactions",
      "payouts",
      "blogposts",
      "blogcategories",
      "blogcomments",
      "menus",
      "notifications",
      "pushsubscriptions",
      "settings",
      "loginattempts",
      "login-attempts",
      "passwordresets",
      "password-resets",
      "audit_logs",
      "auditlogs",
      "aisalesconversations",
      "ai-sales-conversations",
      "counters",
    ];

    let totalDropped = 0;

    for (const collectionName of COLLECTIONS) {
      try {
        const result = await db.collection(collectionName).deleteMany({});
        if (result.deletedCount > 0) {
          console.log(
            `   ✓ Cleared ${collectionName} (${result.deletedCount} documents)`,
          );
          totalDropped += result.deletedCount;
        }
      } catch (error) {
        // Collection doesn't exist; safe to skip silently
      }
    }

    console.log("\n✅ Database reset completed successfully!\n");
    console.log(`Total documents dropped: ${totalDropped}\n`);
  } catch (error) {
    console.error("\n❌ Database reset failed:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("✓ Disconnected from MongoDB");
  }
}

resetDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
