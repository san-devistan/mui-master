import { useCtaClick, type CtaPlacement } from "@/landing/landing-analytics"
import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { PackageOpenIcon } from "lucide-react"

// A real link into the game: /sign-in, where new and returning players alike get their code, then
// /play (straight to /play when already signed in). Crawlers follow it too.
export function PlayButton({
  placement,
  children,
}: {
  placement: CtaPlacement
  children: string
}) {
  const clicked = useCtaClick()
  return (
    <Button
      variant="game"
      nativeButton={false}
      onClick={() => clicked(placement)}
      render={({ role: _buttonRole, ...props }) => (
        <Link {...props} to="/sign-in" preload="intent">
          <PackageOpenIcon aria-hidden="true" />
          {children}
        </Link>
      )}
    />
  )
}
