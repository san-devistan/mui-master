import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { PackageOpenIcon } from "lucide-react"

// A real link to the game, so crawlers follow it too.
export function PlayButton({ children }: { children: string }) {
  return (
    <Button
      variant="game"
      nativeButton={false}
      render={({ role: _buttonRole, ...props }) => (
        <Link {...props} to="/play" preload="intent">
          <PackageOpenIcon aria-hidden="true" />
          {children}
        </Link>
      )}
    />
  )
}
