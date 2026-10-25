import {
  InstallGuideDialog,
  useInstallGuide,
} from "@/game/_components/install-prompt"
import { useNotifications } from "@/game/_lib/notifications"
import { Button } from "@workspace/ui/components/button"
import {
  GameSettings,
  GameSettingsRow,
} from "@workspace/ui/components/game-settings"
import { Switch } from "@workspace/ui/components/switch"
import {
  onSoundChange,
  setSoundOn,
  soundOn,
  type SoundKind,
} from "@workspace/ui/lib/game/sound-settings"
import {
  BellIcon,
  DownloadIcon,
  MusicIcon,
  SmartphoneIcon,
  Volume2Icon,
} from "lucide-react"
import { useState, useSyncExternalStore } from "react"

// The profile's preferences, for this device: notifications, the game's sound
// effects, its music (song previews and the pack's waiting music), and, on a
// phone's browser, how to install the app.
export function PreferenceSettings() {
  return (
    <GameSettings id="preferences-title" title="Preferences">
      <NotificationsRow />
      <SoundRow
        kind="sfx"
        Icon={Volume2Icon}
        label="Sound effects"
        detail="Packs, cards and buttons"
      />
      <SoundRow
        kind="music"
        Icon={MusicIcon}
        label="Music"
        detail="Song previews"
      />
      <InstallRow />
    </GameSettings>
  )
}

// Opens the Home Screen guide again; only where the app can be installed and
// isn't yet.
function InstallRow() {
  const guide = useInstallGuide()
  const [open, setOpen] = useState(false)
  if (!guide) return null
  return (
    <GameSettingsRow
      Icon={SmartphoneIcon}
      label="Install the app"
      detail="On your Home Screen"
    >
      <Button
        variant="game"
        size="icon-game"
        className="shrink-0"
        aria-label="How to install the app"
        onClick={() => setOpen(true)}
      >
        <DownloadIcon aria-hidden="true" />
      </Button>
      <InstallGuideDialog guide={guide} open={open} onClose={setOpen} />
    </GameSettingsRow>
  )
}

// Pushes for a free pack ready, a bid on the player's auction, or being
// outbid; iOS only gets them once the app is on the Home Screen.
function NotificationsRow() {
  const { supported, ready, on, toggle } = useNotifications()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function change(next: boolean) {
    setBusy(true)
    setError(null)
    try {
      await toggle(next)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Something went wrong"
      )
    } finally {
      setBusy(false)
    }
  }

  let detail = "Free packs and auctions"
  if (supported === false) detail = "Add Holotrack to your Home Screen first"
  return (
    <GameSettingsRow
      Icon={BellIcon}
      label="Notifications"
      detail={
        error ? (
          <span role="alert" className="text-destructive">
            {error}
          </span>
        ) : (
          detail
        )
      }
    >
      <Switch
        aria-label="Notifications"
        checked={on ?? false}
        disabled={!supported || !ready || on === null || busy}
        onCheckedChange={(next) => void change(next)}
      />
    </GameSettingsRow>
  )
}

function SoundRow({
  kind,
  ...row
}: { kind: SoundKind } & Omit<
  React.ComponentProps<typeof GameSettingsRow>,
  "children"
>) {
  const on = useSyncExternalStore(
    onSoundChange,
    () => soundOn(kind),
    () => true
  )
  return (
    <GameSettingsRow {...row}>
      <Switch
        aria-label={row.label}
        checked={on}
        onCheckedChange={(next) => setSoundOn(kind, next)}
      />
    </GameSettingsRow>
  )
}
