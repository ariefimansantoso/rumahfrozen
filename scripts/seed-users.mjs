import mongoose from "mongoose";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { twoFactor } from "better-auth/plugins";
import {
  ADMIN_PERMISSIONS,
  STAFF_PERMISSIONS,
  VENDOR_PERMISSIONS,
} from "@/config/permissions.config.js";
import { VENDOR_STATUS } from "@/config/app.config.js";
import { LOCAL_ASSET_PATHS } from "@/lib/media";

const ROLES = {
  ADMIN: "admin",
  VENDOR: "vendor",
  CUSTOMER: "customer",
  SELLER: "seller",
};

const USER_SEED = {
  admin: {
    name: "Storify Admin",
    email: "admin@storify.com",
    password: "Admin@123",
    phone: "+1 555-0100",
  },
  vendor: {
    name: "Storify Vendor",
    email: "vendor@storify.com",
    password: "Vendor@123",
    phone: "+1 555-0200",
  },
  staff: {
    name: "Storify Staff",
    email: "staff@storify.com",
    password: "Staff@123",
    phone: "+1 555-0300",
  },
  customer: {
    name: "Storify Customer",
    email: "customer@storify.com",
    password: "Customer@123",
    phone: "+1 555-0400",
  },
};

function inferDbNameFromMongoUri(uri) {
  const withoutQuery = (uri.split("?")[0] ?? uri).trim();
  const slashIndex = withoutQuery.lastIndexOf("/");
  if (slashIndex === -1) return undefined;
  const candidate = withoutQuery.slice(slashIndex + 1);
  if (!candidate) return undefined;
  return candidate;
}

function createBetterAuthInstance(db, client) {
  const baseURL =
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  return betterAuth({
    baseURL,
    database: mongodbAdapter(db, {
      client,
      transaction: false,
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "customer",
          input: false,
        },
        roles: {
          type: "string[]",
          required: false,
          defaultValue: ["customer"],
          input: false,
        },
        status: {
          type: "string",
          required: false,
          defaultValue: "active",
          input: false,
        },
        phone: {
          type: "string",
          required: false,
          input: true,
        },
        twoFactorEnabled: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
        emailVerifiedAt: {
          type: "date",
          required: false,
          input: false,
        },
      },
    },
    plugins: [twoFactor()],
    account: {
      storeStateStrategy: "cookie",
    },
    trustedOrigins: [baseURL],
  });
}

function withOptionalSession(query, session) {
  return session ? query.session(session) : query;
}

function sessionOptions(session, extra = {}) {
  return session ? { ...extra, session } : extra;
}

async function withTransaction(callback) {
  try {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    if (error?.code === 20 || error?.codeName === "IllegalOperation") {
      console.warn(
        "Transactions not supported here, continuing with standard operations.",
      );
      return callback(null);
    }
    throw error;
  }
}

async function upsertCredentialAccount(
  auth,
  db,
  userId,
  passwordHash,
  session,
) {
  const ctx = await auth.$context;
  const filter = { userId, providerId: "credential" };
  const account = await db
    .collection("account")
    .findOne(filter, sessionOptions(session, { projection: { _id: 1 } }));

  if (account?._id) {
    await db.collection("account").updateOne(
      { _id: account._id },
      {
        $set: {
          password: passwordHash,
          updatedAt: new Date(),
        },
      },
      sessionOptions(session),
    );
  } else {
    await ctx.internalAdapter.linkAccount({
      userId: userId.toString(),
      providerId: "credential",
      accountId: userId.toString(),
      password: passwordHash,
      ...(session ? { session } : {}),
    });
  }

  await db
    .collection("session")
    .deleteMany({ userId }, sessionOptions(session));
}

async function upsertUser(User, auth, db, data, session) {
  const ctx = await auth.$context;
  const passwordHash = await ctx.password.hash(data.password);
  const now = new Date();
  const userPayload = {
    name: data.name,
    email: data.email,
    password: passwordHash,
    role: data.role,
    roles: [data.role],
    emailVerified: true,
    emailVerifiedAt: now,
    status: "active",
    phone: data.phone,
    ...(data.addresses ? { addresses: data.addresses } : {}),
  };

  const existingUser = await withOptionalSession(
    User.findOne({ email: data.email }),
    session,
  );

  if (existingUser) {
    await User.updateOne(
      { _id: existingUser._id },
      { $set: userPayload },
      sessionOptions(session),
    );
    await upsertCredentialAccount(
      auth,
      db,
      existingUser._id,
      passwordHash,
      session,
    );
    return withOptionalSession(User.findById(existingUser._id), session);
  }

  const users = await User.create([userPayload], sessionOptions(session));
  await upsertCredentialAccount(auth, db, users[0]._id, passwordHash, session);
  return users[0];
}

async function ensureAdmin(User, AdminProfile, auth, db) {
  return withTransaction(async (session) => {
    const admin = await upsertUser(
      User,
      auth,
      db,
      {
        ...USER_SEED.admin,
        role: ROLES.ADMIN,
      },
      session,
    );

    const existingProfile = await withOptionalSession(
      AdminProfile.findOne({ userId: admin._id }),
      session,
    );

    if (existingProfile) {
      await AdminProfile.updateOne(
        { _id: existingProfile._id },
        {
          $set: {
            isSuperAdmin: true,
            permissions: Object.values(ADMIN_PERMISSIONS),
            department: "Operations",
          },
        },
        sessionOptions(session),
      );
    } else {
      await AdminProfile.create(
        [
          {
            userId: admin._id,
            isSuperAdmin: true,
            permissions: Object.values(ADMIN_PERMISSIONS),
            department: "Operations",
          },
        ],
        sessionOptions(session),
      );
    }

    console.log(`   ✓ Admin ready: ${USER_SEED.admin.email}`);
    return admin;
  });
}

async function ensureVendor(User, Vendor, auth, db) {
  return withTransaction(async (session) => {
    const vendorUser = await upsertUser(
      User,
      auth,
      db,
      {
        ...USER_SEED.vendor,
        role: ROLES.VENDOR,
      },
      session,
    );

    const vendorPayload = {
      userId: vendorUser._id,
      isDefault: true,
      storeName: "Storify Vendor Store",
      slug: "storify-vendor-store",
      description: "Default vendor account seeded for quick login and testing.",
      logo: LOCAL_ASSET_PATHS.placeholders.vendor,
      banner: LOCAL_ASSET_PATHS.placeholders.vendor,
      status: VENDOR_STATUS.APPROVED,
      commission: 10,
      rating: 5,
      totalSales: 0,
      permissions: Object.values(VENDOR_PERMISSIONS),
      bankDetails: {
        accountName: USER_SEED.vendor.name,
        accountNumber: "XXXX-XXXX-1001",
        bankName: "Storify Demo Bank",
        routingNumber: "123456789",
        swiftCode: "STRYUS01",
      },
      address: {
        street: "123 Vendor Lane",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "USA",
        phone: USER_SEED.vendor.phone,
      },
      socialLinks: {
        website: "https://storify.com",
      },
      notificationPreferences: {
        newOrders: true,
        orderUpdates: true,
        lowStock: true,
        marketing: false,
      },
      payoutSettings: {
        schedule: "weekly",
        minimumAmount: 50,
      },
    };

    const existingVendor = await withOptionalSession(
      Vendor.findOne({ userId: vendorUser._id }),
      session,
    );

    if (existingVendor) {
      await Vendor.updateOne(
        { _id: existingVendor._id },
        { $set: vendorPayload },
        sessionOptions(session),
      );
    } else {
      await Vendor.create([vendorPayload], sessionOptions(session));
    }

    console.log(`   ✓ Vendor ready: ${USER_SEED.vendor.email}`);
    return vendorUser;
  });
}

async function ensureStaff(User, StaffProfile, auth, db, adminUserId) {
  return withTransaction(async (session) => {
    const staffUser = await upsertUser(
      User,
      auth,
      db,
      {
        ...USER_SEED.staff,
        role: ROLES.SELLER,
      },
      session,
    );

    const profilePayload = {
      userId: staffUser._id,
      assignedBy: adminUserId,
      permissions: Object.values(STAFF_PERMISSIONS),
      department: "Sales Floor",
      notes: "Default staff account seeded for POS and store operations.",
      isActive: true,
    };

    const existingProfile = await withOptionalSession(
      StaffProfile.findOne({ userId: staffUser._id }),
      session,
    );

    if (existingProfile) {
      await StaffProfile.updateOne(
        { _id: existingProfile._id },
        { $set: profilePayload },
        sessionOptions(session),
      );
    } else {
      await StaffProfile.create([profilePayload], sessionOptions(session));
    }

    console.log(`   ✓ Staff ready: ${USER_SEED.staff.email}`);
    return staffUser;
  });
}

async function ensureCustomer(User, CustomerProfile, auth, db) {
  return withTransaction(async (session) => {
    const customerUser = await upsertUser(
      User,
      auth,
      db,
      {
        ...USER_SEED.customer,
        role: ROLES.CUSTOMER,
        addresses: [
          {
            firstName: "Storify",
            lastName: "Customer",
            street: "100 Customer Ave",
            city: "New York",
            state: "NY",
            postalCode: "10001",
            country: "USA",
            phone: USER_SEED.customer.phone,
            isDefault: true,
            label: "home",
          },
        ],
      },
      session,
    );

    const profilePayload = {
      userId: customerUser._id,
      loyaltyPoints: 100,
      lifetimePoints: 100,
      loyaltyTier: "bronze",
      marketingOptIn: true,
      emailNotifications: {
        orderUpdates: true,
        promotions: true,
        newsletter: false,
        priceDrops: false,
        backInStock: false,
      },
      stats: {
        totalOrders: 0,
        totalSpent: 0,
        averageOrderValue: 0,
        totalReviews: 0,
        totalWishlistItems: 0,
      },
      tags: ["users-only-seed"],
      acquisitionSource: "seed-users",
      lastActiveAt: new Date(),
    };

    const existingProfile = await withOptionalSession(
      CustomerProfile.findOne({ userId: customerUser._id }),
      session,
    );

    if (existingProfile) {
      await CustomerProfile.updateOne(
        { _id: existingProfile._id },
        { $set: profilePayload },
        sessionOptions(session),
      );
    } else {
      await CustomerProfile.create([profilePayload], sessionOptions(session));
    }

    console.log(`   ✓ Customer ready: ${USER_SEED.customer.email}`);
    return customerUser;
  });
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("Missing MONGODB_URI in environment.");
    process.exit(1);
  }

  const dbName =
    process.env.MONGODB_DB_NAME || inferDbNameFromMongoUri(mongoUri);
  if (!dbName) {
    console.error(
      "Missing database name. Set MONGODB_DB_NAME, or include it in MONGODB_URI.",
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, {
      dbName,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log("✓ Connected to MongoDB");

    await import("@/models");

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("MongoDB connection not available.");
    }

    const auth = createBetterAuthInstance(db, mongoose.connection.getClient());
    const { User, AdminProfile, Vendor, StaffProfile, CustomerProfile } =
      mongoose.models;

    console.log("\n👤 Seeding users-only accounts...\n");

    const admin = await ensureAdmin(User, AdminProfile, auth, db);
    await ensureVendor(User, Vendor, auth, db);
    await ensureStaff(User, StaffProfile, auth, db, admin._id);
    await ensureCustomer(User, CustomerProfile, auth, db);

    console.log("\n✅ Users-only seed completed successfully!\n");
    console.log("=".repeat(60));
    console.log("Users-only credentials");
    console.log("=".repeat(60));
    console.log(
      `Admin:    ${USER_SEED.admin.email} / ${USER_SEED.admin.password}`,
    );
    console.log(
      `Vendor:   ${USER_SEED.vendor.email} / ${USER_SEED.vendor.password}`,
    );
    console.log(
      `Staff:    ${USER_SEED.staff.email} / ${USER_SEED.staff.password}`,
    );
    console.log(
      `Customer: ${USER_SEED.customer.email} / ${USER_SEED.customer.password}`,
    );
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ Users-only seed failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("✓ Disconnected from MongoDB");
  }
}

main();
