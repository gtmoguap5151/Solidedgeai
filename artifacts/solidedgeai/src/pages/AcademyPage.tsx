import { useState } from "react";
import {
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Workflow,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AcademyPageProps {
  onNavigate: (page: string) => void;
}

const capabilityLoop = [
  { icon: Gauge, title: "Assess", text: "Measure six practical AI capabilities instead of assigning one vague level." },
  { icon: Target, title: "Personalize", text: "Prioritize the skills that matter for your role, goals, and current weak points." },
  { icon: BookOpen, title: "Learn", text: "Take only the lessons needed for the next capability milestone." },
  { icon: Workflow, title: "Perform", text: "Complete realistic work instead of earning credit for simply opening content." },
  { icon: ClipboardCheck, title: "Verify", text: "Check the work against a clear rubric, including privacy and human-approval rules." },
  { icon: RefreshCw, title: "Advance", text: "Update the capability profile and move to the next skill or specialization." },
];

const foundationLessons = [
  {
    title: "Understand what AI can and cannot know",
    duration: "12 min",
    capability: "AI Foundations",
    summary: "Build the mental model required to use generated output without confusing confidence with truth.",
    task: "Take one AI answer from a real task and mark which parts are generated, factual, uncertain, or require a human decision.",
    evidence: "A correctly classified answer with at least one justified verification step.",
  },
  {
    title: "Design instructions that survive repetition",
    duration: "18 min",
    capability: "Instruction Design",
    summary: "Turn a vague request into a reusable job brief with context, constraints, examples, and a finished format.",
    task: "Rewrite one real request as a reusable instruction that another person could run without guessing what you meant.",
    evidence: "The instruction includes goal, context, constraints, quality criteria, and an explicit output format.",
  },
  {
    title: "Verify before the output becomes a decision",
    duration: "15 min",
    capability: "Verification",
    summary: "Identify the facts, calculations, assumptions, and consequential decisions that should never pass through unchecked.",
    task: "Create a verification pass for one customer-facing, financial, legal, scheduling, or operational AI output.",
    evidence: "A checklist that separates machine-generated work from facts and decisions requiring independent confirmation.",
  },
];

const courseGroups = {
  builder: [
    {
      icon: BrainCircuit,
      title: "Reusable AI Workflows",
      level: "Builder",
      status: "Existing material — conversion in progress",
      description: "Build controlled prompt and workflow systems, then demonstrate that they produce useful repeatable work.",
      outcomes: ["Instruction systems", "Workflow mapping", "Quality controls", "Outcome measurement"],
    },
    {
      icon: BriefcaseBusiness,
      title: "AI Sales & Communication",
      level: "Builder",
      status: "Existing material — conversion in progress",
      description: "Use AI for response, follow-up, content, and communication while preserving factual accuracy and human approval.",
      outcomes: ["Lead response", "Follow-up systems", "Content workflows", "Approval gates"],
    },
  ],
  advanced: [
    {
      icon: Workflow,
      title: "AI Operations & Automation",
      level: "Advanced",
      status: "Capability standard being defined",
      description: "Design business processes with explicit inputs, tools, approvals, monitoring, and recovery paths.",
      outcomes: ["Process design", "Automation boundaries", "Monitoring", "Failure recovery"],
    },
    {
      icon: Bot,
      title: "AI Agents & Tool-Using Systems",
      level: "Advanced",
      status: "Next curriculum release",
      description: "Design agents that can act without giving them unnecessary data, authority, or silent control over consequential decisions.",
      outcomes: ["Tool permissions", "Memory and state", "Approval gates", "Agent recovery"],
    },
  ],
  professional: [
    {
      icon: BriefcaseBusiness,
      title: "AI Automation for Contractors",
      level: "Professional",
      status: "Existing flagship — being upgraded",
      description: "The current contractor material becomes the first evidence-based specialization rather than a standalone PDF endpoint.",
      outcomes: ["Lead and bid workflows", "Crew operations", "Paperwork systems", "Marketing operations"],
    },
    {
      icon: Award,
      title: "Future Professional Tracks",
      level: "Professional",
      status: "Demand-led roadmap",
      description: "New tracks are added only when we can define realistic tasks and a credible capability standard for that role.",
      outcomes: ["Role-specific tasks", "Verified evidence", "Versioned skills", "Re-verification"],
    },
  ],
};

export default function AcademyPage({ onNavigate }: AcademyPageProps) {
  const [activeLesson, setActiveLesson] = useState(0);
  const lesson = foundationLessons[activeLesson];

  return (
    <div className="min-h-[75vh] bg-stone-100">
      <section className="border-b border-stone-800 bg-stone-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-amber-300">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5">
              <Sparkles className="h-4 w-4" /> Capability platform — working build
            </span>
            <span className="text-stone-400">Product model · September 2026</span>
          </div>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl">
                Do not just finish AI courses. Prove what you can do next.
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-relaxed text-stone-300 sm:text-xl">
                Your path begins with capability, not a catalog. Assess the gaps, learn the missing skill, perform realistic work, verify it, and update your profile.
              </p>
              <button
                onClick={() => onNavigate("assessment")}
                className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3 font-bold text-stone-950 hover:bg-amber-400"
              >
                Build my capability profile <ArrowRight className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-3xl font-bold text-amber-400">6</div>
                <div className="mt-1 text-sm text-stone-400">capability dimensions</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-3xl font-bold text-amber-400">1</div>
                <div className="mt-1 text-sm text-stone-400">adaptive learning path</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-6 max-w-3xl">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-700">The product loop</div>
            <h2 className="mt-2 text-3xl font-bold text-stone-900">Assess → Personalize → Learn → Perform → Verify → Advance</h2>
            <p className="mt-3 text-stone-600">Completion alone is not treated as proof of capability.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {capabilityLoop.map((item) => (
              <article key={item.title} className="rounded-2xl border border-stone-200 p-5">
                <item.icon className="h-6 w-6 text-amber-700" />
                <h3 className="mt-3 font-bold text-stone-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <Tabs defaultValue="foundations">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-stone-200 p-1.5 sm:grid-cols-4">
            <TabsTrigger value="foundations" className="min-h-11 data-[state=active]:bg-white">Foundation</TabsTrigger>
            <TabsTrigger value="builder" className="min-h-11 data-[state=active]:bg-white">Builder</TabsTrigger>
            <TabsTrigger value="advanced" className="min-h-11 data-[state=active]:bg-white">Advanced</TabsTrigger>
            <TabsTrigger value="professional" className="min-h-11 data-[state=active]:bg-white">Professional</TabsTrigger>
          </TabsList>

          <TabsContent value="foundations" className="mt-6">
            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="text-xs font-bold uppercase tracking-wider text-green-700">Open capability units</div>
                <h2 className="mt-2 text-2xl font-bold text-stone-900">Foundation evidence path</h2>
                <p className="mt-3 leading-relaxed text-stone-600">Each unit ends in work that can eventually become evidence in the learner's capability profile.</p>
                <div className="mt-6 space-y-2">
                  {foundationLessons.map((item, index) => (
                    <button
                      key={item.title}
                      onClick={() => setActiveLesson(index)}
                      className={`w-full rounded-xl border p-4 text-left transition-colors ${activeLesson === index ? "border-amber-400 bg-amber-50" : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"}`}
                    >
                      <div className="text-xs font-bold uppercase tracking-wider text-stone-500">{item.capability}</div>
                      <div className="mt-1 flex items-start justify-between gap-3">
                        <span className="font-semibold text-stone-900">{item.title}</span>
                        <span className="whitespace-nowrap text-xs text-stone-500">{item.duration}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <article className="rounded-3xl border border-stone-800 bg-stone-900 p-6 text-white shadow-xl sm:p-8">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                  <BookOpen className="h-4 w-4" /> {lesson.capability}
                </div>
                <h2 className="mt-4 text-3xl font-bold">{lesson.title}</h2>
                <p className="mt-4 text-lg leading-relaxed text-stone-300">{lesson.summary}</p>
                <div className="mt-7 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-300">Perform</div>
                    <p className="mt-2 text-sm leading-relaxed text-stone-200">{lesson.task}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-green-300">Evidence standard</div>
                    <p className="mt-2 text-sm leading-relaxed text-stone-200">{lesson.evidence}</p>
                  </div>
                </div>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => onNavigate("assessment")}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-bold text-stone-950 hover:bg-amber-400"
                  >
                    Assess my starting point <ArrowRight className="h-5 w-5" />
                  </button>
                  {activeLesson < foundationLessons.length - 1 ? (
                    <button
                      onClick={() => setActiveLesson((current) => current + 1)}
                      className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-semibold hover:bg-white/10"
                    >
                      Next unit
                    </button>
                  ) : null}
                </div>
              </article>
            </div>
          </TabsContent>

          {(["builder", "advanced", "professional"] as const).map((group) => (
            <TabsContent key={group} value={group} className="mt-6">
              <div className="grid gap-5 md:grid-cols-2">
                {courseGroups[group].map((course) => (
                  <article key={course.title} className="flex flex-col rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-900">
                        <course.icon className="h-6 w-6 text-amber-400" />
                      </div>
                      <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700">{course.level}</span>
                    </div>
                    <div className="mt-5 text-xs font-bold uppercase tracking-wider text-amber-700">{course.status}</div>
                    <h2 className="mt-2 text-2xl font-bold text-stone-900">{course.title}</h2>
                    <p className="mt-3 leading-relaxed text-stone-600">{course.description}</p>
                    <div className="mt-5 grid gap-2 sm:grid-cols-2">
                      {course.outcomes.map((outcome) => (
                        <div key={outcome} className="flex items-start gap-2 text-sm text-stone-700">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                          {outcome}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => onNavigate("programs")}
                      className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3 font-bold text-white hover:bg-stone-800"
                    >
                      View current programs <ArrowRight className="h-5 w-5" />
                    </button>
                  </article>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </section>

      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
          {[
            {
              icon: ShieldCheck,
              title: "Risk gates before autonomy",
              text: "A learner with weak verification or privacy capability should not be pushed into high-autonomy agent work.",
            },
            {
              icon: RefreshCw,
              title: "Skills can expire",
              text: "Curriculum versions and review dates allow a capability to be refreshed when the underlying technology changes.",
            },
            {
              icon: Award,
              title: "Evidence before credentials",
              text: "Long term, the valuable record is what the learner demonstrated, on which version, and when it was verified.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-stone-200 p-5">
              <item.icon className="h-6 w-6 text-amber-700" />
              <h2 className="mt-4 text-lg font-bold text-stone-900">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
