import type { Rarity } from "@workspace/ui/lib/game/theme"

// The game's sounds, made on the fly with Web Audio: no files to load. All of
// it goes through a soft limiter, with a small room's reverb to send to.

export type Engine = {
  ctx: AudioContext
  dry: AudioNode
  room: AudioNode
  noise: AudioBuffer
}

// Seconds into the legendary cue when it hits: as the celebration's sparks
// fly (see game.css) and the spinning card lands.
const LEGENDARY_HIT = 0.85
// The game's overall loudness, after the limiter: every cue scales with it.
const VOLUME = 0.5
// Tuning: a major pentatonic, so cues that overlap stay in tune together.
const PENTATONIC = [84, 86, 88, 91, 93]
const PRESSABLE = [
  '[data-slot="button"][data-variant="game"]',
  '[data-slot="select-trigger"][data-variant="game"]',
  '[data-slot="game-tab"]',
].join(", ")
// Each overtone of a bell: frequency ratio, level, and length (share of the
// note's). Stretched a little and fading faster than the note: glassy.
const OVERTONES = [
  [1, 1, 1],
  [2.01, 0.35, 0.55],
  [3.03, 0.18, 0.35],
  [4.21, 0.08, 0.2],
] as const

let engine: Engine | null = null

export const midi = (note: number) => 440 * 2 ** ((note - 69) / 12)

// White noise; with `decay`, dying away like a room's echo.
function noiseBuffer(ctx: BaseAudioContext, seconds: number, decay = 0) {
  const length = Math.round(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let sample = 0; sample < length; sample += 1)
      data[sample] = (Math.random() * 2 - 1) * (1 - sample / length) ** decay
  }
  return buffer
}

function setup(): Engine {
  const ctx = new AudioContext({ latencyHint: "interactive" })
  const dry = new GainNode(ctx, { gain: 0.7 })
  dry
    .connect(
      new DynamicsCompressorNode(ctx, {
        threshold: -12,
        knee: 6,
        ratio: 8,
        attack: 0.002,
        release: 0.25,
      })
    )
    .connect(new GainNode(ctx, { gain: VOLUME }))
    .connect(ctx.destination)
  const room = new ConvolverNode(ctx, { buffer: noiseBuffer(ctx, 1.6, 4) })
  room.connect(dry)
  return { ctx, dry, room, noise: noiseBuffer(ctx, 1) }
}

// Starts the audio, inside a gesture: browsers keep it off until the player
// interacts. Null outside one, or without Web Audio.
export function wake() {
  if (typeof AudioContext === "undefined") return null
  // Where the browser can't tell, try anyway: a context made outside a
  // gesture just waits, suspended, for the next one.
  if (!navigator.userActivation?.isActive) return null
  engine ??= setup()
  void engine.ctx.resume().catch(() => undefined)
  return engine
}

type Shape = {
  at: number
  dur: number
  gain: number
  attack?: number
  wet?: number
}

// Swells in over `attack`, then dies away by `at + dur`; `wet` of it goes to
// the reverb too.
function envelope(
  { ctx, dry, room }: Engine,
  { at, dur, gain, attack = 0.004, wet = 0 }: Shape
) {
  const node = new GainNode(ctx, { gain: 0 })
  node.gain.setValueAtTime(0, at)
  node.gain.linearRampToValueAtTime(gain, at + attack)
  node.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  node.connect(dry)
  if (wet > 0) node.connect(new GainNode(ctx, { gain: wet })).connect(room)
  return node
}

type Tone = Shape & {
  freq: number
  to?: number
  type?: OscillatorType
  detune?: number
}

// A note, gliding to `to` over its length.
export function tone(
  audio: Engine,
  { freq, to, type = "sine", detune = 0, ...shape }: Tone
) {
  const osc = new OscillatorNode(audio.ctx, { type, frequency: freq, detune })
  if (to) {
    osc.frequency.setValueAtTime(freq, shape.at)
    osc.frequency.exponentialRampToValueAtTime(to, shape.at + shape.dur)
  }
  osc.connect(envelope(audio, shape))
  osc.start(shape.at)
  osc.stop(shape.at + shape.dur + 0.05)
}

type Noise = Shape & {
  band: BiquadFilterType
  freq: number
  to?: number
  q?: number
}

// A hiss through a filter sweeping to `to`: whooshes, thuds and crackle.
export function noise(
  audio: Engine,
  { band, freq, to, q = 1, ...shape }: Noise
) {
  const source = new AudioBufferSourceNode(audio.ctx, {
    buffer: audio.noise,
    loop: true,
  })
  const filter = new BiquadFilterNode(audio.ctx, {
    type: band,
    frequency: freq,
    Q: q,
  })
  if (to) {
    filter.frequency.setValueAtTime(freq, shape.at)
    filter.frequency.exponentialRampToValueAtTime(to, shape.at + shape.dur)
  }
  source.connect(filter).connect(envelope(audio, shape))
  source.start(shape.at, Math.random() * 0.9)
  source.stop(shape.at + shape.dur + 0.05)
}

type Bells = { gain: number; step?: number; dur?: number }

// Glassy chimes, `step` seconds apart (0: together, a chord).
export function bells(
  audio: Engine,
  at: number,
  notes: ReadonlyArray<number>,
  { gain, step = 0, dur = 1.2 }: Bells
) {
  for (const [index, note] of notes.entries()) {
    for (const [ratio, level, length] of OVERTONES) {
      tone(audio, {
        freq: midi(note) * ratio,
        at: at + index * step,
        gain: gain * level,
        dur: dur * length,
        wet: 0.35,
      })
    }
  }
}

type Crackle = {
  count: number
  every: number
  from: number
  to: number
  gain: number
}

// Ticks of noise in a quick, uneven run, rising from `from` to `to` Hz: foil
// tearing or crinkling.
function crackle(
  audio: Engine,
  at: number,
  { count, every, from, to, gain }: Crackle
) {
  for (let grain = 0; grain < count; grain += 1) {
    noise(audio, {
      at: at + grain * every + Math.random() * every * 0.6,
      dur: 0.025 + Math.random() * 0.02,
      gain: gain * (0.6 + Math.random() * 0.4),
      band: "bandpass",
      freq:
        (from + ((to - from) * grain) / count) * (0.8 + Math.random() * 0.4),
      q: 3,
    })
  }
}

export type Cue =
  | Rarity
  | "tap"
  | "tick"
  | "press"
  | "rip"
  | "glow"
  | "open"
  | "swipe"
  | "lift"
  | "spin"
  | "land"

const CUES: Record<Cue, (audio: Engine, at: number) => void> = {
  // Buttons, selects and tabs: a soft, quick pop.
  tap(audio, at) {
    tone(audio, { at, dur: 0.08, gain: 0.5, freq: 660, to: 330 })
    noise(audio, { at, dur: 0.02, gain: 0.15, band: "highpass", freq: 4000 })
  },
  // Picking from a list: a light glassy tick.
  tick: (audio, at) =>
    bells(audio, at, [91, 98], { gain: 0.12, step: 0.04, dur: 0.25 }),
  // The pack is pressed: a padded thump and a crinkle of foil.
  press(audio, at) {
    tone(audio, { at, dur: 0.25, gain: 0.8, freq: 160, to: 50 })
    noise(audio, { at, dur: 0.07, gain: 0.3, band: "lowpass", freq: 1400 })
    crackle(audio, at + 0.03, {
      count: 8,
      every: 0.022,
      from: 3500,
      to: 6500,
      gain: 0.18,
    })
  },
  // The foil tears along the cut, rising as it goes.
  rip(audio, at) {
    crackle(audio, at, {
      count: 14,
      every: 0.016,
      from: 1200,
      to: 4200,
      gain: 0.8,
    })
    noise(audio, {
      at,
      dur: 0.3,
      gain: 0.3,
      band: "highpass",
      freq: 1800,
      to: 5000,
    })
  },
  // A legendary inside, in place of `open`: one triumphant flourish from the
  // cut through the light (PackGlow) to the pack dropping away. A bright rush,
  // a quick fanfare climbing to a held major chord over a deep boom, and
  // glitter pouring down as the pack falls, about 2 seconds.
  glow(audio, at) {
    const peak = at + 0.36
    noise(audio, {
      at,
      dur: 0.9,
      gain: 0.3,
      attack: 0.06,
      band: "bandpass",
      freq: 900,
      to: 7000,
      q: 0.8,
      wet: 0.4,
    })
    // Fanfare: C, E, G, then the high C rings out on the chord.
    for (const [index, note] of [72, 76, 79].entries()) {
      for (const detune of [-6, 6]) {
        tone(audio, {
          at: at + index * 0.11,
          dur: 0.32,
          gain: 0.07,
          attack: 0.01,
          type: "sawtooth",
          freq: midi(note),
          detune,
          wet: 0.3,
        })
      }
    }
    // The held chord, swelling a little, then fading with the light.
    for (const note of [60, 67, 72, 76, 79, 84]) {
      for (const detune of [-7, 7]) {
        tone(audio, {
          at: peak,
          dur: 1.6,
          gain: note < 70 ? 0.06 : 0.045,
          attack: 0.12,
          type: "triangle",
          freq: midi(note),
          detune,
          wet: 0.5,
        })
      }
    }
    tone(audio, { at: peak, dur: 1.2, gain: 0.8, freq: 98, to: 41 })
    noise(audio, {
      at: peak,
      dur: 1.2,
      gain: 0.22,
      band: "lowpass",
      freq: 8000,
      to: 600,
      wet: 0.5,
    })
    bells(audio, peak, [84, 88, 91, 96], { gain: 0.1, dur: 1.8 })
    // Glitter tumbling down as the pack drops away and the cards come out.
    bells(audio, peak + 0.25, [103, 100, 98, 96, 93, 91, 88, 86, 84], {
      gain: 0.055,
      step: 0.085,
      dur: 0.6,
    })
  },
  // The pack falls away and the cards come out, glittering.
  open(audio, at) {
    noise(audio, {
      at,
      dur: 1,
      gain: 0.3,
      attack: 0.1,
      band: "lowpass",
      freq: 2600,
      to: 200,
      wet: 0.2,
    })
    tone(audio, { at, dur: 0.6, gain: 0.35, freq: 100, to: 45 })
    bells(audio, at + 0.2, [84, 88, 91, 96, 100], {
      gain: 0.07,
      step: 0.07,
      dur: 0.7,
    })
  },
  // A card flicked away.
  swipe: (audio, at) =>
    noise(audio, {
      at,
      dur: 0.26,
      gain: 0.5,
      attack: 0.05,
      band: "bandpass",
      freq: 2400,
      to: 450,
      q: 0.9,
    }),
  // A card lifts out of the grid towards the viewer.
  lift(audio, at) {
    noise(audio, {
      at,
      dur: 0.55,
      gain: 0.3,
      attack: 0.3,
      band: "bandpass",
      freq: 350,
      to: 2200,
      q: 0.8,
    })
    tone(audio, {
      at,
      dur: 0.55,
      gain: 0.05,
      attack: 0.3,
      freq: midi(67),
      to: midi(79),
      wet: 0.3,
    })
  },
  // A card turns a full turn round: a whoosh up, then back down.
  spin(audio, at) {
    noise(audio, {
      at,
      dur: 0.6,
      gain: 0.35,
      attack: 0.45,
      band: "bandpass",
      freq: 400,
      to: 2800,
      q: 1.2,
    })
    noise(audio, {
      at: at + 0.5,
      dur: 0.6,
      gain: 0.3,
      attack: 0.05,
      band: "bandpass",
      freq: 2800,
      to: 500,
      q: 1.2,
    })
  },
  // A new card drops into the collection: a soft thud and a chime, each one
  // on its own note.
  land(audio, at) {
    tone(audio, { at, dur: 0.18, gain: 0.5, freq: 130, to: 60 })
    const note = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)] ?? 84
    bells(audio, at, [note], { gain: 0.1, dur: 0.5 })
  },
  // Reveals: the rarer the card, the fuller and longer it rings.
  common: (audio, at) =>
    bells(audio, at, [72, 79], { gain: 0.16, step: 0.05, dur: 0.9 }),
  rare(audio, at) {
    bells(audio, at, [79, 86, 91], { gain: 0.16, step: 0.07, dur: 1.1 })
    noise(audio, {
      at,
      dur: 0.4,
      gain: 0.08,
      band: "highpass",
      freq: 6000,
      wet: 0.4,
    })
  },
  // Epic: a thump as the card jolts out, and a quick climb.
  epic(audio, at) {
    tone(audio, { at, dur: 0.45, gain: 0.6, freq: 110, to: 45 })
    noise(audio, {
      at,
      dur: 0.35,
      gain: 0.25,
      band: "bandpass",
      freq: 700,
      to: 4000,
    })
    bells(audio, at + 0.04, [72, 76, 79, 84, 88], {
      gain: 0.15,
      step: 0.06,
      dur: 1.2,
    })
    bells(audio, at + 0.34, [72, 79, 88], { gain: 0.1, dur: 1.4 })
  },
  // Legendary: it charges up while the card spins, hits as it lands, then
  // glitters down as the light sweeps across.
  legendary(audio, at) {
    const hit = at + LEGENDARY_HIT
    noise(audio, {
      at,
      dur: 0.9,
      gain: 0.3,
      attack: 0.8,
      band: "bandpass",
      freq: 300,
      to: 6000,
      q: 1.5,
    })
    for (const detune of [-8, 8]) {
      tone(audio, {
        at,
        dur: 0.9,
        gain: 0.07,
        attack: 0.8,
        type: "triangle",
        freq: 220,
        to: 880,
        detune,
      })
    }
    tone(audio, { at: hit, dur: 1, gain: 0.9, freq: 120, to: 38 })
    noise(audio, {
      at: hit,
      dur: 1.4,
      gain: 0.3,
      band: "lowpass",
      freq: 9000,
      to: 800,
      wet: 0.5,
    })
    bells(audio, hit, [60, 67, 72, 76, 79, 84], { gain: 0.11, dur: 2.2 })
    bells(audio, hit + 0.15, [100, 96, 91, 88, 84, 79], {
      gain: 0.06,
      step: 0.13,
      dur: 0.9,
    })
  },
}

// Plays `cue` in `delay` seconds. Silent until the player first interacts.
export function play(cue: Cue, delay = 0) {
  const audio = engine?.ctx.state === "running" ? engine : wake()
  if (audio) CUES[cue](audio, audio.ctx.currentTime + 0.01 + delay)
}

const closest = (event: Event, selector: string) =>
  event.target instanceof Element && event.target.closest(selector) !== null

function press(event: PointerEvent) {
  if (event.button === 0 && closest(event, PRESSABLE)) play("tap")
}

function click(event: MouseEvent) {
  wake()
  if (event.detail === 0 && closest(event, PRESSABLE)) play("tap")
  else if (closest(event, '[data-slot="select-item"]')) play("tick")
}

// Game buttons, selects and tabs pop as they're pressed (or keyed), list items
// tick as they're picked, and any click wakes the audio. Returns the cleanup.
export function soundTaps() {
  document.addEventListener("pointerdown", press, true)
  document.addEventListener("click", click, true)
  return () => {
    document.removeEventListener("pointerdown", press, true)
    document.removeEventListener("click", click, true)
  }
}
