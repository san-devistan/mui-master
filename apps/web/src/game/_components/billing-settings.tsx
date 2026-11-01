import { errorText, proUntilDay } from "@/game/_lib/wallet"
import { CONTACT_EMAIL } from "@/legal/legal-page"
import { authClient } from "@/lib/auth-client"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import {
  GameSettings,
  GameSettingsRow,
} from "@workspace/ui/components/game-settings"
import { useAction } from "convex/react"
import {
  CreditCardIcon,
  CrownIcon,
  ExternalLinkIcon,
  MailIcon,
  ReceiptTextIcon,
} from "lucide-react"
import { useState } from "react"

// The profile's billing, only for a real Stripe Pro subscription: its end date once cancelled,
// Stripe's billing portal (billing:portal), and a refund request emailed to us.
export function BillingSettings() {
  const { data: billing } = useQuery(convexQuery(api.billing.proBilling, {}))
  const { data: session } = authClient.useSession()
  const portal = useAction(api.billing.portal)
  const [busy, setBusy] = useState(false)
  // Stripe's portal is opening: the button stays off until it's there.
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!billing) return null
  const proUntil = proUntilDay(billing.endsAt ?? 0)

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
      {proUntil ? (
        <GameSettingsRow
          Icon={CrownIcon}
          label="Holotrack Pro"
          detail={`Pro active until ${proUntil}`}
        />
      ) : null}
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
      <GameSettingsRow
        Icon={ReceiptTextIcon}
        label="Refunds"
        detail="Request a refund"
      >
        <Button
          variant="game"
          size="icon-game"
          className="shrink-0"
          nativeButton={false}
          aria-label="Request a refund by email"
          render={({ role: _buttonRole, ...props }) => (
            <a {...props} href={refundEmail(session?.user.email)}>
              <MailIcon aria-hidden="true" />
            </a>
          )}
        />
      </GameSettingsRow>
    </GameSettings>
  )
}

function refundEmail(accountEmail: string | undefined) {
  const subject = encodeURIComponent("Holotrack refund request")
  const body = encodeURIComponent(
    `Hi,\n\nI'd like to request a refund.\n\nAccount email: ${accountEmail ?? ""}\nPurchase: \nReason: \n`
  )
  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
}
