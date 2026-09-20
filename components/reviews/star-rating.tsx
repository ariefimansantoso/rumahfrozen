"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  className?: string;
}

export function StarRating({
  rating,
  maxRating = 5,
  size = "md",
  showValue = false,
  interactive = false,
  onChange,
  className,
}: StarRatingProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const handleClick = (index: number) => {
    if (interactive && onChange) {
      onChange(index + 1);
    }
  };

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: maxRating }).map((_, index) => {
        const filled = index < Math.floor(rating);
        const partial = !filled && index < rating;
        const percentage = partial ? (rating - index) * 100 : 0;

        return (
          <button
            key={index}
            type="button"
            className={cn(
              "relative",
              interactive &&
                "cursor-pointer hover:scale-110 transition-transform",
              !interactive && "cursor-default"
            )}
            onClick={() => handleClick(index)}
            disabled={!interactive}
          >
            {/* Background star (empty) */}
            <Star
              className={cn(sizeClasses[size], "text-muted-foreground/30")}
            />
            {/* Foreground star (filled) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: filled ? "100%" : `${percentage}%` }}
            >
              <Star
                className={cn(
                  sizeClasses[size],
                  "fill-yellow-400 text-yellow-400"
                )}
              />
            </div>
          </button>
        );
      })}
      {showValue && (
        <span className="ml-1.5 text-sm font-medium text-muted-foreground">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}

interface InteractiveStarRatingProps {
  value: number;
  onChange: (rating: number) => void;
  size?: "sm" | "md" | "lg";
}

export function InteractiveStarRating({
  value,
  onChange,
  size = "lg",
}: InteractiveStarRatingProps) {
  const sizeClasses = {
    sm: "h-5 w-5",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="hover:scale-110 transition-transform"
        >
          <Star
            className={cn(
              sizeClasses[size],
              star <= value
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/30 hover:text-yellow-400"
            )}
          />
        </button>
      ))}
    </div>
  );
}
