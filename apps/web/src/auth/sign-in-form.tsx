import { explainAuthError as explain, USERNAME_INPUT } from "@/auth/account"
import { authClient } from "@/lib/auth-client"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { MailIcon, PackageOpenIcon, PencilIcon } from "lucide-react"
import { useEffect, useId, useState, type ReactNode } from "react"

const CODE_LENGTH = 6

// One way in for everyone: an email, then the code Resend mails to it. A new
// email makes an account, which then picks its username; a guest who already
// played keeps their cards (convex/players.ts adoptGuest). Then the game.
export function SignInForm() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const member = session?.user.isAnonymous ? null : session?.user
  const [email, setEmail] = useState("")
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // Already in with a username: straight to the game.
  useEffect(() => {
    if (member?.username) void navigate({ to: "/play", replace: true })
  }, [member?.username, navigate])

  // One auth call: the form waits on it, and shows its error if it fails.
  async function request<
    Result extends { error: { code?: string; message?: string } | null },
  >(call: () => Promise<Result>) {
    setPending(true)
    setError(null)
    try {
      const result = await call()
      if (result.error) setError(explain(result.error))
      return result
    } finally {
      setPending(false)
    }
  }

  async function sendCode(to: string) {
    const { error: failed } = await request(() =>
      authClient.emailOtp.sendVerificationOtp({ email: to, type: "sign-in" })
    )
    if (!failed) setSentTo(to)
  }

  // A returning player goes straight to the game; a new one picks a username
  // first (the session now has no username, so the form shows that step).
  async function verify(otp: string) {
    if (!sentTo) return
    const { data } = await request(() =>
      authClient.signIn.emailOtp({ email: sentTo, otp })
    )
    if (data && "username" in data.user && data.user.username) {
      await navigate({ to: "/play" })
    }
  }

  async function pickUsername(username: string) {
    const { error: failed } = await request(() =>
      authClient.updateUser({
        username,
        displayUsername: username,
        name: username,
      })
    )
    if (!failed) await navigate({ to: "/play" })
  }

  if (member && !member.username) {
    return (
      <UsernameStep onPick={pickUsername} pending={pending} error={error} />
    )
  }

  if (sentTo) {
    return (
      <Panel
        title="Check your email"
        lead={
          <>
            Enter the {CODE_LENGTH}-digit code we sent to
            <strong className="block wrap-anywhere text-ink">{sentTo}</strong>
          </>
        }
        error={error}
      >
        <CodeStep onCode={verify} pending={pending} />
        <div className="gap-x-4 gap-y-2 text-sm font-bold flex flex-wrap justify-center">
          <button
            type="button"
            className="gap-1.5 inline-flex items-center hover:underline"
            onClick={() => {
              setSentTo(null)
              setError(null)
            }}
          >
            <PencilIcon className="size-3.5" aria-hidden="true" />
            Change email
          </button>
          <button
            type="button"
            disabled={pending}
            className="inline-flex items-center hover:underline disabled:opacity-50"
            onClick={() => void sendCode(sentTo)}
          >
            Send a new code
          </button>
        </div>
      </Panel>
    )
  }

  return (
    <Panel
      title="Sign in to play"
      lead="New or back, it's the same: enter your email and we'll send you a code. No password."
      error={error}
    >
      <form
        action={() => sendCode(email.trim().toLowerCase())}
        className="gap-4 grid"
      >
        <Field label="Email">
          {(id) => (
            <Input
              variant="game"
              id={id}
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>
        <Button variant="game" type="submit" disabled={pending}>
          <MailIcon aria-hidden="true" />
          Send my code
        </Button>
      </form>
    </Panel>
  )
}

// The code's boxes: a full code checks itself, the button is there too.
function CodeStep({
  onCode,
  pending,
}: {
  onCode: (code: string) => Promise<void>
  pending: boolean
}) {
  const [code, setCode] = useState("")
  return (
    <form
      action={() => onCode(code)}
      className="gap-5 grid justify-items-center"
    >
      <InputOTP
        maxLength={CODE_LENGTH}
        pattern="^[0-9]+$"
        inputMode="numeric"
        aria-label="Code"
        value={code}
        onChange={setCode}
        onComplete={(full: string) => void onCode(full)}
        disabled={pending}
      >
        <InputOTPGroup data-variant="game">
          {Array.from({ length: CODE_LENGTH }, (_, index) => (
            <InputOTPSlot key={index} index={index} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      <Button
        variant="game"
        type="submit"
        disabled={pending || code.length < CODE_LENGTH}
        className="w-full"
      >
        <PackageOpenIcon aria-hidden="true" />
        Verify and play
      </Button>
    </form>
  )
}

// A new account's one question: what other players will see it as.
function UsernameStep({
  onPick,
  pending,
  error,
}: {
  onPick: (username: string) => Promise<void>
  pending: boolean
  error: string | null
}) {
  const [username, setUsername] = useState("")
  return (
    <Panel
      title="Pick your username"
      lead="It's how other players see you, on the market and on your profile."
      error={error}
    >
      <form action={() => onPick(username.trim())} className="gap-4 grid">
        <Field label="Username">
          {(id) => (
            <Input
              variant="game"
              id={id}
              required
              {...USERNAME_INPUT}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          )}
        </Field>
        <Button variant="game" type="submit" disabled={pending}>
          <PackageOpenIcon aria-hidden="true" />
          Start playing
        </Button>
      </form>
    </Panel>
  )
}

function Panel({
  title,
  lead,
  error,
  children,
}: {
  title: string
  lead: ReactNode
  error: string | null
  children: ReactNode
}) {
  return (
    <div className="max-w-md p-6 sm:p-8 gap-5 shadow-xl backdrop-blur-md grid w-full rounded-4xl border-4 border-ink bg-card/90 text-center">
      <div className="gap-2 grid">
        <h1 className="text-3xl font-black sm:text-4xl tracking-tighter font-heading">
          {title}
        </h1>
        <p className="text-pretty text-ink/70">{lead}</p>
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-sm font-bold text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className="gap-2 grid text-left">
      <label htmlFor={id} className="text-sm font-black font-heading">
        {label}
      </label>
      {children(id)}
    </div>
  )
}
