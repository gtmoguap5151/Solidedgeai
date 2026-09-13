import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckSquare,
  FileText,
  Hammer,
  Library,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Resource = {
  id: string;
  resource_key: string;
  title: string;
  description: string;
  resource_type: string;
  capability_key: string | null;
  level: string;
  professional_track: string | null;
  content_text: string | null;
  version: string;
  last_reviewed_at: string | null;
};

const typeIcons: Record<string, typeof BookOpen> = {
  lesson: BookOpen,
  template: FileText,
  checklist: CheckSquare,
  example: Sparkles,
  exercise: Hammer,
  reference: Library,
  workflow: Wrench,
  prompt_system: FileText,
  troubleshooting: Wrench,
  tool: ShieldCheck,
};

const levelLabels: Record<string, string> = {
  foundation: "Foundation",
  builder: "Builder",
  advanced: "Advanced",
  professional: "Professional",
};

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [selected, setSelected] = useState<Resource | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!isSupabaseConfigured) {
        if (mounted) {
          setError("The resource library is temporarily unavailable.");
          setLoading(false);
        }
        return;
      }

      const { data, error: loadError } = await supabase
        .from("resource_library")
        .select(
          "id,resource_key,title,description,resource_type,capability_key,level,professional_track,content_text,version,last_reviewed_at",
        )
        .eq("is_published", true)
        .eq("is_free", true)
        .order("level")
        .order("title");

      if (!mounted) return;
      if (loadError) {
        setError("We could not load the resource library right now.");
      } else {
        setResources((data ?? []) as Resource[]);
      }
      setLoading(false);
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return resources.filter((resource) => {
      const levelMatch = level === "all" || resource.level === level;
      const searchMatch =
        !needle ||
        resource.title.toLowerCase().includes(needle) ||
        resource.description.toLowerCase().includes(needle) ||
        resource.resource_type.toLowerCase().includes(needle) ||
        (resource.capability_key ?? "").toLowerCase().includes(needle);
      return levelMatch && searchMatch;
    });
  }, [resources, query, level]);

  return (
    <div className="min-h-[75vh] bg-stone-100">
      <section className="border-b border-stone-800 bg-stone-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-sm font-semibold text-amber-300">
            <Library className="h-4 w-4" /> Practical AI Resource Library
          </div>
          <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl">
            Useful materials you can put to work today.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-stone-300 sm:text-xl">
            Templates, checklists, references, workflows, troubleshooting guides,
            and practical tools organized around the capabilities they help you build.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search templates, workflows, checklists..."
              className="min-h-12 w-full rounded-xl border border-stone-300 bg-white pl-12 pr-4 text-stone-900 outline-none focus:ring-2 focus:ring-amber-500"
            />
          </label>
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            className="min-h-12 rounded-xl border border-stone-300 bg-white px-4 font-semibold text-stone-700 outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All levels</option>
            <option value="foundation">Foundation</option>
            <option value="builder">Builder</option>
            <option value="advanced">Advanced</option>
            <option value="professional">Professional</option>
          </select>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-sm text-stone-600">
          <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
            {resources.length} published resources
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
            Mobile-friendly
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
            Versioned and reviewed
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-stone-600">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading resources...
          </div>
        ) : error ? (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
            {error}
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((resource) => {
              const Icon = typeIcons[resource.resource_type] ?? BookOpen;
              return (
                <article
                  key={resource.id}
                  className="flex flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-900">
                      <Icon className="h-5 w-5 text-amber-400" />
                    </div>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-stone-600">
                      {resource.resource_type.replace("_", " ")}
                    </span>
                  </div>
                  <div className="mt-4 text-xs font-bold uppercase tracking-wide text-amber-700">
                    {levelLabels[resource.level] ?? resource.level}
                  </div>
                  <h2 className="mt-1 text-xl font-bold text-stone-900">{resource.title}</h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-stone-600">
                    {resource.description}
                  </p>
                  <button
                    onClick={() => setSelected(resource)}
                    className="mt-5 min-h-11 rounded-xl bg-stone-900 px-4 py-2.5 font-bold text-white hover:bg-stone-800"
                  >
                    Open resource
                  </button>
                </article>
              );
            })}
          </div>
        )}

        {!loading && !error && filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-600">
            No resources match that search yet.
          </div>
        ) : null}
      </section>

      {selected ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-amber-700">
                  {levelLabels[selected.level]} · {selected.resource_type.replace("_", " ")}
                </div>
                <h2 className="mt-2 text-3xl font-bold text-stone-900">{selected.title}</h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg bg-stone-100 px-3 py-2 text-sm font-bold text-stone-700"
              >
                Close
              </button>
            </div>
            <p className="mt-4 text-stone-600">{selected.description}</p>
            <div className="mt-6 whitespace-pre-line rounded-2xl border border-stone-200 bg-stone-50 p-5 leading-relaxed text-stone-800">
              {selected.content_text || "This resource is being prepared for release."}
            </div>
            <div className="mt-5 text-xs text-stone-500">
              Version {selected.version}
              {selected.last_reviewed_at
                ? ` · Reviewed ${new Date(selected.last_reviewed_at).toLocaleDateString()}`
                : ""}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
