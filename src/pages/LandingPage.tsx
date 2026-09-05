import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  BookOpen,
  Wrench,
  TrendingUp,
  FileText,
  Users,
  DollarSign,
  ArrowRight,
  Loader2,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { COURSE, MODULES } from '@/lib/courseData';
import { supabase } from '@/lib/supabase';

interface LandingPageProps {
  onNavigate: (page: string) => void;
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const [email, setEmail] = useState('');
  const [signupStatus, setSignupStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [signupError, setSignupError] = useState('');

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSignupStatus('loading');
    setSignupError('');

    const { error } = await supabase.rpc('subscribe_email', {
      p_email: email.trim(),
    });

    if (error) {
      setSignupStatus('error');
      setSignupError('Something went wrong. Please try again.');
    } else {
      setSignupStatus('success');
      setEmail('');
    }
  };

  return (
    <div className="bg-stone-50">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-stone-100 to-stone-50 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000'[...]
        }} />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
              <Wrench className="w-4 h-4" />
              Built for construction business owners
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-stone-900 leading-[1.1] tracking-tight">
              {COURSE.name}
            </h1>
            <p className="mt-6 text-xl sm:text-2xl text-stone-600 font-medium">
              {COURSE.tagline}
            </p>
            <p className="mt-4 text-lg text-stone-600 max-w-2xl mx-auto leading-relaxed">
              {COURSE.description}
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => onNavigate('checkout')}
                className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
              >
                Get the Course — {COURSE.priceFormatted}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-stone-500">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                {COURSE.format}
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                {COURSE.duration}
              </span>
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-600" />
                {COURSE.level}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Why This Course */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-stone-900">
              Why this course exists
            </h2>
            <p className="mt-4 text-lg text-stone-600 max-w-2xl mx-auto">
              You didn't start a construction business to sit behind a laptop
              all night. But the paperwork, bids, and emails keep piling up.
              This course shows you exactly how to use AI tools to get that
              work done in minutes — so you can get back to the job site.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Clock,
                title: 'Save 10+ hours a week',
                text: 'Stop writing proposals, invoices, and reports from scratch. Let AI do the heavy lifting.',
              },
              {
                icon: DollarSign,
                title: 'Win more bids',
                text: 'Turn around professional proposals faster than your competitors. Speed wins jobs.',
              },
              {
                icon: Users,
                title: 'Run smoother operations',
                text: 'Keep crews organized with clear schedules, instructions, and daily reports — generated instantly.',
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="bg-stone-50 rounded-2xl p-8 border border-stone-200 hover:border-amber-300 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-5">
                  <item.icon className="w-6 h-6 text-amber-700" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-bold text-stone-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-stone-600 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Course Modules */}
      <section className="py-16 sm:py-20 bg-stone-100" id="modules">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-stone-900">
              What's inside the course
            </h2>
            <p className="mt-4 text-lg text-stone-600 max-w-2xl mx-auto">
              Four focused PDF guides. Each one tackles a real problem you deal
              with every day. No fluff, no theory — just step-by-step
              instructions with examples you can use right away.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {MODULES.map((module) => (
              <div
                key={module.number}
                className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-amber-600 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {module.number}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-stone-900">
                      {module.title}
                    </h3>
                    <p className="mt-2 text-stone-600 leading-relaxed">
                      {module.description}
                    </p>
                  </div>
                </div>

                <ul className="mt-4 space-y-2">
                  {module.topics.map((topic, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-stone-700"
                    >
                      <CheckCircle2
                        className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                        strokeWidth={2}
                      />
                      <span>{topic}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 pt-5 border-t border-stone-100">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-amber-600" />
                    <span className="font-semibold text-stone-900 text-sm">
                      Result: {module.outcome}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <button
              onClick={() => onNavigate('checkout')}
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl group"
            >
              Get all 4 guides — {COURSE.priceFormatted}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* Email Signup */}
      <section className="py-16 sm:py-20 bg-amber-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Mail className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Not ready to buy yet?
          </h2>
          <p className="mt-4 text-lg text-amber-50 leading-relaxed">
            Drop your email and we'll send you a free cheat sheet: <strong>"5 AI tools every contractor should start using this week."</strong> No spam, just useful stuff.
          </p>

          {signupStatus === 'success' ? (
            <div className="mt-8 bg-white rounded-2xl p-6 shadow-lg">
              <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
              <p className="text-lg font-semibold text-stone-900">
                You're on the list!
              </p>
              <p className="text-stone-600 mt-1">
                We'll reach out when we have tips and updates to share.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleEmailSignup}
              className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourcompany.com"
                className="w-full sm:flex-1 px-5 py-3.5 rounded-xl text-stone-900 bg-white border-2 border-transparent focus:border-amber-300 focus:outline-none text-base placeholder:text-stone-400"
                disabled={signupStatus === 'loading'}
              />
              <button
                type="submit"
                disabled={signupStatus === 'loading'}
                className="w-full sm:w-auto bg-stone-900 hover:bg-stone-800 text-white font-bold px-6 py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {signupStatus === 'loading' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>Send me the cheat sheet</>
                )}
              </button>
            </form>
          )}

          {signupStatus === 'error' && (
            <p className="mt-3 text-amber-100 text-sm">{signupError}</p>
          )}

          <p className="mt-4 text-amber-100 text-xs">
            We'll only email you useful stuff. Unsubscribe anytime.
          </p>
        </div>
      </section>
    </div>
  );
}
