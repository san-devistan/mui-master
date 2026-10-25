import { SiteFooter } from "@/legal/site-footer"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

// The legal pages' frame: the brand, a title with its date, the text, and the
// landing's footer. They scroll in their own container, like the landing.
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <div className="inset-0 fixed overflow-x-hidden overflow-y-auto overscroll-contain game-backdrop text-ink">
      <header className="max-w-3xl px-4 pt-6 sm:px-6 mx-auto game-safe-top">
        <Link
          to="/"
          className="gap-2 text-lg font-black inline-flex items-center font-heading"
        >
          <img
            src="/icon.svg"
            alt=""
            width={36}
            height={36}
            className="size-9"
          />
          Holotrack
        </Link>
      </header>
      <main className="max-w-3xl px-4 py-10 sm:px-6 mx-auto">
        <h1 className="text-3xl font-black tracking-tighter sm:text-4xl font-heading">
          {title}
        </h1>
        <p className="mt-2 text-sm text-ink/60">Last updated {updated}</p>
        <div className="mt-8 gap-8 grid">{children}</div>
      </main>
      <SiteFooter />
    </div>
  )
}

// One part of a legal page: a heading and its paragraphs or lists.
export function LegalSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="gap-3 grid text-pretty text-ink/80">
      <h2 className="text-xl font-black font-heading text-ink">{title}</h2>
      {children}
    </section>
  )
}

// A bullet list; each item is keyed by its `key`, a short unique label.
export function LegalList({
  items,
}: {
  items: ReadonlyArray<{ key: string; text: ReactNode }>
}) {
  return (
    <ul className="pl-5 gap-1.5 grid list-disc">
      {items.map(({ key, text }) => (
        <li key={key}>{text}</li>
      ))}
    </ul>
  )
}

// Where players reach us, for privacy requests and anything else.
export const CONTACT_EMAIL = "hello@holotrack.art"

export function ContactLink() {
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}`}
      className="font-bold text-ink underline"
    >
      {CONTACT_EMAIL}
    </a>
  )
}
