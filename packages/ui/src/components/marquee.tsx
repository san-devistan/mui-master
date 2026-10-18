"use client"

import type { CssVars } from "@workspace/ui/lib/game/theme"
import { cn } from "@workspace/ui/lib/utils"
import { useEffect, useRef, useState } from "react"

// CSS px per second, so every line moves at the same pace however long.
const SPEED = 20
// A trip there and back: each slide is 30% of it, each rest 20% (game.css
// game-marquee). Never shorter than MIN_TRIP s, so a line just too long still
// rests 1.5s at each end.
const SLIDE_SHARE = 0.3
const MIN_TRIP = 7.5

// One line of text that, when it's too long for its box, slides left until its
// end shows, rests, then slides back to its start and rests again, faded at
// both ends. A line that fits stays still.
function Marquee({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  const boxRef = useRef<HTMLSpanElement>(null)
  const lineRef = useRef<HTMLSpanElement>(null)
  // How far the line slides, in px; null for a line that fits.
  const [overflow, setOverflow] = useState<number | null>(null)

  useEffect(() => {
    const box = boxRef.current
    const line = lineRef.current
    if (!box || !line) return undefined
    const fit = new ResizeObserver(() => {
      const over = line.scrollWidth - box.clientWidth
      setOverflow(over > 1 ? over : null)
    })
    fit.observe(box)
    fit.observe(line)
    return () => fit.disconnect()
  }, [])

  const style: CssVars & { animationDuration?: string } = overflow
    ? {
        "--marquee-shift": `${-overflow}px`,
        animationDuration: `${Math.max(overflow / SPEED / SLIDE_SHARE, MIN_TRIP)}s`,
      }
    : {}

  return (
    <span
      ref={boxRef}
      data-scrolls={overflow ? true : undefined}
      style={style}
      className={cn(
        "min-w-0 block overflow-hidden whitespace-nowrap data-scrolls:game-marquee-fade",
        className
      )}
    >
      <span ref={lineRef} className="game-marquee inline-block">
        {children}
      </span>
    </span>
  )
}

export { Marquee }
