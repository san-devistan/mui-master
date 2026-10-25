import { explainAuthError, USERNAME_INPUT } from "@/auth/account"
import { authClient } from "@/lib/auth-client"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  GameSettings,
  GameSettingsRow,
} from "@workspace/ui/components/game-settings"
import { Input } from "@workspace/ui/components/input"
import {
  AtSignIcon,
  CheckIcon,
  LogOutIcon,
  MailIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"
import { usePostHog } from "posthog-js/react"
import { useId, useState } from "react"

// The profile's account settings: a panel with the player's email and their
// username (unique across players, any case, changed in a dialog).
export function AccountSettings() {
  const { data: session } = authClient.useSession()
  const user = session?.user
  if (!user) return null
  return (
    <GameSettings id="account-title" title="Account">
      <GameSettingsRow Icon={MailIcon} label="Email" detail={user.email} />
      <UsernameRow current={user.displayUsername ?? user.username ?? ""} />
    </GameSettings>
  )
}

// The username, with an edit button that opens a dialog to change it.
function UsernameRow({ current }: { current: string }) {
  const [editing, setEditing] = useState(false)
  return (
    <GameSettingsRow Icon={AtSignIcon} label="Username" detail={current}>
      <Button
        variant="game"
        size="icon-game"
        className="shrink-0"
        aria-label="Edit your username"
        onClick={() => setEditing(true)}
      >
        <PencilIcon aria-hidden="true" />
      </Button>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent variant="game">
          {/* Remounted each time it opens, so it starts from the saved name. */}
          {editing ? (
            <UsernameForm current={current} onSaved={() => setEditing(false)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </GameSettingsRow>
  )
}

// The username dialog's field and Save button; closes once it's saved. It
// shows the saved username until the player types.
function UsernameForm({
  current,
  onSaved,
}: {
  current: string
  onSaved: () => void
}) {
  const posthog = usePostHog()
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  const username = draft ?? current
  const next = username.trim()

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const { error: failed } = await authClient.updateUser({
        username: next,
        displayUsername: next,
        name: next,
      })
      if (failed) {
        setError(explainAuthError(failed))
        return
      }
      posthog.capture("username_updated")
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form action={save} className="gap-5 grid">
      <DialogHeader>
        <DialogTitle>Change your username</DialogTitle>
      </DialogHeader>
      <label htmlFor={id} className="sr-only">
        Username
      </label>
      <Input
        variant="game"
        id={id}
        required
        {...USERNAME_INPUT}
        aria-invalid={error ? true : undefined}
        value={username}
        onChange={(event) => {
          setDraft(event.target.value)
          setError(null)
        }}
      />
      {error ? (
        <p role="alert" className="text-sm font-bold text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter variant="game">
        <Button
          variant="game"
          type="submit"
          className="flex-1"
          disabled={busy || !next || next === current}
        >
          <CheckIcon aria-hidden="true" />
          Save
        </Button>
      </DialogFooter>
    </form>
  )
}

// Signing out and deleting the account, apart at the end of the settings.
// Deleting asks first, and needs a sign-in within the last day.
export function DangerZone() {
  const navigate = useNavigate()
  const posthog = usePostHog()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Back to the landing page, out of the game.
  async function leave(
    call: () => Promise<{ error: unknown }>,
    event: "account_signed_out" | "account_deleted"
  ) {
    setBusy(true)
    setError(null)
    try {
      const { error: failed } = await call()
      if (failed) {
        const reason = failed as { code?: string; message?: string }
        setError(
          reason.code === "SESSION_EXPIRED"
            ? "For your safety, sign in again before deleting your account."
            : explainAuthError(reason)
        )
        return
      }
      posthog.capture(event)
      setConfirming(false)
      await navigate({ to: "/", replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <GameSettings id="danger-title" title="Danger zone" danger>
      <GameSettingsRow
        Icon={LogOutIcon}
        label="Sign out"
        detail="Your cards stay on your account."
      >
        <Button
          variant="game"
          className="shrink-0"
          disabled={busy}
          onClick={() =>
            void leave(() => authClient.signOut(), "account_signed_out")
          }
        >
          <LogOutIcon aria-hidden="true" />
          Sign out
        </Button>
      </GameSettingsRow>
      <GameSettingsRow
        Icon={Trash2Icon}
        label="Delete account"
        detail="Cards, holos and auctions, for good."
      >
        <Button
          variant="game"
          data-danger
          className="shrink-0"
          disabled={busy}
          onClick={() => {
            setError(null)
            setConfirming(true)
          }}
        >
          <Trash2Icon aria-hidden="true" />
          Delete
        </Button>
      </GameSettingsRow>
      {error && !confirming ? (
        <output className="px-4 py-3 text-sm font-bold block text-destructive">
          {error}
        </output>
      ) : null}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent variant="game">
          <div className="gap-5 grid">
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                Your cards, holos, showcase and unbid auctions are deleted now,
                and can&apos;t come back. Auctions with a bid run to their end.
              </DialogDescription>
            </DialogHeader>
            {error ? (
              <output className="text-sm font-bold text-destructive">
                {error}
              </output>
            ) : null}
            <DialogFooter variant="game">
              <Button
                variant="game"
                data-danger
                className="flex-1"
                disabled={busy}
                onClick={() =>
                  void leave(() => authClient.deleteUser(), "account_deleted")
                }
              >
                <Trash2Icon aria-hidden="true" />
                Delete for good
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </GameSettings>
  )
}
