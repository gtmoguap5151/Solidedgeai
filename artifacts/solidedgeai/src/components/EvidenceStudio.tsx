import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, FileCheck2, ShieldCheck } from "lucide-react";

type Evidence = {
  target: string;
  source: string;
  test: string;
  result: string;
  improvement: string;
  reviewedAt?: string;
};
type FieldName = "target" | "source" | "test" | "result" | "improvement";
type Props = {
  projectId: string;
  projectTitle: string;
  brief: string;
  work: string;
  rubric: string[];
  selfChecks: boolean[];
  selfReviewedAt?: string;
};
const fields: { name: FieldName; title: string; hint: string; min: number }[] = [
  { name: "target", title: "Define what success looks like", hint: "Name a result someone could observe, not a vague intention.", min: 25 },
  { name: "source", title: "Record sources and assumptions", hint: "What information informed the work? Mark unknowns honestly.", min: 25 },
  { name: "test", title: "Describe an actual test", hint: "What did you check or compare? A future test plan is not a completed test.", min: 35 },
  { name: "result", title: "Record the result and its limits", hint: "What worked, what failed, and what remains uncertain?", min: 35 },
  { name: "improvement", title: "Identify the next improvement", hint: "What one thing would you revise after this review?", min: 25 },
];
const empty = (): Evidence => ({ target: "", source: "", test: "", result: "", improvement: "" });
const storeKey = "solid-edge-evidence-v1";
function getSaved(): Record<string, Evidence> {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storeKey) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, Evidence> : {};
  } catch { return {}; }
}

export default function EvidenceStudio({ projectId, projectTitle, brief, work, rubric, selfChecks, selfReviewedAt }: Props) {
  const [all, setAll] = useState<Record<string, Evidence>>(getSaved);
  const [saved, setSaved] = useState(true);
  const [notice, setNotice] = useState("");
  const record = all[projectId] ?? empty();
  const checks = useMemo(() => fields.map((field) => ({
    ...field,
    ready: record[field.name].trim().length >= field.min,
  })), [record.target, record.source, record.test, record.result, record.improvement]);
  const count = checks.filter((check) => check.ready).length;
  const ready = count === fields.length && work.trim().length >= 60 &&
    Boolean(selfReviewedAt) && selfChecks.length === rubric.length && selfChecks.every(Boolean);
  const archived = ready && Boolean(record.reviewedAt);

  useEffect(() => {
    try { window.localStorage.setItem(storeKey, JSON.stringify(all)); setSaved(true); }
    catch { setSaved(false); }
  }, [all]);

  function update(field: FieldName, value: string) {
    setAll((old) => ({
      ...old,
      [projectId]: { ...(old[projectId] ?? empty()), [field]: value, reviewedAt: undefined },
    }));
    setNotice("");
  }
  function archive() {
    if (!ready) return;
    setAll((old) => ({
      ...old, [projectId]: { ...(old[projectId] ?? empty()), reviewedAt: new Date().toISOString() },
    }));
    setNotice("Self-documented project review saved on this device. This is not an independent skills assessment.");
  }
  function download() {
    const sections = [
      "# GALINYX — Work Evidence",
      "",
      "**Project:** " + projectTitle,
      "**Date:** " + new Date().toISOString().slice(0, 10),
      "**Review status:** " + (archived ? "Self-documented and self-reviewed" : "Draft, review incomplete"),
      "",
      "## Challenge", brief, "",
      "## Original work", work || "Not supplied", "",
      "## Success criteria", record.target || "Not recorded", "",
      "## Evidence and assumptions", record.source || "Not recorded", "",
      "## Test performed", record.test || "Not recorded", "",
      "## Result and uncertainty", record.result || "Not recorded", "",
      "## Improvement", record.improvement || "Not recorded", "",
      "## Self-check", ...rubric.map((criterion, index) => (selfChecks[index] ? "[x] " : "[ ] ") + criterion),
      "",
      "## Limitations",
      "This is the learner's own work and self-assessment, not an independently assessed qualification, certification, verified identity, or endorsement. Facts, authorship, test results and competence have not been independently verified.",
    ];
    const blob = new Blob([sections.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "galinyx-work-evidence-" + projectId.replace(/[^a-z0-9-]/gi, "") + ".md";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-800">
            <FileCheck2 className="h-5 w-5" /> Evidence Studio
          </div>
          <h3 className="mt-2 text-2xl font-bold text-stone-900">Turn practice into documented work</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">Capture what you attempted, how you checked it, what actually happened and what you would improve. Download a portable project record for your own portfolio.</p>
        </div>
        <div className="rounded-xl bg-stone-100 px-4 py-3 text-center">
          <div className="text-2xl font-bold text-stone-900">{count}/5</div>
          <div className="text-xs text-stone-600">Sections complete</div>
        </div>
      </div>
      <div className="mt-6 space-y-5">
        {fields.map((field, index) => (
          <label key={field.name} className="block">
            <span className="flex items-center gap-2 font-bold text-stone-900">
              {checks[index].ready ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <span className="rounded-full bg-stone-200 px-2 text-xs">{index + 1}</span>}
              {field.title}
            </span>
            <span className="mt-1 block text-sm text-stone-600">{field.hint}</span>
            <textarea value={record[field.name]} onChange={(event) => update(field.name, event.target.value)}
              rows={2} maxLength={3000}
              placeholder="Describe exactly what you did, observed or learned..."
              className="mt-2 w-full rounded-xl border border-stone-300 bg-stone-50 p-3 text-stone-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
            {!checks[index].ready ? <span className="text-xs text-amber-800">Add specific detail (at least {field.min} characters).</span> : null}
          </label>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="font-bold text-amber-950">Documentation feedback</div>
        {count === fields.length
          ? <p className="mt-2 text-sm text-amber-950">All five sections contain enough detail for a record. Accuracy and quality have not been independently evaluated.</p>
          : <p className="mt-2 text-sm text-amber-950">Next: {checks.find((check) => !check.ready)?.hint}</p>}
        {!selfReviewedAt ? <p className="mt-2 text-sm text-amber-950">Finish the work sample and self-review checklist above before marking this record reviewed.</p> : null}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" disabled={!ready} onClick={archive}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-bold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40">
          <ShieldCheck className="h-4 w-4" /> {archived ? "Self-review saved" : "Archive self-review"}
        </button>
        <button type="button" onClick={download}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-stone-300 px-5 py-3 text-sm font-bold text-stone-900 hover:bg-stone-50">
          <Download className="h-4 w-4" /> Download my evidence
        </button>
      </div>
      {notice ? <p role="status" className="mt-3 text-sm text-stone-700">{notice}</p> : null}
      {!saved ? <p role="alert" className="mt-3 text-sm text-amber-800">Browser storage is blocked. Download your notes before leaving.</p> : null}
      <p className="mt-4 text-xs leading-relaxed text-stone-500">Your work stays in this browser unless you choose to export it. Clearing browser data may erase it. This feedback checks only whether fields are populated; it does not verify skill, identity, facts or outcomes.</p>
    </section>
  );
}
