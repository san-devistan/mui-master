import { errorText } from "@/game/_lib/wallet"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import {
  GameSettings,
  GameSettingsRow,
} from "@workspace/ui/components/game-settings"
import { useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { CheckIcon, GiftIcon, ShareIcon } from "lucide-react"
import { usePostHog } from "posthog-js/react"
import { useEffect, useState } from "react"

type Referral = FunctionReturnType<typeof api.referrals.mine>

// A player's invite link: 5 packs for this player and for each new player who joins with it.
export function ReferralSettings() {
  const load = useMutation(api.referrals.mine)
  const [referral, setReferral] = useState<Referral | null>(null)
  const posthog = usePostHog()
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    void load({})
      .then((loaded) => {
        if (current) setReferral(loaded)
        return loaded
      })
      .catch((caught: unknown) => {
        if (current) setError(errorText(caught))
      })
    return () => {
      current = false
    }
  }, [load])
  if (!referral) return null

  const reward = `${referral.rewardPacks} packs`
  const detail =
    error ??
    (referral.joined === 0
      ? `Get ${reward} for each friend who joins`
      : `${referral.joined} joined · ${reward} each`)

  async function share() {
    if (!referral) return
    const url = `${window.location.origin}/sign-in?ref=${encodeURIComponent(referral.code)}`
    setError(null)
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Holotrack",
          text: `Join me on Holotrack and get ${referral.rewardPacks} free packs.`,
          url,
        })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }
      posthog.capture("referral_link_shared")
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return
      setError(errorText(caught))
    }
  }

  return (
    <GameSettings id="referrals-title" title="Invite friends">
      <GameSettingsRow Icon={GiftIcon} label="Referral" detail={detail}>
        <Button
          variant="game"
          size="icon-game"
          className="shrink-0"
          aria-label={copied ? "Invite link copied" : "Share your invite link"}
          onClick={() => void share()}
        >
          {copied ? (
            <CheckIcon aria-hidden="true" />
          ) : (
            <ShareIcon aria-hidden="true" />
          )}
        </Button>
      </GameSettingsRow>
    </GameSettings>
  )
}
