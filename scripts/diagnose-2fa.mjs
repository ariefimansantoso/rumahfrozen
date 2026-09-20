/**
 * Read-only 2FA diagnostic. Prints NO password hashes — only whether a
 * credential account exists and what hashing scheme each stored password uses.
 *
 * Usage:  node scripts/diagnose-2fa.mjs [emailOrName]
 *   e.g.  node scripts/diagnose-2fa.mjs john
 * With no argument it reports all admin/vendor users (the roles that can be
 * forced into the mandatory 2FA setup screen).
 */
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      /* file may not exist */
    }
  }
}

function scheme(hash) {
  if (!hash) return "none";
  if (/^\$2[aby]\$/.test(hash)) return "bcrypt";
  if (/^[0-9a-f]+:[0-9a-f]+$/i.test(hash)) return "scrypt (better-auth)";
  return "unknown";
}

loadEnv();
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "storify";
if (!uri) {
  console.error("MONGODB_URI not found in .env / .env.local");
  process.exit(1);
}

const needle = process.argv[2];
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
try {
  await client.connect();
  const db = client.db(dbName);

  const query = needle
    ? {
        $or: [
          { email: new RegExp(needle, "i") },
          { name: new RegExp(needle, "i") },
        ],
      }
    : { $or: [{ role: { $in: ["admin", "vendor"] } }, { roles: { $in: ["admin", "vendor"] } }] };

  const users = await db
    .collection("user")
    .find(query, {
      projection: { name: 1, email: 1, role: 1, roles: 1, twoFactorEnabled: 1, password: 1 },
    })
    .limit(30)
    .toArray();

  if (!users.length) {
    console.log("No matching users found.");
  }

  for (const u of users) {
    const accts = await db
      .collection("account")
      .find({ userId: u._id })
      .project({ providerId: 1, password: 1 })
      .toArray();
    const cred = accts.find((a) => a.providerId === "credential");
    console.log("──────────────────────────────────────────────");
    console.log(`name:  ${u.name}`);
    console.log(`email: ${u.email}`);
    console.log(`role:  ${u.role}   roles: ${JSON.stringify(u.roles)}`);
    console.log(`2FA enabled: ${Boolean(u.twoFactorEnabled)}`);
    console.log(`providers: ${accts.map((a) => a.providerId).join(", ") || "(none)"}`);
    console.log(`credential account exists: ${Boolean(cred)}`);
    console.log(`credential password scheme: ${scheme(cred?.password)}`);
    console.log(`legacy user.password scheme: ${scheme(u.password)}`);
  }
  console.log("──────────────────────────────────────────────");
} catch (e) {
  console.error("ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
