import { CheckCircle2, Cpu, Palette, ShoppingBag } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";

interface PageProps {
  params: Promise<{ locale: string }>;
}

const themes = [
  {
    key: "essential",
    status: "active" as const,
    accent: "from-slate-600 to-slate-800",
    icon: ShoppingBag,
  },
  {
    key: "electronics",
    status: "coming-soon" as const,
    accent: "from-blue-600 to-cyan-600",
    icon: Cpu,
  },
  {
    key: "luxe",
    status: "coming-soon" as const,
    accent: "from-amber-600 to-rose-600",
    icon: Palette,
  },
];

export default async function OnlineStoreThemePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });

  await requireAdminPageAccess(locale);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge variant="secondary" className="rounded-md px-2 py-1 text-xs">
          {t("admin.onlineStoreThemePage.badge")}
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("admin.onlineStoreThemePage.title")}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
          {t("admin.onlineStoreThemePage.description")}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {themes.map((theme) => {
          const Icon = theme.icon;
          const isActive = theme.status === "active";

          return (
            <Card
              key={theme.key}
              className={cn(
                "border-border/70 bg-card/95 transition-colors",
                isActive && "border-primary/50 shadow-sm",
              )}
            >
              <CardHeader className="space-y-4">
                <div
                  className={cn(
                    "h-24 rounded-xl bg-gradient-to-br p-4 text-white",
                    theme.accent,
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="rounded-lg bg-white/20 p-2 backdrop-blur-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    {isActive ? (
                      <Badge className="bg-white/20 text-white hover:bg-white/20">
                        {t("admin.onlineStoreThemePage.currentTheme")}
                      </Badge>
                    ) : (
                      <Badge className="bg-white/20 text-white hover:bg-white/20">
                        {t("admin.onlineStoreThemePage.comingSoon")}
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <CardTitle className="flex items-center gap-2">
                    {t(`admin.onlineStoreThemePage.themes.${theme.key}.name`, {
                      defaultMessage:
                        theme.key === "essential"
                          ? "Essential"
                          : theme.key === "electronics"
                            ? "Electronics"
                            : "Luxe",
                    })}
                    {isActive && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </CardTitle>
                  <CardDescription className="mt-1 text-sm">
                    {t(`admin.onlineStoreThemePage.themes.${theme.key}.description`, {
                      defaultMessage: "",
                    })}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t(`admin.onlineStoreThemePage.themes.${theme.key}.styleNote`, {
                    defaultMessage: "",
                  })}
                </p>

                {isActive ? (
                  <Button disabled className="w-full">
                    {t("admin.onlineStoreThemePage.active")}
                  </Button>
                ) : (
                  <Button variant="outline" disabled className="w-full">
                    {t("admin.onlineStoreThemePage.comingSoon")}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
