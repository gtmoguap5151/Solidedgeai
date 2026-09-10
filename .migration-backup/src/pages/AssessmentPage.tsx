import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, DollarSign, Sparkles, Target } from 'lucide-react';

type Answers = {
  business: string;
  goal: string;
  bottleneck: string;
  experience: string;
  hours: string;
};

interface AssessmentPageProps {
  onNavigate: (page: string) => void;
}

const initialAnswers: Answers = {
  business: '',
  goal: '',
  bottleneck: '',
  experience: '',
  hours: '',
};

export default function AssessmentPage({ onNavigate }: AssessmentPageProps) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [submitted, setSubmitted] = useState(false);

  const isComplete = Object.values(answers).every(Boolean);

  const result = useMemo(() => {
    const hours = Number(answers.hours || 0);
    const weeklyOpportunity = Math.max(2, Math.round(hours * 0.55));
    const annualHours = weeklyOpportunity * 52;
    const isContractor = /contract|construct|roof|remodel|plumb|electric|hvac|landscap|home service/i.test(answers.business);

    return {
      weeklyOpportunity,
      annualHours,
      isContractor,
      recommendation: isContractor
        ? 'AI Automation for Contractors'
        : 'Solid Edge AI Starter Path',
    };
  }, [answers]);

  const update = (key: keyof Answers, value: string) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  if (submitted) {
    return (
      <div className="bg-stone-50 min-h-[70vh] py-12 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white border border-stone-200 rounded-3xl shadow-xl overflow-hidden">
            <div className="bg-stone-900 text-white p-8 sm:p-10">
              <div className="inline-flex items-center gap-2 text-amber-300 font-semibold text-sm mb-4">
                <Sparkles className="w-4 h-4" />
                Your Solid Edge AI Opportunity Report
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold">You have automation opportunities worth acting on.</h1>
              <p className="mt-4 text-stone-300 text-lg max-w-2xl">
                Based on your answers, the fastest wins are around <strong className="text-white">{answers.bottleneck.toLowerCase()}</strong> and your goal to <strong className="text-white">{answers.goal.toLowerCase()}</strong>.
              </p>
            </div>

            <div className="p-8 sm:p-10">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                  <Clock3 className="w-6 h-6 text-amber-700 mb-3" />
                  <div className="text-2xl font-bold text-stone-900">{result.weeklyOpportunity}+ hrs</div>
                  <div className="text-sm text-stone-600 mt-1">potential weekly time recovered</div>
                </div>
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5">
                  <Target className="w-6 h-6 text-stone-700 mb-3" />
                  <div className="text-2xl font-bold text-stone-900">{result.annualHours}</div>
                  <div className="text-sm text-stone-600 mt-1">hours of annual capacity</div>
                </div>
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5">
                  <DollarSign className="w-6 h-6 text-stone-700 mb-3" />
                  <div className="text-2xl font-bold text-stone-900">High</div>
                  <div className="text-sm text-stone-600 mt-1">priority for revenue impact</div>
                </div>
              </div>

              <div className="mt-8">
                <h2 className="text-2xl font-bold text-stone-900">Your first 3 AI moves</h2>
                <div className="mt-5 space-y-4">
                  {[
                    `Automate the repetitive parts of ${answers.bottleneck.toLowerCase()} first.`,
                    `Build one repeatable workflow tied directly to ${answers.goal.toLowerCase()}.`,
                    'Track time saved and revenue generated so you only keep automations that pay for themselves.',
                  ].map((item) => (
                    <div key={item} className="flex gap-3 items-start">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <p className="text-stone-700">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-9 bg-amber-100 border border-amber-200 rounded-2xl p-6 sm:p-7">
                <div className="text-sm font-semibold text-amber-800 uppercase tracking-wide">Recommended next step</div>
                <h3 className="mt-2 text-2xl font-bold text-stone-900">{result.recommendation}</h3>
                <p className="mt-2 text-stone-700">
                  {result.isContractor
                    ? 'You match the exact audience this program was built for. It focuses on follow-up, scheduling, hiring, paperwork, and other repetitive contractor work.'
                    : 'We are expanding Solid Edge AI beyond contractors. For now, use this report as your roadmap and join the list for the next business-specific release.'}
                </p>
                <button
                  onClick={() => onNavigate(result.isContractor ? 'checkout' : 'home')}
                  className="mt-5 inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-bold px-6 py-3.5 rounded-xl transition-colors"
                >
                  {result.isContractor ? 'See the contractor program' : 'Explore Solid Edge AI'}
                  <ArrowRight className="w-5 h-5" />
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
            <Sparkles className="w-4 h-4" />
            Free AI Business Assessment
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-stone-900 tracking-tight">Find where AI can make you money or save you time.</h1>
          <p className="mt-4 text-lg text-stone-600">Answer five questions. Get a personalized opportunity report and your best next move.</p>
        </div>

        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-lg space-y-7">
          <Field label="1. What kind of business or work do you do?">
            <input value={answers.business} onChange={(e) => update('business', e.target.value)} placeholder="Example: Roofing contractor" className="w-full border border-stone-300 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </Field>

          <Field label="2. What is your biggest goal right now?">
            <Select value={answers.goal} onChange={(value) => update('goal', value)} options={['Get more customers', 'Save time', 'Increase profit', 'Grow the business', 'Reduce paperwork', 'Improve follow-up']} />
          </Field>

          <Field label="3. What is eating the most time or causing the most friction?">
            <Select value={answers.bottleneck} onChange={(value) => update('bottleneck', value)} options={['Customer follow-up', 'Estimates and proposals', 'Scheduling', 'Marketing and content', 'Hiring and screening', 'Emails and paperwork']} />
          </Field>

          <Field label="4. How comfortable are you with AI today?">
            <Select value={answers.experience} onChange={(value) => update('experience', value)} options={['Brand new', 'I have tried ChatGPT', 'I use AI sometimes', 'I use AI regularly']} />
          </Field>

          <Field label="5. About how many hours per week go to repetitive admin or marketing work?">
            <Select value={answers.hours} onChange={(value) => update('hours', value)} options={['3', '5', '10', '15', '20']} suffix=" hours/week" />
          </Field>

          <button
            disabled={!isComplete}
            onClick={() => setSubmitted(true)}
            className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-bold text-lg px-6 py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            Show My AI Opportunity Report
            <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-center text-xs text-stone-500">No payment required. Your answers are used to generate this report.</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block font-semibold text-stone-900 mb-2">{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options, suffix = '' }: { value: string; onChange: (value: string) => void; options: string[]; suffix?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-stone-300 rounded-xl px-4 py-3.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500">
      <option value="">Choose one</option>
      {options.map((option) => (
        <option key={option} value={option}>{option}{suffix}</option>
      ))}
    </select>
  );
}
