import { cn } from "@workspace/ui/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

const countBadgeVariants = cva("game-count-badge", {
  variants: {
    size: {
      // On a card's corner, scaled with the card (an @container/thumb). An
      // artist card's wavy edge runs further in (SongCardThumb's data-kind):
      // the badge clears it.
      card: "absolute top-[6cqw] right-[3cqw] z-1 text-[5cqw] in-data-[kind=artist]:right-[7cqw]",
      // On a card's top left corner, opposite the copies.
      "card-start":
        "absolute top-[6cqw] left-[3cqw] z-1 text-[5cqw] in-data-[kind=artist]:left-[7cqw]",
      // On its own, e.g. a screen's corner.
      screen: "text-base",
    },
  },
  defaultVariants: { size: "screen" },
})

const finishes = {
  // The copies badge's brushed silver.
  silver: "",
  // Gold, for a price.
  price: "game-badge-price",
  // Steel, for a time left.
  time: "game-badge-time",
}

// The copies badge's pill, holding anything: a price, a time left. Placed like
// CountBadge, by `size`; `finish` sets its metal.
function GameBadge({
  size,
  finish = "silver",
  className,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof countBadgeVariants> & {
    finish?: keyof typeof finishes
  }) {
  return (
    <span
      data-slot="game-badge"
      className={cn(
        countBadgeVariants({ size }),
        "inline-flex items-center gap-[0.35em]",
        finishes[finish],
        className
      )}
      {...props}
    />
  )
}

// How many copies of a card the player holds, as "×2"; nothing for one.
function CountBadge({
  count,
  size,
  className,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof countBadgeVariants> & { count: number }) {
  if (count < 2) return null
  return (
    <span
      data-slot="count-badge"
      className={cn(countBadgeVariants({ size }), className)}
      aria-label={`${count} copies`}
      {...props}
    >
      ×{count}
    </span>
  )
}

export { CountBadge, GameBadge }
