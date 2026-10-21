import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  Mail,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from "lucide-react";
import { MODULES } from "@/lib/courseData";

const HERO_IMG =
  "https://images.pexels.com/photos/7937313/pexels-photo-7937313.jpeg?auto=compress&cs=tinysrgb&w=1920";
const ALLACCESS_IMG =
  "https://images.pexels.com/photos/8961008/pexels-photo-8961008.jpeg?auto=compress&cs=tinysrgb&w=1600";

const LEVELS = [
  {
    label: "LEVEL 100 · START FROM ZERO",
    title: "Solid Edge AI Starter Playbook",
    text: "New to AI? Find the highest-value ways to use it in your business, build repeatable prompts and workflows, and track the time and money it saves you.",
    price: 49,
    link: "https://buy.stripe.com/00w7sKcL32qiaNw6VmgrS04",
    best: false,
  },
  {
    label: "LEVEL 200 · WIN THE WORK",
    title: "AI Sales & Marketing Playbook",
    text: "AI-assisted outreach, content, and lead follow-up that sounds like you. Win more jobs without adding busywork or hiring an agency.",
    price: 97,
    link: "https://buy.stripe.com/00w7sK5iB5Cuf3MdjKgrS05",
    best: false,
  },
  {
    label: "LEVEL 300 · RUN THE BUSINESS",
    title: "AI Operations & Automation Playbook",
    text: "Repeatable AI workflows for scheduling, admin, and crew communication — so the business runs with less friction and fewer late nights.",
    price: 147,
    link: "https://buy.stripe.com/7sY8wO26p7KCf3M93ugrS06",
    best: false,
  },
  {
    label: "CORE CURRICULUM",
    title: "Construction Contractor AI Course",
    text: "The complete system: four PDF guides covering bids, crews, paperwork, and marketing. Includes the Prompt & Template Vault and a completion certificate.",
    price: 197,
    link: "https://buy.stripe.com/fZu28qeTb6GybRA7ZqgrS03",
    best: true,
  },
];

const ALLACCESS_LINK = "https://buy.stripe.com/6oU14maCV5Cu6xggvWgrS07";
const CORE_LINK = "https://buy.stripe.com/fZu28qeTb6GybRA7ZqgrS03";

const FAQS = [
  {
    q: "What format are the guides?",
    a: "Written PDF guides you can read on any device — phone, tablet, or laptop. No videos to sit through, no logins or platforms to fight with. Download and read at your own pace.",
  },
  {
    q: "Do I need tech experience?",
    a: "None. The guides are written for construction business owners, not engineers. If you can send a text and use a web browser, you can use these.",
  },
  {
    q: "How does delivery work?",
    a: "Checkout is secure on Stripe. After payment your guides are emailed to you — usually within minutes. No accounts, no portals.",
  },
  {
    q: "What about a guarantee?",
    a: "30-day money-back guarantee. Try any level for a full month. If it doesn't help you save time and win more work, email us and we'll refund every penny.",
  },
  {
    q: "Where should I start?",
    a: "Start free with the cheat sheet. If you want more, Level 100 is the on-ramp. Or grab the Core Course or All-Access Pass if you want the whole system at once.",
  },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [error, setError] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setError("");
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      setStatus("error");
      setError("Email signup is temporarily unavailable. Please try again shortly.");
      return;
    }
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/subscribe_email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ p_email: email.trim() }),
      });
      if (!res.ok) throw new Error("signup failed");
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="bg-stone-950 text-stone-100">
      {/* HERO */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden">
        <img
          src={HERO_IMG}
          alt="Construction site at golden hour with hard hat and blueprints"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/85 to-stone-950/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-transparent to-stone-950/60" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold tracking-wide uppercase px-4 py-2 rounded-full mb-7">
              <Sparkles className="w-4 h-4" /> The AI University for Contractors
            </div>
            <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-white">
              The AI university built for{" "}
              <span className="text-amber-400">contractors.</span>
            </h1>
            <p className="mt-7 text-lg sm:text-2xl text-stone-300 max-w-2xl leading-relaxed">
              Win bids faster, run crews smoother, and kill the paperwork —
              practical AI courses you read on your phone, right at the job site.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => scrollTo("free")}
                className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-lg px-7 py-4 rounded-xl transition-colors"
              >
                Start Free <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => scrollTo("levels")}
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-lg px-7 py-4 rounded-xl transition-colors"
              >
                See the Levels
              </button>
            </div>
            <p className="mt-8 text-sm text-stone-400">
              30-day money-back guarantee · No tech experience needed
            </p>
          </div>
        </div>
      </section>

      {/* TRUST BAND */}
      <section className="bg-stone-900 border-y border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: ShieldCheck, title: "30-Day Guarantee", text: "Love it or it's free" },
              { icon: Zap, title: "Self-Paced", text: "No videos to sit through" },
              { icon: Sparkles, title: "Zero Tech Skills", text: "Written for owners" },
              { icon: Smartphone, title: "Job-Site Ready", text: "Read on your phone" },
            ].map((t) => (
              <div key={t.title} className="flex items-start gap-3">
                <t.icon className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white text-sm">{t.title}</div>
                  <div className="text-stone-400 text-sm">{t.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FREE ENTRY */}
      <section id="free" className="py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-14 h-14 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileText className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl font-bold text-white tracking-tight">
            Start free. Seriously.
          </h2>
          <p className="mt-5 text-lg text-stone-400 max-w-xl mx-auto leading-relaxed">
            Get the cheat sheet: "5 AI tools every contractor should start using
            this week." Free, by email. No spam — just useful stuff.
          </p>

          {status === "success" ? (
            <div className="mt-8 bg-stone-900 border border-amber-500/30 rounded-2xl p-6 max-w-md mx-auto">
              <CheckCircle2 className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <p className="font-bold text-white text-lg">You're in.</p>
              <p className="text-stone-400 text-sm mt-1">
                Check your inbox for the cheat sheet.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSignup}
              className="mt-8 flex flex-col sm:flex-row gap-3 max-w-lg mx-auto"
            >
              <div className="relative flex-1">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourcompany.com"
                  className="w-full pl-12 pr-4 py-4 rounded-xl text-stone-100 bg-stone-900 border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-stone-500"
                  disabled={status === "loading"}
                />
              </div>
              <button
                type="submit"
                disabled={status === "loading"}
                className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-6 py-4 rounded-xl transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Sending...
                  </>
                ) : (
                  "Get the cheat sheet"
                )}
              </button>
            </form>
          )}
          {status === "error" && (
            <p className="mt-3 text-amber-400 text-sm font-medium">{error}</p>
          )}
        </div>
      </section>

      {/* THE ACADEMY LADDER */}
      <section id="levels" className="py-20 sm:py-28 bg-stone-900/50 border-y border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-sm font-bold uppercase tracking-wider text-amber-400">
              The Academy Ladder
            </div>
            <h2 className="mt-3 font-serif text-3xl sm:text-5xl font-bold text-white tracking-tight">
              Pick your level. Climb from there.
            </h2>
          </div>
          <div className="mt-12 grid md:grid-cols-2 gap-6">
            {LEVELS.map((lvl) => (
              <div
                key={lvl.title}
                className={`relative rounded-2xl p-7 border transition-all ${
                  lvl.best
                    ? "border-amber-500/60 bg-gradient-to-b from-amber-500/10 to-stone-900"
                    : "border-white/10 bg-stone-900 hover:border-amber-500/40"
                }`}
              >
                {lvl.best && (
                  <div className="absolute -top-3 left-7 bg-amber-500 text-stone-950 text-xs font-bold px-3 py-1 rounded-full tracking-wide">
                    BEST VALUE
                  </div>
                )}
                <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  {lvl.label}
                </div>
                <h3 className="mt-3 font-serif text-2xl font-bold text-white">
                  {lvl.title}
                </h3>
                <p className="mt-3 text-stone-400 leading-relaxed">{lvl.text}</p>
                <div className="mt-6 flex items-center justify-between gap-4">
                  <div className="font-serif text-3xl font-bold text-white">
                    ${lvl.price}
                  </div>
                  <a
                    href={lvl.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-5 py-3 rounded-xl transition-colors"
                  >
                    Enroll — ${lvl.price} <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ALL-ACCESS PASS */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-amber-500/30">
            <img
              src={ALLACCESS_IMG}
              alt="Contractor using a tablet on site"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/90 to-stone-950/50" />
            <div className="relative p-8 sm:p-14 max-w-2xl">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                All-Access Pass
              </div>
              <h2 className="mt-3 font-serif text-3xl sm:text-5xl font-bold text-white tracking-tight">
                Everything. One pass. $297.
              </h2>
              <p className="mt-5 text-lg text-stone-300 leading-relaxed">
                All three playbooks + the full core course + the Prompt &
                Template Vault + your completion certificate. Bought separately:
                $490. With the pass: $297 — and every future level added this year
                is included.
              </p>
              <a
                href={ALLACCESS_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-lg px-7 py-4 rounded-xl transition-colors"
              >
                Get All-Access — $297 <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* INSIDE THE CORE COURSE */}
      <section id="core-course" className="py-20 sm:py-28 bg-stone-900/50 border-y border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-sm font-bold uppercase tracking-wider text-amber-400">
              Inside the Core Course
            </div>
            <h2 className="mt-3 font-serif text-3xl sm:text-5xl font-bold text-white tracking-tight">
              Four guides. One complete system.
            </h2>
          </div>
          <div className="mt-12 grid md:grid-cols-2 gap-6">
            {MODULES.map((m) => (
              <div
                key={m.number}
                className="rounded-2xl p-7 border border-white/10 bg-stone-900 hover:border-amber-500/40 transition-colors"
              >
                <div className="font-serif text-5xl font-bold text-amber-500/30">
                  {String(m.number).padStart(2, "0")}
                </div>
                <h3 className="mt-2 font-serif text-2xl font-bold text-white">
                  {m.title}
                </h3>
                <p className="mt-3 text-stone-400 leading-relaxed">
                  {m.description}
                </p>
                <ul className="mt-5 space-y-2">
                  {m.topics.map((t) => (
                    <li
                      key={t}
                      className="flex items-start gap-2 text-sm text-stone-300"
                    >
                      <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      {t}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 pt-5 border-t border-white/10 text-sm font-semibold text-amber-400">
                  {m.outcome}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-sm font-bold uppercase tracking-wider text-amber-400">
              How it works
            </div>
            <h2 className="mt-3 font-serif text-3xl sm:text-5xl font-bold text-white tracking-tight">
              Three steps. That's it.
            </h2>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              { n: "01", t: "Pick your level", d: "Choose the playbook or course that fits where you are. Check out securely on Stripe." },
              { n: "02", t: "Get your guides", d: "Your PDF guides are emailed to you. No logins, no platforms — just open and read." },
              { n: "03", t: "Put it to work", d: "Learn on your phone, at your own pace, and apply it on the job the same day." },
            ].map((s) => (
              <div
                key={s.n}
                className="rounded-2xl p-7 border border-white/10 bg-stone-900"
              >
                <div className="font-serif text-4xl font-bold text-amber-500">
                  {s.n}
                </div>
                <h3 className="mt-3 font-serif text-xl font-bold text-white">
                  {s.t}
                </h3>
                <p className="mt-3 text-stone-400 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GUARANTEE BAND */}
      <section className="py-16 bg-amber-500">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ShieldCheck className="w-12 h-12 text-stone-950 mx-auto mb-4" />
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-950 tracking-tight">
            30-day money-back guarantee.
          </h2>
          <p className="mt-4 text-lg text-stone-900 max-w-2xl mx-auto leading-relaxed">
            Try any level for a full month. If it doesn't help you save time and
            win more work, email us and we'll refund every penny.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-sm font-bold uppercase tracking-wider text-amber-400">
              FAQ
            </div>
            <h2 className="mt-3 font-serif text-3xl sm:text-5xl font-bold text-white tracking-tight">
              Questions, answered.
            </h2>
          </div>
          <div className="mt-10 space-y-3">
            {FAQS.map((f, i) => (
              <div
                key={f.q}
                className="rounded-2xl border border-white/10 bg-stone-900 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left"
                >
                  <span className="font-semibold text-white">{f.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-amber-400 shrink-0 transition-transform ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-stone-400 leading-relaxed">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STICKY BOTTOM BAR */}
      <div className="sticky bottom-0 z-40 bg-stone-950/95 backdrop-blur-md border-t border-amber-500/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="text-sm text-stone-300">
              <span className="font-bold text-white">Core Course — $197</span>
              <span className="hidden sm:inline text-stone-500"> · All four guides · 30-day guarantee</span>
            </div>
            <a
              href={CORE_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm px-5 py-2.5 rounded-lg transition-colors"
            >
              Enroll Now <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
