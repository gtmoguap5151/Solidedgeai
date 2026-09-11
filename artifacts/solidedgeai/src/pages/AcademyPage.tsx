import { useState } from "react";
import {
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AcademyPageProps {
  onNavigate: (page: string) => void;
}

const foundationLessons = [
  {
    title: "What AI is—and what it is not",
    duration: "12 min",
    summary:
      "Learn the useful mental model: AI predicts and generates; it does not know, verify, or take responsibility for the result.",
    practice:
      "Choose one repetitive task you understand well. Write down its input, the result you need, and the mistakes that would matter.",
  },
  {
    title: "Give AI a complete job brief",
    duration: "18 min",
    summary:
      "Turn vague requests into dependable instructions using context, goal, constraints, examples, and a clear output format.",
    practice:
      "Rewrite one real request using the five-part Solid Edge brief: role, context, task, rules, and finished format.",
  },
  {
    title: "Check the work before you trust it",
    duration: "15 min",
    summary:
      "Use a verification pass for facts, calculations, legal claims, private information, and anything sent to another person.",
    practice:
      "Ask AI to identify every claim in its answer that needs a source, calculation, or human decision before use.",
  },
];

const courseGroups = {
  builder: [
    {
      icon: BrainCircuit,
      title: "Prompt Systems & Reusable AI Workflows",
      level: "Builder",
      price: "$49",
      status: "Program available",
      description:
        "Build reusable prompt systems, define quality checks, and measure whether an AI workflow earns its place.",
      topics: [
        "Prompt architecture",
        "Reusable templates",
        "Quality controls",
        "ROI scorecards",
      ],
    },
    {
      icon: BriefcaseBusiness,
      title: "AI Sales & Marketing",
      level: "Builder",
      price: "$97",
      status: "Program available",
      description:
        "Create truthful offers, faster lead response, follow-up systems, and a content engine with human approval.",
      topics: [
        "Lead response",
        "Follow-up sequences",
        "Content systems",
        "Growth measurement",
      ],
    },
  ],
  advanced: [
    {
      icon: Workflow,
      title: "AI Operations & Automation",
      level: "Advanced",
      price: "$147",
      status: "Program available",
      description:
        "Map business processes, choose safe automation boundaries, and build reliable AI-assisted operations.",
      topics: [
        "Process mapping",
        "Automation design",
        "Approval gates",
        "30-day rollout",
      ],
    },
    {
      icon: Bot,
      title: "AI Agents & Autonomous Systems",
      level: "Advanced",
      price: "In development",
      status: "Next curriculum release",
      description:
        "Learn how tool-using agents plan work, access systems, handle failure, preserve privacy, and stay under human control.",
      topics: [
        "Agent architecture",
        "Tool permissions",
        "Memory and state",
        "Monitoring and recovery",
      ],
    },
  ],
  professional: [
    {
      icon: BriefcaseBusiness,
      title: "AI Automation for Contractors",
      level: "Professional track",
      price: "$197",
      status: "Flagship program available",
      description:
        "The original Solid Edge professional specialization for bids, crews, paperwork, marketing, and growth.",
      topics: [
        "Finding and winning bids",
        "Crew operations",
        "Paperwork and billing",
        "Marketing systems",
      ],
    },
    {
      icon: Award,
      title: "Future Industry Specializations",
      level: "Professional track",
      price: "Planned",
      status: "Curriculum roadmap",
      description:
        "Role-specific programs will be added only when the curriculum, practical exercises, and assessment standard are ready.",
      topics: [
        "Small business",
        "Sales teams",
        "Creators",
        "Operations leaders",
      ],
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
              <BookOpen className="h-4 w-4" /> Solid Edge AI Academy
            </span>
            <span className="text-stone-400">
              Classroom foundation · September 2026
            </span>
          </div>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl">
                Learn AI from your first useful prompt to advanced systems.
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-relaxed text-stone-300 sm:text-xl">
                One learning ladder. Plain language at the beginning, real
                workflows in the middle, and responsible automation at the
                advanced level.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-3xl font-bold text-amber-400">4</div>
                <div className="mt-1 text-sm text-stone-400">
                  learning levels
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-3xl font-bold text-amber-400">3</div>
                <div className="mt-1 text-sm text-stone-400">
                  open starter lessons
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <Tabs defaultValue="foundations">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-stone-200 p-1.5 sm:grid-cols-4">
            <TabsTrigger
              value="foundations"
              className="min-h-11 data-[state=active]:bg-white"
            >
              Beginner
            </TabsTrigger>
            <TabsTrigger
              value="builder"
              className="min-h-11 data-[state=active]:bg-white"
            >
              Builder
            </TabsTrigger>
            <TabsTrigger
              value="advanced"
              className="min-h-11 data-[state=active]:bg-white"
            >
              Advanced
            </TabsTrigger>
            <TabsTrigger
              value="professional"
              className="min-h-11 data-[state=active]:bg-white"
            >
              Professional
            </TabsTrigger>
          </TabsList>

          <TabsContent value="foundations" className="mt-6">
            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-green-700">
                      Free classroom preview
                    </div>
                    <h2 className="mt-2 text-2xl font-bold text-stone-900">
                      AI Foundations
                    </h2>
                  </div>
                  <Sparkles className="h-7 w-7 text-amber-600" />
                </div>
                <p className="mt-3 leading-relaxed text-stone-600">
                  Start here if AI still feels confusing, unreliable, or louder
                  than it is useful.
                </p>
                <div className="mt-6 space-y-2">
                  {foundationLessons.map((item, index) => (
                    <button
                      key={item.title}
                      onClick={() => setActiveLesson(index)}
                      className={`w-full rounded-xl border p-4 text-left transition-colors ${
                        activeLesson === index
                          ? "border-amber-400 bg-amber-50"
                          : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-semibold text-stone-900">
                          {index + 1}. {item.title}
                        </span>
                        <span className="whitespace-nowrap text-xs text-stone-500">
                          {item.duration}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <article className="rounded-3xl border border-stone-800 bg-stone-900 p-6 text-white shadow-xl sm:p-8">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                  <BookOpen className="h-4 w-4" /> Lesson {activeLesson + 1} of
                  3
                </div>
                <h2 className="mt-4 text-3xl font-bold">{lesson.title}</h2>
                <p className="mt-4 text-lg leading-relaxed text-stone-300">
                  {lesson.summary}
                </p>
                <div className="mt-7 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Put it to work
                  </div>
                  <p className="mt-2 leading-relaxed text-stone-200">
                    {lesson.practice}
                  </p>
                </div>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => onNavigate("assessment")}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-bold text-stone-950 transition-colors hover:bg-amber-400"
                  >
                    Find my learning path <ArrowRight className="h-5 w-5" />
                  </button>
                  {activeLesson < foundationLessons.length - 1 ? (
                    <button
                      onClick={() => setActiveLesson((current) => current + 1)}
                      className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-semibold hover:bg-white/10"
                    >
                      Next lesson
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
                  <article
                    key={course.title}
                    className="flex flex-col rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-900">
                        <course.icon className="h-6 w-6 text-amber-400" />
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">
                        {course.price}
                      </span>
                    </div>
                    <div className="mt-5 text-xs font-bold uppercase tracking-wider text-stone-500">
                      {course.level} · {course.status}
                    </div>
                    <h2 className="mt-2 text-2xl font-bold text-stone-900">
                      {course.title}
                    </h2>
                    <p className="mt-3 leading-relaxed text-stone-600">
                      {course.description}
                    </p>
                    <div className="mt-5 grid gap-2 sm:grid-cols-2">
                      {course.topics.map((topic) => (
                        <div
                          key={topic}
                          className="flex items-start gap-2 text-sm text-stone-700"
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                          {topic}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => onNavigate("programs")}
                      className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3 font-bold text-white hover:bg-stone-800"
                    >
                      View programs <ArrowRight className="h-5 w-5" />
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
              title: "Responsible by design",
              text: "Privacy, verification, security, and human approval belong inside the curriculum—not in tiny print afterward.",
            },
            {
              icon: Clock3,
              title: "Built for changing technology",
              text: "Courses are versioned and reviewed so students can see when material was updated and what changed.",
            },
            {
              icon: LockKeyhole,
              title: "Credentials without pretending",
              text: "Completion certificates will verify finished work. They will never be marketed as degrees, licenses, or accreditation.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-stone-200 p-5"
            >
              <item.icon className="h-6 w-6 text-amber-700" />
              <h2 className="mt-4 text-lg font-bold text-stone-900">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
