import { useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, BarChart3, BookOpen, Boxes, CheckCircle2,
  ChevronRight, CircleAlert, Clock3, Cloud, Database, FileCheck2,
  Fingerprint, GitBranch, Globe2, LayoutDashboard, LockKeyhole,
  Menu, RadioTower, ShieldCheck, Sparkles, Wallet, X
} from "lucide-react";

type Section = "Overview" | "BLACKPINE FIELD" | "Revenue" | "Opportunities" | "Governance" | "Evidence" | "Audit Trail" | "Connections";

const navigation: { label: Section; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "BLACKPINE FIELD", icon: Globe2 },
  { label: "Revenue", icon: Wallet },
  { label: "Opportunities", icon: Sparkles },
  { label: "Governance", icon: ShieldCheck },
  { label: "Evidence", icon: FileCheck2 },
  { label: "Audit Trail", icon: Activity },
  { label: "Connections", icon: RadioTower },
];

const opportunities = [
  { id: "BP-OPP-001", title: "Establish an attributable revenue baseline", priority: "P1", reason: "Analytics, affiliate-click, and commission reports are not yet connected.", action: "Import verified reports", measure: "Sessions → outbound clicks → orders → commissions" },
  { id: "BP-OPP-002", title: "Review time-sensitive retailer price language", priority: "P1", reason: "Current retailer evidence was not present in the repository snapshot.", action: "Attach current retailer evidence", measure: "All displayed prices have a dated source" },
  { id: "BP-OPP-003", title: "Build product-claim evidence coverage", priority: "P2", reason: "Manufacturer-source evidence coverage is incomplete.", action: "Create claim-to-source register", measure: "Share of material product claims with traceable sources" },
];

function Status({ children, tone = "muted" }: { children: React.ReactNode; tone?: "green" | "amber" | "muted" | "blue" }) {
  const styles = { green: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20", amber: "bg-amber-400/10 text-amber-200 ring-amber-400/20", muted: "bg-white/5 text-slate-300 ring-white/10", blue: "bg-sky-400/10 text-sky-300 ring-sky-400/20" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${styles[tone]}`}>{children}</span>;
}

function Metric({ label, value, note, icon: Icon, tone = "muted" }: { label: string; value: string; note: string; icon: typeof Activity; tone?: "green" | "amber" | "muted" | "blue" }) {
  return <div className="rounded-2xl border border-white/10 bg-[#111b2a] p-4 sm:p-5">
    <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-400">{label}</span><span className="rounded-xl bg-white/5 p-2 text-slate-300"><Icon size={17}/></span></div>
    <div className="mt-4 text-2xl font-semibold tracking-tight text-white">{value}</div>
    <div className="mt-2"><Status tone={tone}>{note}</Status></div>
  </div>;
}

export default function App() {
  const [section, setSection] = useState<Section>("Overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<string | null>(null);
  const [showSourceNotes, setShowSourceNotes] = useState(false);
  const pageDescription = useMemo(() => ({
    "Overview": "A live operating picture of the business and its governance.",
    "BLACKPINE FIELD": "Storefront operations, deployment health, and content integrity.",
    "Revenue": "The complete path from attention to verified affiliate commission.",
    "Opportunities": "Evidence-backed improvements ranked by business priority.",
    "Governance": "Authority, policy enforcement, and human approval boundaries.",
    "Evidence": "The source material behind every metric and recommendation.",
    "Audit Trail": "A traceable record of observations, decisions, and outcomes.",
    "Connections": "External systems and the permissions available to GALINYX.",
  } as Record<Section, string>)[section], [section]);

  const sidebar = <div className="flex h-full flex-col">
    <div className="flex items-center gap-3 px-5 py-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-slate-950"><Fingerprint size={22}/></div>
      <div><div className="text-sm font-bold tracking-[0.16em] text-white">GALINYX</div><div className="text-[10px] tracking-[0.2em] text-slate-500">CONTROL ROOM</div></div>
    </div>
    <div className="px-4 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Workspace</div>
    <nav className="space-y-1 px-3">
      {navigation.map(({ label, icon: Icon }) => <button key={label} onClick={() => { setSection(label); setMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${section === label ? "bg-amber-400/10 font-semibold text-amber-200 ring-1 ring-amber-300/20" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
        <Icon size={17}/><span>{label}</span>{label === "Opportunities" && <span className="ml-auto rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-200">3</span>}
      </button>)}
    </nav>
    <div className="mt-auto p-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300"><LockKeyhole size={14}/> Human authority</div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Read-only mode. Commercial actions remain disabled pending explicit approval.</p>
        <div className="mt-3"><Status tone="green">Governance enforced</Status></div>
      </div>
      <div className="mt-4 flex items-center gap-2 px-1 text-[10px] text-slate-600"><span className="h-2 w-2 rounded-full bg-emerald-400"/> GALINYX OS · Prototype</div>
    </div>
  </div>;

  return <div className="min-h-screen bg-[#09111d] text-slate-200">
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#0c1624] lg:block">{sidebar}</aside>
      {menuOpen && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close navigation" className="absolute inset-0 bg-black/70" onClick={() => setMenuOpen(false)}/><aside className="relative h-full w-72 border-r border-white/10 bg-[#0c1624]">{sidebar}</aside></div>}
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#09111d]/95 px-4 py-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3"><button onClick={() => setMenuOpen(true)} className="rounded-lg p-2 text-slate-300 hover:bg-white/5 lg:hidden"><Menu size={20}/></button><div><div className="text-sm font-semibold text-white">{section}</div><div className="hidden text-[11px] text-slate-500 sm:block">{pageDescription}</div></div></div>
          <div className="flex items-center gap-2"><Status tone="blue">BLACKPINE test environment</Status><div className="hidden h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-bold text-amber-200 sm:flex">G</div></div>
        </header>
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-7">
          <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Operating intelligence / 01</div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{section === "Overview" ? "Good systems make the truth visible." : section}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">{pageDescription}</p></div>
            <div className="flex items-center gap-2 text-xs text-slate-500"><Clock3 size={14}/> Snapshot: 16 Nov 2026 <span className="text-slate-700">·</span> Read-only</div>
          </section>

          {section === "Overview" && <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Storefront" value="Online" note="HTTP 200 · last verified" icon={Globe2} tone="green"/>
              <Metric label="Verified revenue" value="Not measured" note="No commission report" icon={Wallet} tone="amber"/>
              <Metric label="Governance" value="Enforced" note="Human authority retained" icon={ShieldCheck} tone="green"/>
              <Metric label="Open opportunities" value="3 identified" note="Evidence-backed · not executed" icon={Sparkles} tone="blue"/>
            </div>
            <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
              <section className="rounded-2xl border border-white/10 bg-[#111b2a] p-5 sm:p-6">
                <div className="flex items-center justify-between"><div><h2 className="font-semibold text-white">BLACKPINE FIELD / system health</h2><p className="mt-1 text-xs text-slate-500">Production storefront and governance checks</p></div><Status tone="green">Operational</Status></div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {[["Custom domain","blackpinefield.com","Cloudflare Pages"],["Production branch","main","GitHub source"],["Product cards","60","Repository snapshot"],["Latest deployment","13 Nov 2026","Successful deployment"]].map(([k,v,n])=><div key={k} className="border-t border-white/10 pt-3"><div className="text-xs text-slate-500">{k}</div><div className="mt-1 text-lg font-semibold text-white">{v}</div><div className="mt-1 text-[11px] text-slate-500">{n}</div></div>)}
                </div>
                <button onClick={() => setSection("BLACKPINE FIELD")} className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-amber-200 hover:text-amber-100">Inspect storefront <ArrowUpRight size={14}/></button>
              </section>
              <section className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-5 sm:p-6">
                <div className="flex items-center gap-2 text-amber-200"><CircleAlert size={17}/><h2 className="font-semibold">Priority blocker</h2></div>
                <h3 className="mt-4 text-lg font-semibold text-white">Revenue is not yet attributable.</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">The storefront is online, but GA4 and affiliate performance reports have not been verified as connected. Traffic and commission must not be guessed.</p>
                <div className="mt-5 rounded-xl border border-white/10 bg-black/10 p-3"><div className="text-[11px] uppercase tracking-wider text-slate-500">Next required evidence</div><div className="mt-2 flex items-center gap-2 text-sm text-slate-200"><Database size={15} className="text-amber-200"/> Analytics + click + commission exports</div></div>
                <button onClick={() => setSection("Connections")} className="mt-4 text-xs font-semibold text-amber-200">Review connections <ChevronRight className="ml-1 inline" size={14}/></button>
              </section>
            </div>
            <section className="rounded-2xl border border-white/10 bg-[#111b2a] p-5 sm:p-6">
              <div className="flex items-center justify-between"><div><h2 className="font-semibold text-white">Highest-priority opportunities</h2><p className="mt-1 text-xs text-slate-500">Ranked by evidence gap and business mechanism</p></div><button onClick={() => setSection("Opportunities")} className="text-xs font-semibold text-amber-200">View all <ArrowUpRight className="ml-1 inline" size={13}/></button></div>
              <div className="mt-4 divide-y divide-white/10">{opportunities.map(o=><button key={o.id} onClick={() => {setSelectedOpportunity(o.id);setSection("Opportunities");}} className="flex w-full items-center gap-3 py-4 text-left"><div className="rounded-lg bg-white/5 p-2 text-amber-200"><Sparkles size={16}/></div><div className="min-w-0 flex-1"><div className="text-sm font-medium text-slate-200">{o.title}</div><div className="mt-1 text-xs text-slate-500">{o.id}</div></div><Status tone={o.priority === "P1" ? "amber" : "muted"}>{o.priority}</Status><ChevronRight size={16} className="text-slate-600"/></button>)}</div>
            </section>
          </>}

          {section === "BLACKPINE FIELD" && <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#111b2a] p-5"><h2 className="font-semibold text-white">Storefront deployment</h2><div className="mt-5 space-y-4">{[["Public site","https://blackpinefield.com","Online · HTTP 200"],["Cloudflare Pages","blackpine-field.pages.dev","Project active"],["Source repository","gtmoguap5151/blackpine-field","Production branch: main"],["Latest known deployment","13 Nov 2026","Successful"]].map(([a,b,c])=><div key={a} className="border-b border-white/10 pb-3 last:border-0"><div className="text-xs text-slate-500">{a}</div><div className="mt-1 break-all text-sm text-slate-200">{b}</div><div className="mt-1 text-xs text-emerald-300">{c}</div></div>)}</div><a className="mt-3 inline-flex items-center gap-2 text-xs text-amber-200" href="https://blackpinefield.com" target="_blank" rel="noreferrer">Open storefront <ArrowUpRight size={13}/></a></div>
            <div className="rounded-2xl border border-white/10 bg-[#111b2a] p-5"><h2 className="font-semibold text-white">Content integrity checks</h2><div className="mt-5 space-y-3">{[["Affiliate disclosure","Detected in inspected content","green"],["Hands-on testing disclosure","Present","green"],["Product cards","60 in latest known snapshot","blue"],["Manufacturer evidence","Coverage incomplete","amber"],["Retailer price evidence","Refresh required","amber"]].map(([a,b,t])=><div key={a} className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 last:border-0"><div><div className="text-sm text-slate-200">{a}</div><div className="mt-1 text-xs text-slate-500">{b}</div></div><Status tone={t as "green"|"amber"|"blue"}>{t === "green" ? "Observed" : t === "blue" ? "Snapshot" : "Needs review"}</Status></div>)}</div></div>
          </div>}

          {section === "Revenue" && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Sessions" value="Not connected" note="GA4 not verified" icon={Activity} tone="amber"/><Metric label="Outbound clicks" value="Not measured" note="Affiliate report missing" icon={ArrowUpRight}/><Metric label="Orders" value="Not measured" note="Network report missing" icon={Boxes}/><Metric label="Commission" value="Not measured" note="No verified payout data" icon={Wallet} tone="amber"/></div><div className="rounded-2xl border border-white/10 bg-[#111b2a] p-5"><h2 className="font-semibold text-white">Attribution funnel</h2><p className="mt-2 text-sm text-slate-400">The measurement chain is defined; its values are deliberately blank until source reports are supplied.</p><div className="mt-5 grid gap-2 sm:grid-cols-4">{["Sessions","Product views","Outbound clicks","Orders / commission"].map((v,i)=><div key={v} className="rounded-xl border border-dashed border-white/15 p-4"><div className="text-xs text-slate-500">0{i+1} / {v}</div><div className="mt-3 text-lg font-semibold text-slate-500">—</div><div className="mt-1 text-[10px] text-amber-200">Awaiting evidence</div></div>)}</div></div></div>}

          {section === "Opportunities" && <div className="space-y-3">{opportunities.map(o=><div key={o.id} className="rounded-2xl border border-white/10 bg-[#111b2a] p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-[11px] font-semibold tracking-wider text-slate-500">{o.id}</div><Status tone={o.priority === "P1" ? "amber" : "muted"}>{o.priority}</Status></div><h2 className="mt-3 text-lg font-semibold text-white">{o.title}</h2><p className="mt-2 text-sm text-slate-400">{o.reason}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><div className="text-[10px] uppercase tracking-wider text-slate-500">Recommended next step</div><div className="mt-1 text-sm text-slate-200">{o.action}</div></div><div><div className="text-[10px] uppercase tracking-wider text-slate-500">Success measurement</div><div className="mt-1 text-sm text-slate-200">{o.measure}</div></div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3"><Status tone="muted">Recommendation only · no execution</Status><button onClick={()=>setSelectedOpportunity(selectedOpportunity===o.id?null:o.id)} className="text-xs font-semibold text-amber-200">{selectedOpportunity===o.id?"Hide governance details":"Governance details"} <ChevronRight className="inline" size={13}/></button></div>{selectedOpportunity===o.id&&<div className="mt-3 rounded-xl bg-black/20 p-3 text-xs leading-relaxed text-slate-400">Evidence gap is documented. A human must review source material before any change. No publishing, spending, account modification, or external contact is authorized by this recommendation.</div>}</div>)}</div>}

          {section === "Governance" && <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-[#111b2a] p-5"><h2 className="font-semibold text-white">Authority model</h2><p className="mt-2 text-sm text-slate-400">Rank defines the office or role. Level defines the authority and competence band assigned to that role. Neither grants unrestricted access.</p><div className="mt-5 space-y-3">{[["Human authority","Final decision-maker"],["Agent mandate","Exact operation + resource scope"],["Expiry / revocation","Required controls"],["Audit record","Decision and outcome traceability"]].map(([a,b])=><div key={a} className="flex justify-between gap-4 border-b border-white/10 pb-3 text-sm"><span className="text-slate-300">{a}</span><span className="text-right text-slate-500">{b}</span></div>)}</div></div><div className="rounded-2xl border border-white/10 bg-[#111b2a] p-5"><h2 className="font-semibold text-white">Execution boundary</h2><div className="mt-4 flex items-center gap-2"><LockKeyhole className="text-amber-200" size={18}/><span className="text-sm font-semibold text-amber-100">Execution disabled in this console</span></div><p className="mt-3 text-sm leading-relaxed text-slate-400">The current authority registry is in-memory and test-oriented. It is not yet a durable production authorization service. This interface cannot issue permissions or perform commercial actions.</p><div className="mt-4"><Status tone="green">Read-only posture</Status></div></div></div>}

          {section === "Evidence" && <div className="rounded-2xl border border-white/10 bg-[#111b2a] p-5"><h2 className="font-semibold text-white">Evidence register</h2><p className="mt-2 text-sm text-slate-400">Each imported record must retain its source, reporting period, capture time, verifier, freshness, and integrity reference.</p><div className="mt-5 space-y-3">{[["Cloudflare Pages deployment","Platform observation","Captured 16 Nov 2026","Verified"],["GitHub product-card snapshot","Repository-derived","Latest known snapshot","Verified snapshot"],["GA4 analytics export","Required for baseline","Not supplied","Missing"],["Affiliate click report","Required for attribution","Not supplied","Missing"],["Commission report","Required for revenue","Not supplied","Missing"]].map(([a,b,c,d])=><div key={a} className="flex flex-col gap-2 border-b border-white/10 pb-3 sm:flex-row sm:items-center"><div className="flex-1"><div className="text-sm text-slate-200">{a}</div><div className="mt-1 text-xs text-slate-500">{b} · {c}</div></div><Status tone={d==="Verified"?"green":d==="Missing"?"amber":"muted"}>{d}</Status></div>)}</div><button onClick={()=>setShowSourceNotes(!showSourceNotes)} className="mt-4 text-xs font-semibold text-amber-200">{showSourceNotes?"Hide":"Show"} data provenance rules</button>{showSourceNotes&&<p className="mt-3 rounded-xl bg-black/20 p-3 text-xs leading-relaxed text-slate-400">Imported files are hashed for integrity. A hash does not prove the report is truthful; source verification remains a separate human review.</p>}</div>}

          {section === "Audit Trail" && <div className="rounded-2xl border border-white/10 bg-[#111b2a] p-5"><h2 className="font-semibold text-white">Recorded system milestones</h2><div className="mt-5 space-y-5">{[["16 Nov 2026","Control Room dashboard specification committed","Design contract recorded in governance adapter."],["16 Nov 2026","BLACKPINE revenue opportunities integrated","Three evidence-backed recommendations; execution disabled."],["13 Nov 2026","BLACKPINE production deployment","Latest known successful Pages deployment."],["Earlier test cycle","Governance policy and measurement intake","Authorization and evidence validation tests authored; latest CI result still requires verification."]].map(([date,title,desc])=><div key={title} className="flex gap-3"><div className="mt-1 h-2 w-2 rounded-full bg-amber-300"/><div><div className="text-[11px] text-slate-500">{date}</div><div className="mt-1 text-sm font-medium text-slate-200">{title}</div><div className="mt-1 text-xs text-slate-500">{desc}</div></div></div>)}</div></div>}

          {section === "Connections" && <div className="grid gap-3 sm:grid-cols-2">{[{name:"GitHub",detail:"Repository source and governance code",state:"Connected · branch-scoped",tone:"green",icon:GitBranch},{name:"Cloudflare Pages",detail:"BLACKPINE deployment and domain",state:"Connected · read verified",tone:"green",icon:Cloud},{name:"Google Analytics 4",detail:"Sessions and product-page events",state:"Not verified",tone:"amber",icon:BarChart3},{name:"Awin",detail:"Affiliate clicks and commissions",state:"Account status known · reports not connected",tone:"amber",icon:Wallet},{name:"CJ Affiliate",detail:"Advertiser and commission reports",state:"Account status known · reports not connected",tone:"amber",icon:Database}].map(({name,detail,state,tone,icon:Icon})=><div key={name} className="rounded-2xl border border-white/10 bg-[#111b2a] p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-white/5 p-2.5 text-slate-300"><Icon size={18}/></div><div className="font-semibold text-white">{name}</div></div><Status tone={tone as "green"|"amber"}>{tone==="green"?"Connected":"Needs setup"}</Status></div><p className="mt-3 text-xs text-slate-500">{detail}</p><div className="mt-4 border-t border-white/10 pt-3 text-xs text-slate-300">{state}</div></div>)}</div>}

          <footer className="flex flex-col justify-between gap-2 border-t border-white/10 pt-4 text-[10px] text-slate-600 sm:flex-row"><span>GALINYX CONTROL ROOM · INTERNAL TEST INTERFACE</span><span>Known observations are labelled. Unknowns stay unknown. Human authority remains final.</span></footer>
        </div>
      </main>
    </div>
  </div>;
}
