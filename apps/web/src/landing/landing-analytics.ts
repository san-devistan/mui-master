import { usePostHog } from "posthog-js/react"
import { useCallback, useEffect, useRef, type RefObject } from "react"

// How the landing converts, in PostHog: how far down the page a visit got
// (`landing_section_viewed`, each section once a visit) and which button took
// it on (`landing_cta_clicked`). With the pageview on `/` and the game's
// `pack_opened`, they make the landing's funnel.

// The landing's beats, in page order: the film's first card out of the pack,
// its last card, then the features list above the last call to play.
export type LandingSection = "card_reveal" | "all_cards" | "features"

// Where a call to action sits on the page.
export type CtaPlacement = "header" | "hero" | "join"

export function useSectionReached() {
  const posthog = usePostHog()
  const reached = useRef(new Set<LandingSection>())
  return useCallback(
    (section: LandingSection) => {
      if (reached.current.has(section)) return
      reached.current.add(section)
      posthog.capture("landing_section_viewed", { section })
    },
    [posthog]
  )
}

// `section` is reached once `ref` scrolls into view.
export function useSectionInView(
  ref: RefObject<HTMLElement | null>,
  section: LandingSection
) {
  const reach = useSectionReached()
  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      reach(section)
      observer.disconnect()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, section, reach])
}

export function useCtaClick() {
  const posthog = usePostHog()
  return useCallback(
    (placement: CtaPlacement) =>
      posthog.capture("landing_cta_clicked", { cta: "play", placement }),
    [posthog]
  )
}
