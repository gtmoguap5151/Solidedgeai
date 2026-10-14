import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, ClipboardCheck, Copy, FileText, Lightbulb, ShieldCheck, Sparkles, Target, Trophy } from "lucide-react";
import EvidenceStudio from "@/components/EvidenceStudio";

type Exercise = {
  id: string;
  audience: string;
  title: string;
  outcome: string;
  inputLabel: string;
  inputHint: string;
  instructions: string;
  rubric: string[];
  example: string;
};

const exercises: Exercise[] = [
  {
    id: "creator",
    audience: "Creators",
    title: "Make an idea publishable",
    outcome: "Turn one original thought into a factual, audience-specific content brief",
    inputLabel: "Your original idea",
    inputHint: "Explain something useful you genuinely know in 2–5 sentences.",
    instructions: "Using only your original idea, prepare a headline, a short post and a 30-second script. Adapt them to one specific audience. Keep claims accurate and identify facts that need checking.",
    rubric: ["Names a specific audience and a concrete benefit", "Preserves the original meaning", "Contains no invented statistics, quotes or testimonials", "Includes one clear next action"],
    example: "I help my neighborhood exchange spare plants. A monthly swap could save waste and help new gardeners start.",
  },
  {
    id: "career",
    audience: "Careers",
    title: "Prove a transferable skill",
    outcome: "Describe real experience in language an employer can evaluate",
    inputLabel: "One real task you performed",
    inputHint: "Describe what you did, not what you wish you had done.",
    instructions: "Write a truthful 3-line accomplishment using Situation, Action and Result. Explain what evidence supports the result and what skill it demonstrates. Do not manufacture metrics, qualifications or experience.",
    rubric: ["Describes an actual task and your specific contribution", "Uses verified facts rather than exaggerated results", "Names the transferable skill", "Identifies supporting evidence or remaining uncertainty"],
    example: "I organized a weekly volunteer rota and resolved scheduling conflicts for a community event.",
  },
  {
    id: "founder",
    audience: "Business",
    title: "Design an offer buyers understand",
    outcome: "Make a service clear enough for a buyer to accept or decline",
    inputLabel: "A problem you can solve",
    inputHint: "Who faces the problem, and what outcome can you personally deliver?",
    instructions: "Produce a one-page offer with buyer, observed problem, fixed deliverables, exclusions, required inputs, proposed price test and completion criteria. Mark unverified demand and costs as hypotheses.",
    rubric: ["Defines one narrow buyer and meaningful problem", "States exactly what is delivered and excluded", "Makes cost assumptions transparent", "Proposes a real customer test without fake urgency"],
    example: "Independent retailers lose time sorting repeated customer questions. I can create and organize a reviewed FAQ document.",
  },
  {
    id: "seller",
    audience: "Online sellers",
    title: "Audit a product listing",
    outcome: "Increase clarity without making unsupported product claims",
    inputLabel: "Verified product facts",
    inputHint: "Include actual dimensions, materials, use, and returns/shipping conditions, if known.",
    instructions: "Write a listing title, factual bullets, compatibility limitations and buyer FAQ. Highlight anything missing rather than filling gaps with assumptions.",
    rubric: ["Claims are supported by the supplied product facts", "Sizing or compatibility limitations are explicit", "No fake reviews, scarcity or guarantees", "Buyer questions and missing evidence are listed"],
    example: "Reusable 500 mL stainless-steel bottle. Hand wash only. Lid color black. Dimensions not yet measured.",
  },
  {
    id: "team",
    audience: "Teams",
    title: "Map a repeatable workflow",
    outcome: "Create a small procedure another person can follow",
    inputLabel: "A recurring task",
    inputHint: "What triggers it, who does it, and what gets sent or saved?",
    instructions: "Map trigger, inputs, steps, owner, approval point, output, exception and manual recovery. Add an AI-assisted draft step only if it can be reviewed before use.",
    rubric: ["Steps have a clear owner and sequence", "Inputs and expected output are explicit", "Consequential decisions retain human approval", "Includes an error response and manual fallback"],
    example: "Each Monday, someone organizes incoming customer questions into categories and proposes draft responses.",
  },
  {
    id: "research",
    audience: "Researchers & students",
    title: "Challenge an AI-generated answer",
    outcome: "Separate claims, evidence and uncertainty before trusting an answer",
    inputLabel: "An answer or claim to check",
    inputHint: "Paste a non-sensitive paragraph you wrote or received.",
    instructions: "Identify three factual claims, label each Verified, Unverified or Inference, and say what primary source could confirm it. Do not cite sources you have not actually opened.",
    rubric: ["Separates fact, inference and opinion", "Names evidence needed for significant claims", "Does not invent citations or assume AI accuracy", "Explains how uncertainty affects a decision"],
    example: "Our neighborhood recycling center accepts batteries on weekends and has no fees.",
  },
  {
    id: "life",
    audience: "Everyday life",
    title: "Build a safer personal admin routine",
    outcome: "Create a repeatable, privacy-conscious weekly task system",
    inputLabel: "Things you need to remember",
    inputHint: "List ordinary chores and deadlines; do not provide passwords, IDs, account numbers or medical details.",
    instructions: "Group the tasks by consequence and deadline. Draft a 15-minute weekly review with one reminder method and a way to confirm deadlines using official sources.",
    rubric: ["Tasks are grouped by actual urgency", "Unverified dates are not invented", "No private identifiers are needed", "The routine is repeatable and realistic"],
    example: "Review household mail each Friday, check upcoming renewals, and keep receipts organized.",
  },
];

const storageKey = "solid-edge-ai-skill-lab-v1";
type Entry = { notes: string; checks: boolean[]; completedAt?: string };
type Entries = Record<string, Entry>;

function loadEntries(): Entries {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Entries : {};
  } catch {
    return {};
  }
}

export default function SkillLabPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [selection, setSelection] = useState(exercises[0].id);
  const [entries, setEntries] = useState<Entries>(loadEntries);
  const [copied, setCopied] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const exercise = exercises.find((item) => item.id === selection) ?? exercises[0];
  const entry = entries[exercise.id] ?? { notes: "", checks: [] };
  const completed = useMemo(() => exercises.filter((item) => Boolean(entries[item.id]?.completedAt)).length, [entries]);
  const checked = exercise.rubric.filter((_, i) => entry.checks[i]).length;
  const isReady = entry.notes.trim().length >= 60 && checked === exercise.rubric.length;

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(entries));
      setStorageWarning(false);
    } catch {
      setStorageWarning(true);
    }
  }, [entries]);

  function updateEntry(next: Partial<Entry>) {
    setEntries((current) => ({
      ...current,
      [exercise.id]: { ...(current[exercise.id] ?? { notes: "", checks: [] }), ...next, completedAt: undefined },
    }));
    setCopied(false);
  }

  function markDone() {
    if (!isReady) return;
    setEntries((current) => ({
      ...current,
      [exercise.id]: { ...entry, completedAt: new Date().toISOString() },
    }));
  }

  async function copyWorksheet() {
    const text = [
      "SOLID EDGE AI — SKILL LAB",
      exercise.title,
      "Goal: " + exercise.outcome,
      "",
      "Practice:",
      exercise.instructions,
      "",
      "My work:",
      entry.notes,
      "",
      "Self-review:",
      ...exercise.rubric.map((item, i) => (entry.checks[i] ? "[x] " : "[ ] ") + item),
      "",
      "Self-reviewed practice only. Not a certificate or independent assessment.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-h-[80vh] bg-stone-100">
      <section className="bg-stone-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-300"><Sparkles className="h-5 w-5" /> Solid Edge AI · Free Practice Lab</div>
          <h1 className="mt-5 max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl">Don't just learn about AI. <span className="text-amber-400">Practice something real.</span></h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-stone-300">Seven practical challenges across careers, creativity, business, research, teams, online sales and everyday life. Produce a work sample, check it against a clear rubric, document what you tested, and export the evidence for your portfolio. No account required.</p>
          <div className="mt-7 flex flex-wrap gap-3 text-sm font-semibold text-stone-200">
            <span className="rounded-full border border-white/20 px-4 py-2"><BookOpen className="mr-2 inline h-4 w-4" /> 7 real-world exercises</span>
            <span className="rounded-full border border-white/20 px-4 py-2"><ShieldCheck className="mr-2 inline h-4 w-4" /> No account needed</span>
            <span className="rounded-full border border-white/20 px-4 py-2"><Trophy className="mr-2 inline h-4 w-4" /> {completed} / {exercises.length} practiced</span>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(230px,0.8fr)_minmax(0,1.8fr)]">
        <aside className="h-fit rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-stone-900">Choose your challenge</h2>
          <p className="mt-1 text-sm text-stone-500">One skill at a time. Switch freely.</p>
          <div className="mt-5 space-y-2">
            {exercises.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setSelection(item.id); setCopied(false); }}
                className={"w-full rounded-xl border p-4 text-left transition " + (selection === item.id ? "border-amber-500 bg-amber-50" : "border-stone-200 hover:border-amber-200 hover:bg-stone-50")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800">{item.audience}</span>
                  {entries[item.id]?.completedAt ? <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-label="Self-reviewed" /> : null}
                </div>
                <div className="mt-1 font-bold text-stone-900">{item.title}</div>
              </button>
            ))}
          </div>
          <button onClick={() => onNavigate("resources")} className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-amber-800 underline underline-offset-4">Explore the 10 free toolkits <ArrowRight className="h-4 w-4" /></button>
        </aside>

        <section className="space-y-5">
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-800"><Target className="h-4 w-4" /> Your mission</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-stone-900">{exercise.title}</h2>
            <p className="mt-3 leading-relaxed text-stone-600">{exercise.outcome}</p>
            <div className="mt-6 rounded-2xl bg-stone-900 p-5 text-stone-100">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-300"><Lightbulb className="h-4 w-4" /> Exercise brief</div>
              <p className="mt-3 whitespace-pre-line leading-relaxed">{exercise.instructions}</p>
              <p className="mt-4 border-t border-white/20 pt-4 text-sm text-stone-300"><strong className="text-white">Example input:</strong> {exercise.example}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <label htmlFor="work-sample" className="flex items-center gap-2 text-xl font-bold text-stone-900"><FileText className="h-5 w-5 text-amber-700" /> {exercise.inputLabel}</label>
            <p className="mt-2 text-sm text-stone-500">{exercise.inputHint}</p>
            <textarea
              id="work-sample"
              value={entry.notes}
              onChange={(event) => updateEntry({ notes: event.target.value })}
              className="mt-4 min-h-48 w-full resize-y rounded-2xl border border-stone-300 bg-stone-50 p-4 leading-relaxed text-stone-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              placeholder="Write your response or paste the work sample you created. This is not sent to Solid Edge AI."
              maxLength={12000}
            />
            <div className="mt-2 flex items-center justify-between text-xs text-stone-500"><span>Stored locally on this device only</span><span>{entry.notes.length} / 12000</span></div>
            {storageWarning ? <p role="alert" className="mt-2 text-sm text-amber-800">Your browser blocked local storage. Copy your work before leaving.</p> : null}
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <h3 className="flex items-center gap-2 text-xl font-bold text-stone-900"><ClipboardCheck className="h-5 w-5 text-amber-700" /> Check your work</h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">Mark each criterion only if you actually checked your result. This is a self-review, not independent grading or certification.</p>
            <div className="mt-5 space-y-3">
              {exercise.rubric.map((criterion, i) => (
                <label key={criterion} className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 p-4 hover:bg-stone-50">
                  <input type="checkbox" className="mt-1 h-5 w-5 accent-amber-600" checked={Boolean(entry.checks[i])} onChange={(event) => updateEntry({ checks: exercise.rubric.map((_, j) => j === i ? event.target.checked : Boolean(entry.checks[j])) })} />
                  <span className="text-sm font-medium leading-relaxed text-stone-800">{criterion}</span>
                </label>
              ))}
            </div>
            <div className="mt-5 text-sm font-semibold text-stone-600">{checked} / {exercise.rubric.length} criteria self-checked</div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" onClick={markDone} disabled={!isReady} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-bold text-stone-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 className="h-5 w-5" /> {entry.completedAt ? "Reviewed · Saved" : "Mark practice reviewed"}</button>
              <button type="button" onClick={() => void copyWorksheet()} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-3 font-bold text-stone-700 hover:bg-stone-50"><Copy className="h-5 w-5" /> {copied ? "Copied" : "Copy my work"}</button>
            </div>
            {entry.completedAt ? <p className="mt-4 text-sm font-semibold text-emerald-800">Self-review saved on this device. This is not a formal credential.</p> : null}
          </div>
          <EvidenceStudio projectId={exercise.id} projectTitle={exercise.title} brief={exercise.instructions} work={entry.notes} rubric={exercise.rubric} selfChecks={entry.checks} selfReviewedAt={entry.completedAt} />
          <p className="px-2 text-sm leading-relaxed text-stone-500">Privacy note: your work stays in this browser unless you choose to copy or share it. Clearing browser data may erase progress. Avoid entering secrets or sensitive personal records. Always independently check important real-world claims.</p>
        </section>
      </div>
    </div>
  );
}
