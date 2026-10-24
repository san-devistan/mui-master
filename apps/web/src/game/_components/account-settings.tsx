import { explainAuthError, USERNAME_INPUT } from "@/auth/account"
import { authClient } from "@/lib/auth-client"
import { Link, useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { CheckIcon, LogOutIcon, Trash2Icon } from "lucide-react"
import { useId, useState } from "react"

// The profile's account settings: the username (unique across players, any
// case), then signing out and deleting the account. A guest gets a way to
// sign in instead.
export function AccountSettings() {
  const { data: session } = authClient.useSession()
  const user = session?.user
  if (!user) return null
  if (user.isAnonymous) {
    return (
      <section aria-labelledby="account-title" className="mt-8 gap-3 grid">
        <SectionTitle id="account-title">Account</SectionTitle>
        <p className="text-sm text-ink/60">
          You&apos;re playing as a guest. Sign in to keep your cards on every
          device.
        </p>
        <Button
          variant="game"
          className="justify-self-start"
          nativeButton={false}
          render={<Link to="/sign-in" />}
        >
          <LogOutIcon aria-hidden="true" className="rotate-180" />
          Sign in
        </Button>
      </section>
    )
  }
  return (
    <>
      <section aria-labelledby="account-title" className="mt-8 gap-3 grid">
        <SectionTitle id="account-title">Account</SectionTitle>
        <UsernameField current={user.displayUsername ?? user.username ?? ""} />
        <p className="text-sm text-ink/60">Signed in as {user.email}</p>
      </section>
      <DangerZone />
    </>
  )
}

function SectionTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="text-2xl font-black tracking-tighter font-heading">
      {children}
    </h2>
  )
}

function UsernameField({ current }: { current: string }) {
  // What the player typed; null shows the saved username.
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null)
  const id = useId()
  const username = draft ?? current
  const next = username.trim()
  const changed = next !== current

  async function save() {
    setBusy(true)
    setNote(null)
    try {
      const { error } = await authClient.updateUser({
        username: next,
        displayUsername: next,
        name: next,
      })
      if (error) {
        setNote({ text: explainAuthError(error), ok: false })
        return
      }
      setDraft(null)
      setNote({ text: "Username saved.", ok: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form action={save} className="max-w-lg gap-2 grid">
      <label htmlFor={id} className="font-bold">
        Username
      </label>
      <div className="gap-2 flex">
        <Input
          variant="game"
          id={id}
          required
          {...USERNAME_INPUT}
          aria-invalid={note && !note.ok ? true : undefined}
          value={username}
          onChange={(event) => {
            setDraft(event.target.value)
            setNote(null)
          }}
        />
        <Button
          variant="game"
          type="submit"
          className="shrink-0"
          disabled={busy || !changed}
        >
          <CheckIcon aria-hidden="true" />
          Save
        </Button>
      </div>
      {note ? (
        <output
          className={`text-sm font-bold ${note.ok ? "text-ink/70" : "text-destructive"}`}
        >
          {note.text}
        </output>
      ) : null}
    </form>
  )
}

// Signing out and deleting the account, apart at the page's end. Deleting
// asks first, and needs a sign-in within the last day.
function DangerZone() {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Back to the landing page: the game would sign a new guest in straight away.
  async function leave(call: () => Promise<{ error: unknown }>) {
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
      setConfirming(false)
      await navigate({ to: "/", replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="danger-title" data-slot="danger-zone">
      <SectionTitle id="danger-title">Danger zone</SectionTitle>
      <div className="gap-3 flex items-center justify-between">
        <div className="gap-1 grid">
          <span className="font-bold">Sign out</span>
          <span className="text-sm text-ink/60">
            Your cards stay on your account. Sign in again with your email.
          </span>
        </div>
        <Button
          variant="game"
          className="shrink-0"
          disabled={busy}
          onClick={() => void leave(() => authClient.signOut())}
        >
          <LogOutIcon aria-hidden="true" />
          Sign out
        </Button>
      </div>
      <div className="gap-3 flex items-center justify-between">
        <div className="gap-1 grid">
          <span className="font-bold">Delete account</span>
          <span className="text-sm text-ink/60">
            Your cards, holos and auctions are gone for good.
          </span>
        </div>
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
      </div>
      {error && !confirming ? (
        <output className="text-sm font-bold text-destructive">{error}</output>
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
                onClick={() => void leave(() => authClient.deleteUser())}
              >
                <Trash2Icon aria-hidden="true" />
                Delete for good
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
