import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setRequestLocale } from "next-intl/server";
import { requireAdminPageAccess } from "@/lib/admin-page-guard";
import { FileText, ListTree, Palette, PanelsTopLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PageProps {
  params: Promise<{ locale: string }>;
}

const channelSections = [
  {
    title: "Themes",
    description:
      "Review your active storefront theme and track upcoming industry-focused themes.",
    href: "/admin/online-store/theme",
    icon: Palette,
  },
  {
    title: "Home",
    description:
      "Manage storefront hero content, featured collections, and key conversion blocks.",
    href: "/admin/online-store/home-page",
    icon: PanelsTopLeft,
  },
  {
    title: "Pages",
    description: "Manage storefront pages like Privacy Policy and more.",
    href: "/admin/online-store/pages",
    icon: FileText,
  },
  {
    title: "Menus",
    description: "Manage storefront navigation menus for header and footer locations.",
    href: "/admin/online-store/menus",
    icon: ListTree,
  },
];

export default async function OnlineStorePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireAdminPageAccess(locale);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge variant="secondary" className="rounded-md px-2 py-1 text-xs">
          Sales Channel
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Online Store</h1>
        <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
          Configure your storefront experience with a structure aligned to modern ecommerce dashboards.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {channelSections.map((section) => {
          const Icon = section.icon;

          return (
            <Card key={section.title} className="border-border/70 bg-card/95">
              <CardHeader className="space-y-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>{section.title}</CardTitle>
                  <CardDescription className="mt-1 text-sm">
                    {section.description}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild size="sm">
                  <Link href={section.href}>Open {section.title}</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
