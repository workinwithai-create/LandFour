import type { Chair, NoteEvent } from "@/lib/landfour/score";

const TPQ = 480;

const CHANNEL: Record<Chair, number> = {
  piano: 0,
  bass: 1,
  cello: 2,
  click: 9,
};

const PROGRAM: Partial<Record<Chair, number>> = {
  piano: 0,
  bass: 32,
  cello: 42,
};

function vlq(value: number) {
  let n = Math.max(0, value);
  const bytes = [n & 0x7f];
  n >>= 7;
  while (n > 0) {
    bytes.unshift((n & 0x7f) | 0x80);
    n >>= 7;
  }
  return bytes;
}

export function encodeMidi(events: NoteEvent[], bpm: number) {
  const tempo = Math.round(60000000 / bpm);
  const body: number[] = [];
  let cursor = 0;

  const emit = (tick: number, bytes: number[]) => {
    body.push(...vlq(tick - cursor), ...bytes);
    cursor = tick;
  };

  emit(0, [0xff, 0x51, 0x03, (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff]);
  emit(0, [0xff, 0x03, 0x08, ..."LandFour".split("").map((ch) => ch.charCodeAt(0))]);
  emit(0, [0xc0, PROGRAM.piano ?? 0]);
  emit(0, [0xc1, PROGRAM.bass ?? 32]);
  emit(0, [0xc2, PROGRAM.cello ?? 42]);

  type Hit = { tick: number; bytes: number[] };
  const hits: Hit[] = [];
  for (const event of events) {
    const start = Math.round((event.bar * 4 + event.beat) * TPQ);
    const end = start + Math.max(30, Math.round(event.dur * TPQ));
    const channel = CHANNEL[event.chair];
    const note = event.chair === "click" ? 76 : event.midi;
    const vel = Math.max(1, Math.min(127, Math.round(event.vel * 120)));
    hits.push({ tick: start, bytes: [0x90 | channel, note, vel] });
    hits.push({ tick: end, bytes: [0x80 | channel, note, 0] });
  }
  hits.sort((a, b) => a.tick - b.tick || a.bytes[0] - b.bytes[0]);
  for (const hit of hits) emit(hit.tick, hit.bytes);
  emit(cursor, [0xff, 0x2f, 0x00]);

  const header = [
    0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01,
    (TPQ >> 8) & 0xff, TPQ & 0xff,
    0x4d, 0x54, 0x72, 0x6b,
    (body.length >> 24) & 0xff,
    (body.length >> 16) & 0xff,
    (body.length >> 8) & 0xff,
    body.length & 0xff,
  ];
  return new Uint8Array([...header, ...body]);
}

export function downloadMidi(bytes: Uint8Array, filename: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
