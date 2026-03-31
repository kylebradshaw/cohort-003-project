import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

interface StarRatingDisplayProps {
  averageRating: number;
  totalRatings: number;
  className?: string;
}

export function StarRatingDisplay({
  averageRating,
  totalRatings,
  className,
}: StarRatingDisplayProps) {
  return (
    <span className={cn("flex items-center gap-1", className)}>
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < Math.round(averageRating);
        return (
          <Star
            key={i}
            className={cn(
              "size-3.5",
              filled ? "fill-amber-400 text-amber-400" : "fill-none text-muted-foreground/40"
            )}
          />
        );
      })}
      <span className="text-xs text-muted-foreground">
        {averageRating.toFixed(1)} ({totalRatings})
      </span>
    </span>
  );
}

interface StarRatingInputProps {
  currentRating: number | null;
  onRate: (rating: number) => void;
  disabled?: boolean;
  className?: string;
}

export function StarRatingInput({
  currentRating,
  onRate,
  disabled,
  className,
}: StarRatingInputProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? currentRating ?? 0;

  return (
    <span
      className={cn("flex items-center gap-0.5", className)}
      onMouseLeave={() => setHovered(null)}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const value = i + 1;
        const filled = value <= active;
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onRate(value)}
            onMouseEnter={() => setHovered(value)}
            aria-label={`Rate ${value} star${value !== 1 ? "s" : ""}`}
            className={cn(
              "rounded p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            )}
          >
            <Star
              className={cn(
                "size-6",
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "fill-none text-muted-foreground/40"
              )}
            />
          </button>
        );
      })}
    </span>
  );
}
