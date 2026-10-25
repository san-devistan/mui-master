import {
  ContactLink,
  LegalList,
  LegalPage,
  LegalSection,
} from "@/legal/legal-page"
import { Link } from "@tanstack/react-router"

const UPDATED = "October 25, 2026"

const linkClass = "font-bold text-ink underline"

// The rules of the game: accounts, virtual items, purchases and their limits.
export function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated={UPDATED}>
      <LegalSection title="The game">
        <p>
          Holotrack (holotrack.art) is a free-to-play music trading card game.
          By making an account or playing, you agree to these terms and to our{" "}
          <Link to="/privacy" className={linkClass}>
            privacy policy
          </Link>
          . You must be at least 13 years old, and have a parent's or guardian's
          permission to play and to buy anything if you're under 18.
        </p>
      </LegalSection>
      <LegalSection title="Your account">
        <LegalList
          items={[
            {
              key: "sign-in",
              text: "You sign in with a code sent to your email: keep access to that inbox to yourself.",
            },
            {
              key: "one-account",
              text: "One account per person. Your username must not impersonate anyone or be offensive; we may change one that is.",
            },
            {
              key: "fair-play",
              text: "No bots, scripts, exploits or multiple accounts to farm packs, holos or auctions.",
            },
            {
              key: "delete",
              text: "You can delete your account at any time from your profile.",
            },
          ]}
        />
      </LegalSection>
      <LegalSection title="Cards and holos">
        <p>
          Cards, packs and holos are virtual items. You get a personal license
          to use them in the game; they have no value outside it, can't be
          exchanged for money and can't be sold or traded for anything but
          holos, inside the game. We may rebalance the game, for example prices
          or how often free packs come.
        </p>
        <p>
          A card's rarity comes from its streams on Spotify, can rise when the
          song does, and never goes down. Every pack's odds are on the{" "}
          <Link to="/odds" className={linkClass}>
            pack odds
          </Link>{" "}
          page.
        </p>
      </LegalSection>
      <LegalSection title="Purchases">
        <LegalList
          items={[
            {
              key: "prices",
              text: "Prices are in euros and include VAT where it applies. Stripe takes the payment.",
            },
            {
              key: "holos",
              text: "Holos arrive in your account as soon as the payment goes through.",
            },
            {
              key: "pro",
              text: "Holotrack Pro is a monthly subscription that renews until you cancel it. Cancel any time from your profile; Pro then lasts until the end of the month you paid for.",
            },
            {
              key: "withdrawal",
              text: "Holos and Pro are delivered right away: by buying them you ask for that, and you accept that you lose your 14-day right of withdrawal once they're delivered.",
            },
            {
              key: "missing",
              text: "If something you paid for doesn't arrive, write to us and we'll fix it or refund you.",
            },
          ]}
        />
      </LegalSection>
      <LegalSection title="Music">
        <p>
          Song and artist names, cover art and previews belong to their owners
          and appear only to identify the music. Previews play from Spotify and
          Deezer. Holotrack isn't affiliated with Spotify, Deezer or any artist
          or label.
        </p>
      </LegalSection>
      <LegalSection title="If things go wrong">
        <p>
          We work to keep the game running, but it's provided as it is and may
          change, pause or end. We may suspend or close an account that breaks
          these terms. If we ever close the game, we'll say so in it at least 30
          days before, and end Pro subscriptions without charging another month.
          Nothing here limits your rights as a consumer under the law where you
          live.
        </p>
      </LegalSection>
      <LegalSection title="Changes and contact">
        <p>
          If these terms change, we'll update them here with a new date, and
          tell players in the game when the change matters. Questions:{" "}
          <ContactLink />.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
