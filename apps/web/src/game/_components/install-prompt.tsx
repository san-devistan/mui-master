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

// Once dismissed, never shown again on its own on this browser; the profile's
// preferences can still open it.
const DISMISSED = "holotrack:install-prompt-dismissed"
const noSubscription = () => () => undefined

// The guide for this browser: on a phone, in the browser (not already the
// Home Screen app).
function guideHere(): InstallGuide | null {
  if (matchMedia("(display-mode: standalone)").matches) return null
  // iOS's Home Screen apps also say so here.
  if ("standalone" in navigator && navigator.standalone === true) return null
  return installGuide(navigator.userAgent)
}

function dismissedBefore() {
  try {
    return localStorage.getItem(DISMISSED) !== null
  } catch {
    // Storage blocked (private mode): shown, as it can't be remembered.
    return false
  }
}

// Worked out once: useSyncExternalStore needs the same object back each time.
let cached: { guide: InstallGuide | null; dismissed: boolean } | undefined
const here = () =>
  (cached ??= { guide: guideHere(), dismissed: dismissedBefore() })

// How to put the game on the phone's Home Screen in the browser it's open in
// (there it opens full screen and can send notifications); null where there's
// nothing to install, on a computer or already in the app. None on the server.
export function useInstallGuide() {
  return useSyncExternalStore(
    noSubscription,
    () => here().guide,
    () => null
  )
}

// Shows the install guide once, on its own, until dismissed.
export function InstallPrompt() {
  const guide = useInstallGuide()
  const seen = useSyncExternalStore(
    noSubscription,
    () => here().dismissed,
    () => true
  )
  const [dismissed, setDismissed] = useState(false)

  function close(open: boolean) {
    if (open) return
    setDismissed(true)
    rememberDismissed()
  }

  if (!guide || seen) return null
  return <InstallGuideDialog guide={guide} open={!dismissed} onClose={close} />
}

function rememberDismissed() {
  try {
    localStorage.setItem(DISMISSED, "1")
  } catch {
    // Storage blocked: it closes for now, and may show again next visit.
  }
}

// The guide's steps, each by the icon its browser shows.
export function InstallGuideDialog({
  guide,
  open,
  onClose,
}: {
  guide: InstallGuide
  open: boolean
  onClose: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
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
              onClick={() => onClose(false)}
            >
              Got it
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
