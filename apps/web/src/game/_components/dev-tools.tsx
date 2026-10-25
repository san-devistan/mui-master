import { useFlags } from "@/game/_lib/flags"
import { useWallet } from "@/game/_lib/wallet"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import { Switch } from "@workspace/ui/components/switch"
import { useMutation } from "convex/react"
import { useId } from "react"

const AMOUNTS = [100, 1_000, 10_000] as const

// Testing without a checkout: switch Pro on or off (with premium on) and add holos to yourself.
// Shown only in dev mode (flags.ts, DEV_TOOLS=1 on the dev deployment).
export function DevTools() {
  const flags = useFlags()
  const wallet = useWallet()
  const setPro = useMutation(api.wallet.setPro)
  const addHolos = useMutation(api.wallet.addHolos)
  const proId = useId()
  if (!flags.dev || !wallet) return null

  return (
    <section aria-labelledby="dev-title" data-slot="dev-tools">
      <h2
        id="dev-title"
        className="text-2xl font-black tracking-tighter font-heading"
      >
        Dev
      </h2>
      {flags.premium ? (
        <div className="gap-3 flex items-center justify-between">
          <label htmlFor={proId} className="font-bold">
            Holotrack Pro
          </label>
          <Switch
            id={proId}
            checked={wallet.pro}
            onCheckedChange={(pro) => void setPro({ pro })}
          />
        </div>
      ) : null}
      <div className="gap-3 grid">
        <span className="font-bold">Add holos</span>
        <div className="gap-2 grid grid-cols-3">
          {AMOUNTS.map((amount) => (
            <Button
              key={amount}
              variant="game"
              onClick={() => void addHolos({ amount })}
            >
              +{amount.toLocaleString("en")}
            </Button>
          ))}
        </div>
      </div>
    </section>
  )
}
