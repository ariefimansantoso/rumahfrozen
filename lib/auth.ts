import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { APIError } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";
import { connectDB, mongoose } from "@/lib/db";
import {
  appConfig,
  USER_ACCOUNT_STATUS,
  USER_ROLES,
  type UserAccountStatus,
  type UserRole,
} from "@/config/app.config";
import { ObjectId, type Db, type MongoClient } from "mongodb";
import {
  forceCustomerRoleForOAuthUser,
  isOAuthCallbackPath,
  assertOAuthCustomerOnlySession,
} from "@/lib/auth-oauth-guards";
import { resolveOAuthCredentials } from "@/lib/credentials";
import {
  resolveEmailVerificationStatus,
  resolveEmailVerificationPolicyRole,
  type EmailVerificationStatus,
} from "@/lib/email-verification-policy";
import { isCurrentSmtpConfigurationVerified } from "@/lib/smtp-verification";
import type { ISettings } from "@/models/settings.model";

/**
 * Better Auth Server Configuration
 * Handles authentication with MongoDB adapter
 * Supports OAuth, 2FA, and dynamic settings from database
 */

// Types for settings that can affect auth configuration
export interface AuthSecuritySettings {
  sessionMaxAgeDays: number;
  minPasswordLength: number;
  emailVerificationRequired: boolean;
  emailVerificationForVendors: boolean;
  emailVerificationRequiredSince?: Date;
  emailVerificationForVendorsSince?: Date;
  emailDeliveryReady: boolean;
  googleOAuthEnabled: boolean;
  googleClientId?: string;
  googleClientSecret?: string;
  facebookOAuthEnabled: boolean;
  facebookAppId?: string;
  facebookAppSecret?: string;
}

// Default security settings (used before DB settings are loaded)
const defaultSecuritySettings: AuthSecuritySettings = {
  sessionMaxAgeDays: 7,
  minPasswordLength: 8,
  emailVerificationRequired: false,
  emailVerificationForVendors: false,
  emailDeliveryReady: false,
  googleOAuthEnabled: false,
  facebookOAuthEnabled: false,
};

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = Math.min(2, local.length);
  const maskedLocal = `${local.slice(0, visible)}${"*".repeat(
    Math.max(3, local.length - visible),
  )}`;
  return `${maskedLocal}@${domain}`;
}

function createAuth(
  db: Db,
  client?: MongoClient,
  settings?: AuthSecuritySettings,
) {
  const securitySettings = settings || defaultSecuritySettings;
  const requireCustomerVerification =
    securitySettings.emailDeliveryReady &&
    securitySettings.emailVerificationRequired;
  const requireVendorVerification =
    securitySettings.emailDeliveryReady &&
    securitySettings.emailVerificationForVendors;

  const baseURL =
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const socialProviders: Record<
    string,
    { clientId: string; clientSecret: string }
  > = {};

  // Resolve OAuth credentials from two sources: DB settings win, .env is the
  // per-field fallback. A provider is active when usable credentials resolve
  // AND either the admin toggled it on, or the credentials come purely from
  // .env (so an env-only deployment enables the provider without DB config).
  const oauth = resolveOAuthCredentials(securitySettings);

  const googleFromEnvOnly =
    !securitySettings.googleClientId && !securitySettings.googleClientSecret;
  if (
    oauth.google.clientId &&
    oauth.google.clientSecret &&
    (securitySettings.googleOAuthEnabled || googleFromEnvOnly)
  ) {
    socialProviders.google = {
      clientId: oauth.google.clientId,
      clientSecret: oauth.google.clientSecret,
    };
  }

  const facebookFromEnvOnly =
    !securitySettings.facebookAppId && !securitySettings.facebookAppSecret;
  if (
    oauth.facebook.appId &&
    oauth.facebook.appSecret &&
    (securitySettings.facebookOAuthEnabled || facebookFromEnvOnly)
  ) {
    socialProviders.facebook = {
      clientId: oauth.facebook.appId,
      clientSecret: oauth.facebook.appSecret,
    };
  }

  return betterAuth({
    baseURL,
    // Disable transactions for standalone MongoDB (non-replica set)
    // Enable this in production if using MongoDB Atlas or a replica set
    database: mongodbAdapter(db, {
      client,
      transaction: false,
    }),

    // Email & Password Authentication
    emailAndPassword: {
      enabled: true,
      // Verification is enforced by the role-aware session hook below. Better
      // Auth's global switch cannot distinguish customers from vendors/staff.
      requireEmailVerification: false,
      autoSignIn: true,
      minPasswordLength: securitySettings.minPasswordLength,
    },

    emailVerification: {
      expiresIn: 60 * 60 * 24,
      sendOnSignUp: requireCustomerVerification || requireVendorVerification,
      sendOnSignIn: false,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const audience = (user as { emailVerificationAudience?: string })
          .emailVerificationAudience;
        const role = (user as { role?: string }).role;
        const isVendorRegistration =
          role === USER_ROLES.VENDOR || audience === USER_ROLES.VENDOR;
        const verificationRequired = isVendorRegistration
          ? requireVendorVerification
          : requireCustomerVerification;
        if (!verificationRequired) return;

        const { sendAccountVerificationEmail } = await import(
          "@/lib/email-verification"
        );
        await sendAccountVerificationEmail({
          user: { id: user.id, email: user.email, name: user.name },
          url,
        });
      },
      afterEmailVerification: async (user) => {
        const { markAccountEmailVerified } = await import(
          "@/lib/email-verification"
        );
        await markAccountEmailVerified({
          id: user.id,
          email: user.email,
          name: user.name,
        });
      },
    },

    // Session Configuration
    session: {
      expiresIn: 60 * 60 * 24 * securitySettings.sessionMaxAgeDays,
      updateAge: 60 * 60 * 24, // Update session every 24 hours
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },

    // User Configuration
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: USER_ROLES.CUSTOMER,
          input: false,
        },
        roles: {
          type: "string[]",
          required: false,
          defaultValue: [USER_ROLES.CUSTOMER],
          input: false,
        },
        status: {
          type: "string",
          required: false,
          defaultValue: USER_ACCOUNT_STATUS.ACTIVE,
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
        emailVerificationRequiredAt: {
          type: "date",
          required: false,
          input: false,
        },
        emailVerificationAudience: {
          type: "string",
          required: false,
          defaultValue: USER_ROLES.CUSTOMER,
          input: true,
        },
      },
    },
    socialProviders,
    appName: appConfig.name,
    account: {
      storeStateStrategy: "cookie",
    },
    plugins: [twoFactor()],
    databaseHooks: {
      user: {
        create: {
          before: async (user, ctx) => {
            const userWithRole = forceCustomerRoleForOAuthUser(user, ctx?.path);
            const emailVerificationAudience = isOAuthCallbackPath(ctx?.path)
              ? USER_ROLES.CUSTOMER
              : (userWithRole as { emailVerificationAudience?: string })
                    .emailVerificationAudience === USER_ROLES.VENDOR
                ? USER_ROLES.VENDOR
                : USER_ROLES.CUSTOMER;
            return {
              data: {
                ...userWithRole,
                emailVerificationAudience,
                status:
                  (userWithRole as { status?: string }).status ||
                  USER_ACCOUNT_STATUS.ACTIVE,
              },
            };
          },
          after: async (user) => {
            // Auto-create customer profile for customer roles
            const role = (user as { role?: string }).role;
            if (!role || role === USER_ROLES.CUSTOMER) {
              try {
                const { ensureCustomerProfile } = await import(
                  "@/lib/customer"
                );
                const userId =
                  (user as { id?: string }).id ||
                  (user as { _id?: { toString(): string } })._id?.toString();
                if (userId) {
                  await ensureCustomerProfile(userId);
                }
              } catch (error) {
                console.error("Failed to create customer profile:", error);
              }
            }
          },
        },
      },
      session: {
        create: {
          before: async (session, ctx) => {
            const rawUserId =
              "userId" in session && typeof session.userId === "string"
                ? session.userId
                : undefined;

            if (!rawUserId) {
              throw new APIError("FORBIDDEN", { message: "Authentication failed." });
            }

            const userDoc = await db
              .collection("user")
              .findOne({ _id: new ObjectId(rawUserId) });

            if (!userDoc) {
              throw new APIError("FORBIDDEN", { message: "Authentication failed." });
            }

            const rawRole = (userDoc as { role?: string }).role;
            const role = isKnownUserRole(rawRole)
              ? rawRole
              : USER_ROLES.CUSTOMER;
            const email = (userDoc as { email?: string }).email;
            const status =
              (userDoc as { status?: string }).status ||
              USER_ACCOUNT_STATUS.ACTIVE;

            const emailVerified = Boolean(
              (userDoc as { emailVerified?: boolean }).emailVerified,
            );
            const emailVerificationAudience =
              (userDoc as { emailVerificationAudience?: string })
                .emailVerificationAudience === USER_ROLES.VENDOR
                ? USER_ROLES.VENDOR
                : USER_ROLES.CUSTOMER;
            const verificationRole = resolveEmailVerificationPolicyRole(
              role,
              emailVerificationAudience,
            );
            const verificationStatus = resolveEmailVerificationStatus(
              {
                role: verificationRole,
                emailVerified,
                createdAt:
                  (userDoc as { createdAt?: Date }).createdAt || undefined,
                emailVerificationRequiredAt:
                  (userDoc as { emailVerificationRequiredAt?: Date })
                    .emailVerificationRequiredAt || undefined,
              },
              securitySettings,
            );

            const isEmailSignUp = Boolean(
              ctx?.path && ctx.path.endsWith("/sign-up/email"),
            );
            if (verificationStatus === "blocked_pending" && !isEmailSignUp) {
              throw new APIError("FORBIDDEN", {
                code: "EMAIL_NOT_VERIFIED",
                message: "Please verify your email address before signing in.",
              });
            }

            if (
              (role === USER_ROLES.CUSTOMER || role === USER_ROLES.VENDOR) &&
              status !== USER_ACCOUNT_STATUS.ACTIVE
            ) {
              throw new APIError("FORBIDDEN", {
                code: "ACCOUNT_INACTIVE_OR_BANNED",
                message:
                  status === USER_ACCOUNT_STATUS.BANNED
                    ? "Your account has been banned. Contact support."
                    : "Your account is inactive. Contact support.",
              });
            }

            if (!isOAuthCallbackPath(ctx?.path)) return { data: session };

            if (!assertOAuthCustomerOnlySession(ctx?.path, role)) {
              if (role === USER_ROLES.VENDOR && email) {
                throw new APIError("FORBIDDEN", {
                  code: "OAUTH_ACCOUNT_ROLE_CONFLICT",
                  message:
                    "This email is already registered as a vendor account.",
                  role,
                  email: maskEmail(email),
                });
              }
              throw new APIError("FORBIDDEN", {
                code: "OAUTH_SIGNIN_IS_ONLY_AVAILABLE_FOR_CUSTOMERS",
                message: "OAuth sign-in is only available for customers.",
              });
            }

            return { data: session };
          },
        },
      },
    },

    // Trusted Origins (for CORS)
    trustedOrigins: [baseURL],
  });
}

type AuthInstance = ReturnType<typeof createAuth>;
type GetSessionArgs = Parameters<AuthInstance["api"]["getSession"]>;
type GetSessionReturn = ReturnType<AuthInstance["api"]["getSession"]>;

let authInstance: AuthInstance | null = null;
let authInitPromise: Promise<AuthInstance> | null = null;
let activeSecuritySettings = defaultSecuritySettings;

const USER_ROLE_VALUES = Object.values(USER_ROLES) as UserRole[];

function isKnownUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" && USER_ROLE_VALUES.includes(value as UserRole)
  );
}

function normalizeUserRoles(value: unknown, fallbackRole: UserRole): UserRole[] {
  const roles = Array.isArray(value)
    ? value.filter((role): role is UserRole => isKnownUserRole(role))
    : [];

  return roles.length ? Array.from(new Set(roles)) : [fallbackRole];
}

function getPrimaryRole(role: UserRole, roles: UserRole[]): UserRole {
  // Existing admin APIs still read `user.role`, so keep it authoritative when
  // the newer roles array marks the user as an admin.
  if (roles.includes(USER_ROLES.ADMIN)) return USER_ROLES.ADMIN;
  return role;
}

async function hydrateSessionUserFromDb(
  session: AuthSession,
): Promise<AuthSession> {
  try {
    const db = mongoose.connection.db;
    if (!db || !ObjectId.isValid(session.user.id)) return session;

    const userDoc = await db.collection("user").findOne(
      { _id: new ObjectId(session.user.id) },
      {
        projection: {
          role: 1,
          roles: 1,
          status: 1,
          emailVerified: 1,
          createdAt: 1,
          emailVerificationRequiredAt: 1,
          emailVerificationAudience: 1,
        },
      },
    );

    if (!userDoc) return session;

    const dbRole = isKnownUserRole(userDoc.role)
      ? userDoc.role
      : session.user.role;
    const roles = normalizeUserRoles(userDoc.roles, dbRole);
    const role = getPrimaryRole(dbRole, roles);
    const status =
      typeof userDoc.status === "string"
        ? (userDoc.status as UserAccountStatus)
        : session.user.status;
    const emailVerified = Boolean(userDoc.emailVerified);
    const createdAt = userDoc.createdAt
      ? new Date(userDoc.createdAt as Date)
      : session.user.createdAt;
    const emailVerificationRequiredAt = userDoc.emailVerificationRequiredAt
      ? new Date(userDoc.emailVerificationRequiredAt as Date)
      : undefined;
    const emailVerificationAudience =
      userDoc.emailVerificationAudience === USER_ROLES.VENDOR
        ? USER_ROLES.VENDOR
        : USER_ROLES.CUSTOMER;
    const verificationRole = resolveEmailVerificationPolicyRole(
      role,
      emailVerificationAudience,
    );
    const emailVerificationStatus = resolveEmailVerificationStatus(
      {
        role: verificationRole,
        emailVerified,
        createdAt,
        emailVerificationRequiredAt,
      },
      activeSecuritySettings,
    );

    return {
      ...session,
      user: {
        ...session.user,
        role,
        roles,
        status,
        emailVerified,
        createdAt,
        emailVerificationRequiredAt,
        emailVerificationAudience,
        emailVerificationStatus,
      },
    };
  } catch {
    return session;
  }
}

async function getAuthInstance(): Promise<AuthInstance> {
  if (authInstance) return authInstance;
  if (!authInitPromise) {
    authInitPromise = (async () => {
      await connectDB();

      const db = mongoose.connection.db as unknown as Db | undefined;
      if (!db) {
        throw new Error("MongoDB is not connected");
      }

      const client = mongoose.connection.getClient() as unknown as
        | MongoClient
        | undefined;

      // Try to load security settings from database
      let securitySettings: AuthSecuritySettings | undefined;
      try {
        const settingsCollection = db.collection("settings");
        const settings = await settingsCollection.findOne({});
        if (settings?.security) {
          const now = new Date();
          const verificationMigration: Record<string, Date> = {};
          if (
            settings.security.emailVerificationRequired &&
            !settings.security.emailVerificationRequiredSince
          ) {
            settings.security.emailVerificationRequiredSince = now;
            verificationMigration["security.emailVerificationRequiredSince"] = now;
          }
          if (
            settings.security.emailVerificationForVendors &&
            !settings.security.emailVerificationForVendorsSince
          ) {
            settings.security.emailVerificationForVendorsSince = now;
            verificationMigration["security.emailVerificationForVendorsSince"] = now;
          }
          if (Object.keys(verificationMigration).length > 0) {
            await settingsCollection.updateOne(
              { _id: settings._id },
              { $set: verificationMigration },
            );
          }
          securitySettings = {
            sessionMaxAgeDays: settings.security.sessionMaxAgeDays || 7,
            minPasswordLength: settings.security.minPasswordLength || 8,
            emailVerificationRequired:
              settings.security.emailVerificationRequired || false,
            emailVerificationForVendors:
              settings.security.emailVerificationForVendors ?? false,
            emailVerificationRequiredSince:
              settings.security.emailVerificationRequiredSince,
            emailVerificationForVendorsSince:
              settings.security.emailVerificationForVendorsSince,
            emailDeliveryReady: isCurrentSmtpConfigurationVerified(
              settings as unknown as ISettings,
            ),
            googleOAuthEnabled: settings.security.googleOAuthEnabled || false,
            googleClientId: settings.security.googleClientId,
            googleClientSecret: settings.security.googleClientSecret,
            facebookOAuthEnabled:
              settings.security.facebookOAuthEnabled || false,
            facebookAppId: settings.security.facebookAppId,
            facebookAppSecret: settings.security.facebookAppSecret,
          };
        }
      } catch (error) {
        console.warn(
          "Could not load security settings from DB, using defaults:",
          error,
        );
      }

      authInstance = createAuth(db, client, securitySettings);
      activeSecuritySettings = securitySettings || defaultSecuritySettings;
      return authInstance;
    })();
  }
  return authInitPromise;
}

export async function getAuthContext(): Promise<AuthInstance["$context"]> {
  const instance = await getAuthInstance();
  return await instance.$context;
}

// Function to reload auth instance when settings change
export async function reloadAuthInstance(): Promise<void> {
  authInstance = null;
  authInitPromise = null;
  await getAuthInstance();
}

export async function requestEmailVerification(
  email: string,
  callbackURL: string,
) {
  const instance = await getAuthInstance();
  return instance.api.sendVerificationEmail({
    body: { email, callbackURL },
  });
}

// Custom user type with all additional fields
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Custom fields
  role: UserRole;
  roles?: UserRole[];
  status?: UserAccountStatus;
  phone?: string;
  twoFactorEnabled?: boolean;
  emailVerifiedAt?: Date;
  emailVerificationRequiredAt?: Date;
  emailVerificationAudience?: "customer" | "vendor";
  emailVerificationStatus?: EmailVerificationStatus;
}

// Custom session type with typed user
export interface AuthSession {
  user: AuthUser;
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}

export const auth = {
  async handler(request: Request): Promise<Response> {
    const instance = (await getAuthInstance()) as unknown as {
      handler?: (request: Request) => Promise<Response>;
      (request: Request): Promise<Response>;
    };
    return "handler" in instance
      ? instance.handler!(request)
      : instance(request);
  },
  api: {
    async getRegistrationSession(
      ...args: GetSessionArgs
    ): Promise<AuthSession | null> {
      const instance = (await getAuthInstance()) as unknown as {
        api: { getSession: (...innerArgs: unknown[]) => GetSessionReturn };
      };
      const session = await instance.api.getSession(...(args as unknown[]));
      const typedSession = session as unknown as AuthSession | null;
      if (!typedSession) return null;

      const hydratedSession = await hydrateSessionUserFromDb(typedSession);
      const status = hydratedSession.user.status || USER_ACCOUNT_STATUS.ACTIVE;
      if (
        (hydratedSession.user.role === USER_ROLES.CUSTOMER ||
          hydratedSession.user.role === USER_ROLES.VENDOR) &&
        status !== USER_ACCOUNT_STATUS.ACTIVE
      ) {
        return null;
      }

      return hydratedSession;
    },
    async getSession(...args: GetSessionArgs): Promise<AuthSession | null> {
      const instance = (await getAuthInstance()) as unknown as {
        api: { getSession: (...innerArgs: unknown[]) => GetSessionReturn };
      };
      const session = await instance.api.getSession(...(args as unknown[]));
      // Cast to our typed session which includes custom fields
      const typedSession = session as unknown as AuthSession | null;
      if (!typedSession) return null;
      const hydratedSession = await hydrateSessionUserFromDb(typedSession);

      const status = hydratedSession.user.status || USER_ACCOUNT_STATUS.ACTIVE;
      if (
        (hydratedSession.user.role === USER_ROLES.CUSTOMER ||
          hydratedSession.user.role === USER_ROLES.VENDOR) &&
        status !== USER_ACCOUNT_STATUS.ACTIVE
      ) {
        return null;
      }

      if (
        hydratedSession.user.emailVerificationStatus === "blocked_pending"
      ) {
        return null;
      }

      return hydratedSession;
    },
  },
};

// Export types for use in the application
export type Session = AuthInstance["$Infer"]["Session"];
export type User = AuthUser;
