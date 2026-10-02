import type { Chair, NoteEvent } from "@/lib/landfour/score";

const SF = "https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/FluidR3_GM";

const FOLDER: Record<Chair, string> = {
  piano: "acoustic_grand_piano-mp3",
  bass: "acoustic_bass-mp3",
  cello: "cello-mp3",
  click: "woodblock-mp3",
};

const NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export function sampleName(midi: number) {
  const oct = Math.floor(midi / 12) - 1;
  return `${NAMES[((midi % 12) + 12) % 12]}${oct}`;
}

type CacheKey = string;

const buffers = new Map<CacheKey, AudioBuffer>();
let ctx: AudioContext | null = null;
let nodes: AudioNode[] = [];
let raf = 0;

function context() {
  if (typeof window === "undefined") throw new Error("Audio only runs in the browser");
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
}

function keyOf(chair: Chair, midi: number) {
  return `${FOLDER[chair]}/${sampleName(midi)}`;
}

async function loadOne(audio: AudioContext, chair: Chair, midi: number) {
  const id = keyOf(chair, midi);
  const hit = buffers.get(id);
  if (hit) return hit;
  const url = `${SF}/${id}.mp3`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Missing live sample ${id} (${res.status})`);
  const raw = await res.arrayBuffer();
  const decoded = await audio.decodeAudioData(raw.slice(0));
  buffers.set(id, decoded);
  return decoded;
}

async function pool<T>(items: T[], size: number, job: (item: T) => Promise<void>) {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      await job(items[current]);
    }
  }
  const n = Math.min(size, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
}

export function stopLand() {
  cancelAnimationFrame(raf);
  raf = 0;
  for (const node of nodes) {
    try {
      if (node instanceof AudioBufferSourceNode) node.stop();
    } catch {
      /* already stopped */
    }
  }
  nodes = [];
}

export async function playLand(
  events: NoteEvent[],
  bpm: number,
  bars: number,
  onHead: (bar: number) => void,
  onLoad?: (done: number, total: number) => void,
) {
  stopLand();
  const audio = context();
  if (audio.state === "suspended") await audio.resume();

  const unique = new Map<string, { chair: Chair; midi: number }>();
  for (const event of events) unique.set(keyOf(event.chair, event.midi), { chair: event.chair, midi: event.midi });
  const pending = [...unique.values()];
  let done = 0;
  await pool(pending, 8, async (item) => {
    await loadOne(audio, item.chair, item.midi);
    done += 1;
    onLoad?.(done, pending.length);
  });

  const beat = 60 / bpm;
  const start = audio.currentTime + 0.12;
  const master = audio.createGain();
  master.gain.setValueAtTime(0.9, start);
  master.connect(audio.destination);
  nodes.push(master);

  for (const event of events) {
    const buffer = buffers.get(keyOf(event.chair, event.midi));
    if (!buffer) throw new Error(`Sample not in memory for ${event.chair}`);
    const when = start + (event.bar * 4 + event.beat) * beat;
    const dur = Math.max(0.08, event.dur * beat);
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const gain = audio.createGain();
    const peak = Math.max(0.02, event.vel);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.018);
    const releaseAt = when + Math.max(0.05, dur - 0.08);
    gain.gain.setValueAtTime(peak, releaseAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    source.connect(gain);
    gain.connect(master);
    source.start(when);
    source.stop(when + dur + 0.02);
    nodes.push(source, gain);
  }

  const total = bars * 4 * beat;
  const paint = () => {
    const bar = (audio.currentTime - start) / beat / 4;
    onHead(bar);
    if (audio.currentTime < start + total) raf = requestAnimationFrame(paint);
    else onHead(bars);
  };
  raf = requestAnimationFrame(paint);
}
