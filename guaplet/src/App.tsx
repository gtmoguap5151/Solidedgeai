import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import type {
  Disclosure,
  Lesson,
  LessonProgress,
  Module,
  Opportunity,
  Profile,
} from "./lib/types";

type Tab = "home" | "earn" | "learn" | "profile";
type ApplicationStatus = "interested" | "applied" | "accepted" | "declined" | "completed";

function Brand() {
  return (
    <div className="brand" aria-label="Guaplet">
      <span className="brand-mark" aria-hidden="true">G</span>
      <span>Guaplet</span>
    </div>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

function formatInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (!list.length) return;
    out.push(
      <ul key={`ul-${out.length}`} className="lesson-list">
        {list.map((item, i) => <li key={i}>{formatInline(item)}</li>)}
      </ul>,
    );
    list = [];
  };

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) {
      flushList();
      return;
    }
    if (/^[-*]\s+/.test(line)) {
      list.push(line.replace(/^[-*]\s+/, ""));
      return;
    }
    flushList();
    const numbered = line.match(/^\d+\.\s+(.*)$/);
    if (numbered) {
      out.push(<p className="numbered" key={index}>{formatInline(line)}</p>);
    } else if (line.startsWith("### ")) {
      out.push(<h4 key={index}>{formatInline(line.slice(4))}</h4>);
    } else if (line.startsWith("## ")) {
      out.push(<h3 key={index}>{formatInline(line.slice(3))}</h3>);
    } else if (line.startsWith("# ")) {
      out.push(<h2 key={index}>{formatInline(line.slice(2))}</h2>);
    } else {
      out.push(<p key={index}>{formatInline(line)}</p>);
    }
  });
  flushList();
  return <div className="markdown">{out}</div>;
}

function AuthGate({
  onExplore,
}: {
  onExplore: (tab: Tab) => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to finish creating your Guaplet account.");
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <Brand />
        <p className="tagline">Earn. Learn. Move Forward.</p>
        <h1>Build better money moves without the nonsense.</h1>
        <p className="lede">
          Learn practical money skills and discover earning opportunities that Guaplet reviews before publishing.
        </p>

        <div className="auth-card">
          <div className="segmented">
            <button className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>Sign in</button>
            <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Create account</button>
          </div>
          <form onSubmit={submit}>
            <label>Email<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>Password<input required minLength={6} type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <button className="primary full" disabled={busy} type="submit">
              {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
          {message && <p className="form-message" role="status">{message}</p>}
        </div>

        <div className="guest-actions">
          <span>Want to look around first?</span>
          <button onClick={() => onExplore("learn")}>Explore Money University</button>
          <button onClick={() => onExplore("earn")}>Browse Earn</button>
        </div>
      </div>
    </div>
  );
}

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  const items: Array<[Tab, string, string]> = [
    ["home", "⌂", "Home"],
    ["earn", "↗", "Earn"],
    ["learn", "▤", "Learn"],
    ["profile", "○", "Profile"],
  ];
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map(([value, icon, label]) => (
        <button
          key={value}
          className={tab === value ? "active" : ""}
          aria-current={tab === value ? "page" : undefined}
          onClick={() => setTab(value)}
        >
          <span>{icon}</span>{label}
        </button>
      ))}
    </nav>
  );
}

function ProgressBar({ value }: { value: number }) {
  return <div className="progress"><div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

function Home({
  session,
  modules,
  lessons,
  progress,
  opportunities,
  disclosures,
  setTab,
  openLesson,
}: {
  session: Session | null;
  modules: Module[];
  lessons: Lesson[];
  progress: LessonProgress[];
  opportunities: Opportunity[];
  disclosures: Disclosure[];
  setTab: (tab: Tab) => void;
  openLesson: (lesson: Lesson) => void;
}) {
  const completed = progress.filter((p) => p.status === "completed").length;
  const percent = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;
  const completedIds = new Set(progress.filter((p) => p.status === "completed").map((p) => p.lesson_id));
  const nextLesson = lessons.find((l) => !completedIds.has(l.id)) || lessons[0];
  const revenue = disclosures.find((d) => d.key === "revenue_model");

  return (
    <>
      <header className="page-head">
        <Brand />
        <p className="eyebrow">{session ? "Welcome back" : "Welcome to Guaplet"}</p>
        <h1>Your next move,<br />made clear.</h1>
        <p className="muted">Earn. Learn. Move Forward.</p>
      </header>

      <main className="page-body">
        <section className="feature-card">
          <span>RECOMMENDED NEXT</span>
          {nextLesson ? (
            <>
              <h2>{nextLesson.title}</h2>
              <p>{nextLesson.summary}</p>
              <button onClick={() => openLesson(nextLesson)}>Start lesson →</button>
            </>
          ) : (
            <>
              <h2>Money University is loading.</h2>
              <p>Published curriculum will appear here as soon as it is available.</p>
              <button onClick={() => setTab("learn")}>Open Learn →</button>
            </>
          )}
        </section>

        <section className="section">
          <div className="section-heading">
            <h2>Money University</h2>
            <span>{completed}/{lessons.length} lessons</span>
          </div>
          <ProgressBar value={percent} />
          <p className="small muted">{session ? `${percent}% complete` : "Sign in to save your progress."}</p>
        </section>

        <section className="two-grid">
          <button className="path-card" onClick={() => setTab("earn")}>
            <Icon>↗</Icon><strong>Earn</strong>
            <span>{opportunities.length ? `${opportunities.length} vetted opportunities` : "Reviewed opportunities only"}</span>
          </button>
          <button className="path-card" onClick={() => setTab("learn")}>
            <Icon>▤</Icon><strong>Learn</strong>
            <span>{modules.length ? `${modules.length} real modules` : "Practical money education"}</span>
          </button>
        </section>

        <section className="transparency-strip">
          <Icon>◎</Icon>
          <div>
            <strong>How Guaplet makes money</strong>
            <p>{revenue?.body_markdown || "Guaplet uses clearly disclosed revenue sources and does not take a percentage of your wages merely because you earned them."}</p>
          </div>
        </section>
      </main>
    </>
  );
}

function Learn({
  session,
  modules,
  lessons,
  progress,
  disclosures,
  selectedLesson,
  setSelectedLesson,
  markLesson,
}: {
  session: Session | null;
  modules: Module[];
  lessons: Lesson[];
  progress: LessonProgress[];
  disclosures: Disclosure[];
  selectedLesson: Lesson | null;
  setSelectedLesson: (lesson: Lesson | null) => void;
  markLesson: (lesson: Lesson, status: "in_progress" | "completed") => Promise<void>;
}) {
  const progressMap = useMemo(() => new Map(progress.map((p) => [p.lesson_id, p])), [progress]);
  const educationNotice = disclosures.find((d) => d.key === "education_notice");

  if (selectedLesson) {
    const p = progressMap.get(selectedLesson.id);
    return (
      <main className="page-body lesson-page">
        <button className="text-button" onClick={() => setSelectedLesson(null)}>← Money University</button>
        <p className="eyebrow">LESSON · {selectedLesson.estimated_minutes} MIN</p>
        <h1>{selectedLesson.title}</h1>
        <p className="lesson-summary">{selectedLesson.summary}</p>
        <MarkdownLite text={selectedLesson.body_markdown} />
        <div className="lesson-actions">
          {session ? (
            <>
              {p?.status !== "completed" && <button className="secondary" onClick={() => markLesson(selectedLesson, "in_progress")}>Save for later</button>}
              <button className="primary" onClick={() => markLesson(selectedLesson, "completed")}>{p?.status === "completed" ? "Completed ✓" : "Mark complete"}</button>
            </>
          ) : (
            <p className="notice">Sign in to save lesson progress. You can still read every published lesson.</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <>
      <header className="page-head">
        <Brand />
        <p className="eyebrow">LEARN</p>
        <h1>Money University</h1>
        <p className="muted">Practical money knowledge, without jargon or judgment.</p>
      </header>
      <main className="page-body">
        {modules.map((module) => {
          const moduleLessons = lessons.filter((l) => l.module_id === module.id);
          const moduleDone = moduleLessons.filter((l) => progressMap.get(l.id)?.status === "completed").length;
          return (
            <section className="module-card" key={module.id}>
              <div className="module-num">{String(module.position).padStart(2, "0")}</div>
              <div className="module-main">
                <h2>{module.title}</h2>
                <p>{module.description}</p>
                <span className="small muted">{moduleDone}/{moduleLessons.length} complete</span>
                <div className="lesson-links">
                  {moduleLessons.map((lesson) => (
                    <button key={lesson.id} onClick={() => setSelectedLesson(lesson)}>
                      <span>{progressMap.get(lesson.id)?.status === "completed" ? "✓" : "→"}</span>
                      <div><strong>{lesson.title}</strong><small>{lesson.estimated_minutes} min</small></div>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
        {!modules.length && <div className="empty"><h2>No published modules yet</h2><p>Guaplet only shows curriculum that is ready for real use.</p></div>}
        {educationNotice && <div className="notice"><strong>{educationNotice.title}</strong><p>{educationNotice.body_markdown}</p></div>}
      </main>
    </>
  );
}

function Earn({
  session,
  opportunities,
  saved,
  applications,
  disclosures,
  toggleSave,
  setApplication,
  openOpportunity,
  reportOpportunity,
}: {
  session: Session | null;
  opportunities: Opportunity[];
  saved: Set<string>;
  applications: Map<string, string>;
  disclosures: Disclosure[];
  toggleSave: (id: string) => Promise<void>;
  setApplication: (id: string, status: ApplicationStatus) => Promise<void>;
  openOpportunity: (opportunity: Opportunity) => Promise<void>;
  reportOpportunity: (opportunity: Opportunity) => Promise<void>;
}) {
  const earningsNotice = disclosures.find((d) => d.key === "earnings_notice");
  return (
    <>
      <header className="page-head">
        <Brand />
        <p className="eyebrow">EARN</p>
        <h1>Opportunities worth your time.</h1>
        <p className="muted">Listings appear only after Guaplet reviews the provider and required disclosures.</p>
      </header>
      <main className="page-body">
        {!opportunities.length ? (
          <div className="empty">
            <div className="empty-icon">↗</div>
            <h2>No verified opportunities published yet</h2>
            <p>That is intentional. Guaplet will not pad this page with fake jobs, fake earnings, or unreviewed offers.</p>
          </div>
        ) : opportunities.map((o) => (
          <article className="opportunity" key={o.id}>
            <div className="op-top"><span className="pill">{o.opportunity_type.replaceAll("_", " ")}</span><span>Reviewed {o.last_reviewed_at ? new Date(o.last_reviewed_at).toLocaleDateString() : "recently"}</span></div>
            <h2>{o.title}</h2>
            <p className="provider">{o.provider_name}</p>
            <p>{o.description}</p>
            <dl>
              <div><dt>Compensation</dt><dd>{o.compensation_disclosure}</dd></div>
              <div><dt>Pay basis</dt><dd>{o.pay_basis}</dd></div>
              {o.effort_expectation && <div><dt>Effort</dt><dd>{o.effort_expectation}</dd></div>}
              <div><dt>Fees / costs</dt><dd>{o.fees_costs}</dd></div>
              {o.payout_timing && <div><dt>Payout</dt><dd>{o.payout_timing}</dd></div>}
              {o.geography && <div><dt>Where</dt><dd>{o.geography}</dd></div>}
            </dl>
            {o.referral_disclosure && <p className="affiliate">{o.referral_disclosure}</p>}
            <div className="button-row">
              <button className="primary" onClick={() => openOpportunity(o)}>Open opportunity ↗</button>
              {session && <button className="secondary" onClick={() => toggleSave(o.id)}>{saved.has(o.id) ? "Saved ✓" : "Save"}</button>}
            </div>
            {session && (
              <div className="track-row">
                <label>My status
                  <select value={applications.get(o.id) || "interested"} onChange={(e) => setApplication(o.id, e.target.value as ApplicationStatus)}>
                    <option value="interested">Interested</option><option value="applied">Applied</option><option value="accepted">Accepted</option><option value="declined">Declined</option><option value="completed">Completed</option>
                  </select>
                </label>
                <button className="report" onClick={() => reportOpportunity(o)}>Report listing</button>
              </div>
            )}
          </article>
        ))}
        {!session && <div className="notice">Sign in to save opportunities and track applications.</div>}
        {earningsNotice && <div className="notice"><strong>{earningsNotice.title}</strong><p>{earningsNotice.body_markdown}</p></div>}
      </main>
    </>
  );
}

function ProfilePage({
  session,
  profile,
  progress,
  lessons,
  saved,
  applications,
  premiumStatus,
  disclosures,
  updateName,
  signOut,
  onSignIn,
}: {
  session: Session | null;
  profile: Profile | null;
  progress: LessonProgress[];
  lessons: Lesson[];
  saved: Set<string>;
  applications: Map<string, string>;
  premiumStatus: string;
  disclosures: Disclosure[];
  updateName: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
  onSignIn: () => void;
}) {
  const [name, setName] = useState(profile?.display_name || "");
  useEffect(() => setName(profile?.display_name || ""), [profile?.display_name]);
  const completed = progress.filter((p) => p.status === "completed").length;

  return (
    <>
      <header className="page-head">
        <Brand />
        <p className="eyebrow">PROFILE</p>
        <h1>{session ? "Your account" : "Transparency & account"}</h1>
      </header>
      <main className="page-body">
        {session ? (
          <>
            <section className="section-card">
              <label>Display name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label>
              <button className="secondary" onClick={() => updateName(name)}>Save name</button>
              <p className="small muted">{session.user.email}</p>
            </section>
            <section className="stats-grid">
              <div><strong>{completed}/{lessons.length}</strong><span>Lessons complete</span></div>
              <div><strong>{saved.size}</strong><span>Saved opportunities</span></div>
              <div><strong>{Array.from(applications.values()).filter((s) => s !== "interested").length}</strong><span>Tracked applications</span></div>
              <div><strong>{premiumStatus === "active" ? "Active" : "Free"}</strong><span>Account tier</span></div>
            </section>
          </>
        ) : (
          <div className="section-card">
            <h2>Sign in for progress and saves</h2>
            <p>Your published lessons and Earn listings remain browseable without an account.</p>
            <button className="primary" onClick={onSignIn}>Sign in</button>
          </div>
        )}

        <section className="section">
          <h2>Transparency</h2>
          {disclosures.map((d) => (
            <details key={d.key} className="disclosure">
              <summary>{d.title}</summary>
              <MarkdownLite text={d.body_markdown} />
            </details>
          ))}
        </section>

        <section className="notice">
          <strong>Banking status</strong>
          <p>Guaplet does not currently expose a wallet, bank balance, transfer, debit card, direct deposit, or cash-out feature. Those functions stay absent until a real regulated production program is approved and connected.</p>
        </section>

        {session && <button className="danger-text" onClick={signOut}>Sign out</button>}
      </main>
    </>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [guest, setGuest] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<LessonProgress[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [disclosures, setDisclosures] = useState<Disclosure[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [applications, setApplications] = useState<Map<string, string>>(new Map());
  const [premiumStatus, setPremiumStatus] = useState("inactive");
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [toast, setToast] = useState("");

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function loadPublic() {
    const [moduleRes, lessonRes, oppRes, disclosureRes] = await Promise.all([
      supabase.from("money_university_modules").select("id,slug,title,description,position").order("position"),
      supabase.from("money_university_lessons").select("id,module_id,slug,title,summary,body_markdown,estimated_minutes,position").order("position"),
      supabase.from("earning_opportunities").select("id,provider_name,title,opportunity_type,description,eligibility,pay_basis,compensation_disclosure,effort_expectation,fees_costs,payout_timing,geography,application_url,last_reviewed_at,referral_disclosure,referral_url").order("last_reviewed_at", { ascending: false }),
      supabase.from("app_disclosures").select("key,title,body_markdown,version").order("key"),
    ]);
    if (moduleRes.error) throw moduleRes.error;
    if (lessonRes.error) throw lessonRes.error;
    if (oppRes.error) throw oppRes.error;
    if (disclosureRes.error) throw disclosureRes.error;
    setModules((moduleRes.data || []) as Module[]);
    setLessons((lessonRes.data || []) as Lesson[]);
    setOpportunities((oppRes.data || []) as Opportunity[]);
    setDisclosures((disclosureRes.data || []) as Disclosure[]);
  }

  async function loadUser(activeSession: Session) {
    const userId = activeSession.user.id;
    await supabase.from("guaplet_profiles").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

    const [profileRes, progressRes, savedRes, appRes, premiumRes] = await Promise.all([
      supabase.from("guaplet_profiles").select("user_id,display_name").eq("user_id", userId).maybeSingle(),
      supabase.from("lesson_progress").select("lesson_id,status,started_at,completed_at").eq("user_id", userId),
      supabase.from("saved_opportunities").select("opportunity_id").eq("user_id", userId),
      supabase.from("opportunity_applications").select("opportunity_id,status").eq("user_id", userId),
      supabase.from("premium_entitlements").select("status").eq("user_id", userId).maybeSingle(),
    ]);
    setProfile((profileRes.data || null) as Profile | null);
    setProgress((progressRes.data || []) as LessonProgress[]);
    setSaved(new Set((savedRes.data || []).map((r) => r.opportunity_id)));
    setApplications(new Map((appRes.data || []).map((r) => [r.opportunity_id, r.status])));
    setPremiumStatus(premiumRes.data?.status || "inactive");
  }

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        setSession(data.session);
        await loadPublic();
        if (data.session) await loadUser(data.session);
      } catch (e) {
        console.error(e);
        notify("Guaplet couldn't load all data. Try again.");
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) {
        setGuest(false);
        loadUser(next).catch(console.error);
      } else {
        setProfile(null);
        setProgress([]);
        setSaved(new Set());
        setApplications(new Map());
        setPremiumStatus("inactive");
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function markLesson(lesson: Lesson, status: "in_progress" | "completed") {
    if (!session) {
      setGuest(false);
      notify("Sign in to save progress.");
      return;
    }
    const now = new Date().toISOString();
    const payload = {
      user_id: session.user.id,
      lesson_id: lesson.id,
      status,
      started_at: progress.find((p) => p.lesson_id === lesson.id)?.started_at || now,
      completed_at: status === "completed" ? now : null,
      updated_at: now,
    };
    const { error } = await supabase.from("lesson_progress").upsert(payload, { onConflict: "user_id,lesson_id" });
    if (error) return notify(error.message);
    setProgress((prev) => [...prev.filter((p) => p.lesson_id !== lesson.id), payload as LessonProgress]);
    notify(status === "completed" ? "Lesson completed." : "Lesson saved.");
  }

  async function toggleSave(id: string) {
    if (!session) return;
    if (saved.has(id)) {
      const { error } = await supabase.from("saved_opportunities").delete().eq("user_id", session.user.id).eq("opportunity_id", id);
      if (error) return notify(error.message);
      setSaved((prev) => { const n = new Set(prev); n.delete(id); return n; });
      notify("Removed from saved.");
    } else {
      const { error } = await supabase.from("saved_opportunities").insert({ user_id: session.user.id, opportunity_id: id });
      if (error) return notify(error.message);
      setSaved((prev) => new Set(prev).add(id));
      notify("Opportunity saved.");
    }
  }

  async function setApplication(id: string, status: ApplicationStatus) {
    if (!session) return;
    const { error } = await supabase.from("opportunity_applications").upsert({
      user_id: session.user.id,
      opportunity_id: id,
      status,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,opportunity_id" });
    if (error) return notify(error.message);
    setApplications((prev) => new Map(prev).set(id, status));
    notify("Application status updated.");
  }

  async function openOpportunity(o: Opportunity) {
    await supabase.from("referral_events").insert({
      user_id: session?.user.id || null,
      opportunity_id: o.id,
      event_type: "click",
      source: "guaplet_earn",
    });
    window.open(o.referral_url || o.application_url, "_blank", "noopener,noreferrer");
  }

  async function reportOpportunity(o: Opportunity) {
    if (!session) return;
    const details = window.prompt("What looks inaccurate or concerning about this listing?");
    if (!details) return;
    const { error } = await supabase.from("opportunity_reports").insert({
      user_id: session.user.id,
      opportunity_id: o.id,
      reason: "other",
      details: details.slice(0, 2000),
    });
    notify(error ? error.message : "Thanks. Guaplet will review the listing.");
  }

  async function updateName(name: string) {
    if (!session) return;
    const displayName = name.trim() || null;
    const { error } = await supabase.from("guaplet_profiles").update({
      display_name: displayName,
      updated_at: new Date().toISOString(),
    }).eq("user_id", session.user.id);
    if (error) return notify(error.message);
    setProfile({ user_id: session.user.id, display_name: displayName });
    notify("Profile updated.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setGuest(false);
    setTab("home");
  }

  function openLesson(lesson: Lesson) {
    setSelectedLesson(lesson);
    setTab("learn");
    if (session && !progress.find((p) => p.lesson_id === lesson.id)) {
      markLesson(lesson, "in_progress").catch(console.error);
    }
  }

  if (loading) return <div className="loading"><Brand /><span>Loading Guaplet…</span></div>;

  if (!session && !guest) {
    return <AuthGate onExplore={(nextTab) => { setGuest(true); setTab(nextTab); }} />;
  }

  return (
    <div className="app-shell">
      {toast && <div className="toast" role="status">{toast}</div>}
      {tab === "home" && <Home session={session} modules={modules} lessons={lessons} progress={progress} opportunities={opportunities} disclosures={disclosures} setTab={setTab} openLesson={openLesson} />}
      {tab === "learn" && <Learn session={session} modules={modules} lessons={lessons} progress={progress} disclosures={disclosures} selectedLesson={selectedLesson} setSelectedLesson={setSelectedLesson} markLesson={markLesson} />}
      {tab === "earn" && <Earn session={session} opportunities={opportunities} saved={saved} applications={applications} disclosures={disclosures} toggleSave={toggleSave} setApplication={setApplication} openOpportunity={openOpportunity} reportOpportunity={reportOpportunity} />}
      {tab === "profile" && <ProfilePage session={session} profile={profile} progress={progress} lessons={lessons} saved={saved} applications={applications} premiumStatus={premiumStatus} disclosures={disclosures} updateName={updateName} signOut={signOut} onSignIn={() => setGuest(false)} />}
      <BottomNav tab={tab} setTab={(next) => { setSelectedLesson(null); setTab(next); }} />
    </div>
  );
}
