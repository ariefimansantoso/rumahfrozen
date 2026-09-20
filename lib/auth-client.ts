import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import type { UserRole } from "@/config/app.config";

/**
 * Better Auth Client Configuration
 * Client-side authentication utilities for React components
 */

const fallbackBaseURL =
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : fallbackBaseURL,
  plugins: [twoFactorClient()],
});

// Export commonly used hooks and functions
export const { signIn, signUp, signOut, useSession, getSession } = authClient;

// OAuth sign-in helpers
export const signInWithGoogle = (options?: {
  callbackURL?: string;
  errorCallbackURL?: string;
  newUserCallbackURL?: string;
}) => {
  return signIn.social({
    provider: "google",
    callbackURL: options?.callbackURL || "/",
    errorCallbackURL: options?.errorCallbackURL,
    newUserCallbackURL: options?.newUserCallbackURL,
  });
};

export const signInWithFacebook = (options?: {
  callbackURL?: string;
  errorCallbackURL?: string;
  newUserCallbackURL?: string;
}) => {
  return signIn.social({
    provider: "facebook",
    callbackURL: options?.callbackURL || "/",
    errorCallbackURL: options?.errorCallbackURL,
    newUserCallbackURL: options?.newUserCallbackURL,
  });
};

// Type-safe session with role and 2FA fields
export type ClientSession = {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
    role: UserRole;
    roles?: UserRole[];
    phone?: string;
    emailVerified: boolean;
    twoFactorEnabled?: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
} | null;
