import path from "path";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { randomBytes, randomUUID } from "crypto";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import {
  ADMIN_PERMISSIONS,
  VENDOR_PERMISSIONS,
  STAFF_PERMISSIONS,
} from "@/config/permissions.config.js";
import {
  ORDER_STATUS,
  PRODUCT_STATUS,
  VENDOR_STATUS,
} from "@/config/app.config.js";
import { LOCAL_ASSET_PATHS } from "@/lib/media";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Demo credentials for default seeded accounts.
 * Update emails/passwords here to change demo login defaults.
 */
const DEMO_CREDENTIALS = {
  admin: {
    name: "Admin User",
    email: "naziullah.wp@gmail.com",
    password: "Nsacno2565&",
  },
  vendor: {
    name: "Tech Gadgets Store",
    email: "neurolightstudio@gmail.com",
    password: "Neurolight123&",
  },
  customer: {
    name: "John Customer",
    email: "naziullahshawn135@gmail.com",
    password: "Nsacno2565&",
  },
  staff: {
    name: "Staff User",
    email: "naziullah.shawn@gmail.com",
    password: "Nsacno2565&",
  },
};

const ROLES = {
  ADMIN: "admin",
  VENDOR: "vendor",
  CUSTOMER: "customer",
  SELLER: "seller",
};

/**
 * Generate a SKU from product title.
 * Mirrors lib/utils.ts generateSku() so seeded products line up with runtime-created ones.
 */
function generateSku(title) {
  const cleaned = title.trim().replace(/[^a-zA-Z0-9\s]/g, "");
  const words = cleaned.split(/\s+/).filter(Boolean);
  let base;
  if (words.length >= 2) {
    base = words
      .slice(0, 5)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  } else if (words.length === 1) {
    base = words[0].substring(0, 3).toUpperCase();
  } else {
    base = "PRD";
  }
  const suffix = Math.random().toString(16).substring(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
      transaction: true,
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

/**
 * Execute a function within a MongoDB transaction if available
 * Falls back to regular execution if replica set is not available
 * Prevents race conditions during user/vendor creation in production
 */
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
      session.endSession();
    }
  } catch (error) {
    // If transactions not supported (standalone MongoDB), fall back to regular execution
    if (error.code === 20 || error.codeName === "IllegalOperation") {
      console.warn(
        "⚠️  Transactions not supported (requires replica set), using standard operations",
      );
      return await callback(null);
    }
    throw error;
  }
}

/**
 * Drops all known application collections so a `--reset` run starts from a clean slate.
 * Includes auth-related collections (Better Auth) and counters used for order numbering.
 */
async function clearDatabase() {
  console.log("🗑️  Clearing database...");
  const db = mongoose.connection.db;
  if (!db) {
    console.error("Database connection not available");
    return;
  }

  const COLLECTIONS = [
    // Users & auth
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
    // Profiles
    "customerprofiles",
    "customer-profiles",
    "adminprofiles",
    "admin-profiles",
    "staffprofiles",
    "staff-profiles",
    // Catalog
    "vendors",
    "categories",
    "products",
    "collections",
    // Commerce
    "carts",
    "abandonedcheckouts",
    "abandoned-checkouts",
    "orders",
    "reviews",
    "wishlists",
    "coupons",
    // Inventory
    "inventorylocations",
    "inventory-locations",
    "transfers",
    // Finance
    "paymenttransactions",
    "payment-transactions",
    "payouts",
    // CMS
    "blogposts",
    "blogcategories",
    "blogcomments",
    "menus",
    // Misc
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

  for (const collectionName of COLLECTIONS) {
    try {
      const result = await db.collection(collectionName).deleteMany({});
      if (result.deletedCount > 0) {
        console.log(`   ✓ Cleared ${collectionName} (${result.deletedCount})`);
      }
    } catch (error) {
      // Collection doesn't exist; safe to skip silently
    }
  }
}

/**
 * Create the demo admin user, link credentials, and ensure a SuperAdmin profile exists.
 * Uses transactions to prevent race conditions
 */
async function createAdmin(User, AdminProfile, auth) {
  const { name, email, password } = DEMO_CREDENTIALS.admin;

  return await withTransaction(async (session) => {
    const existingAdmin = await User.findOne({ email }).session(session);
    if (existingAdmin) {
      const existingProfile = await AdminProfile.findOne({
        userId: existingAdmin._id,
      }).session(session);
      if (!existingProfile) {
        await AdminProfile.create(
          [
            {
              userId: existingAdmin._id,
              isSuperAdmin: true,
              permissions: Object.values(ADMIN_PERMISSIONS),
              department: "Operations",
            },
          ],
          { session },
        );
      }
      console.log(`   ✓ Admin already exists: ${email}`);
      return existingAdmin;
    }

    const ctx = await auth.$context;
    const passwordHash = await ctx.password.hash(password);

    const admin = await User.create(
      [
        {
          name,
          email,
          password: passwordHash,
          role: ROLES.ADMIN,
          roles: [ROLES.ADMIN],
          emailVerified: true,
          emailVerifiedAt: new Date(),
          status: "active",
          phone: "+1 555-0100",
        },
      ],
      { session },
    );

    await AdminProfile.create(
      [
        {
          userId: admin[0]._id,
          isSuperAdmin: true,
          permissions: Object.values(ADMIN_PERMISSIONS),
          department: "Operations",
        },
      ],
      { session },
    );

    await ctx.internalAdapter.createAccount({
      userId: admin[0]._id.toString(),
      providerId: "credential",
      accountId: admin[0]._id.toString(),
      password: passwordHash,
      session,
    });

    console.log(`   ✓ Created admin: ${email} / ${password}`);
    return admin[0];
  });
}

/**
 * Create demo vendors with linked Vendor profiles. The first vendor is marked
 * isDefault so it acts as the single-vendor-mode store owner.
 * Uses transactions to prevent race conditions
 */
async function createVendors(User, Vendor, auth) {
  const vendorsData = [
    {
      name: DEMO_CREDENTIALS.vendor.name,
      email: DEMO_CREDENTIALS.vendor.email,
      password: DEMO_CREDENTIALS.vendor.password,
      storeName: "Tech Gadgets",
      slug: "tech-gadgets",
      description:
        "Premium tech gadgets and accessories — phones, watches, cameras, and chargers.",
      isDefault: true,
      logo: LOCAL_ASSET_PATHS.placeholders.vendor,
      banner: LOCAL_ASSET_PATHS.placeholders.vendor,
      socialLinks: {
        website: "https://techgadgets.example.com",
        instagram: "https://instagram.com/techgadgets",
      },
    },
    {
      name: "Fashion Hub",
      email: "vendor2@example.com",
      password: "vendor123",
      storeName: "Fashion Hub",
      slug: "fashion-hub",
      description: "Latest trends in fashion and apparel for every season.",
      isDefault: false,
      logo: LOCAL_ASSET_PATHS.placeholders.vendor,
      banner: LOCAL_ASSET_PATHS.placeholders.vendor,
      socialLinks: {
        instagram: "https://instagram.com/fashionhub",
      },
    },
    {
      name: "Home Essentials",
      email: "vendor3@example.com",
      password: "vendor123",
      storeName: "Home Essentials",
      slug: "home-essentials",
      description: "Everything you need for a beautiful, functional home.",
      isDefault: false,
      logo: LOCAL_ASSET_PATHS.placeholders.vendor,
    },
  ];

  const vendors = [];
  for (const data of vendorsData) {
    const vendor = await withTransaction(async (session) => {
      const existingUser = await User.findOne({ email: data.email }).session(
        session,
      );
      if (existingUser) {
        const existingVendor = await Vendor.findOne({
          userId: existingUser._id,
        }).session(session);
        if (existingVendor) {
          console.log(`   ✓ Vendor already exists: ${data.email}`);
          return existingVendor;
        }
      }

      const ctx = await auth.$context;
      const passwordHash = await ctx.password.hash(data.password);

      const user = await User.create(
        [
          {
            name: data.name,
            email: data.email,
            password: passwordHash,
            role: ROLES.VENDOR,
            roles: [ROLES.VENDOR],
            emailVerified: true,
            emailVerifiedAt: new Date(),
            status: "active",
          },
        ],
        { session },
      );

      const vendor = await Vendor.create(
        [
          {
            userId: user[0]._id,
            isDefault: data.isDefault,
            storeName: data.storeName,
            slug: data.slug,
            description: data.description,
            logo: data.logo,
            banner: data.banner,
            status: VENDOR_STATUS.APPROVED,
            commission: 10,
            rating: 4 + Math.random(),
            totalSales: randomBetween(50, 500),
            permissions: Object.values(VENDOR_PERMISSIONS),
            bankDetails: {
              accountName: data.name,
              accountNumber: "XXXX-XXXX-" + randomBetween(1000, 9999),
              bankName: "Demo Bank",
              routingNumber: String(randomBetween(100000000, 999999999)),
              swiftCode: "DEMOUS33",
            },
            address: {
              street: "123 Vendor Lane",
              city: "New York",
              state: "NY",
              postalCode: "10001",
              country: "USA",
              phone: "+1 555-0123",
            },
            socialLinks: data.socialLinks || {},
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
          },
        ],
        { session },
      );

      await ctx.internalAdapter.createAccount({
        userId: user[0]._id.toString(),
        providerId: "credential",
        accountId: user[0]._id.toString(),
        password: passwordHash,
        session,
      });

      console.log(`   ✓ Created vendor: ${data.email} / ${data.password}`);
      return vendor[0];
    });
    vendors.push(vendor);
  }

  return vendors;
}

/**
 * Create demo customers and seed CustomerProfile with cached stats and tier data.
 * Uses transactions to prevent race conditions
 */
async function createCustomers(User, CustomerProfile, auth) {
  const customersData = [
    {
      name: DEMO_CREDENTIALS.customer.name,
      email: DEMO_CREDENTIALS.customer.email,
      password: DEMO_CREDENTIALS.customer.password,
      tier: "gold",
    },
    {
      name: "Jane Shopper",
      email: "customer2@example.com",
      password: "customer123",
      tier: "silver",
    },
    {
      name: "Bob Buyer",
      email: "customer3@example.com",
      password: "customer123",
      tier: "bronze",
    },
  ];

  const customers = [];
  for (const data of customersData) {
    const customer = await withTransaction(async (session) => {
      const existingCustomer = await User.findOne({
        email: data.email,
      }).session(session);
      if (existingCustomer) {
        const existingProfile = await CustomerProfile.findOne({
          userId: existingCustomer._id,
        }).session(session);
        if (!existingProfile) {
          await CustomerProfile.create(
            [
              {
                userId: existingCustomer._id,
                loyaltyPoints: randomBetween(100, 1000),
                lifetimePoints: randomBetween(500, 5000),
                loyaltyTier: data.tier,
                marketingOptIn: true,
              },
            ],
            { session },
          );
        }
        console.log(`   ✓ Customer already exists: ${data.email}`);
        return existingCustomer;
      }

      const ctx = await auth.$context;
      const passwordHash = await ctx.password.hash(data.password);

      const user = await User.create(
        [
          {
            name: data.name,
            email: data.email,
            password: passwordHash,
            role: ROLES.CUSTOMER,
            roles: [ROLES.CUSTOMER],
            emailVerified: true,
            emailVerifiedAt: new Date(),
            status: "active",
            phone: `+1 555-${randomBetween(1000, 9999)}`,
            addresses: [
              {
                firstName: data.name.split(" ")[0],
                lastName: data.name.split(" ").slice(1).join(" "),
                street: `${randomBetween(100, 999)} Customer Ave`,
                city: "New York",
                state: "NY",
                postalCode: "10001",
                country: "USA",
                phone: `+1 555-${randomBetween(1000, 9999)}`,
                isDefault: true,
                label: "home",
              },
            ],
          },
        ],
        { session },
      );

      await CustomerProfile.create(
        [
          {
            userId: user[0]._id,
            loyaltyPoints: randomBetween(100, 1000),
            lifetimePoints: randomBetween(500, 5000),
            loyaltyTier: data.tier,
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
            tags: ["demo"],
            acquisitionSource: "seed",
            lastActiveAt: new Date(),
          },
        ],
        { session },
      );

      await ctx.internalAdapter.createAccount({
        userId: user[0]._id.toString(),
        providerId: "credential",
        accountId: user[0]._id.toString(),
        password: passwordHash,
        session,
      });

      console.log(`   ✓ Created customer: ${data.email} / ${data.password}`);
      return user[0];
    });
    customers.push(customer);
  }

  return customers;
}

/**
 * Create a staff (seller) user and associated StaffProfile assigned by the admin.
 * Uses transactions to prevent race conditions
 */
async function createStaff(User, StaffProfile, auth, adminUserId) {
  const { name, email, password } = DEMO_CREDENTIALS.staff;

  return await withTransaction(async (session) => {
    const existingStaff = await User.findOne({ email }).session(session);
    if (existingStaff) {
      const existingProfile = await StaffProfile.findOne({
        userId: existingStaff._id,
      }).session(session);
      if (!existingProfile) {
        await StaffProfile.create(
          [
            {
              userId: existingStaff._id,
              assignedBy: adminUserId,
              permissions: Object.values(STAFF_PERMISSIONS),
              department: "Sales Floor",
              isActive: true,
            },
          ],
          { session },
        );
      }
      console.log(`   ✓ Staff already exists: ${email}`);
      return existingStaff;
    }

    const ctx = await auth.$context;
    const passwordHash = await ctx.password.hash(password);

    const staffUser = await User.create(
      [
        {
          name,
          email,
          password: passwordHash,
          role: ROLES.SELLER,
          roles: [ROLES.SELLER],
          emailVerified: true,
          emailVerifiedAt: new Date(),
          status: "active",
        },
      ],
      { session },
    );

    await StaffProfile.create(
      [
        {
          userId: staffUser[0]._id,
          assignedBy: adminUserId,
          permissions: Object.values(STAFF_PERMISSIONS),
          department: "Sales Floor",
          notes: "Default seeded staff with full POS + sales permissions.",
          isActive: true,
        },
      ],
      { session },
    );

    await ctx.internalAdapter.createAccount({
      userId: staffUser[0]._id.toString(),
      providerId: "credential",
      accountId: staffUser[0]._id.toString(),
      password: passwordHash,
      session,
    });

    console.log(`   ✓ Created staff: ${email} / ${password}`);
    return staffUser[0];
  });
}

/**
 * Inventory locations — created BEFORE products so product.locationInventory can
 * reference real location IDs.
 */
async function createInventoryLocations(InventoryLocation) {
  const existing = await InventoryLocation.find();
  if (existing.length > 0) {
    console.log("   ✓ Inventory locations already exist, skipping...");
    return existing;
  }

  const locations = await InventoryLocation.create([
    {
      name: "Main Warehouse",
      address: "123 Warehouse Blvd, New York, NY 10001",
      isDefault: true,
      isActive: true,
    },
    {
      name: "Store Front",
      address: "456 Retail Ave, New York, NY 10002",
      isDefault: false,
      isActive: true,
    },
    {
      name: "Secondary Storage",
      address: "789 Storage Dr, New York, NY 10003",
      isDefault: false,
      isActive: false,
    },
  ]);

  console.log(`   ✓ Created ${locations.length} inventory locations`);
  return locations;
}

async function createCategories(Category) {
  const categoriesData = [
    {
      name: "Phone",
      slug: "phone",
      description: "Latest mobile phones and smartphones",
      image: LOCAL_ASSET_PATHS.placeholders.category,
      order: 1,
      featured: true,
    },
    {
      name: "Smart Watches",
      slug: "smart-watches",
      description: "Wearable smart watches and fitness trackers",
      image: LOCAL_ASSET_PATHS.placeholders.category,
      order: 2,
      featured: true,
    },
    {
      name: "Cameras",
      slug: "cameras",
      description: "Mirrorless, DSLR, and compact cameras",
      image: LOCAL_ASSET_PATHS.placeholders.category,
      order: 3,
    },
    {
      name: "Headphones",
      slug: "headphones",
      description: "Wireless headphones, earbuds, and audio gear",
      image: LOCAL_ASSET_PATHS.placeholders.category,
      order: 4,
      featured: true,
    },
    {
      name: "Accessories",
      slug: "accessories",
      description: "Power banks, hubs, cables, and other accessories",
      image: LOCAL_ASSET_PATHS.placeholders.category,
      order: 5,
    },
    {
      name: "Shoes",
      slug: "shoes",
      description: "Running shoes, sneakers, and dress shoes",
      image: LOCAL_ASSET_PATHS.placeholders.category,
      order: 6,
    },
    {
      name: "Bags",
      slug: "bags",
      description: "Backpacks, duffel bags, and travel accessories",
      image: LOCAL_ASSET_PATHS.placeholders.category,
      order: 7,
    },
    {
      name: "Men's Cloth",
      slug: "mens-cloth",
      description: "T-shirts, jeans, jackets, and apparel for men",
      image: LOCAL_ASSET_PATHS.placeholders.category,
      order: 8,
    },
  ];

  const categories = [];
  for (const data of categoriesData) {
    const existing = await Category.findOne({ slug: data.slug });
    if (existing) {
      console.log(`   ✓ Category already exists: ${data.name}`);
      categories.push(existing);
      continue;
    }
    const category = await Category.create({
      ...data,
      isActive: true,
      productCount: 0,
      seo: {
        pageTitle: `${data.name} - Storify`,
        metaDescription: data.description,
      },
    });
    categories.push(category);
    console.log(`   ✓ Created category: ${data.name}`);
  }

  return categories;
}

async function createProducts(Product, vendors, categories, locations) {
  const existingCount = await Product.countDocuments();
  if (existingCount > 0) {
    console.log(`   ✓ Products already exist (${existingCount}), skipping...`);
    return await Product.find().lean();
  }

  const [
    phone,
    smartWatches,
    cameras,
    headphones,
    accessories,
    shoes,
    bags,
    mensCloth,
  ] = categories;

  const defaultLocation = locations.find((l) => l.isDefault) || locations[0];
  const storeLocation = locations.find((l) => !l.isDefault && l.isActive);

  const productsData = [
    {
      name: "iPhone 15 Pro Max",
      price: 1099.0,
      category: phone,
      vendor: vendors[0],
      stock: 30,
      featured: true,
    },
    {
      name: "iPhone 14 Pro",
      price: 899.0,
      category: phone,
      vendor: vendors[0],
      stock: 40,
    },
    {
      name: "iPhone 17",
      price: 799.0,
      category: phone,
      vendor: vendors[0],
      stock: 60,
    },
    {
      name: "iPhone 17 Pro Max",
      price: 1199.0,
      category: phone,
      vendor: vendors[0],
      stock: 25,
      featured: true,
    },
    {
      name: "Smart Watch Pro",
      price: 199.99,
      category: smartWatches,
      vendor: vendors[0],
      stock: 50,
      featured: true,
    },
    {
      name: "Smart Watch Ultra",
      price: 349.0,
      category: smartWatches,
      vendor: vendors[0],
      stock: 35,
    },
    {
      name: "Mirrorless Camera Kit",
      price: 1299.0,
      category: cameras,
      vendor: vendors[0],
      stock: 12,
    },
    {
      name: "Compact Travel Camera",
      price: 549.0,
      category: cameras,
      vendor: vendors[0],
      stock: 22,
    },
    {
      name: "Wireless Bluetooth Headphones",
      price: 79.99,
      category: headphones,
      vendor: vendors[0],
      stock: 80,
      featured: true,
    },
    {
      name: "BOULT Earbuds",
      price: 24.99,
      category: headphones,
      vendor: vendors[0],
      stock: 150,
    },
    {
      name: "Portable Power Bank",
      price: 29.99,
      category: accessories,
      vendor: vendors[0],
      stock: 100,
    },
    {
      name: "USB-C Hub Adapter",
      price: 49.99,
      category: accessories,
      vendor: vendors[0],
      stock: 75,
    },
    {
      name: "Magnetic Power Bank",
      price: 39.99,
      category: accessories,
      vendor: vendors[0],
      stock: 90,
    },
    {
      name: "Chic Ballet Flats",
      price: 24.99,
      category: shoes,
      vendor: vendors[1],
      stock: 90,
    },
    {
      name: "Running Shoes",
      price: 89.99,
      category: shoes,
      vendor: vendors[1],
      stock: 45,
      featured: true,
    },
    {
      name: "Aprilia E-Bike Sneakers",
      price: 129.0,
      category: shoes,
      vendor: vendors[1],
      stock: 20,
    },
    {
      name: "Everyday Backpack",
      price: 59.0,
      category: bags,
      vendor: vendors[1],
      stock: 60,
    },
    {
      name: "Travel Duffel Bag",
      price: 79.0,
      category: bags,
      vendor: vendors[1],
      stock: 35,
    },
    {
      name: "Cotton T-Shirt",
      price: 24.99,
      category: mensCloth,
      vendor: vendors[1],
      stock: 200,
    },
    {
      name: "Denim Jeans",
      price: 59.99,
      category: mensCloth,
      vendor: vendors[1],
      stock: 80,
    },
    {
      name: "Winter Jacket",
      price: 129.99,
      category: mensCloth,
      vendor: vendors[1],
      stock: 35,
    },
  ];

  const products = [];
  for (const data of productsData) {
    const slug = `${slugify(data.name)}-${randomBytes(3).toString("hex")}`;
    const sku = generateSku(data.name);

    // Split stock across two locations (warehouse + storefront) when storeLocation exists
    const warehouseStock = storeLocation
      ? Math.floor(data.stock * 0.7)
      : data.stock;
    const storeStock = storeLocation ? data.stock - warehouseStock : 0;

    const locationInventory = [
      { locationId: String(defaultLocation._id), quantity: warehouseStock },
    ];
    if (storeLocation) {
      locationInventory.push({
        locationId: String(storeLocation._id),
        quantity: storeStock,
      });
    }

    const product = await Product.create({
      vendorId: data.vendor._id,
      productSource: "vendor",
      name: data.name,
      title: data.name,
      slug,
      handle: slug,
      description: `<p>High-quality ${data.name.toLowerCase()} for everyday use. Premium materials and excellent craftsmanship.</p>`,
      shortDescription: `Premium ${data.name.toLowerCase()} with excellent quality.`,
      price: data.price,
      comparePrice: Math.round(data.price * 1.2 * 100) / 100,
      cost: Math.round(data.price * 0.4 * 100) / 100,
      sku,
      stock: data.stock,
      locationInventory,
      category: data.category._id,
      productType: data.category.name,
      images: [LOCAL_ASSET_PATHS.placeholders.product],
      media: [
        {
          _id: randomUUID(),
          type: "image",
          url: LOCAL_ASSET_PATHS.placeholders.product,
          alt: data.name,
          position: 0,
        },
      ],
      tags: [data.category.slug, "featured", "demo"],
      status: PRODUCT_STATUS.ACTIVE,
      featured: data.featured || Math.random() > 0.7,
      chargeTax: true,
      publishing: {
        onlineStore: true,
        pointOfSale: true,
      },
      shipping: {
        isPhysicalProduct: true,
        weight: 0.5,
        weightUnit: "kg",
      },
      seo: {
        pageTitle: `${data.name} - Buy Online`,
        metaDescription: `Buy ${data.name} online. Premium quality, fast shipping.`,
        handle: slug,
      },
      rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
      reviewCount: randomBetween(0, 50),
    });

    products.push(product);
    console.log(`   ✓ Created product: ${data.name}`);
  }

  // Update category product counts
  for (const cat of categories) {
    const count = products.filter(
      (p) => String(p.category) === String(cat._id),
    ).length;
    await cat.updateOne({ productCount: count });
  }

  return products;
}

/**
 * Create a mix of online + POS orders spread across the last 30 days.
 * Online orders carry subOrders for multi-vendor split; POS orders include staff + location.
 */
async function createOrders(
  Order,
  customers,
  products,
  vendors,
  staffUser,
  locations,
) {
  const orderStatuses = [
    ORDER_STATUS.PENDING,
    ORDER_STATUS.PROCESSING,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.CANCELLED,
  ];
  const paymentStatuses = ["pending", "paid", "paid", "paid", "refunded"];

  const existingCount = await Order.countDocuments();
  if (existingCount > 0) {
    console.log(`   ✓ Orders already exist (${existingCount}), skipping...`);
    return await Order.find().lean();
  }

  const defaultLocation = locations.find((l) => l.isDefault) || locations[0];
  const orders = [];

  // Determine sequential order numbering starting from ORD000001
  for (let i = 0; i < 20; i++) {
    const customer = pickOne(customers);
    const isPos = i % 5 === 0;
    const numItems = 1 + Math.floor(Math.random() * 3);

    // Group items by vendor so we can build subOrders for multi-vendor splits
    const itemsByVendor = new Map();
    const flatItems = [];

    for (let j = 0; j < numItems; j++) {
      const product = pickOne(products);
      const quantity = 1 + Math.floor(Math.random() * 3);
      const item = {
        productId: product._id,
        vendorId: product.vendorId,
        name: product.name,
        sku: product.sku || generateSku(product.name),
        price: product.price,
        quantity,
        image: product.images?.[0] || "",
      };
      flatItems.push(item);

      const vid = String(product.vendorId);
      if (!itemsByVendor.has(vid)) itemsByVendor.set(vid, []);
      itemsByVendor.get(vid).push(item);
    }

    const subtotal = flatItems.reduce(
      (sum, it) => sum + it.price * it.quantity,
      0,
    );
    const shippingCost = isPos ? 0 : 5;
    const tax = Math.round(subtotal * 0.08 * 100) / 100;
    const total = Math.round((subtotal + shippingCost + tax) * 100) / 100;

    const status = isPos ? ORDER_STATUS.DELIVERED : pickOne(orderStatuses);
    const paymentStatus = isPos
      ? "paid"
      : status === "cancelled"
        ? "pending"
        : pickOne(paymentStatuses);

    // Build subOrders — one per vendor — with commission/earnings
    const subOrders = [];
    for (const [vendorId, items] of itemsByVendor.entries()) {
      const vendor = vendors.find((v) => String(v._id) === vendorId);
      const commissionRate = vendor?.commission || 10;
      const sub = items.reduce((s, it) => s + it.price * it.quantity, 0);
      const commission = Math.round(((sub * commissionRate) / 100) * 100) / 100;
      const vendorEarnings = Math.round((sub - commission) * 100) / 100;

      subOrders.push({
        vendorId,
        items,
        subtotal: sub,
        commission,
        vendorEarnings,
        status,
        inventoryReserved: status !== "cancelled",
        payoutStatus:
          status === "delivered" && paymentStatus === "paid"
            ? "unpaid"
            : "unpaid",
      });
    }

    const orderNumber = isPos
      ? `POS${String(i + 1).padStart(6, "0")}`
      : `ORD${String(i + 1).padStart(6, "0")}`;

    const createdAt = new Date(
      Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
    );
    const processingAt =
      status !== "pending" ? new Date(createdAt.getTime() + 60_000) : undefined;
    const shippedAt = ["shipped", "delivered"].includes(status)
      ? new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000)
      : undefined;
    const deliveredAt =
      status === "delivered"
        ? new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000)
        : undefined;
    const cancelledAt =
      status === "cancelled"
        ? new Date(createdAt.getTime() + 3600_000)
        : undefined;

    const order = await Order.create({
      orderNumber,
      customerId: customer._id,
      items: flatItems,
      subOrders,
      shippingAddress: {
        fullName: customer.name,
        firstName: customer.name.split(" ")[0],
        lastName: customer.name.split(" ").slice(1).join(" ") || "Customer",
        street: "123 Main Street",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "USA",
        phone: "+1 555-0123",
      },
      billingAddress: {
        fullName: customer.name,
        street: "123 Main Street",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "USA",
      },
      paymentMethod: isPos ? "cash" : pickOne(["stripe", "cod", "paypal"]),
      paymentStatus,
      subtotal,
      shippingCost,
      tax,
      discount: 0,
      total,
      channel: isPos ? "pos" : "online",
      posLocationId: isPos ? String(defaultLocation._id) : undefined,
      staffId: isPos ? String(staffUser._id) : undefined,
      status,
      processingAt,
      shippedAt,
      deliveredAt,
      cancelledAt,
      trackingNumber: shippedAt
        ? `TRK-${randomBytes(6).toString("hex").toUpperCase()}`
        : undefined,
      carrier: shippedAt ? pickOne(["UPS", "FedEx", "USPS", "DHL"]) : undefined,
      createdAt,
    });

    orders.push(order);
    console.log(`   ✓ Created order: ${orderNumber} (${status})`);
  }

  return orders;
}

async function createCoupons(Coupon, categories, adminId) {
  const couponsData = [
    {
      code: "WELCOME10",
      label: "Welcome Discount",
      description: "10% off your first order over $25",
      type: "percentage",
      value: 10,
      minOrderAmount: 25,
      perUserLimit: 1,
    },
    {
      code: "SAVE20",
      label: "Save $20",
      description: "$20 off orders over $100",
      type: "fixed",
      value: 20,
      minOrderAmount: 100,
      perUserLimit: 3,
    },
    {
      code: "FREESHIP",
      label: "Free Shipping",
      description: "Free shipping on orders over $50",
      type: "free_shipping",
      value: 0,
      minOrderAmount: 50,
    },
    {
      code: "TECH15",
      label: "Tech Sale",
      description: "15% off phones and accessories",
      type: "percentage",
      value: 15,
      minOrderAmount: 0,
      maxDiscount: 200,
      applicableCategories: [
        categories.find((c) => c.slug === "phone")?._id,
        categories.find((c) => c.slug === "accessories")?._id,
      ].filter(Boolean),
    },
  ];

  for (const data of couponsData) {
    const existing = await Coupon.findOne({ code: data.code });
    if (existing) {
      console.log(`   ✓ Coupon already exists: ${data.code}`);
      continue;
    }
    await Coupon.create({
      ...data,
      status: "active",
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      usedCount: 0,
      createdBy: String(adminId),
    });
    console.log(`   ✓ Created coupon: ${data.code}`);
  }
}

async function createCollections(Collection, products) {
  const collectionsData = [
    {
      title: "Featured Products",
      slug: "featured",
      description: "Our handpicked featured products",
      collectionType: "manual",
      products: products
        .filter((p) => p.featured)
        .slice(0, 6)
        .map((p) => p._id),
      status: "active",
      position: 1,
    },
    {
      title: "Best Sellers",
      slug: "best-sellers",
      description: "Most popular products this month",
      collectionType: "manual",
      products: products.slice(0, 5).map((p) => p._id),
      status: "active",
      position: 2,
    },
    {
      title: "New Arrivals",
      slug: "new-arrivals",
      description: "Just landed - check out these new products",
      collectionType: "manual",
      products: products.slice(-5).map((p) => p._id),
      status: "active",
      position: 3,
    },
    {
      title: "On Sale",
      slug: "on-sale",
      description: "Products with active discounts",
      collectionType: "automated",
      conditions: [{ field: "comparePrice", operator: "is_set", value: true }],
      conditionMatch: "all",
      sortOrder: "price-asc",
      status: "active",
      position: 4,
    },
  ];

  const created = [];
  for (const data of collectionsData) {
    const existing = await Collection.findOne({ slug: data.slug });
    if (existing) {
      console.log(`   ✓ Collection already exists: ${data.title}`);
      created.push(existing);
      continue;
    }
    const collection = await Collection.create({
      ...data,
      publishing: {
        onlineStore: true,
        pointOfSale: false,
      },
      seo: {
        pageTitle: `${data.title} - Storify`,
        metaDescription: data.description,
        handle: data.slug,
      },
      productCount: data.products?.length || 0,
    });
    created.push(collection);
    console.log(`   ✓ Created collection: ${data.title}`);
  }

  return created;
}

async function createReviews(Review, Product, orders) {
  // Only generate reviews for delivered orders so isVerified makes sense
  const deliveredOrders = orders.filter((o) => o.status === "delivered");
  const reviewsToCreate = [];

  for (const order of deliveredOrders.slice(0, 8)) {
    const item = order.items[0];
    if (!item) continue;
    if (
      reviewsToCreate.find(
        (r) =>
          String(r.productId) === String(item.productId) &&
          String(r.userId) === String(order.customerId) &&
          String(r.orderId) === String(order._id),
      )
    )
      continue;

    reviewsToCreate.push({
      productId: item.productId,
      userId: order.customerId,
      orderId: order._id,
      rating: randomBetween(3, 5),
      title: pickOne([
        "Great product!",
        "Highly recommended",
        "Worth the price",
        "Excellent quality",
      ]),
      comment: pickOne([
        "Exactly as described. Fast shipping and well-packaged.",
        "Quality exceeded my expectations. Will buy again.",
        "Solid product. Does what it promises.",
        "Loved it — bought another one for a friend.",
      ]),
      isVerified: true,
      isApproved: true,
    });
  }

  let count = 0;
  for (const review of reviewsToCreate) {
    try {
      await Review.create(review);
      count++;
    } catch {
      // Skip duplicates (unique index on productId+userId+orderId)
    }
  }

  // Recompute product rating + reviewCount from approved reviews
  const productIds = [
    ...new Set(reviewsToCreate.map((r) => String(r.productId))),
  ];
  for (const pid of productIds) {
    const productReviews = await Review.find({
      productId: pid,
      isApproved: true,
    });
    if (productReviews.length > 0) {
      const avg =
        productReviews.reduce((sum, r) => sum + r.rating, 0) /
        productReviews.length;
      await Product.updateOne(
        { _id: pid },
        {
          rating: Math.round(avg * 10) / 10,
          reviewCount: productReviews.length,
        },
      );
    }
  }

  console.log(`   ✓ Created ${count} reviews`);
}

async function createWishlists(Wishlist, customers, products) {
  let count = 0;
  for (const customer of customers) {
    const existing = await Wishlist.findOne({ userId: String(customer._id) });
    if (existing) continue;

    const picks = [];
    const usedIdx = new Set();
    const wishlistSize = randomBetween(2, 5);
    while (picks.length < wishlistSize && picks.length < products.length) {
      const idx = Math.floor(Math.random() * products.length);
      if (usedIdx.has(idx)) continue;
      usedIdx.add(idx);
      picks.push({
        productId: products[idx]._id,
        addedAt: new Date(
          Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000,
        ),
      });
    }

    await Wishlist.create({
      userId: String(customer._id),
      items: picks,
    });
    count++;
  }

  console.log(`   ✓ Created ${count} wishlists`);
}

async function createBlog(BlogCategory, BlogPost, adminUserId, adminName) {
  const existingPosts = await BlogPost.countDocuments();
  if (existingPosts > 0) {
    console.log("   ✓ Blog posts already exist, skipping...");
    return;
  }

  const categoriesData = [
    {
      name: "Accessories",
      slug: "accessories",
      description: "Tips and reviews for everyday tech accessories",
      order: 1,
    },
    {
      name: "Mobile Phones",
      slug: "mobile-phones",
      description: "Latest mobile launches and buyer guides",
      order: 2,
    },
    {
      name: "Power & Charging",
      slug: "power-charging",
      description: "Power banks, chargers, and energy gear",
      order: 3,
    },
  ];

  const createdCategories = [];
  for (const data of categoriesData) {
    const existing = await BlogCategory.findOne({ slug: data.slug });
    if (existing) {
      createdCategories.push(existing);
      continue;
    }
    const category = await BlogCategory.create({
      ...data,
      isActive: true,
      postCount: 0,
    });
    createdCategories.push(category);
  }

  const postsData = [
    {
      title: "Must-Have Accessories",
      slug: "must-have-accessories",
      excerpt:
        "Discover essential smartphone accessories that elevate your device, from stylish cases to powerful chargers and more.",
      content:
        "<p>Discover essential smartphone accessories that elevate your device, from stylish cases to powerful chargers and more. The right accessory turns a phone into a productivity hub — invest in quality cables, durable cases, and reliable wireless earbuds to get the best of your device every day.</p>",
      featuredImage: {
        url: "/blog/accessories.jpg",
        alt: "Must-have accessories",
      },
      categorySlug: "accessories",
      tags: ["accessories", "smartphone", "lifestyle"],
    },
    {
      title: "Choose the Perfect Phone Case",
      slug: "choose-the-perfect-phone-case",
      excerpt:
        "Discover stylish, protective phone cases that safeguard your smartphone while showcasing your personal style. Shop now for durability!",
      content:
        "<p>Discover stylish, protective phone cases that safeguard your smartphone while showcasing your personal style. Whether you prefer slim minimalist designs or rugged drop-tested protection, the right case extends your device's life without sacrificing aesthetics.</p>",
      featuredImage: {
        url: "/blog/phone-case.jpg",
        alt: "Choose the perfect phone case",
      },
      categorySlug: "mobile-phones",
      tags: ["phone case", "mobile", "protection"],
    },
    {
      title: "Power Banks for Every Device",
      slug: "power-banks-for-every-device",
      excerpt:
        "Your essential smartphone accessory for reliable, on-the-go charging. Keep your devices powered anytime, anywhere.",
      content:
        "<p>Your essential smartphone accessory for reliable, on-the-go charging. Keep your devices powered anytime, anywhere with high-capacity power banks that support fast charging and pass-through use.</p>",
      featuredImage: {
        url: "/blog/power-bank.jpg",
        alt: "Power banks for every device",
      },
      categorySlug: "power-charging",
      tags: ["power bank", "charging", "travel"],
    },
  ];

  for (const data of postsData) {
    const category = createdCategories.find(
      (c) => c.slug === data.categorySlug,
    );

    await BlogPost.create({
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      content: data.content,
      featuredImage: data.featuredImage,
      authorId: adminUserId,
      authorName: adminName,
      categoryIds: category ? [category._id] : [],
      tags: data.tags,
      status: "published",
      visibility: "public",
      publishedAt: new Date(),
      allowComments: true,
      isFeatured: true,
      readingTime: 3,
      seo: {
        pageTitle: data.title,
        metaDescription: data.excerpt,
      },
    });

    if (category) {
      await BlogCategory.updateOne(
        { _id: category._id },
        { $inc: { postCount: 1 } },
      );
    }
  }

  console.log(
    `   ✓ Created ${categoriesData.length} blog categories and ${postsData.length} blog posts`,
  );
}

async function createMenus(Menu) {
  const count = await Menu.countDocuments();
  if (count > 0) {
    console.log("   ✓ Menus already exist, skipping...");
    return;
  }

  const DEFAULT_MENUS = [
    {
      name: "Main Header",
      handle: "main-header",
      location: "header",
      description: "Primary navigation links shown in the store header.",
      items: [
        {
          label: "Blog",
          url: "/blog",
          type: "page",
          target: "_self",
          children: [],
        },
      ],
    },
    // Footer link columns are managed from the Footer builder (settings.footer),
    // not from seeded menus — so no "footer" location menus are seeded here.
  ];

  await Menu.insertMany(
    DEFAULT_MENUS.map((m) => ({ ...m, isActive: true })),
    { ordered: false },
  );

  console.log(`   ✓ Created ${DEFAULT_MENUS.length} default menus`);
}

async function createNotifications(Notification, admin, customers, orders) {
  const existingCount = await Notification.countDocuments();
  if (existingCount > 0) {
    console.log("   ✓ Notifications already exist, skipping...");
    return;
  }

  const recentOrders = orders.slice(-5);
  let count = 0;

  for (const order of recentOrders) {
    await Notification.create({
      userId: String(admin._id),
      type: "order_placed",
      title: "New order placed",
      message: `Order ${order.orderNumber} for $${order.total.toFixed(2)} was placed.`,
      link: `/admin/orders/${order._id}`,
      data: { orderId: String(order._id), orderNumber: order.orderNumber },
      isRead: Math.random() > 0.5,
    });
    count++;
  }

  // Customer-facing notifications
  for (const customer of customers.slice(0, 2)) {
    await Notification.create({
      userId: String(customer._id),
      type: "system",
      title: "Welcome to Storify!",
      message:
        "Start exploring our products and enjoy 10% off with code WELCOME10.",
      link: "/products",
      isRead: false,
    });
    count++;
  }

  console.log(`   ✓ Created ${count} notifications`);
}

async function createSettings(Settings) {
  const existing = await Settings.findOne();
  if (existing) {
    console.log("   ✓ Settings already exist, skipping...");
    return;
  }

  await Settings.create({
    general: {
      storeName: "Storify",
      storeDescription: "Multi-vendor E-commerce Platform",
      storeEmail: "support@storify.com",
      storePhone: "+1 555-0100",
      storeAddress: "123 Main Street, New York, NY 10001",
      logoUrl: LOCAL_ASSET_PATHS.logos.main,
      darkModeLogoUrl: LOCAL_ASSET_PATHS.logos.dark,
      faviconUrl: LOCAL_ASSET_PATHS.logos.favicon,
      defaultLanguage: "en",
      defaultCurrency: "USD",
      supportedLanguages: [
        "en",
        "bn",
        "ar",
        "hi",
        "zh",
        "ja",
        "ko",
        "fr",
        "es",
      ],
      supportedCurrencies: ["USD", "EUR", "GBP", "BDT", "INR"],
      timezone: "America/New_York",
    },
    appearance: {
      primaryColor: "#2065D1",
      secondaryColor: "#8b5cf6",
      accentColor: "#f59e0b",
      theme: "system",
      contrast: false,
      rtl: false,
      compact: false,
      navLayout: "mini",
      navColor: "integrate",
      presetColor: "default",
    },
    payment: {
      stripe: {
        enabled: false,
        publishableKey: "",
        secretKey: "",
        webhookSecret: "",
      },
      paypal: {
        enabled: false,
        clientId: "",
        clientSecret: "",
        mode: "sandbox",
      },
      razorpay: { enabled: false, keyId: "", keySecret: "" },
      paystack: { enabled: false, publicKey: "", secretKey: "" },
      cod: {
        enabled: true,
        instructions: "Pay with cash when your order is delivered.",
        minOrderAmount: 0,
      },
    },
    email: {
      provider: "smtp",
      enabled: false,
      smtp: { port: 587, secure: false },
      fromEmail: "no-reply@storify.com",
      fromName: "Storify",
    },
    orders: {
      prefix: "ORD",
      taxRate: 1,
      freeShippingThreshold: 0,
      defaultShippingCost: 5,
      commission: { vendorRate: 10, minWithdrawalAmount: 50 },
    },
    shipping: {
      enabled: true,
      origin: {
        country: "USA",
        state: "NY",
        city: "New York",
        postalCode: "10001",
        address1: "123 Main Street",
      },
      delivery: {
        processingDaysMin: 1,
        processingDaysMax: 2,
        showEstimatedDelivery: true,
      },
      zones: [
        {
          id: randomUUID(),
          name: "United States",
          countries: ["USA"],
          regions: [],
          rates: [
            {
              id: randomUUID(),
              name: "Standard",
              type: "flat",
              price: 5.99,
              minDays: 3,
              maxDays: 5,
              active: true,
            },
            {
              id: randomUUID(),
              name: "Free Shipping (over $50)",
              type: "free_over",
              price: 0,
              freeOver: 50,
              minDays: 5,
              maxDays: 7,
              active: true,
            },
          ],
        },
      ],
      fallbackRate: {
        enabled: true,
        name: "Standard",
        price: 9.99,
        minDays: 5,
        maxDays: 10,
      },
      localPickup: {
        enabled: false,
      },
    },
    seo: {
      metaTitle: "Storify - Multi-vendor E-commerce",
      metaDescription:
        "Shop premium products from top vendors. Fast shipping and easy returns.",
      metaKeywords: "ecommerce, multi-vendor, online shopping",
      ogImage: LOCAL_ASSET_PATHS.og.default,
    },
    social: {},
    analytics: {},
    maintenance: {
      enabled: false,
      allowedIPs: [],
    },
    security: {
      emailVerificationRequired: false,
      emailVerificationForVendors: false,
      twoFactorEnabled: true,
      twoFactorRequiredForAdmin: false,
      twoFactorRequiredForVendors: false,
      twoFactorRequiredForStaff: false,
      googleOAuthEnabled: false,
      facebookOAuthEnabled: false,
      sessionMaxAgeDays: 7,
      maxLoginAttempts: 5,
      lockoutDurationMinutes: 15,
      minPasswordLength: 8,
      requireUppercase: false,
      requireNumbers: false,
      requireSpecialChars: false,
      rateLimiting: {
        enabled: true,
        ipPreset: "default",
        adminPreset: "default",
        vendorPreset: "default",
        checkoutPreset: "default",
        cartPreset: "default",
        couponPreset: "default",
        authPreset: "default",
      },
    },
    pos: {
      enabled: true,
      allowAdminSales: true,
      allowVendorSales: true,
      allowSellerSales: true,
      language: "en",
      customize: {
        smartGridEnabled: true,
        lockScreenTimeoutMinutes: 5,
        printedReceiptsEnabled: false,
        customerDisplayEnabled: false,
        soundEnabled: true,
        soundVolume: 50,
        soundAddToCart: true,
        soundOrderComplete: true,
        soundPayment: true,
        soundError: true,
      },
      checkout: {
        paymentMethods: ["cash", "card"],
        customerReceiptSelectionEnabled: false,
        offlinePaymentsEnabled: false,
      },
      orders: {
        orderNumberPrefix: "POS",
        returnRules: {
          enabled: true,
          windowDays: 30,
          allowWithoutReceipt: false,
        },
      },
    },
    multiVendorMode: {
      enabled: true,
      canManageProducts: true,
      canViewOrders: true,
      canManageOrders: true,
      canManageStoreSettings: true,
      canViewAnalytics: true,
      canManagePayouts: true,
      canAccessPOS: true,
    },
    storage: {
      provider: "cloudflare_r2",
      region: "auto",
      maxFileSizeMB: 20,
      maxImageSizeMB: 20,
      maxVideoSizeMB: 1024,
      maxModelSizeMB: 500,
      pathPrefix: "uploads/",
    },
    aiSalesAgent: {
      enabled: false,
      model: "gpt-5-mini",
      temperature: 0.3,
      reasoningEffort: "minimal",
      maxRecommendations: 4,
      agentName: "Sales AI",
      greeting:
        "Hi! I can help you find products, compare options, add items to your cart, and check order status.",
      tone: "friendly",
      escalationMessage:
        "I can connect you with the store team for anything that needs a human review.",
      widget: {
        position: "bottom-right",
        primaryColor: "#7c3aed",
        accentColor: "#a855f7",
        footerText: "Powered by AI",
      },
      capabilities: {
        productQA: true,
        recommendations: true,
        cartActions: true,
        checkoutHandoff: true,
        orderStatus: true,
      },
    },
    homePage: {
      sectionOrder: [
        "hero",
        "featuredCategories",
        "newArrivals",
        "promotionsOffers",
        "featuredProducts",
        "topVendors",
        "becomeVendor",
        "topArticles",
        "fromInstagram",
      ],
      sections: {
        hero: {
          visible: true,
          slides: [{ imageSrc: "", alt: "", href: "" }],
        },
        featuredCategories: {
          visible: true,
          title: "Featured Categories.",
          limit: 8,
        },
        newArrivals: {
          visible: true,
          title: "Products on Sale.",
          subtitle: "",
        },
        promotionsOffers: {
          visible: true,
          cards: [
            { imageSrc: "", href: "/products" },
            { imageSrc: "", href: "/products" },
            { imageSrc: "", href: "/products" },
            { imageSrc: "", href: "/products" },
            { imageSrc: "", href: "/products" },
          ],
        },
        topVendors: {
          visible: true,
          title: "Top Vendors",
          limit: 8,
        },
        featuredProducts: {
          visible: true,
          title: "",
        },
        topArticles: {
          visible: true,
          title: "Top Articles",
          limit: 9,
        },
        becomeVendor: {
          visible: true,
          imageSrc: "",
          title: "Start Selling With Us Today",
          subtitle:
            "Join our marketplace, manage products easily, accept secure payments, and grow your business faster.",
          buttonLabel: "Become a Vendor",
          buttonHref: "/become-vendor",
        },
        fromInstagram: {
          visible: true,
          title: "From Instagram",
          items: [
            { imageSrc: "", href: "" },
            { imageSrc: "", href: "" },
            { imageSrc: "", href: "" },
            { imageSrc: "", href: "" },
            { imageSrc: "", href: "" },
          ],
        },
      },
    },
    contentPages: {
      terms: {
        title: "Terms of Service",
        content:
          "<h2>Terms of Service</h2><p>Add your store's terms of service here.</p>",
        visible: true,
      },
      privacy: {
        title: "Privacy Policy",
        content:
          "<h2>Privacy Policy</h2><p>Add your privacy policy details here.</p>",
        visible: true,
      },
      cookies: {
        title: "Cookie Policy",
        content:
          "<h2>Cookie Policy</h2><p>Describe the cookies your site uses and why.</p>",
        visible: true,
      },
      accessibility: {
        title: "Accessibility",
        content:
          "<h2>Accessibility</h2><p>Share your accessibility standards and support contact details.</p>",
        visible: true,
      },
      faq: {
        title: "Frequently Asked Questions",
        subtitle:
          "Find quick answers to common questions about shopping, shipping, and returns.",
        visible: true,
        items: [
          {
            id: "faq-shipping",
            question: "How long does shipping take?",
            answer:
              "Standard shipping usually takes 3-7 business days depending on your location.",
          },
          {
            id: "faq-returns",
            question: "What is your return policy?",
            answer:
              "You can return eligible items within 30 days of delivery. Items must be unused and in original packaging.",
          },
          {
            id: "faq-tracking",
            question: "How can I track my order?",
            answer:
              "Once your order ships, you will receive a tracking link by email and in your account order history.",
          },
        ],
      },
      customPages: [],
    },
  });

  console.log("   ✓ Created default settings");
}

async function seedCounters(Counter, orders) {
  // Pre-seed order number counters so subsequent runtime orders pick up where seed left off.
  const onlineOrders = orders.filter((o) => o.channel !== "pos");
  const posOrders = orders.filter((o) => o.channel === "pos");

  if (onlineOrders.length > 0) {
    const maxSeq = onlineOrders
      .map((o) => parseInt(String(o.orderNumber).replace(/^ORD/, ""), 10) || 0)
      .reduce((a, b) => Math.max(a, b), 0);
    await Counter.updateOne(
      { _id: "online_order:ORD" },
      { $set: { seq: maxSeq } },
      { upsert: true },
    );
  }

  if (posOrders.length > 0) {
    const maxSeq = posOrders
      .map((o) => parseInt(String(o.orderNumber).replace(/^POS/, ""), 10) || 0)
      .reduce((a, b) => Math.max(a, b), 0);
    await Counter.updateOne(
      { _id: "pos_order:POS" },
      { $set: { seq: maxSeq } },
      { upsert: true },
    );
  }

  console.log("   ✓ Seeded order number counters");
}

async function seed() {
  const MONGODB_URI = process.env.MONGODB_URI;
  const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;

  if (!MONGODB_URI) {
    console.error("❌ Missing MONGODB_URI in environment.");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      ...(MONGODB_DB_NAME ? { dbName: MONGODB_DB_NAME } : {}),
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log("✓ Connected to MongoDB");

    await import("@/models");

    const db = mongoose.connection.db;
    const client = mongoose.connection.getClient();
    const auth = createBetterAuthInstance(db, client);

    const {
      User,
      Vendor,
      Category,
      Product,
      Order,
      Coupon,
      Collection,
      Settings,
      CustomerProfile,
      AdminProfile,
      StaffProfile,
      InventoryLocation,
      BlogCategory,
      BlogPost,
      Menu,
      Review,
      Wishlist,
      Notification,
      Counter,
    } = mongoose.models;

    console.log("\n👤 Creating admin...");
    const admin = await createAdmin(User, AdminProfile, auth);

    console.log("\n🏪 Creating vendors...");
    const vendors = await createVendors(User, Vendor, auth);

    console.log("\n👥 Creating customers...");
    const customers = await createCustomers(User, CustomerProfile, auth);

    console.log("\n🧑‍💼 Creating staff...");
    const staff = await createStaff(User, StaffProfile, auth, admin._id);

    console.log("\n📍 Creating inventory locations...");
    const locations = await createInventoryLocations(InventoryLocation);

    console.log("\n📁 Creating categories...");
    const categories = await createCategories(Category);

    console.log("\n📦 Creating products...");
    const products = await createProducts(
      Product,
      vendors,
      categories,
      locations,
    );

    console.log("\n📚 Creating collections...");
    await createCollections(Collection, products);

    console.log("\n📝 Creating orders...");
    const orders = await createOrders(
      Order,
      customers,
      products,
      vendors,
      staff,
      locations,
    );

    console.log("\n🔢 Seeding counters...");
    await seedCounters(Counter, orders);

    console.log("\n⭐ Creating reviews...");
    await createReviews(Review, Product, orders);

    console.log("\n❤️  Creating wishlists...");
    await createWishlists(Wishlist, customers, products);

    console.log("\n🎟️  Creating coupons...");
    await createCoupons(Coupon, categories, admin._id);

    console.log("\n🔔 Creating notifications...");
    await createNotifications(Notification, admin, customers, orders);

    console.log("\n📰 Creating blog content...");
    await createBlog(BlogCategory, BlogPost, admin._id, admin.name);

    console.log("\n🧭 Creating menus...");
    await createMenus(Menu);

    console.log("\n⚙️  Creating settings...");
    await createSettings(Settings);

    console.log("\n✅ Database seeded successfully!\n");
    console.log("=".repeat(60));
    console.log("Demo Credentials:");
    console.log("=".repeat(60));
    console.log(
      `Admin:    ${DEMO_CREDENTIALS.admin.email} / ${DEMO_CREDENTIALS.admin.password}`,
    );
    console.log(
      `Vendor:   ${DEMO_CREDENTIALS.vendor.email} / ${DEMO_CREDENTIALS.vendor.password}`,
    );
    console.log(
      `Customer: ${DEMO_CREDENTIALS.customer.email} / ${DEMO_CREDENTIALS.customer.password}`,
    );
    console.log(
      `Staff:    ${DEMO_CREDENTIALS.staff.email} / ${DEMO_CREDENTIALS.staff.password}`,
    );
    console.log("=".repeat(60) + "\n");
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("✓ Disconnected from MongoDB");
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
