import { CollectionSearch } from "@/game/_components/collection-search"
import type { RarityFilter } from "@/game/_lib/rarity-filter"
import { Button } from "@workspace/ui/components/button"
import { Marquee } from "@workspace/ui/components/marquee"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { ListFilterIcon, SearchIcon, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

const RARITIES = {
  all: "All rarities",
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
} as const satisfies Record<RarityFilter, string>

// Filters share the row on phones (shrinking, so the search button stays in
// view); wider, they keep their size and the search button sits at the end.
const TRIGGER_CLASS = "min-w-0 flex-1 sm:flex-none sm:min-w-48"

// A card grid's filters (`children`) and a button opening the search at the
// row's end; the search field takes their place while open (`search` not
// null). `label` names the search.
export function CardToolbar({
  search,
  onSearch,
  label,
  children,
}: {
  search: string | null
  onSearch: (text: string | null) => void
  label: string
  children: ReactNode
}) {
  if (search !== null) {
    return (
      <CollectionSearch
        text={search}
        label={label}
        onText={onSearch}
        onClose={() => onSearch(null)}
      />
    )
  }
  return (
    <div className="mt-5 gap-3 flex">
      {children}
      {/* At the row's end, where the search's close button takes its place. */}
      <Button
        variant="game"
        size="icon-game"
        className="ml-auto shrink-0"
        aria-label={label}
        onClick={() => onSearch("")}
      >
        <SearchIcon aria-hidden="true" />
      </Button>
    </div>
  )
}

export function RaritySelect({
  value,
  onValue,
}: {
  value: RarityFilter
  onValue: (value: RarityFilter) => void
}) {
  return (
    <Select
      items={RARITIES}
      value={value}
      onValueChange={(next) => {
        if (next) onValue(next)
      }}
    >
      <SelectTrigger
        variant="game"
        aria-label="Filter by rarity"
        className={TRIGGER_CLASS}
      >
        <ListFilterIcon aria-hidden="true" />
        <SelectValue>
          {(chosen: RarityFilter) => (
            <Marquee className="flex-1">{RARITIES[chosen]}</Marquee>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent variant="game">
        {Object.entries(RARITIES).map(([key, name]) => (
          <SelectItem key={key} value={key}>
            <span
              data-rarity={key === "all" ? undefined : key}
              className="size-3 self-center rounded-full border-2 border-ink not-data-rarity:game-rarity-grid data-rarity:game-fill"
              aria-hidden="true"
            />
            <Marquee className="flex-1">{name}</Marquee>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// One of `options`, each listed with its icon; the trigger leads with `Icon`.
export function OptionSelect<Key extends string>({
  options,
  value,
  onValue,
  label,
  Icon,
}: {
  options: Record<Key, { label: string; Icon: LucideIcon }>
  value: Key
  onValue: (value: Key) => void
  label: string
  Icon: LucideIcon
}) {
  const keys = Object.keys(options).filter((key): key is Key => key in options)
  return (
    <Select
      items={Object.fromEntries(keys.map((key) => [key, options[key].label]))}
      value={value}
      onValueChange={(next) => {
        if (next) onValue(next)
      }}
    >
      <SelectTrigger
        variant="game"
        aria-label={label}
        className={TRIGGER_CLASS}
      >
        <Icon aria-hidden="true" />
        <SelectValue>
          {(chosen: Key) => (
            <Marquee className="flex-1">{options[chosen].label}</Marquee>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent variant="game">
        {keys.map((key) => {
          const { label: name, Icon: ItemIcon } = options[key]
          return (
            <SelectItem key={key} value={key}>
              <ItemIcon aria-hidden="true" strokeWidth={2.5} />
              <Marquee className="flex-1">{name}</Marquee>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
