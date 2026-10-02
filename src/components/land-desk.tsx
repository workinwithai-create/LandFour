import { useEffect, useRef, useState } from "react";
import { Copy, Download, Play, Square } from "lucide-react";
import { playLand, stopLand } from "@/lib/landfour/audio";
import { downloadMidi, encodeMidi } from "@/lib/landfour/midi";
import {
  KEYS,
  RECIPES,
  keyOf,
  laneScore,
  leadSheet,
  partBars,
  partEvents,
  type BarView,
  type KeyId,
  type Part,
  type RecipeId,
} from "@/lib/landfour/score";

const STORE = "landfour-v1";

export function LandDesk() {
  const [keyId, setKeyId] = useState<KeyId>("C");
  const [recipe, setRecipe] = useState<RecipeId>("authentic");
  const [bpm, setBpm] = useState(82);
  const [part, setPart] = useState<Part | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "playing">("idle");
  const [head, setHead] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadLabel, setLoadLabel] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const playToken = useRef(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const saved = JSON.parse(raw) as { keyId?: KeyId; recipe?: RecipeId; bpm?: number };
        if (saved.keyId && KEYS.some((key) => key.id === saved.keyId)) setKeyId(saved.keyId);
        if (saved.recipe && RECIPES.some((item) => item.id === saved.recipe)) setRecipe(saved.recipe);
        if (typeof saved.bpm === "number" && saved.bpm >= 68 && saved.bpm <= 120) setBpm(saved.bpm);
      }
    } catch {
      /* ignore a bad save */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORE, JSON.stringify({ keyId, recipe, bpm }));
  }, [hydrated, keyId, recipe, bpm]);

  useEffect(() => () => stopLand(), []);

  const loop = laneScore(keyId, recipe, "cycle");
  const land = laneScore(keyId, recipe, "land");
  const recipeMeta = RECIPES.find((item) => item.id === recipe) ?? RECIPES[0];

  function halt() {
    playToken.current += 1;
    stopLand();
    setStatus("idle");
    setPart(null);
    setHead(-1);
    setLoadLabel(null);
  }

  async function play(next: Part) {
    const token = playToken.current + 1;
    playToken.current = token;
    stopLand();
    setError(null);
    setPart(next);
    setHead(-1);
    setStatus("loading");
    setLoadLabel("Loading FluidR3 piano, upright, cello, and woodblock.");
    const events = partEvents(keyId, recipe, next);
    const bars = partBars(next);
    try {
      await playLand(
        events,
        bpm,
        bars,
        (bar) => {
          if (playToken.current !== token) return;
          if (bar >= bars) {
            setHead(-1);
            setStatus("idle");
            setPart(null);
            setLoadLabel(null);
            return;
          }
          setStatus("playing");
          setLoadLabel(null);
          setHead(bar);
        },
        (done, total) => {
          if (playToken.current !== token) return;
          setLoadLabel(`Loading live samples ${done} of ${total}.`);
        },
      );
    } catch (err) {
      if (playToken.current !== token) return;
      halt();
      setError(err instanceof Error ? err.message : "Playback failed");
    }
  }

  function exportLand() {
    const events = partEvents(keyId, recipe, "finish");
    const bytes = encodeMidi(events, bpm);
    const name = recipeMeta.name.toLowerCase().replace(/\s+/g, "-");
    downloadMidi(bytes, `landfour-${keyId.toLowerCase()}-${name}.mid`);
  }

  async function copySheet() {
    const text = leadSheet(keyId, recipe, bpm);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setError("Clipboard blocked. The lead sheet is still on screen.");
    }
  }

  const busy = status === "loading";

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <header className="flex flex-col gap-6 border-b border-fg/15 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <p className="text-xs font-medium uppercase tracking-widest text-fg/60">Finish desk</p>
          <h1 className="mt-2 font-serif text-5xl leading-none tracking-tight sm:text-6xl">
            Land<span className="text-gold">Four</span>
          </h1>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-fg/80">
            The loop is not a song until the last bar can sit. Four bars of live piano, upright, and cello.
            The woodblock keeps time, then leaves.
          </p>
        </div>
        <p className="max-w-xs text-sm leading-relaxed text-fg/60">
          Not a stacked third. Not a shaker lift. Not a tag you sing twice. A cadence, then silence.
        </p>
      </header>

      <div className="mt-5 flex flex-col gap-3 border-b border-fg/15 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={primary} disabled={busy} onClick={() => void play("finish")}>
            <Play className="size-4" aria-hidden />
            Finish it
          </button>
          <button type="button" className={ghost} disabled={busy} onClick={() => void play("cycle")}>
            <Play className="size-4" aria-hidden />
            Loop
          </button>
          <button type="button" className={ghost} disabled={busy} onClick={() => void play("land")}>
            <Play className="size-4" aria-hidden />
            Land
          </button>
          <button type="button" className={ghost} onClick={halt}>
            <Square className="size-4" aria-hidden />
            Stop
          </button>
          <label className="ml-auto flex min-w-48 flex-1 items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-widest text-fg/60">Tempo</span>
            <input
              className="w-full accent-gold"
              type="range"
              min={68}
              max={120}
              value={bpm}
              aria-valuetext={`${bpm} bpm`}
              onChange={(event) => {
                halt();
                setBpm(Number(event.target.value));
              }}
            />
            <span className="w-8 font-serif text-lg text-fg">{bpm}</span>
          </label>
        </div>
        <p className="min-h-5 text-sm leading-snug text-fg/70" role="status">
          {error
            ? error
            : status === "loading"
              ? (loadLabel ?? "Loading FluidR3 piano, upright, cello, and woodblock.")
              : status === "playing"
                ? playingLine(part)
                : "Live FluidR3 samples. No oscillators. Audio stays in this tab."}
        </p>
      </div>

      <section className="mt-5 grid gap-4 lg:grid-cols-[16rem_1fr]">
        <div className="order-2 flex flex-col gap-4 rounded-2xl border border-fg/15 bg-moss/50 p-4 lg:order-1">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-fg/60">Key</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {KEYS.map((key) => (
                <button
                  key={key.id}
                  type="button"
                  aria-pressed={key.id === keyId}
                  className={pill(key.id === keyId)}
                  onClick={() => {
                    halt();
                    setKeyId(key.id);
                  }}
                >
                  {key.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-fg/60">Cadence</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {RECIPES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={item.id === recipe}
                  className={pill(item.id === recipe)}
                  onClick={() => {
                    halt();
                    setRecipe(item.id);
                  }}
                >
                  {item.name}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm leading-snug text-fg/70">{recipeMeta.blurb}</p>
          </div>

          <p className="text-sm leading-relaxed text-fg/60">
            {keyOf(keyId).label} · {recipeMeta.name}. Drop the MIDI on the last bars of the section. HookGrid
            still owns the map. MixForge still owns the master.
          </p>
        </div>

        <div className="order-1 flex flex-col gap-4 lg:order-2">
          <ScoreLane
            title="The loop"
            kicker="Still cycling"
            bars={loop.bars}
            caption={loop.caption}
            activeIndex={activeIndex(part, "cycle", head)}
            beat={activeBeat(part, "cycle", head)}
          />
          <ScoreLane
            title="The land"
            kicker={recipeMeta.name}
            bars={land.bars}
            caption={land.caption}
            activeIndex={activeIndex(part, "land", head)}
            beat={activeBeat(part, "land", head)}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" className={ghost} onClick={exportLand}>
              <Download className="size-4" aria-hidden />
              Export loop + land MIDI
            </button>
            <button type="button" className={ghost} onClick={() => void copySheet()}>
              <Copy className="size-4" aria-hidden />
              {copied ? "Copied" : "Copy lead sheet"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function ScoreLane({
  title,
  kicker,
  bars,
  caption,
  activeIndex,
  beat,
}: {
  title: string;
  kicker: string;
  bars: BarView[];
  caption: string;
  activeIndex: number;
  beat: number;
}) {
  return (
    <section className="rounded-2xl border border-fg/15 p-3 sm:p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-2xl leading-none text-fg">{title}</h2>
        <p className="text-xs font-medium uppercase tracking-widest text-fg/50">{kicker}</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {bars.map((bar, index) => {
          const on = index === activeIndex;
          return (
            <article
              key={`${bar.symbol}-${index}`}
              className={`min-h-32 min-w-0 rounded-xl border p-2 sm:p-3 ${
                bar.hold ? "border-gold bg-moss text-fg" : "border-bg/10 bg-paper text-bg"
              } ${on ? "ring-2 ring-gold" : ""}`}
            >
              <p className="font-serif text-lg leading-tight sm:text-2xl">{bar.symbol}</p>
              {bar.then ? <p className="font-serif text-sm leading-tight sm:text-base">→ {bar.then}</p> : null}
              <div className="mt-3 flex gap-1" aria-hidden>
                {[0, 1, 2, 3].map((step) => {
                  const clickBeat = bar.clicks && (step === 1 || step === 3);
                  const lit = on && step === beat;
                  return (
                    <span
                      key={step}
                      className={`h-1.5 flex-1 rounded-full ${
                        lit ? "bg-gold" : clickBeat ? "bg-gold/60" : bar.hold ? "bg-fg/25" : "bg-bg/15"
                      }`}
                    />
                  );
                })}
              </div>
              <p className={`mt-2 text-xs leading-snug ${bar.hold ? "text-fg/75" : "text-bg/60"}`}>{bar.role}</p>
            </article>
          );
        })}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-fg/70">{caption}</p>
    </section>
  );
}

function activeIndex(part: Part | null, lane: "cycle" | "land", head: number) {
  if (part == null || head < 0) return -1;
  if (part === lane) return Math.floor(head);
  if (part === "finish" && lane === "cycle" && head < 4) return Math.floor(head);
  if (part === "finish" && lane === "land" && head >= 4) return Math.floor(head - 4);
  return -1;
}

function activeBeat(part: Part | null, lane: "cycle" | "land", head: number) {
  const index = activeIndex(part, lane, head);
  if (index < 0) return -1;
  const local = part === "finish" && lane === "land" ? head - 4 : head;
  return Math.min(3, Math.floor((local - Math.floor(local)) * 4));
}

function playingLine(part: Part | null) {
  if (part === "cycle") return "Loop. Bar 4 will want to go back.";
  if (part === "land") return "Land. Listen for the woodblock leaving.";
  if (part === "finish") return "Loop, then the cadence. The second half sits.";
  return "";
}

function pill(on: boolean) {
  return `grid h-11 min-w-11 place-items-center rounded-full border px-3 font-medium ${
    on ? "border-gold bg-gold text-bg" : "border-fg/20 bg-bg text-fg"
  }`;
}

const ghost =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-fg/20 px-4 text-sm font-medium text-fg disabled:opacity-50";
const primary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gold px-4 text-sm font-semibold text-bg disabled:opacity-50";
