import { errorText } from "@/game/_lib/wallet"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import {
  GameSettings,
  GameSettingsRow,
} from "@workspace/ui/components/game-settings"
import { useAction } from "convex/react"
import { CreditCardIcon, ExternalLinkIcon } from "lucide-react"
import { useState } from "react"

// The profile's billing, once the player has bought something: Stripe's billing portal
// (billing:portal), to cancel Pro, change their card or get their invoices.
export function BillingSettings() {
  const { data: hasBilling } = useQuery(convexQuery(api.billing.hasBilling, {}))
  const portal = useAction(api.billing.portal)
  const [busy, setBusy] = useState(false)
  // Stripe's portal is opening: the button stays off until it's there.
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!hasBilling) return null

  const open = async () => {
    setBusy(true)
    setError(null)
    try {
      const url = await portal()
      setLeaving(true)
      window.location.assign(url)
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <GameSettings id="billing-title" title="Billing">
      <GameSettingsRow
        Icon={CreditCardIcon}
        label="Subscription and receipts"
        detail={error ?? "Cancel Pro, change your card, get your invoices"}
      >
        <Button
          variant="game"
          size="icon-game"
          className="shrink-0"
          aria-label="Manage billing"
          disabled={busy || leaving}
          onClick={() => void open()}
        >
          <ExternalLinkIcon aria-hidden="true" />
        </Button>
      </GameSettingsRow>
    </GameSettings>
  )
}
