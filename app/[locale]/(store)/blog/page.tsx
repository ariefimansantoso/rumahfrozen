import Link from "next/link";
import { type Locale } from "@/config/i18n.config";
import { setRequestLocale } from "next-intl/server";
import { MoveRight } from "lucide-react";
import { AppImage } from "@/components/ui/app-image";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  getStorefrontBlogIndex,
  type BlogListItem,
} from "@/lib/blog/storefront-blog-posts";
import {
  BlogArticleCard,
  type BlogArticleCardData,
} from "@/components/store/blog/blog-article-card";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function toBlogArticleCard(post: BlogListItem): BlogArticleCardData {
  return {
    _id: post._id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    image: post.featuredImage?.url || "",
    imageAlt: post.featuredImage?.alt || post.title,
    authorName: post.authorName,
    authorImage: post.authorImage,
    publishedAt: post.publishedAt,
  };
}

export default async function BlogIndexPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const page = typeof sp.page === "string" ? parseInt(sp.page, 10) || 1 : 1;
  const search = typeof sp.search === "string" ? sp.search : "";
  const categorySlug = typeof sp.category === "string" ? sp.category : "";
  const tag = typeof sp.tag === "string" ? sp.tag : "";

  const { categories, items, pagination } = await getStorefrontBlogIndex({
    page,
    search,
    categorySlug,
    tag,
  });

  const featuredPost = page === 1 ? items[0] : undefined;
  const gridPosts = featuredPost ? items.slice(1) : items;
  const totalPages = pagination.totalPages;

  const buildHref = (nextPage: number) => {
    const next = new URLSearchParams();
    if (search) next.set("search", search);
    if (categorySlug) next.set("category", categorySlug);
    if (tag) next.set("tag", tag);
    if (nextPage > 1) next.set("page", String(nextPage));
    const queryString = next.toString();
    return `/${locale}/blog${queryString ? `?${queryString}` : ""}`;
  };

  return (
    <main className="bg-background">
      <div className="container mx-auto max-w-[1310px] px-4 pb-10 pt-12 md:pb-16 md:pt-14">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-[40px] md:leading-tight">
            Latest Guides and News
          </h1>
          <p className="mt-4 text-sm text-foreground/80 md:text-base">
            Stories from Overflow on design, user flows, UI, UX and more from
            the experts.
          </p>
        </div>

        {categories.length > 0 ? (
          <nav
            aria-label="Blog categories"
            className="mt-7 flex flex-wrap justify-center gap-3"
          >
            {categories.slice(0, 7).map((category) => {
              const isActive = category.slug === categorySlug;
              return (
                <Link
                  key={category._id}
                  href={`/${locale}/blog?category=${category.slug}`}
                  className={
                    isActive
                      ? "inline-flex h-7 min-w-20 items-center justify-center rounded-full bg-muted px-5 text-xs font-medium text-foreground"
                      : "inline-flex h-7 min-w-20 items-center justify-center rounded-full border border-border bg-background px-5 text-xs font-medium text-foreground/80 transition-colors hover:border-foreground/30 hover:text-foreground"
                  }
                >
                  {category.name}
                </Link>
              );
            })}
          </nav>
        ) : null}

        {items.length === 0 ? (
          <div className="mt-20 rounded-xl border border-dashed p-16 text-center text-muted-foreground">
            No articles published yet.
          </div>
        ) : (
          <>
            {featuredPost ? (
              <FeaturedPost post={featuredPost} locale={locale as Locale} />
            ) : null}

            {gridPosts.length > 0 ? (
              <div className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
                {gridPosts.map((post) => (
                  <BlogArticleCard
                    key={post._id}
                    article={toBlogArticleCard(post)}
                    locale={locale as Locale}
                  />
                ))}
              </div>
            ) : null}
          </>
        )}

        {totalPages > 1 ? (
          <Pagination className="mt-12">
            <PaginationContent>
              {page > 1 ? (
                <PaginationItem>
                  <PaginationPrevious href={buildHref(page - 1)} />
                </PaginationItem>
              ) : null}
              {Array.from({ length: totalPages })
                .slice(0, 7)
                .map((_, index) => {
                  const pageNumber = index + 1;
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        href={buildHref(pageNumber)}
                        isActive={page === pageNumber}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
              {page < totalPages ? (
                <PaginationItem>
                  <PaginationNext href={buildHref(page + 1)} />
                </PaginationItem>
              ) : null}
            </PaginationContent>
          </Pagination>
        ) : null}
      </div>
    </main>
  );
}

function formatDate(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function AuthorMeta({ post }: { post: BlogListItem }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
        {post.authorImage ? (
          <AppImage
            src={post.authorImage}
            alt={post.authorName}
            width={40}
            height={40}
            className="h-10 w-10 object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs font-semibold text-muted-foreground">
            {post.authorName.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {post.authorName}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDate(post.publishedAt)}
        </p>
      </div>
    </div>
  );
}

function ReadMoreLink({
  href,
  compact = false,
}: {
  href: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        compact
          ? "group inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-foreground/80 bg-background px-5 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
          : "group inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-foreground/80 bg-background px-6 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
      }
    >
      Read More
      <MoveRight
        strokeWidth={1.5}
        className={
          compact
            ? "h-4 w-4 transition-transform group-hover:translate-x-0.5"
            : "h-5 w-5 transition-transform group-hover:translate-x-0.5"
        }
      />
    </Link>
  );
}

function FeaturedPost({
  post,
  locale,
}: {
  post: BlogListItem;
  locale: Locale;
}) {
  const href = `/${locale}/blog/${post.slug}`;

  return (
    <article className="mt-20 grid items-center gap-10 md:grid-cols-[1.3fr_1fr] lg:gap-[60px]">
      <Link
        href={href}
        className="block aspect-[1.8/1] overflow-hidden rounded-xl bg-muted"
      >
        {post.featuredImage?.url ? (
          <AppImage
            src={post.featuredImage.url}
            alt={post.featuredImage.alt || post.title}
            width={760}
            height={442}
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-muted text-sm text-muted-foreground">
            No image
          </div>
        )}
      </Link>

      <div className="flex min-h-full flex-col justify-center">
        <Link href={href}>
          <h2 className="max-w-md text-2xl font-bold leading-tight text-foreground transition-colors hover:text-primary md:text-[32px]">
            {post.title}
          </h2>
        </Link>
        {post.excerpt ? (
          <p className="mt-8 max-w-md text-base leading-relaxed text-muted-foreground">
            {post.excerpt}
          </p>
        ) : null}
        <div className="mt-9 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <AuthorMeta post={post} />
          <ReadMoreLink href={href} />
        </div>
      </div>
    </article>
  );
}
