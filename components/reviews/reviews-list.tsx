"use client";

import {
  CheckCircle2,
  Flag,
  Star,
  ThumbsDown,
  ThumbsUp,
  ChevronDown,
  PenSquare,
  Store,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { ReviewForm } from "./review-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AppImage } from "@/components/ui/app-image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Review {
  _id: string;
  rating: number;
  title?: string;
  comment: string;
  reply?: {
    comment: string;
    createdAt?: string;
    updatedAt?: string;
  };
  isVerified: boolean;
  createdAt: string;
  images?: string[];
  userId: {
    _id: string;
    name: string;
    image?: string;
  } | null;
}

interface RatingStats {
  average: number;
  total: number;
  breakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

interface ReviewsListProps {
  productId: string;
  locale: string;
}

type SortOption = "newest" | "oldest" | "highest" | "lowest";

type VoteState = {
  up: number;
  down: number;
  choice: "up" | "down" | null;
};

const stars = [5, 4, 3, 2, 1] as const;

type OrderItem = {
  productId?: string | { _id?: string };
};

type OrderRecord = {
  _id: string;
  status?: string;
  items?: OrderItem[];
};

export function ReviewsList({ productId, locale }: ReviewsListProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  const tf = (
    key: string,
    fallback: string,
    values?: Record<string, string | number>,
  ) => {
    if (t.has(key)) {
      return t(key as never, values as never);
    }
    if (!values) return fallback;
    return fallback.replace(/\{(\w+)\}/g, (_, token) =>
      String(values[token] ?? `{${token}}`),
    );
  };

  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [votes, setVotes] = useState<Record<string, VoteState>>({});
  const [isWriteReviewOpen, setIsWriteReviewOpen] = useState(false);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [eligibleOrderId, setEligibleOrderId] = useState<string | null>(null);
  const [reviewEligibilityError, setReviewEligibilityError] = useState<
    string | null
  >(null);

  const fetchReviews = useCallback(
    async (pageToLoad: number) => {
      try {
        const res = await fetch(
          `/api/reviews?productId=${productId}&page=${pageToLoad}&limit=12`,
        );
        const data = await res.json();

        if (data?.success) {
          const payload = data.data ?? {};
          const nextReviews: Review[] = Array.isArray(payload.reviews)
            ? (payload.reviews as Review[])
            : [];
          const nextStats: RatingStats | null = payload.stats ?? null;
          const hasNext: boolean = Boolean(payload.pagination?.hasNext);

          if (pageToLoad === 1) {
            setReviews(nextReviews);
          } else {
            setReviews((prev) => [...prev, ...nextReviews]);
          }

          setVotes((prev) => {
            const next = { ...prev };
            for (const r of nextReviews) {
              if (!next[r._id]) {
                next[r._id] = { up: 0, down: 0, choice: null };
              }
            }
            return next;
          });

          setStats(nextStats);
          setHasMore(hasNext);
        }
      } catch (error) {
        console.error("Failed to fetch reviews:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [productId],
  );

  useEffect(() => {
    const loadReviews = async () => {
      await fetchReviews(page);
    };

    void loadReviews();
  }, [fetchReviews, page]);

  const sortLabels: Record<SortOption, string> = {
    newest: tf("product.mostRecent", "Newest"),
    oldest: tf("reviews.oldest", "Oldest"),
    highest: tf("product.highestRated", "Highest Rated"),
    lowest: tf("product.lowestRated", "Lowest Rated"),
  };

  const displayedReviews = useMemo(() => {
    const filtered =
      selectedRating === null
        ? reviews
        : reviews.filter((review) => review.rating === selectedRating);

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortBy === "highest") return b.rating - a.rating;
      if (sortBy === "lowest") return a.rating - b.rating;
      if (sortBy === "oldest") {
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return sorted;
  }, [reviews, selectedRating, sortBy]);

  const statsData = useMemo(() => {
    if (stats) return stats;

    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let totalRating = 0;

    for (const review of reviews) {
      breakdown[review.rating as 1 | 2 | 3 | 4 | 5] += 1;
      totalRating += review.rating;
    }

    return {
      average: reviews.length ? totalRating / reviews.length : 0,
      total: reviews.length,
      breakdown,
    };
  }, [stats, reviews]);

  const recommendedCount = statsData.breakdown[5] + statsData.breakdown[4];
  const recommendedPct = statsData.total
    ? Math.round((recommendedCount / statsData.total) * 100)
    : 0;

  const handleVote = (reviewId: string, choice: "up" | "down") => {
    setVotes((prev) => {
      const current = prev[reviewId] || { up: 0, down: 0, choice: null };
      const next = { ...current };

      if (current.choice === choice) {
        if (choice === "up") next.up = Math.max(0, next.up - 1);
        if (choice === "down") next.down = Math.max(0, next.down - 1);
        next.choice = null;
      } else {
        if (choice === "up") {
          next.up += 1;
          if (current.choice === "down") next.down = Math.max(0, next.down - 1);
        }
        if (choice === "down") {
          next.down += 1;
          if (current.choice === "up") next.up = Math.max(0, next.up - 1);
        }
        next.choice = choice;
      }

      return { ...prev, [reviewId]: next };
    });
  };

  const resolveEligibleOrderId = useCallback(async (): Promise<
    string | null
  > => {
    const res = await fetch("/api/orders?page=1&limit=100");
    const data = await res.json();
    const orders: OrderRecord[] = Array.isArray(data?.data?.data)
      ? data.data.data
      : [];

    const eligible = orders.find((order) => {
      const status = String(order.status || "").toLowerCase();
      if (status !== "delivered" && status !== "completed") return false;
      const items = Array.isArray(order.items) ? order.items : [];
      return items.some((item) => {
        const rawProductId = item?.productId;
        const itemProductId =
          typeof rawProductId === "string"
            ? rawProductId
            : rawProductId?._id || "";
        return String(itemProductId) === String(productId);
      });
    });

    return eligible?._id || null;
  }, [productId]);

  const openWriteReview = async () => {
    setIsWriteReviewOpen(true);
    setReviewEligibilityError(null);
    setEligibleOrderId(null);

    if (!isAuthenticated) return;

    setIsCheckingEligibility(true);
    try {
      const orderId = await resolveEligibleOrderId();
      if (!orderId) {
        setReviewEligibilityError(
          tf(
            "reviews.eligibleOrderRequired",
            "You can review this product only after it is delivered in one of your orders.",
          ),
        );
      } else {
        setEligibleOrderId(orderId);
      }
    } catch {
      setReviewEligibilityError(
        tf("common.error", "Something went wrong while checking eligibility."),
      );
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  const handleReviewSuccess = async () => {
    setIsWriteReviewOpen(false);
    setSelectedRating(null);
    setPage(1);
    setIsLoading(true);
    await fetchReviews(1);
  };

  if (isLoading) {
    return <ReviewsListSkeleton />;
  }

  return (
    <section className="py-8">
      <div className="mb-8 flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-foreground">
          {tf("common.reviews", "Reviews")}
        </h2>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Button
            variant="outline"
            className="rounded-sm"
            onClick={() => void openWriteReview()}
          >
            <PenSquare className="mr-2 h-4 w-4" />
            {tf("reviews.writeReview", "Write a review")}
          </Button>
          <span>
            {displayedReviews.length} {tf("common.of", "of")} {statsData.total}{" "}
            {tf("common.reviews", "reviews").toLowerCase()}
          </span>
          <span className="h-4 w-px bg-border" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 font-medium text-foreground"
              >
                {tf("product.sortBy", "Sort By")}: {sortLabels[sortBy]}
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {(Object.keys(sortLabels) as SortOption[]).map((option) => (
                <DropdownMenuItem
                  key={option}
                  onClick={() => setSortBy(option)}
                >
                  {sortLabels[option]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={isWriteReviewOpen} onOpenChange={setIsWriteReviewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {tf("reviews.writeReview", "Write a review")}
            </DialogTitle>
            <DialogDescription>
              {tf(
                "reviews.writeReviewHint",
                "Your email address will not be published. Required fields are marked with an asterisk (*).",
              )}
            </DialogDescription>
          </DialogHeader>

          {!isAuthenticated ? (
            <div className="space-y-4 rounded-xl border border-border/70 p-4">
              <p className="text-sm text-muted-foreground">
                {tf(
                  "reviews.loginToReview",
                  "Please sign in to write a review for this product.",
                )}
              </p>
              <Button
                className="rounded-full"
                onClick={() =>
                  router.push(
                    `/${locale}/login?redirect=${encodeURIComponent(pathname || `/${locale}`)}`,
                  )
                }
              >
                {tf("common.login", "Login")}
              </Button>
            </div>
          ) : isCheckingEligibility ? (
            <div className="rounded-xl border border-border/70 p-4 text-sm text-muted-foreground">
              {tf(
                "reviews.checkingEligibility",
                "Checking your eligible orders...",
              )}
            </div>
          ) : reviewEligibilityError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {reviewEligibilityError}
            </div>
          ) : eligibleOrderId ? (
            <ReviewForm
              productId={productId}
              orderId={eligibleOrderId}
              onSuccess={() => void handleReviewSuccess()}
              onCancel={() => setIsWriteReviewOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <div className="space-y-3 border-b border-border/70 pb-8">
            <div className="flex items-end gap-4">
              <p className="text-5xl font-semibold leading-none text-foreground">
                {statsData.average.toFixed(1)}
              </p>

              <div className="space-y-1.5 pb-1">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star
                      key={index}
                      className={cn(
                        "h-4 w-4",
                        index < Math.round(statsData.average)
                          ? "fill-yellow-500 text-yellow-500"
                          : "text-muted-foreground/30",
                      )}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {statsData.total}{" "}
                    {tf("common.reviews", "reviews").toLowerCase()}
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">
                    {tf("reviews.verifiedByShop", "Verified by Shop")}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {recommendedCount} {tf("common.of", "out of")} {statsData.total} (
              {recommendedPct}%){" "}
              {tf(
                "reviews.recommendProduct",
                "reviewers recommend this product",
              )}
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-md font-semibold text-foreground">
              {tf("reviews.ratingSnapshot", "Rating snapshot")}
            </h3>

            <div className="space-y-3">
              {stars.map((value) => {
                const count = statsData.breakdown[value] || 0;
                const width = statsData.total
                  ? (count / statsData.total) * 100
                  : 0;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setSelectedRating((prev) =>
                        prev === value ? null : value,
                      )
                    }
                    className={cn(
                      "grid w-full grid-cols-[70px_1fr_28px] items-center gap-3 text-left",
                      selectedRating === value && "text-blue-700",
                    )}
                  >
                    <span className="text-sm text-muted-foreground">
                      {value} stars
                    </span>
                    <span className="h-2 rounded-full bg-muted">
                      <span
                        className="block h-2 rounded-full bg-blue-600"
                        style={{ width: `${width}%` }}
                      />
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="space-y-8">
          {displayedReviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
              {selectedRating
                ? tf(
                    "reviews.noReviewsForRating",
                    "No reviews for this rating yet",
                  )
                : tf("reviews.noReviews", "No reviews yet")}
            </div>
          ) : (
            displayedReviews.map((review) => {
              const vote = votes[review._id] || {
                up: 0,
                down: 0,
                choice: null,
              };

              return (
                <article
                  key={review._id}
                  className="border-b border-border/70 pb-8 last:border-b-0"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={review.userId?.image} />
                        <AvatarFallback>
                          {review.userId?.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="text-sm leading-tight">
                        <p className="font-semibold text-foreground">
                          {review.userId?.name ||
                            tf("reviews.anonymous", "Anonymous")}
                        </p>
                        {review.isVerified && (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            {tf("reviews.verified", "Verified customer")}
                          </p>
                        )}
                      </div>
                    </div>

                    <p className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(review.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>

                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={index}
                          className={cn(
                            "h-4 w-4",
                            index < review.rating
                              ? "fill-yellow-500 text-yellow-500"
                              : "text-muted-foreground/30",
                          )}
                        />
                      ))}
                    </div>
                    {review.rating >= 4 && (
                      <span className="text-xs text-muted-foreground">
                        {tf("reviews.highlyRecommended", "Highly recommended")}
                      </span>
                    )}
                  </div>

                  {review.title && (
                    <h4 className="mb-2 text-base font-semibold text-foreground">
                      {review.title}
                    </h4>
                  )}

                  <p className="mb-3 text-sm leading-relaxed text-foreground/90">
                    {review.comment}
                  </p>

                  {Array.isArray(review.images) && review.images.length > 0 && (
                    <div className="mb-4 flex gap-2">
                      {review.images.slice(0, 4).map((src, idx) => (
                        <div
                          key={`${review._id}-img-${idx}`}
                          className="relative h-20 w-20 overflow-hidden rounded-sm bg-muted"
                        >
                          <AppImage
                            src={src}
                            alt={`Review image ${idx + 1}`}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mb-4 flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{tf("product.helpful", "Helpful?")}</span>
                    <button
                      type="button"
                      onClick={() => handleVote(review._id, "up")}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-foreground",
                        vote.choice === "up" && "text-foreground",
                      )}
                    >
                      <ThumbsUp className="h-4 w-4" /> ({vote.up})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVote(review._id, "down")}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-foreground",
                        vote.choice === "down" && "text-foreground",
                      )}
                    >
                      <ThumbsDown className="h-4 w-4" /> ({vote.down})
                    </button>
                    <span className="ml-auto">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        <Flag className="h-4 w-4" />
                        {tf("product.report", "Report")}
                      </button>
                    </span>
                  </div>

                  {review.reply?.comment && (
                    <div className="ml-6 rounded-sm border-l-2 border-blue-600 bg-muted/40 px-4 py-3 sm:ml-12">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600/10 text-blue-700">
                          <Store className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          {tf("reviews.storeReply", "Store reply")}
                        </span>
                        {review.reply.createdAt && (
                          <span className="text-xs text-muted-foreground">
                            ·{" "}
                            {formatDistanceToNow(
                              new Date(review.reply.createdAt),
                              { addSuffix: true },
                            )}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {review.reply.comment}
                      </p>
                    </div>
                  )}
                </article>
              );
            })
          )}

          {hasMore && (
            <div className="pt-2">
              <Button
                variant="outline"
                className="rounded-full px-5"
                onClick={() => setPage((p) => p + 1)}
              >
                {tf("product.viewAllReviews", "Load more reviews")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ReviewsListSkeleton() {
  return (
    <section className="py-12">
      <div className="mb-8 border-b border-border/70 pb-5">
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>

        <div className="space-y-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-4 border-b border-border/70 pb-8">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-6 w-52" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
