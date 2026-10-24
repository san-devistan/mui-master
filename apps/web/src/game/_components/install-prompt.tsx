import {
  installGuide,
  type InstallGuide,
  type StepIcon,
} from "@/game/_lib/install-guide"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  EllipsisVerticalIcon,
  MenuIcon,
  PlusIcon,
  ShareIcon,
  SquarePlusIcon,
  type LucideIcon,
} from "lucide-react"
import { useState, useSyncExternalStore } from "react"

// The icon each browser shows for a step: iOS's Share and Add to Home Screen,
// Android's ⋮ and ☰ menus, and the Add button that ends it.
const ICONS: Record<StepIcon, LucideIcon> = {
  share: ShareIcon,
  add: SquarePlusIcon,
  dots: EllipsisVerticalIcon,
  menu: MenuIcon,
  install: PlusIcon,
}

// Once dismissed, never shown again on this browser.
const DISMISSED = "holotrack:install-prompt-dismissed"
const noSubscription = () => () => undefined

// The guide to show: on a phone, in the browser (not already the Home Screen
// app), and never dismissed.
function guideNow(): InstallGuide | null {
  if (matchMedia("(display-mode: standalone)").matches) return null
  // iOS's Home Screen apps also say so here.
  if ("standalone" in navigator && navigator.standalone === true) return null
  try {
    if (localStorage.getItem(DISMISSED)) return null
  } catch {
    // Storage blocked (private mode): shown, as it can't be remembered.
  }
  return installGuide(navigator.userAgent)
}

// Worked out once: useSyncExternalStore needs the same object back each time.
let cached: { guide: InstallGuide | null } | undefined
const guideToShow = () => (cached ??= { guide: guideNow() }).guide

// Shows, once, how to put the game on the phone's Home Screen in the browser
// it's open in: there it opens full screen and can send notifications.
export function InstallPrompt() {
  // None on the server; read from the browser once it's running.
  const guide = useSyncExternalStore(noSubscription, guideToShow, () => null)
  const [dismissed, setDismissed] = useState(false)

  function close(open: boolean) {
    if (open) return
    setDismissed(true)
    try {
      localStorage.setItem(DISMISSED, "1")
    } catch {
      // Storage blocked: it closes for now, and may show again next visit.
    }
  }

  if (!guide) return null
  return (
    <Dialog open={!dismissed} onOpenChange={close}>
      <DialogContent variant="game">
        <div className="gap-5 grid">
          <DialogHeader>
            <DialogTitle>Install the app</DialogTitle>
          </DialogHeader>
          <ol className="gap-3 grid" aria-label={`In ${guide.browser}`}>
            {guide.steps.map(({ icon, text }) => {
              const Icon = ICONS[icon]
              return (
                <li key={text} className="gap-3 font-bold flex items-center">
                  <span className="size-10 grid shrink-0 place-items-center rounded-xl border-2 border-ink/15 bg-card text-ink">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  {text}
                </li>
              )
            })}
          </ol>
          <DialogFooter variant="game">
            <Button
              variant="game"
              className="flex-1"
              onClick={() => close(false)}
            >
              Got it
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
