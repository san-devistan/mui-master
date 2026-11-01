import { useEffect, useRef } from "react"

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string
          action: string
          appearance: "interaction-only"
          callback: (token: string) => void
          "expired-callback": () => void
          "error-callback": () => void
        }
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

const SCRIPT_ID = "cf-turnstile-script"
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  return new Promise<NonNullable<Window["turnstile"]>>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID)
    const script =
      existing instanceof HTMLScriptElement
        ? existing
        : Object.assign(document.createElement("script"), {
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            async: true,
            defer: true,
          })
    script.addEventListener("load", () => {
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error("Turnstile did not load"))
    })
    script.addEventListener("error", () =>
      reject(new Error("Turnstile did not load"))
    )
    if (!existing) document.head.append(script)
  })
}

// Cloudflare's bot check before a sign-in code is emailed. Usually invisible; it only shows when
// Cloudflare needs the player to interact. `resetKey` asks for a fresh single-use token.
export function TurnstileCheck({
  siteKey,
  resetKey,
  onToken,
}: {
  siteKey: string
  resetKey: number
  onToken: (token: string | null) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<string | null>(null)

  useEffect(() => {
    let current = true
    void loadTurnstile()
      .then((turnstile) => {
        const container = containerRef.current
        if (!current || !container || widgetRef.current) return turnstile
        widgetRef.current = turnstile.render(container, {
          sitekey: siteKey,
          action: "send-code",
          appearance: "interaction-only",
          callback: onToken,
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        })
        return turnstile
      })
      .catch(() => onToken(null))
    return () => {
      current = false
      const widget = widgetRef.current
      if (widget) window.turnstile?.remove(widget)
      widgetRef.current = null
    }
  }, [onToken, siteKey])

  useEffect(() => {
    if (resetKey === 0 || !widgetRef.current) return
    onToken(null)
    window.turnstile?.reset(widgetRef.current)
  }, [onToken, resetKey])

  return <div ref={containerRef} className="min-h-0 flex justify-center" />
}
