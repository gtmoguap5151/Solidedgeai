import { useState } from 'react';
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileText,
  Gauge,
  HardHat,
  Loader2,
  Mail,
  Megaphone,
  Rocket,
  Sparkles,
  Target,
  Workflow,
  Zap,
} from 'lucide-react';

interface LandingPageProps {
  onNavigate: (page: string) => void;
}

const paths = [
  {
    icon: Sparkles,
    eyebrow: 'Start free',
    title: 'AI Opportunity Assessment',
    text: 'Answer five questions and see where AI can save time, increase capacity, or create revenue in your business.',
    action: 'Find my best AI move',
    onClick: (onNavigate: (page: string) => void) => onNavigate('assessment'),
  },
  {
    icon: HardHat,
    eyebrow: 'Flagship program',
    title: 'AI Automation for Contractors',
    text: 'Practical systems for follow-up, scheduling, hiring, paperwork, estimates, and other repetitive contractor work.',
    action: 'Explore the contractor program',
    onClick: (onNavigate: (page: string) => void) => onNavigate('checkout'),
  },
  {
    icon: Workflow,
    eyebrow: 'Business systems',
    title: 'AI Operations & Automation',
    text: 'Turn repetitive business work into repeatable AI-assisted workflows that keep getting easier to run as you grow.',
    action: 'See what is coming',
    onClick: () => document.getElementById('roadmap')?.scrollIntoView({ behavior: 'smooth' }),
  },
  {
    icon: Megaphone,
    eyebrow: 'Growth',
    title: 'AI Sales & Marketing',
    text: 'Improve outreach, content, follow-up, lead handling, and customer communication without adding more busywork.',
    action: 'Join the early list',
    onClick: () => document.getElementById('free-guide')?.scrollIntoView({ behavior: 'smooth' }),
  },
];

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const [email, setEmail] = useState('');
  const [signupStatus, setSignupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [signupError, setSignupError] = useState('');

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSignupStatus('loading');
    setSignupError('');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      setSignupStatus('error');
      setSignupError('Email signup is temporarily unavailable. Please try again shortly.');
      return;
    }

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/subscribe_email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ p_email: email.trim() }),
      });
      if (!response.ok) throw new Error('signup failed');
      setSignupStatus('success');
      setEmail('');
    } catch {
      setSignupStatus('error');
      setSignupError('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="bg-stone-50">
      <section className="relative overflow-hidden bg-stone-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_35%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/10 text-amber-300 text-sm font-semibold px-4 py-2 rounded-full mb-7">
              <Zap className="w-4 h-4" /> Practical AI for people who want an edge
            </div>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.03]">
              Stop collecting AI tools. <span className="text-amber-400">Start getting results.</span>
            </h1>
            <p className="mt-7 text-xl sm:text-2xl text-stone-300 max-w-3xl leading-relaxed">
              Solid Edge AI helps businesses use artificial intelligence to save time, win customers, automate repetitive work, and build systems that actually pay for themselves.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <button onClick={() => onNavigate('assessment')} className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-lg px-7 py-4 rounded-xl transition-colors">
                Take the free AI assessment <ArrowRight className="w-5 h-5" />
              </button>
              <button onClick={() => document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-lg px-7 py-4 rounded-xl transition-colors">
                Explore Solid Edge AI
              </button>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-sm text-stone-400">
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400" /> Free ways to start</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400" /> Business-specific programs</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400" /> No AI experience required</span>
            </div>
          </div>
        </div>
      </section>

      <section id="explore" className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="max-w-3xl">
            <div className="text-sm font-bold uppercase tracking-wider text-amber-700">Choose your path</div>
            <h2 className="mt-3 text-3xl sm:text-5xl font-bold text-stone-900">You do not need the same AI plan as everyone else.</h2>
            <p className="mt-5 text-lg text-stone-600 leading-relaxed">Start with what matters right now. Some paths are free, some are focused programs, and the library will keep expanding as Solid Edge AI grows.</p>
          </div>
          <div className="mt-10 grid md:grid-cols-2 gap-5">
            {paths.map((path) => (
              <button key={path.title} onClick={() => path.onClick(onNavigate)} className="text-left bg-stone-50 hover:bg-amber-50 border border-stone-200 hover:border-amber-300 rounded-2xl p-6 sm:p-7 transition-all group">
                <div className="flex items-start justify-between gap-4">
                  <div className="w-12 h-12 bg-stone-900 group-hover:bg-amber-600 rounded-xl flex items-center justify-center transition-colors"><path.icon className="w-6 h-6 text-white" /></div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full">{path.eyebrow}</span>
                </div>
                <h3 className="mt-5 text-2xl font-bold text-stone-900">{path.title}</h3>
                <p className="mt-3 text-stone-600 leading-relaxed">{path.text}</p>
                <div className="mt-5 inline-flex items-center gap-2 font-bold text-stone-900 group-hover:text-amber-700">{path.action}<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-stone-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="text-sm font-bold uppercase tracking-wider text-amber-700">The Solid Edge approach</div>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-stone-900">AI should either make money, save time, or make the business easier to run.</h2>
              <p className="mt-5 text-lg text-stone-600 leading-relaxed">If it does none of those things, it is probably noise. We focus on useful workflows, clear outcomes, and tools ordinary business owners can actually put to work.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: Clock3, title: 'Save time', text: 'Reduce repetitive admin, follow-up, writing, and scheduling work.' },
                { icon: Target, title: 'Win more', text: 'Respond faster, follow up better, and turn more opportunities into customers.' },
                { icon: Gauge, title: 'Run leaner', text: 'Build repeatable systems before adding more payroll and overhead.' },
                { icon: Rocket, title: 'Grow smarter', text: 'Use AI where it creates leverage instead of adding another app to manage.' },
              ].map((item) => (
                <div key={item.title} className="bg-white border border-stone-200 rounded-2xl p-5">
                  <item.icon className="w-6 h-6 text-amber-700" />
                  <h3 className="mt-4 font-bold text-stone-900 text-lg">{item.title}</h3>
                  <p className="mt-2 text-sm text-stone-600 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="programs" className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="text-sm font-bold uppercase tracking-wider text-amber-700">Programs & resources</div>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-stone-900">Start free. Go deeper when you see the value.</h2>
            <p className="mt-4 text-lg text-stone-600">Find the right fit first. Pricing comes later, after people understand what they are getting.</p>
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            <div className="border border-stone-200 rounded-2xl p-6">
              <Bot className="w-7 h-7 text-amber-700" />
              <div className="mt-4 text-sm font-bold text-green-700">FREE</div>
              <h3 className="mt-1 text-xl font-bold text-stone-900">AI Business Assessment</h3>
              <p className="mt-3 text-stone-600">A personalized starting point based on your goals, bottlenecks, and current AI experience.</p>
              <button onClick={() => onNavigate('assessment')} className="mt-5 font-bold text-stone-900 inline-flex items-center gap-2">Take assessment <ArrowRight className="w-4 h-4" /></button>
            </div>
            <div className="border-2 border-amber-300 bg-amber-50 rounded-2xl p-6 relative">
              <div className="absolute -top-3 left-5 bg-stone-900 text-white text-xs font-bold px-3 py-1 rounded-full">AVAILABLE NOW</div>
              <HardHat className="w-7 h-7 text-amber-700" />
              <div className="mt-4 text-sm font-bold text-amber-800">FLAGSHIP</div>
              <h3 className="mt-1 text-xl font-bold text-stone-900">AI Automation for Contractors</h3>
              <p className="mt-3 text-stone-600">Four focused guides built around the repetitive work contractors deal with every week.</p>
              <button onClick={() => onNavigate('checkout')} className="mt-5 font-bold text-stone-900 inline-flex items-center gap-2">See program details <ArrowRight className="w-4 h-4" /></button>
            </div>
            <div className="border border-stone-200 rounded-2xl p-6">
              <BriefcaseBusiness className="w-7 h-7 text-amber-700" />
              <div className="mt-4 text-sm font-bold text-stone-500">EXPANDING</div>
              <h3 className="mt-1 text-xl font-bold text-stone-900">Solid Edge Business Library</h3>
              <p className="mt-3 text-stone-600">New practical paths for operations, sales, marketing, customer service, and business automation.</p>
              <button onClick={() => document.getElementById('free-guide')?.scrollIntoView({ behavior: 'smooth' })} className="mt-5 font-bold text-stone-900 inline-flex items-center gap-2">Get updates <ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </section>

      <section id="free-guide" className="py-16 sm:py-20 bg-amber-500">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-14 h-14 bg-stone-950 rounded-2xl flex items-center justify-center mx-auto mb-6"><FileText className="w-7 h-7 text-amber-300" /></div>
          <h2 className="text-3xl sm:text-4xl font-bold text-stone-950">Want something useful before you spend a dollar?</h2>
          <p className="mt-4 text-lg text-stone-800 max-w-2xl mx-auto">Join the Solid Edge list for practical AI ideas, new tools, and upcoming business-specific releases.</p>
          {signupStatus === 'success' ? (
            <div className="mt-8 bg-white rounded-2xl p-6 max-w-md mx-auto shadow-lg"><CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" /><p className="font-bold text-stone-900 text-lg">You are in.</p></div>
          ) : (
            <form onSubmit={handleEmailSignup} className="mt-8 flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
              <div className="relative flex-1">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourcompany.com" className="w-full pl-12 pr-4 py-4 rounded-xl text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-900" disabled={signupStatus === 'loading'} />
              </div>
              <button type="submit" disabled={signupStatus === 'loading'} className="bg-stone-950 hover:bg-stone-800 text-white font-bold px-6 py-4 rounded-xl transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2">
                {signupStatus === 'loading' ? <><Loader2 className="w-5 h-5 animate-spin" /> Joining...</> : 'Join free'}
              </button>
            </form>
          )}
          {signupStatus === 'error' && <p className="mt-3 text-stone-900 text-sm font-medium">{signupError}</p>}
        </div>
      </section>

      <section id="roadmap" className="py-16 bg-stone-950 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Sparkles className="w-8 h-8 text-amber-400 mx-auto" />
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold">Solid Edge AI is being built as an ecosystem, not a one-course website.</h2>
          <p className="mt-5 text-lg text-stone-300 max-w-3xl mx-auto">The contractor program is the first focused product. The larger direction is a growing library of practical AI systems for different industries, roles, and business problems.</p>
          <button onClick={() => onNavigate('assessment')} className="mt-8 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-7 py-3.5 rounded-xl transition-colors">
            Find my starting point <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>
    </div>
  );
}
