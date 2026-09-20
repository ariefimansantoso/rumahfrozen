import mongoose from "mongoose";

/**
 * Product/Review index migration
 * ================================
 *
 * Brings existing databases in line with the index set defined in
 * models/product.model.ts and models/review.model.ts after the storefront
 * query-shape audit.
 *
 * What it does:
 *   1. Ensures the new status-led compound indexes (and the review compound)
 *      exist. This is idempotent and defensive — the running app normally
 *      creates them via Mongoose autoIndex, but we re-assert them so the drop
 *      step below is always safe.
 *   2. Drops the now-redundant single-field indexes, but ONLY after verifying
 *      the index that supersedes each one is present. Nothing is dropped blind.
 *
 * Drop set (verified safe by the audit):
 *   products: status_1, featured_1, price_1
 *     - each was only ever queried alongside a status-led predicate, so the
 *       { status, ... } compounds cover them.
 *     - createdAt_1 is intentionally KEPT: the admin product list sorts by
 *       createdAt with no status filter, which the compounds cannot serve.
 *   reviews: productId_1
 *     - a productId-only lookup is served by the prefix of
 *       { productId, isApproved, createdAt } and of the unique
 *       { productId, userId, orderId } index.
 *
 * Deployment ordering matters: run this AFTER deploying the code that removes
 * these indexes from the schemas. If it runs while an older build (whose schema
 * still defines them) is live, autoIndex will simply recreate them.
 *
 * Usage:
 *   node --env-file=.env scripts/migrate-product-review-indexes.mjs            (apply)
 *   node --env-file=.env scripts/migrate-product-review-indexes.mjs --dry-run  (report only)
 */

const DRY_RUN = process.argv.includes("--dry-run");

// Compound indexes that must exist before we drop anything they supersede.
// Names match Mongoose's default naming so they coincide with the
// schema-managed indexes (no duplicates are created).
const ENSURE = {
  products: [
    { name: "status_1_createdAt_-1", key: { status: 1, createdAt: -1 } },
    {
      name: "status_1_featured_1_createdAt_-1",
      key: { status: 1, featured: 1, createdAt: -1 },
    },
    { name: "status_1_price_1", key: { status: 1, price: 1 } },
    {
      name: "status_1_rating_-1_reviewCount_-1",
      key: { status: 1, rating: -1, reviewCount: -1 },
    },
    {
      name: "status_1_category_1_createdAt_-1",
      key: { status: 1, category: 1, createdAt: -1 },
    },
  ],
  reviews: [
    {
      name: "productId_1_isApproved_1_createdAt_-1",
      key: { productId: 1, isApproved: 1, createdAt: -1 },
    },
  ],
};

// Stale indexes to drop, each gated on the superseding index being present.
const DROP = {
  products: [
    { name: "status_1", requires: ["status_1_createdAt_-1"] },
    { name: "featured_1", requires: ["status_1_featured_1_createdAt_-1"] },
    { name: "price_1", requires: ["status_1_price_1"] },
  ],
  reviews: [
    {
      name: "productId_1",
      // Either superseding index is sufficient; require at least the new one.
      requires: ["productId_1_isApproved_1_createdAt_-1"],
    },
  ],
};

async function listIndexNames(collection) {
  try {
    const indexes = await collection.indexes();
    return new Set(indexes.map((index) => index.name));
  } catch {
    // Collection does not exist yet (fresh install) — nothing to migrate.
    return null;
  }
}

async function migrateCollection(db, collectionName) {
  const collection = db.collection(collectionName);
  const existing = await listIndexNames(collection);

  if (existing === null) {
    console.log(`   • ${collectionName}: collection not found, skipping`);
    return;
  }

  // 1. Ensure compound indexes.
  for (const { name, key } of ENSURE[collectionName] || []) {
    if (existing.has(name)) {
      console.log(`   ✓ ${collectionName}.${name} already present`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`   [dry-run] would create ${collectionName}.${name}`);
      continue;
    }
    await collection.createIndex(key, { name });
    existing.add(name);
    console.log(`   + created ${collectionName}.${name}`);
  }

  // 2. Drop redundant single-field indexes (guarded).
  for (const { name, requires } of DROP[collectionName] || []) {
    if (!existing.has(name)) {
      console.log(`   • ${collectionName}.${name} not present, nothing to drop`);
      continue;
    }

    const missing = requires.filter((req) => !existing.has(req));
    // In dry-run the ensure step above didn't actually create anything, so a
    // requirement may legitimately be "missing" only because it wasn't created
    // yet — surface that rather than treating it as unsafe.
    if (missing.length > 0 && !DRY_RUN) {
      console.warn(
        `   ! SKIP drop ${collectionName}.${name}: superseding index missing (${missing.join(", ")})`,
      );
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `   [dry-run] would drop ${collectionName}.${name} (superseded by ${requires.join(", ")})`,
      );
      continue;
    }

    await collection.dropIndex(name);
    existing.delete(name);
    console.log(`   - dropped ${collectionName}.${name}`);
  }
}

async function run() {
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

    console.log(
      `\n📇 Product/Review index migration${DRY_RUN ? " (DRY RUN)" : ""}...\n`,
    );

    for (const collectionName of ["products", "reviews"]) {
      console.log(`-- ${collectionName} --`);
      await migrateCollection(db, collectionName);
    }

    console.log(
      `\n✅ Index migration ${DRY_RUN ? "dry-run complete (no changes made)" : "completed"}.\n`,
    );
  } catch (error) {
    console.error("\n❌ Index migration failed:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("✓ Disconnected from MongoDB");
  }
}

run()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
