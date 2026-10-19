import {
  bells,
  type Engine,
  midi,
  noise,
  tone,
  wake,
} from "@workspace/ui/lib/game/sfx"
// Waiting music: a music-box loop round C, Am, F and G over a slow heartbeat,
// a riser on the last bar leading back round. Seconds per bar.
const BAR = 2.5
const CHORDS = [
  [72, 76, 79, 84],
  [69, 72, 76, 81],
  [65, 69, 72, 77],
  [67, 71, 74, 79],
] as const
const ARPEGGIO = [0, 1, 2, 3, 2, 1, 2, 3]
// Under the effects: the cues stay on top.
const MUSIC = 0.5
// How often, in seconds, to check whether held music can go on.
const RETRY = 0.25

function waitingBar(audio: Engine, at: number, bar: number) {
  const chord = CHORDS[bar % CHORDS.length] ?? CHORDS[0]
  for (const [step, note] of ARPEGGIO.entries()) {
    const start = at + (step * BAR) / ARPEGGIO.length
    bells(audio, start, [(chord[note] ?? chord[0]) + 12], {
      gain: 0.05,
      dur: 0.6,
    })
  }
  tone(audio, {
    at,
    dur: BAR,
    gain: 0.08,
    attack: 0.3,
    type: "triangle",
    freq: midi(chord[0] - 24),
  })
  for (const beat of [0, BAR / 2]) {
    tone(audio, { at: at + beat, dur: 0.15, gain: 0.25, freq: 110, to: 50 })
    tone(audio, {
      at: at + beat + 0.2,
      dur: 0.12,
      gain: 0.15,
      freq: 100,
      to: 50,
    })
  }
  if (bar % CHORDS.length === CHORDS.length - 1) {
    noise(audio, {
      at,
      dur: BAR,
      gain: 0.06,
      attack: BAR * 0.9,
      band: "bandpass",
      freq: 1500,
      to: 8000,
      wet: 0.4,
    })
  }
}

// Loops the waiting music, a bar at a time, until the returned stop fades it
// out. Silent in a background tab.
export function waitingMusic() {
  const audio = wake()
  if (!audio) return () => undefined
  const { ctx } = audio
  // Its own dry and reverb sends, so stopping silences the bars already
  // scheduled, echoes included.
  const dry = new GainNode(ctx, { gain: 0 })
  const room = new GainNode(ctx, { gain: 0 })
  dry.connect(audio.dry)
  room.connect(audio.room)
  const levels = [dry.gain, room.gain]
  // In after the press cue's thump, then swelling.
  let at = ctx.currentTime + 0.3
  for (const level of levels) {
    level.setValueAtTime(0, at)
    level.linearRampToValueAtTime(MUSIC, at + 1.2)
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  let bar = 0
  const next = () => {
    // A timer held up (a busy or hidden tab) starts afresh, not in a rush.
    at = Math.max(at, ctx.currentTime + 0.05)
    // Held (a background tab, a call, still starting): wait, without running
    // ahead of a clock that's stopped, so it carries on at once when let.
    if (document.hidden || ctx.state !== "running") {
      timer = setTimeout(next, RETRY * 1000)
      return
    }
    waitingBar({ ...audio, dry, room }, at, bar)
    at += BAR
    bar += 1
    timer = setTimeout(next, (at - ctx.currentTime - 0.3) * 1000)
  }
  next()
  return () => {
    clearTimeout(timer)
    for (const level of levels) level.setTargetAtTime(0, ctx.currentTime, 0.08)
    setTimeout(() => {
      dry.disconnect()
      room.disconnect()
    }, 1000)
  }
}
