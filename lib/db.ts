import mongoose from "mongoose";

/**
 * MongoDB Connection Singleton
 * Handles connection pooling and caching for serverless environments
 */

// Declare global mongoose cache type
declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;
const shouldLog = process.env.NODE_ENV !== "production";

// Initialize the cached connection
let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

/**
 * Connect to MongoDB
 * Uses connection pooling and caching for optimal performance
 */
export async function connectDB(): Promise<typeof mongoose> {
  // Return cached connection if available
  if (cached.conn) {
    return cached.conn;
  }

  // Create new connection if no promise exists
  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      ...(MONGODB_DB_NAME ? { dbName: MONGODB_DB_NAME } : {}),
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    if (!MONGODB_URI) {
      throw new Error(
        "Please define the MONGODB_URI environment variable inside .env"
      );
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      if (shouldLog) {
        console.log("MongoDB connected");
      }
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    console.error("MongoDB connection error:", error);
    throw error;
  }

  return cached.conn;
}

/**
 * Disconnect from MongoDB
 * Useful for graceful shutdown
 */
export async function disconnectDB(): Promise<void> {
  if (cached.conn) {
    await mongoose.disconnect();
    cached.conn = null;
    cached.promise = null;
    if (shouldLog) {
      console.log("MongoDB disconnected");
    }
  }
}

/**
 * Check if MongoDB is connected
 */
export function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

// Export mongoose for schema creation
export { mongoose };
