import {
  ContactLink,
  LegalList,
  LegalPage,
  LegalSection,
} from "@/legal/legal-page"
import { Link } from "@tanstack/react-router"

const UPDATED = "October 25, 2026"

// What the game collects, why, who helps run it, and how to get it deleted.
export function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated={UPDATED}>
      <LegalSection title="Who we are">
        <p>
          Holotrack (holotrack.art) is a music trading card game. This policy
          explains what we collect when you visit the site or play, why, and
          what you can do about it. Questions or requests: <ContactLink />.
        </p>
      </LegalSection>
      <LegalSection title="What we collect">
        <LegalList
          items={[
            {
              key: "account",
              text: (
                <>
                  <strong>Your account</strong>: your email address, to send you
                  sign-in codes, and the username you pick, which other players
                  see.
                </>
              ),
            },
            {
              key: "game",
              text: (
                <>
                  <strong>Your game</strong>: your cards, holos, packs,
                  favorites and showcase, the auctions you run and the bids you
                  place.
                </>
              ),
            },
            {
              key: "purchases",
              text: (
                <>
                  <strong>Your purchases</strong>: when you buy holos or Pro,
                  Stripe handles the payment. We keep your Stripe customer id,
                  what you bought and your subscription status. Your card
                  details go to Stripe only, never to us.
                </>
              ),
            },
            {
              key: "notifications",
              text: (
                <>
                  <strong>Notifications</strong>: if you turn them on, your
                  browser's push address for that device, so we can tell you
                  when a free pack is ready or when someone bids on or outbids
                  you.
                </>
              ),
            },
            {
              key: "usage",
              text: (
                <>
                  <strong>Usage</strong>: the pages you view, what you tap,
                  errors, your browser and device type, and a rough location
                  from your IP address, through PostHog analytics. Once you're
                  signed in, this is linked to your account, email and username.
                </>
              ),
            },
            {
              key: "device",
              text: (
                <>
                  <strong>On your device</strong>: a cookie that keeps you
                  signed in, PostHog's analytics cookie, and your sound
                  settings.
                </>
              ),
            },
          ]}
        />
        <p>We don't sell your data, and we don't show ads.</p>
      </LegalSection>
      <LegalSection title="Why we use it">
        <LegalList
          items={[
            {
              key: "contract",
              text: "To run your account and the game, and to take and deliver your purchases (the contract between us).",
            },
            {
              key: "legal",
              text: "To keep payment records as the law requires (legal obligation).",
            },
            {
              key: "improve",
              text: "To understand how the game is played, fix bugs and improve it (our legitimate interest).",
            },
            {
              key: "messages",
              text: "To send sign-in codes and the notifications you turned on. We don't send marketing emails.",
            },
          ]}
        />
      </LegalSection>
      <LegalSection title="Who helps us run it">
        <p>These services process data for us, under their own safeguards:</p>
        <LegalList
          items={[
            {
              key: "convex",
              text: "Convex: our database and backend, hosted in the EU (Ireland).",
            },
            { key: "cloudflare", text: "Cloudflare: hosts the website." },
            { key: "resend", text: "Resend: sends sign-in code emails." },
            { key: "stripe", text: "Stripe: takes payments." },
            {
              key: "posthog",
              text: "PostHog: analytics, hosted in the United States.",
            },
            {
              key: "push",
              text: "Google, Apple, Mozilla and Microsoft: deliver push notifications to your browser, if you turn them on.",
            },
          ]}
        />
        <p>
          Song previews and cover art load straight from Spotify's and Deezer's
          servers, which see your IP address when they do. Some of these
          services are outside the EU; transfers rely on the EU-US Data Privacy
          Framework or the European Commission's standard contractual clauses.
        </p>
      </LegalSection>
      <LegalSection title="How long we keep it">
        <p>
          We keep your account and game for as long as you have an account.
          Deleting your account (Profile, then Delete account) erases your game
          and account data. Payment records stay with Stripe for as long as tax
          and accounting law requires. Analytics data is kept for up to 7 years,
          then deleted.
        </p>
      </LegalSection>
      <LegalSection title="Your rights">
        <p>
          You can ask to see, correct, export or delete your data, object to or
          restrict how we use it, or withdraw consent you gave. Most of it you
          can do yourself in the game; for the rest, write to <ContactLink />.
          We answer within a month. You can also complain to your data
          protection authority; in France, the CNIL (cnil.fr).
        </p>
      </LegalSection>
      <LegalSection title="Children">
        <p>
          Holotrack isn't meant for children under 13, and we don't knowingly
          collect their data. If you think a child has an account, tell us and
          we'll delete it.
        </p>
      </LegalSection>
      <LegalSection title="Changes">
        <p>
          If this policy changes, we'll update it here with a new date, and tell
          players in the game when the change matters. See also our{" "}
          <Link to="/terms" className="font-bold text-ink underline">
            terms
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}
