import { useWallet } from "@/game/_lib/wallet"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import { Switch } from "@workspace/ui/components/switch"
import { useMutation } from "convex/react"
import { useId } from "react"

const AMOUNTS = [100, 1_000, 10_000] as const

// Testing without a checkout: switch Pro on or off and add holos to yourself. Shown only where
// the backend has its dev tools on (DEV_TOOLS=1, the dev deployment).
export function DevTools() {
  const { data: on } = useQuery(convexQuery(api.wallet.devToolsOn, {}))
  const wallet = useWallet()
  const setPro = useMutation(api.wallet.setPro)
  const addHolos = useMutation(api.wallet.addHolos)
  const proId = useId()
  if (!on || !wallet) return null

  return (
    <section aria-labelledby="dev-title" data-slot="dev-tools">
      <h2
        id="dev-title"
        className="text-2xl font-black tracking-tighter font-heading"
      >
        Dev
      </h2>
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
