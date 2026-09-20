import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { ArrowLeft, Calendar, Clock, MessageCircle } from "lucide-react";
import { AppImage } from "@/components/ui/app-image";
import { sanitizeHtml } from "@/lib/sanitize";
import { Badge } from "@/components/ui/badge";
import { CommentsSection } from "@/components/store/blog/comments-section";
import { BlogPostViewTracker } from "@/components/store/blog/blog-post-view-tracker";
import { getPublishedBlogPostDetail } from "@/lib/blog/storefront-blog-posts";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublishedBlogPostDetail(slug);
  if (!data) return {};
  const { post } = data;
  return {
    title: post.seo?.pageTitle || post.title,
    description: post.seo?.metaDescription || post.excerpt || undefined,
    openGraph: {
      title: post.seo?.pageTitle || post.title,
      description: post.seo?.metaDescription || post.excerpt || undefined,
      images: post.featuredImage?.url ? [post.featuredImage.url] : undefined,
      type: "article",
    },
  };
}

export default async function BlogDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const data = await getPublishedBlogPostDetail(slug);
  if (!data) notFound();
  const { post, related } = data;
  const author = post.author?.name || post.authorName || "Author";

  return (
    <article className="bg-background">
      <BlogPostViewTracker slug={slug} />
      <div className="container mx-auto px-4 pt-8">
        <Link
          href={`/${locale}/blog`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All articles
        </Link>
      </div>

      <header className="container mx-auto max-w-4xl px-4 pt-6 pb-8 text-center">
        {post.categories && post.categories.length > 0 ? (
          <div className="mb-3 flex flex-wrap justify-center gap-1">
            {post.categories.map((c) => (
              <Link key={c._id} href={`/${locale}/blog?category=${c.slug}`}>
                <Badge variant="secondary">{c.name}</Badge>
              </Link>
            ))}
          </div>
        ) : null}
        <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl lg:text-5xl">
          {post.title}
        </h1>
        {post.excerpt ? (
          <p className="mt-4 text-base text-muted-foreground md:text-lg">{post.excerpt}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="relative h-8 w-8 overflow-hidden rounded-full bg-muted">
              {post.author?.image ? (
                <AppImage
                  src={post.author.image}
                  alt={author}
                  width={32}
                  height={32}
                  className="h-8 w-8 object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-xs font-semibold">
                  {author.slice(0, 1)}
                </div>
              )}
            </div>
            <span className="font-medium text-foreground">{author}</span>
          </div>
          {post.publishedAt ? (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(post.publishedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          ) : null}
          {post.readingTime ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {post.readingTime} min read
            </span>
          ) : null}
          {post.allowComments ? (
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4" />
              {post.commentCount ?? 0} comments
            </span>
          ) : null}
        </div>
      </header>

      {post.featuredImage?.url ? (
        <div className="container mx-auto max-w-5xl px-4">
          <div className="aspect-[16/8] overflow-hidden rounded-2xl bg-muted">
            <AppImage
              src={post.featuredImage.url}
              alt={post.featuredImage.alt || post.title}
              width={1200}
              height={600}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      ) : null}

      <div className="container mx-auto max-w-3xl px-4 py-12">
        <div
          className="rich-text-content max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
        />

        {post.tags && post.tags.length > 0 ? (
          <div className="mt-10 flex flex-wrap gap-2 border-t pt-6">
            {post.tags.map((t) => (
              <Link key={t} href={`/${locale}/blog?tag=${t}`}>
                <Badge variant="outline" className="capitalize">
                  #{t}
                </Badge>
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {related && related.length > 0 ? (
        <section className="border-t bg-muted/20 py-12">
          <div className="container mx-auto px-4">
            <h2 className="mb-6 text-2xl font-bold tracking-tight">Related articles</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <Link
                  key={p._id}
                  href={`/${locale}/blog/${p.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md"
                >
                  <div className="aspect-[16/10] overflow-hidden bg-muted">
                    {p.featuredImage?.url ? (
                      <AppImage
                        src={p.featuredImage.url}
                        alt={p.title}
                        width={640}
                        height={400}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <h3 className="line-clamp-2 font-semibold group-hover:text-primary">
                      {p.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {p.excerpt || ""}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {post.allowComments ? (
        <section className="container mx-auto max-w-3xl px-4 py-12">
          <CommentsSection postId={post._id} />
        </section>
      ) : null}
    </article>
  );
}
