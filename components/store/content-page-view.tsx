import { sanitizeHtml } from "@/lib/sanitize";

interface ContentPageViewProps {
  title: string;
  content: string;
}

export function ContentPageView({ title, content }: ContentPageViewProps) {
  return (
    <section className="py-10 md:py-14">
      <div className="container mx-auto max-w-4xl px-4">
        <article className="rounded-2xl border border-border/70 bg-card/95 p-6 md:p-8">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
          <div
            className="rich-text-content mt-6 max-w-none text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
          />
        </article>
      </div>
    </section>
  );
}
