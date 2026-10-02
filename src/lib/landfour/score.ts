export type Chair = "piano" | "bass" | "cello" | "click";

export type NoteEvent = {
  bar: number;
  beat: number;
  dur: number;
  midi: number;
  chair: Chair;
  vel: number;
};

export type KeyId = "C" | "D" | "Eb" | "F" | "G" | "A" | "Bb";
export type RecipeId = "authentic" | "minor4" | "picardy";
export type Lane = "cycle" | "land";
export type Part = "cycle" | "land" | "finish";

export const KEYS: { id: KeyId; label: string; pc: number; flat: boolean }[] = [
  { id: "C", label: "C", pc: 0, flat: false },
  { id: "D", label: "D", pc: 2, flat: false },
  { id: "Eb", label: "E♭", pc: 3, flat: true },
  { id: "F", label: "F", pc: 5, flat: true },
  { id: "G", label: "G", pc: 7, flat: false },
  { id: "A", label: "A", pc: 9, flat: false },
  { id: "Bb", label: "B♭", pc: 10, flat: true },
];

export const RECIPES: { id: RecipeId; name: string; blurb: string }[] = [
  {
    id: "authentic",
    name: "Authentic",
    blurb: "ii–V–I. The fourth falls to the leading tone. The last bar is a chord, not a loop point.",
  },
  {
    id: "minor4",
    name: "Minor four",
    blurb: "IV, then iv on the same bass note. One borrowed color, then the tonic sits.",
  },
  {
    id: "picardy",
    name: "Picardy",
    blurb: "A minor loop whose last bar is major. The third comes back when the woodblock leaves.",
  },
];

export type BarView = {
  symbol: string;
  then?: string;
  role: string;
  clicks: boolean;
  hold: boolean;
};

const FLATS = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const SHARPS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

export function keyOf(id: KeyId) {
  const key = KEYS.find((k) => k.id === id);
  if (!key) throw new Error(`Unknown key ${id}`);
  return key;
}

export function spell(pc: number, semi: number, flat: boolean) {
  return (flat ? FLATS : SHARPS)[((pc + semi) % 12 + 12) % 12];
}

function midi(pc: number, semi: number, oct: number) {
  return 60 + pc + semi + oct * 12;
}

function push(
  out: NoteEvent[],
  bar: number,
  beat: number,
  dur: number,
  note: number,
  chair: Chair,
  vel: number,
) {
  out.push({ bar, beat, dur, midi: note, chair, vel });
}

function clicks(out: NoteEvent[], bar: number) {
  push(out, bar, 1, 0.18, 72, "click", 0.16);
  push(out, bar, 3, 0.15, 72, "click", 0.12);
}

function bassSplit(out: NoteEvent[], bar: number, pc: number, degree: number) {
  push(out, bar, 0, 1.55, midi(pc, degree, -2), "bass", 0.68);
  push(out, bar, 2, 1.45, midi(pc, degree + 7, -2), "bass", 0.5);
}

function bassHold(out: NoteEvent[], bar: number, pc: number, degree: number) {
  push(out, bar, 0, 3.75, midi(pc, degree, -2), "bass", 0.72);
}

function shells(out: NoteEvent[], bar: number, pc: number, a: number[], b: number[]) {
  for (const semi of a) push(out, bar, 0, 1.3, midi(pc, semi, 0), "piano", 0.4);
  for (const semi of b) push(out, bar, 2, 1.25, midi(pc, semi, 0), "piano", 0.32);
}

function stab(out: NoteEvent[], bar: number, pc: number, tones: number[], vel = 0.46) {
  for (const semi of tones) push(out, bar, 0, 3.4, midi(pc, semi, 0), "piano", vel);
}

function cycleMajor(out: NoteEvent[], pc: number) {
  bassSplit(out, 0, pc, 0);
  shells(out, 0, pc, [4, 7, 12], [4, 11, 14]);
  clicks(out, 0);

  bassSplit(out, 1, pc, 7);
  shells(out, 1, pc, [7, 11, 14], [2, 7, 11]);
  clicks(out, 1);

  bassSplit(out, 2, pc, 9);
  shells(out, 2, pc, [0, 4, 7], [4, 9, 12]);
  clicks(out, 2);

  bassSplit(out, 3, pc, 5);
  shells(out, 3, pc, [-3, 0, 4], [0, 5, 9]);
  clicks(out, 3);
}

function cycleMinor(out: NoteEvent[], pc: number) {
  bassSplit(out, 0, pc, 0);
  shells(out, 0, pc, [3, 7, 12], [3, 7, 10]);
  clicks(out, 0);

  bassSplit(out, 1, pc, 10);
  shells(out, 1, pc, [-2, 5, 10], [2, 5, 10]);
  clicks(out, 1);

  bassSplit(out, 2, pc, 8);
  shells(out, 2, pc, [0, 3, 8], [3, 8, 12]);
  clicks(out, 2);

  bassSplit(out, 3, pc, 7);
  shells(out, 3, pc, [-2, 2, 7], [2, 7, 10]);
  clicks(out, 3);
}

function landAuthentic(out: NoteEvent[], pc: number) {
  bassSplit(out, 0, pc, 0);
  shells(out, 0, pc, [4, 7, 12], [4, 11, 14]);
  clicks(out, 0);

  bassSplit(out, 1, pc, 2);
  shells(out, 1, pc, [0, 5, 9], [2, 5, 12]);
  clicks(out, 1);

  bassHold(out, 2, pc, 7);
  shells(out, 2, pc, [0, 5, 14], [-1, 2, 5]);
  clicks(out, 2);

  bassHold(out, 3, pc, 0);
  stab(out, 3, pc, [0, 4, 7, 11], 0.5);
  push(out, 3, 0, 3.7, midi(pc, 0, -1), "cello", 0.46);
}

function landMinor4(out: NoteEvent[], pc: number) {
  bassSplit(out, 0, pc, 0);
  shells(out, 0, pc, [4, 7, 12], [4, 11, 14]);
  clicks(out, 0);

  bassSplit(out, 1, pc, 5);
  shells(out, 1, pc, [0, 4, 9], [5, 9, 12]);
  clicks(out, 1);

  bassHold(out, 2, pc, 5);
  stab(out, 2, pc, [0, 8, 12], 0.44);
  push(out, 2, 0, 3.6, midi(pc, 8, -1), "cello", 0.42);
  clicks(out, 2);

  bassHold(out, 3, pc, 0);
  stab(out, 3, pc, [0, 4, 7], 0.5);
  push(out, 3, 0, 3.7, midi(pc, 7, -1), "cello", 0.44);
}

function landPicardy(out: NoteEvent[], pc: number) {
  bassSplit(out, 0, pc, 0);
  shells(out, 0, pc, [3, 7, 12], [3, 7, 10]);
  clicks(out, 0);

  bassHold(out, 1, pc, 5);
  shells(out, 1, pc, [0, 5, 8], [0, 8, 12]);
  clicks(out, 1);

  bassHold(out, 2, pc, 7);
  shells(out, 2, pc, [-1, 5, 11], [2, 7, 11]);
  clicks(out, 2);

  bassHold(out, 3, pc, 0);
  stab(out, 3, pc, [0, 4, 7], 0.52);
  push(out, 3, 0, 3.75, midi(pc, 4, 0), "cello", 0.5);
}

export function laneScore(keyId: KeyId, recipe: RecipeId, lane: Lane): {
  bars: BarView[];
  events: NoteEvent[];
  caption: string;
} {
  const { pc, flat } = keyOf(keyId);
  const s = (semi: number) => spell(pc, semi, flat);
  const events: NoteEvent[] = [];

  if (lane === "cycle" && recipe === "picardy") cycleMinor(events, pc);
  else if (lane === "cycle") cycleMajor(events, pc);
  else if (recipe === "authentic") landAuthentic(events, pc);
  else if (recipe === "minor4") landMinor4(events, pc);
  else landPicardy(events, pc);

  const I = s(0);
  const hold = "Piano, upright, and cello hold. Woodblock is gone.";

  let bars: BarView[];
  let caption: string;

  if (lane === "cycle" && recipe !== "picardy") {
    bars = [
      { symbol: I, role: "Root, then fifth", clicks: true, hold: false },
      { symbol: s(7), role: "Dominant, still moving", clicks: true, hold: false },
      { symbol: `${s(9)}m`, role: "Relative minor", clicks: true, hold: false },
      { symbol: s(5), role: "Wants to go back", clicks: true, hold: false },
    ];
    caption = `${I}–${s(7)}–${s(9)}m–${s(5)}. Bar 4 is ${s(5)}, so the ear walks back to the top. It can loop all night.`;
  } else if (lane === "cycle") {
    bars = [
      { symbol: `${I}m`, role: "Minor tonic", clicks: true, hold: false },
      { symbol: s(10), role: "Flat seven", clicks: true, hold: false },
      { symbol: s(8), role: "Flat six", clicks: true, hold: false },
      { symbol: `${s(7)}m`, role: "Minor five, no leading tone", clicks: true, hold: false },
    ];
    caption = `Minor axis. The five stays minor (${s(7)}m), so nothing points at a major ending.`;
  } else if (recipe === "authentic") {
    bars = [
      { symbol: I, role: "Same as the loop", clicks: true, hold: false },
      { symbol: `${s(2)}m7`, role: "The supertonic", clicks: true, hold: false },
      { symbol: `${s(7)}7sus`, then: `${s(7)}7`, role: "Fourth falls to the third", clicks: true, hold: false },
      { symbol: `${I}maj7`, role: hold, clicks: false, hold: true },
    ];
    caption = `${s(2)}m7, then ${s(7)}7. The fourth falls to the leading tone on beat 3. Bar 4 is ${I}, and the woodblock leaves.`;
  } else if (recipe === "minor4") {
    bars = [
      { symbol: I, role: "Same as the loop", clicks: true, hold: false },
      { symbol: s(5), role: "Major four", clicks: true, hold: false },
      { symbol: `${s(5)}m`, role: "Same bass, minor color", clicks: true, hold: false },
      { symbol: I, role: hold, clicks: false, hold: true },
    ];
    caption = `${s(5)} then ${s(5)}m on the same bass note. One borrowed color. The cello steps down into ${I}.`;
  } else {
    bars = [
      { symbol: `${I}m`, role: "Still minor", clicks: true, hold: false },
      { symbol: `${s(5)}m`, role: "Minor four", clicks: true, hold: false },
      { symbol: s(7), role: "Major five, leading tone", clicks: true, hold: false },
      { symbol: I, role: "Cello holds the major third", clicks: false, hold: true },
    ];
    caption = `Minor until ${s(7)} major. The last bar is ${I} major. The cello holds the third the loop never had.`;
  }

  return { bars, events, caption };
}

export function partEvents(keyId: KeyId, recipe: RecipeId, part: Part): NoteEvent[] {
  if (part === "finish") {
    const loop = laneScore(keyId, recipe, "cycle").events;
    const land = laneScore(keyId, recipe, "land").events.map((event) => ({
      ...event,
      bar: event.bar + 4,
    }));
    return [...loop, ...land];
  }
  return laneScore(keyId, recipe, part).events;
}

export function partBars(part: Part) {
  return part === "finish" ? 8 : 4;
}

export function leadSheet(keyId: KeyId, recipe: RecipeId, bpm: number) {
  const key = keyOf(keyId);
  const loop = laneScore(keyId, recipe, "cycle").bars.map(sym).join(" | ");
  const land = laneScore(keyId, recipe, "land").bars.map(sym).join(" | ");
  const name = RECIPES.find((item) => item.id === recipe)?.name ?? recipe;
  return [
    `LandFour · ${key.label} · ${name} · ${bpm} bpm`,
    `Loop: ${loop}`,
    `Land: ${land}`,
    "Chairs: FluidR3 piano, upright bass, cello. Woodblock leaves on the last bar.",
  ].join("\n");
}

function sym(bar: BarView) {
  return bar.then ? `${bar.symbol} → ${bar.then}` : bar.symbol;
}
