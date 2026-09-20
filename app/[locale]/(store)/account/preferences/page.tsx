import { Settings2 } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PreferencesForm } from "@/components/account/preferences-form";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function PreferencesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings2 className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">
            {t("customerProfile.preferences")}
          </h1>
          <p className="text-muted-foreground">
            {t("customerProfile.preferencesDesc")}
          </p>
        </div>
      </div>
      <PreferencesForm />
    </div>
  );
}
