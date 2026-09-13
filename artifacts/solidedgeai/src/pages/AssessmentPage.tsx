import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Gauge, ShieldCheck, Sparkles, Target } from 'lucide-react';

type Dimension =
  | 'foundations'
  | 'instructions'
  | 'verification'
  | 'workflow'
  | 'agents'
  | 'safety';

type Answers = Record<Dimension, number> & {
  role: string;
  goal: string;
};

interface AssessmentPageProps {
  onNavigate: (page: string) => void;
}

const dimensions: Array<{
  key: Dimension;
  label: string;
  question: string;
  options: string[];
}> = [
  {
    key: 'foundations',
    label: 'AI Foundations',
    question: 'When AI gives you a confident answer, what best describes how you treat it?',
    options: [
      'I usually assume it is correct.',
      'I know it can be wrong, but I do not always check it.',
      'I treat it as generated output that may need verification.',
      'I can explain where model output is useful, uncertain, or inappropriate.',
    ],
  },
  {
    key: 'instructions',
    label: 'Instruction Design',
    question: 'How do you usually ask AI to do important work?',
    options: [
      'I type a short request and hope it understands.',
      'I add some context when the first answer is weak.',
      'I provide context, goal, constraints, and an output format.',
      'I build reusable instructions with examples and quality criteria.',
    ],
  },
  {
    key: 'verification',
    label: 'Verification',
    question: 'What happens before you use AI output in a real decision or customer-facing task?',
    options: [
      'Usually nothing.',
      'I reread it for obvious mistakes.',
      'I check important facts, calculations, assumptions, and claims.',
      'I use a repeatable verification process and know when a human expert is required.',
    ],
  },
  {
    key: 'workflow',
    label: 'Workflow Design',
    question: 'How well can you turn a repeated task into an AI-assisted process?',
    options: [
      'I have not done that yet.',
      'I reuse prompts manually.',
      'I can map inputs, steps, outputs, and approval points.',
      'I can design, measure, and improve a controlled workflow around a real business process.',
    ],
  },
  {
    key: 'agents',
    label: 'Automation & Agents',
    question: 'How comfortable are you with AI systems that use tools or act across multiple steps?',
    options: [
      'I do not really know how agents work.',
      'I understand the basic idea.',
      'I understand tools, permissions, memory, and approval gates.',
      'I can design monitored agent workflows with failure handling and limited permissions.',
    ],
  },
  {
    key: 'safety',
    label: 'Safety & Privacy',
    question: 'How do you decide what information or authority an AI system should receive?',
    options: [
      'I have not thought much about it.',
      'I avoid obvious secrets.',
      'I separate sensitive data and require approval for consequential actions.',
      'I deliberately minimize data access, permissions, and autonomy based on risk.',
    ],
  },
];

const emptyScores = dimensions.reduce(
  (scores, item) => ({ ...scores, [item.key]: -1 }),
  {} as Record<Dimension, number>,
);

const initialAnswers: Answers = {
  ...emptyScores,
  role: '',
  goal: '',
};

export default function AssessmentPage({ onNavigate }: AssessmentPageProps) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [submitted, setSubmitted] = useState(false);

  const isComplete =
    answers.role.length > 0 &&
    answers.goal.length > 0 &&
    dimensions.every((item) => answers[item.key] >= 0);

  const result = useMemo(() => {
    const scored = dimensions.map((item) => ({
      ...item,
      score: Math.max(0, answers[item.key]),
    }));
    const total = scored.reduce((sum, item) => sum + item.score, 0);
    const percent = Math.round((total / (dimensions.length * 3)) * 100);
    const weakest = [...scored].sort((a, b) => a.score - b.score).slice(0, 2);
    const strongest = [...scored].sort((a, b) => b.score - a.score)[0];
    const level = percent < 35 ? 'Foundation' : percent < 65 ? 'Builder' : percent < 85 ? 'Advanced' : 'Advanced+';

    return { scored, percent, weakest, strongest, level };
  }, [answers]);

  const setScore = (key: Dimension, score: number) => {
    setAnswers((current) => ({ ...current, [key]: score }));
  };

  if (submitted) {
    return (
      <div className="min-h-[70vh] bg-stone-50 py-12 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-xl">
            <div className="bg-stone-950 p-8 text-white sm:p-10">
              <div className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-300">
                <Sparkles className="h-4 w-4" /> Capability profile preview
              </div>
              <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <h1 className="text-3xl font-bold sm:text-5xl">Your next step is based on what you can demonstrate.</h1>
                  <p className="mt-4 max-w-3xl text-lg text-stone-300">
                    This is a starting profile, not a credential. Your answers place you at the <strong className="text-white">{result.level}</strong> stage and identify where evidence-based practice should begin.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                  <div className="text-4xl font-bold text-amber-400">{result.percent}%</div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-stone-400">self-assessed readiness</div>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-10">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.scored.map((item) => (
                  <div key={item.key} className="rounded-2xl border border-stone-200 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold text-stone-900">{item.label}</div>
                      <div className="rounded-full bg-stone-100 px-2.5 py-1 text-sm font-bold text-stone-700">{item.score}/3</div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full bg-amber-500" style={{ width: `${(item.score / 3) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-800">
                    <Target className="h-4 w-4" /> Your first capability targets
                  </div>
                  <div className="mt-4 space-y-3">
                    {result.weakest.map((item) => (
                      <div key={item.key} className="flex gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
                        <div>
                          <div className="font-bold text-stone-900">{item.label}</div>
                          <div className="text-sm text-stone-600">Build this skill next, then prove it with a practical task.</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-stone-700">
                    <Gauge className="h-4 w-4" /> Personalized path
                  </div>
                  <p className="mt-3 text-stone-700">
                    Strongest current area: <strong>{result.strongest.label}</strong>. Your path should preserve that strength while prioritizing {result.weakest.map((item) => item.label).join(' and ')}.
                  </p>
                  <p className="mt-3 text-sm text-stone-600">
                    Role: {answers.role}. Goal: {answers.goal}. These will shape the realistic tasks used to verify progress.
                  </p>
                </div>
              </div>

              <div className="mt-8 rounded-2xl border border-stone-800 bg-stone-900 p-6 text-white sm:p-7">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-300">
                  <ShieldCheck className="h-4 w-4" /> What happens next
                </div>
                <p className="mt-3 max-w-3xl text-stone-300">
                  The platform will move from self-assessment to evidence: learn the missing skill, complete a realistic task, verify the work against a rubric, update your capability profile, then advance.
                </p>
                <button
                  onClick={() => onNavigate('academy')}
                  className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 font-bold text-stone-950 hover:bg-amber-400"
                >
                  Start my capability path <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-stone-50 py-12 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-semibold text-amber-800">
            <Sparkles className="h-4 w-4" /> Free AI Capability Assessment
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">Find what you know, what you can do, and what you should learn next.</h1>
          <p className="mt-4 text-lg text-stone-600">This first version creates a starting profile across six practical AI capabilities. Later assessments will verify the skills with real work.</p>
        </div>

        <div className="space-y-6 rounded-3xl border border-stone-200 bg-white p-6 shadow-lg sm:p-8">
          <Field label="What kind of work do you do?">
            <input
              value={answers.role}
              onChange={(event) => setAnswers((current) => ({ ...current, role: event.target.value }))}
              placeholder="Example: roofing contractor, office manager, sales rep"
              className="w-full rounded-xl border border-stone-300 px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </Field>

          <Field label="What do you most want AI to help you accomplish?">
            <input
              value={answers.goal}
              onChange={(event) => setAnswers((current) => ({ ...current, goal: event.target.value }))}
              placeholder="Example: follow up faster without losing quality"
              className="w-full rounded-xl border border-stone-300 px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </Field>

          {dimensions.map((item, index) => (
            <fieldset key={item.key} className="rounded-2xl border border-stone-200 p-5 sm:p-6">
              <legend className="px-2 text-sm font-bold uppercase tracking-wider text-amber-800">{index + 1}. {item.label}</legend>
              <p className="mt-1 font-semibold text-stone-900">{item.question}</p>
              <div className="mt-4 grid gap-2">
                {item.options.map((option, score) => (
                  <button
                    type="button"
                    key={option}
                    onClick={() => setScore(item.key, score)}
                    className={`rounded-xl border p-4 text-left text-sm transition-colors ${
                      answers[item.key] === score
                        ? 'border-amber-500 bg-amber-50 text-stone-950'
                        : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}

          <button
            disabled={!isComplete}
            onClick={() => setSubmitted(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-6 py-4 text-lg font-bold text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            Build My Capability Profile <ArrowRight className="h-5 w-5" />
          </button>
          <p className="text-center text-xs text-stone-500">No payment required. This initial score is self-reported and is not presented as a verified credential.</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block font-semibold text-stone-900">{label}</span>
      {children}
    </label>
  );
}
