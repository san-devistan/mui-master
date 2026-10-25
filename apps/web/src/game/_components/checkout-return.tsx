import { useNavigate, useSearch } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { usePostHog } from "posthog-js/react"
import { useEffect } from "react"

// Back from Stripe's checkout (/play?checkout=done or =cancelled): says how it went, once, then
// drops the search param. What was paid for lands by Stripe's webhook, a moment later.
export function CheckoutReturn() {
  const navigate = useNavigate()
  const posthog = usePostHog()
  const checkout = useSearch({
    strict: false,
    select: (search) => search.checkout,
  })

  useEffect(() => {
    if (checkout) posthog.capture("checkout_returned", { outcome: checkout })
  }, [checkout, posthog])

  const close = () => void navigate({ to: "/play", search: {}, replace: true })

  return (
    <Dialog
      open={checkout !== undefined}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent variant="game">
        <DialogHeader>
          <DialogTitle>
            {checkout === "done" ? "Thanks!" : "Checkout cancelled"}
          </DialogTitle>
          <DialogDescription>
            {checkout === "done"
              ? "Your purchase is on its way: it shows up here in a moment."
              : "Nothing was charged. The shop's still open whenever you want."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="game" onClick={close}>
            Back to packs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
