"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSession as useBetterAuthSession } from "@/lib/auth-client";

interface ProfileContextValue {
  profileImage: string | null;
}

const ProfileContext = createContext<ProfileContextValue>({
  profileImage: null,
});

/**
 * AuthProvider fetches the user profile image once and shares it
 * across all components that use useAuth(), preventing duplicate
 * API calls to /api/user/profile.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session } = useBetterAuthSession();
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const userId = (session?.user as { id?: string } | undefined)?.id;

  useEffect(() => {
    if (!userId) {
      setProfileImage(null);
      return;
    }

    let isActive = true;

    (async () => {
      try {
        const res = await fetch("/api/user/profile");
        if (!res.ok) return;
        const json = (await res.json()) as {
          success?: boolean;
          data?: { user?: { image?: string | null } };
        };
        if (!json?.success) return;
        const image = json?.data?.user?.image ?? null;
        if (isActive) setProfileImage(image);
      } catch {
        // ignore
      }
    })();

    return () => {
      isActive = false;
    };
  }, [userId]);

  const value = useMemo(() => ({ profileImage }), [profileImage]);

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfileContext() {
  return useContext(ProfileContext);
}
