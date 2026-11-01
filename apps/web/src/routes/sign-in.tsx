import { SignInPage } from "@/auth/sign-in-page"
import { createFileRoute } from "@tanstack/react-router"

type SignInSearch = { ref?: string }

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>): SignInSearch =>
    typeof search.ref === "string" && search.ref.length <= 64
      ? { ref: search.ref }
      : {},
  head: () => ({
    meta: [
      { title: "Sign in · Holotrack" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignInPage,
})
