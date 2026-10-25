import { LegalPage, LegalSection } from "@/legal/legal-page"
import {
  atLeastOne,
  GOD_PACK_PERCENT,
  percent,
  pullRate,
  SLOT_ODDS,
} from "@/legal/pack-odds"
import { RarityBadge } from "@workspace/ui/components/rarity-badge"
import { RARITY_ORDER } from "@workspace/ui/lib/game/theme"

const UPDATED = "October 25, 2026"
const ORDINALS = ["First", "Second", "Third", "Fourth", "Fifth"] as const

// Every pack's odds, card by card, as the game draws them: free or bought,
// every pack is drawn the same way.
export function OddsPage() {
  return (
    <LegalPage title="Pack odds" updated={UPDATED}>
      <LegalSection title="How a pack is drawn">
        <p>
          Every pack holds five cards and is drawn the same way, whether it's
          free or bought with holos. Each card's rarity is rolled with the odds
          for its place in the pack, then a song or artist of that rarity is
          picked at random, each one as likely as the next. A pack never holds
          the same card twice.
        </p>
        <p>
          A card's rarity comes from its Spotify streams: 100M+ is common, 400M+
          rare, 1B+ epic and 2B+ legendary for a song. An artist is rated on all
          their songs in the game together: 1B+ rare, 5B+ epic and 20B+
          legendary.
        </p>
      </LegalSection>
      <LegalSection title="Odds per card">
        <div className="overflow-x-auto">
          <table className="text-sm w-full text-left">
            <thead className="text-ink/60">
              <tr>
                <th className="py-2 pr-4 font-bold">Card</th>
                <th className="py-2 font-bold">Rarity odds</th>
              </tr>
            </thead>
            <tbody>
              {SLOT_ODDS.map((slot, index) => (
                <tr
                  key={ORDINALS[index] ?? slot.map((one) => one.rarity).join()}
                  className="border-t border-ink/10"
                >
                  <th className="py-3 pr-4 font-bold whitespace-nowrap text-ink">
                    {ORDINALS[index]}
                  </th>
                  <td className="py-3">
                    <span className="gap-x-4 gap-y-2 flex flex-wrap">
                      {slot.map(({ rarity, percent: value }) => (
                        <span key={rarity} className="gap-2 flex items-center">
                          <RarityBadge rarity={rarity} />
                          <span className="font-bold text-ink tabular-nums">
                            {percent(value)}
                          </span>
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Instead of these, {percent(GOD_PACK_PERCENT)} of packs (one in{" "}
          {Math.round(100 / GOD_PACK_PERCENT).toLocaleString("en")}) are god
          packs: all five cards legendary.
        </p>
      </LegalSection>
      <LegalSection title="Odds per pack">
        <p>Across all packs, god packs included, the cards you pull are:</p>
        <ul className="gap-x-5 gap-y-2 flex flex-wrap">
          {RARITY_ORDER.map((rarity) => (
            <li key={rarity} className="gap-2 flex items-center">
              <RarityBadge rarity={rarity} />
              <span className="font-bold text-ink tabular-nums">
                {percent(pullRate(rarity))}
              </span>
            </li>
          ))}
        </ul>
        <p>
          Every pack has at least one rare or better card. A pack has a{" "}
          {percent(atLeastOne("epic"))} chance of at least one epic or legendary
          card, and a {percent(atLeastOne("legendary"))} chance of at least one
          legendary.
        </p>
      </LegalSection>
      <LegalSection title="Rarity upgrades">
        <p>
          Cards you own can rise a rarity when their streams pass the next
          threshold, checked about once a month. A card's rarity never goes
          down.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
