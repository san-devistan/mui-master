import { SignInPage } from "@/auth/sign-in-page"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/sign-in")({
  head: () => ({
    meta: [
      { title: "Sign in · Holotrack" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignInPage,
})
