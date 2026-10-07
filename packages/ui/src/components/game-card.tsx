import { cn } from "@workspace/ui/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

const gameCardVariants = cva(
  "group/game-card shadow-md relative flex aspect-5/7 w-full flex-col overflow-hidden rounded-2xl border-2 bg-card text-left text-card-foreground transition-transform",
  {
    variants: {
      rarity: {
        common: "border-rarity-common",
        rare: "border-rarity-rare shadow-rarity-rare/20",
        epic: "shadow-lg border-rarity-epic shadow-rarity-epic/30",
        legendary:
          "shadow-xl border-rarity-legendary shadow-rarity-legendary/40",
      },
      state: {
        owned: "",
        locked: "opacity-45 grayscale",
      },
    },
    defaultVariants: {
      rarity: "common",
      state: "owned",
    },
  }
)

const gameCardRarityVariants = cva(
  "px-2 py-0.5 text-xs font-semibold tracking-wide rounded-full uppercase",
  {
    variants: {
      rarity: {
        common: "bg-rarity-common text-background",
        rare: "bg-rarity-rare text-background",
        epic: "bg-rarity-epic text-background",
        legendary: "bg-rarity-legendary text-foreground",
      },
    },
    defaultVariants: { rarity: "common" },
  }
)

type GameCardRarity = NonNullable<
  VariantProps<typeof gameCardVariants>["rarity"]
>

function GameCard({
  className,
  rarity,
  state,
  ...props
}: React.ComponentProps<"article"> & VariantProps<typeof gameCardVariants>) {
  return (
    <article
      data-slot="game-card"
      className={cn(gameCardVariants({ rarity, state }), className)}
      {...props}
    />
  )
}

function GameCardButton({
  className,
  type = "button",
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      data-slot="game-card-button"
      type={type}
      className={cn(
        "block w-full rounded-2xl transition-transform outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95",
        className
      )}
      {...props}
    />
  )
}

function GameCardReveal({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="game-card-reveal"
      className={cn(
        "animate-in fade-in zoom-in-75 slide-in-from-bottom-8 relative duration-500 nth-2:delay-150 nth-3:delay-300 nth-4:delay-500 nth-5:delay-700",
        className
      )}
      {...props}
    />
  )
}

function GameCardArt({
  className,
  src,
  alt,
  ...props
}: React.ComponentProps<"img">) {
  return (
    <div
      data-slot="game-card-art"
      className="min-h-0 relative w-full flex-1 overflow-hidden bg-muted"
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={cn("size-full object-cover", className)}
          {...props}
        />
      ) : null}
    </div>
  )
}

function GameCardRarity({
  rarity,
  className,
  ...props
}: React.ComponentProps<"span"> & { rarity: GameCardRarity }) {
  return (
    <span
      data-slot="game-card-rarity"
      className={cn(gameCardRarityVariants({ rarity }), className)}
      {...props}
    />
  )
}

function GameCardBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="game-card-body"
      className={cn("gap-1 p-2.5 flex shrink-0 flex-col", className)}
      {...props}
    />
  )
}

function GameCardTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="game-card-title"
      className={cn(
        "text-sm leading-tight font-semibold line-clamp-2 font-heading",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  )
}

function GameCardMeta({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="game-card-meta"
      className={cn("text-xs truncate text-muted-foreground", className)}
      {...props}
    />
  )
}

function GameCardStats({ className, ...props }: React.ComponentProps<"dl">) {
  return (
    <dl
      data-slot="game-card-stats"
      className={cn(
        "gap-1 text-xs mt-auto grid grid-cols-2 font-heading",
        className
      )}
      {...props}
    />
  )
}

function GameCardStat({
  label,
  value,
  className,
  ...props
}: React.ComponentProps<"div"> & { label: string; value: React.ReactNode }) {
  return (
    <div
      data-slot="game-card-stat"
      className={cn(
        "px-1.5 py-0.5 flex items-center justify-between rounded-md bg-muted",
        className
      )}
      {...props}
    >
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  )
}

export {
  GameCard,
  GameCardArt,
  GameCardBody,
  GameCardButton,
  GameCardMeta,
  GameCardRarity,
  GameCardReveal,
  GameCardStat,
  GameCardStats,
  GameCardTitle,
  gameCardVariants,
  type GameCardRarity as GameCardRarityValue,
}
