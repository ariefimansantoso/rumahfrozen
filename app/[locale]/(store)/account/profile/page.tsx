import { Suspense } from "react";
import { User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileForm } from "@/components/account/profile-form";
import { setRequestLocale, getTranslations } from "next-intl/server";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ProfilePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-full bg-primary/10">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {t("profile.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("profile.subtitle")}
          </p>
        </div>
      </div>

      {/* Profile Form */}
      <Suspense fallback={<ProfileFormSkeleton />}>
        <ProfileForm />
      </Suspense>
    </div>
  );
}

function ProfileFormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
      <Skeleton className="h-10 w-32 ml-auto" />
    </div>
  );
}
