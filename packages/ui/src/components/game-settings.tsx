import { TriangleAlertIcon, type LucideIcon } from "lucide-react"
import type * as React from "react"

// A titled panel of settings rows; `danger` makes it red, for what can't be
// undone (with a warning sign by its title).
function GameSettings({
  id,
  title,
  danger = false,
  children,
}: {
  id: string
  title: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} className="mt-8 gap-3 grid">
      <h2
        id={id}
        data-danger={danger || undefined}
        className="gap-2 text-2xl font-black tracking-tighter flex items-center font-heading data-danger:text-destructive"
      >
        {danger ? (
          <TriangleAlertIcon
            aria-hidden="true"
            className="size-6"
            strokeWidth={2.75}
          />
        ) : null}
        {title}
      </h2>
      <div data-slot="settings-panel" data-danger={danger || undefined}>
        {children}
      </div>
    </section>
  )
}

// One setting: its icon on a disc, its name over its value or a note, and
// what it does (`children`) at the end.
function GameSettingsRow({
  Icon,
  label,
  detail,
  children,
}: {
  Icon: LucideIcon
  label: string
  detail: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div data-slot="settings-row">
      <span data-slot="settings-row-icon">
        <Icon aria-hidden="true" />
      </span>
      <div className="min-w-0 gap-0.5 grid flex-1">
        <span className="text-xs font-bold tracking-wide text-ink/55 uppercase">
          {label}
        </span>
        <span className="font-bold truncate">{detail}</span>
      </div>
      {children}
    </div>
  )
}

export { GameSettings, GameSettingsRow }
