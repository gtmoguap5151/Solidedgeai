import { ArrowRight, BookOpen, Bot, CheckCircle2, Code2, Layers3, LockKeyhole, Workflow } from "lucide-react";

interface LandingPageProps {
  onNavigate: (page: string) => void;
}

const platformPillars = [
  {
    icon: Layers3,
    title: "One runtime. Many applications.",
    text: "A shared application layer for identity, state, task execution, and lifecycle controls—so each AI application does not have to reinvent its own foundation.",
  },
  {
    icon: LockKeyhole,
    title: "Capabilities before autonomy.",
    text: "Entities should receive only the permissions they need. Authorization, review gates, and clear boundaries belong in the platform—not as afterthoughts in each app.",
  },
  {
    icon: Workflow,
    title: "Inspectable execution.",
    text: "Tasks, results, and events should be understandable and traceable. Reliability and human control matter as much as generating an answer.",
  },
];

const prototypeFacts = [
  "Local Python runtime backed by SQLite",
  "Entity-scoped memory and event records",
  "Capability checks and idempotent task requests",
  "Creator storyworld and draft-asset workflow",
];

export default function LandingPage({ onNavigate }: LandingPageProps) {
  return (
    <div className="bg-stone-50 text-stone-900">
      <section className="relative overflow-hidden bg-stone-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(129,153,255,0.22),transparent_38%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/25 bg-indigo-300/10 px-4 py-2 text-sm font-semibold text-indigo-200">
            <Code2 className="h-4 w-4" /> Application-layer AI platform · In development
          </div>
          <h1 className="mt-7 max-w-5xl text-4xl font-bold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl">
            Build AI entities on a foundation you can{" "}
            <span className="text-indigo-300">understand and control.</span>
          </h1>
          <p className="mt-7 max-w-3xl text-lg leading-relaxed text-stone-300 sm:text-xl">
            GALINYX OS™ is being developed as a shared application layer for AI-powered entities and applications—with explicit capabilities, persistent state, inspectable tasks, and human control built into the design.
          </p>
          <div className="mt-9 flex flex-col gap-4 sm:flex-row">
            <a
              href="https://github.com/gtmoguap5151/Solidedgeai/blob/galinyx-launch/architecture/galinyx-developer-platform-roadmap.md"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-200 px-6 py-3 font-bold text-stone-950 transition-colors hover:bg-white"
            >
              Read the platform roadmap <ArrowRight className="h-5 w-5" />
            </a>
            <a
              href="https://github.com/gtmoguap5151/Solidedgeai/tree/galinyx-launch/galinyx-os"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10"
            >
              Inspect the prototype
            </a>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-stone-400">
            This is an active engineering project, not a claim of a finished or production-ready operating system. The current runtime prototype is local and offline.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-3xl">
          <div className="text-sm font-bold uppercase tracking-wider text-indigo-700">The platform idea</div>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">The Creator is one native application—not the whole OS.</h2>
          <p className="mt-5 text-lg leading-relaxed text-stone-600">
            GALINYX is designed around reusable runtime contracts. The Creator subsystem is the first reference application: a place to test how an AI-enabled creative workflow can use shared identity, story state, task controls, rights tracking, and human review. Other applications should be able to use the same foundation without inheriting Creator-specific privileges.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {platformPillars.map((pillar) => (
            <article key={pillar.title} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-950 text-indigo-200">
                <pillar.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-bold">{pillar.title}</h3>
              <p className="mt-3 leading-relaxed text-stone-600">{pillar.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8">
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-indigo-700">What exists today</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">A small, testable runtime prototype.</h2>
            <p className="mt-4 leading-relaxed text-stone-600">
              The repository contains a standard-library Python prototype and automated tests. It is intentionally limited while core contracts and security boundaries are being established.
            </p>
            <a
              href="https://github.com/gtmoguap5151/Solidedgeai/blob/galinyx-launch/architecture/galinyx-branch-audit-2026-10-16.md"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 font-bold text-indigo-800 hover:text-indigo-600"
            >
              Read the engineering audit <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6">
            <h3 className="text-lg font-bold">Prototype capabilities</h3>
            <ul className="mt-5 space-y-3">
              {prototypeFacts.map((fact) => (
                <li key={fact} className="flex items-start gap-3 text-sm leading-relaxed text-stone-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
              <strong>Not yet production-ready:</strong> authentication and tenant ownership, hardened authorization, migration tooling, external model adapters, deployment operations, and independent security validation remain open work. The current Creator generator is deterministic and offline; it does not generate real images or video.
            </div>
          </div>
        </div>
      </section>

      <section className="bg-stone-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="text-sm font-bold uppercase tracking-wider text-indigo-300">Supporting resources</div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">A platform is earned through working software.</h2>
              <p className="mt-4 max-w-2xl leading-relaxed text-stone-300">
                The existing learning materials can remain useful supporting content while the core developer platform is built and tested. They are not presented as proof that the GALINYX runtime is already a complete hosted product.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
              <button
                onClick={() => onNavigate("resources")}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-200 px-5 py-3 font-bold text-stone-950 hover:bg-white"
              >
                <BookOpen className="h-5 w-5" /> Explore resources
              </button>
              <button
                onClick={() => onNavigate("academy")}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 px-5 py-3 font-semibold text-white hover:bg-white/10"
              >
                <Bot className="h-5 w-5" /> Visit the Academy
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
