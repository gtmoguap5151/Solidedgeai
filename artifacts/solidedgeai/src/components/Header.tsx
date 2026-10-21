import { Zap } from "lucide-react";

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-stone-950/85 backdrop-blur-md border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center group-hover:bg-amber-400 transition-colors">
              <Zap className="w-5 h-5 text-stone-950" strokeWidth={2.5} />
            </div>
            <span className="font-serif font-bold text-white text-sm sm:text-base tracking-tight">
              SolidEdge AI Academy
            </span>
          </button>

          <nav className="flex items-center gap-1 sm:gap-5">
            <button
              onClick={() => scrollTo("levels")}
              className="hidden sm:inline text-sm font-medium text-stone-300 hover:text-white transition-colors"
            >
              The Levels
            </button>
            <button
              onClick={() => scrollTo("core-course")}
              className="hidden sm:inline text-sm font-medium text-stone-300 hover:text-white transition-colors"
            >
              Core Course
            </button>
            <button
              onClick={() => scrollTo("faq")}
              className="hidden sm:inline text-sm font-medium text-stone-300 hover:text-white transition-colors"
            >
              FAQ
            </button>
            <button
              onClick={() => scrollTo("free")}
              className="inline-flex items-center justify-center bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm px-4 py-2 rounded-lg transition-colors"
            >
              Start Free
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
