import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { sanitizeHtml } from "@/lib/sanitize";
import { getStorefrontSettings } from "@/lib/storefront-settings";

interface PageProps {
  params: Promise<{ locale: string; handle: string }>;
}

export default async function StoreCustomPage({ params }: PageProps) {
  const { locale, handle } = await params;
  setRequestLocale(locale);

  const { contentPages } = await getStorefrontSettings();

  const page = contentPages.customPages.find(
    (item) => item.handle === handle && item.visible,
  );

  if (!page) {
    notFound();
  }

  return (
    <section className="py-10 md:py-14">
      <div className="container mx-auto max-w-4xl px-4">
        <article className="rounded-2xl border border-border/70 bg-card/95 p-6 md:p-8">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{page.title}</h1>
          <div
            className="rich-text-content mt-6 max-w-none text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content) }}
          />
        </article>
      </div>
    </section>
  );
}
