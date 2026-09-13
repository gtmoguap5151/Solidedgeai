import { Library, Sparkles, Zap } from "lucide-react";

interface HeaderProps {
  onNavigate: (page: string) => void;
  currentPage: string;
}

export default function Header({ onNavigate, currentPage }: HeaderProps) {
  const scrollTo = (id: string) => {
    if (currentPage !== "home") {
      onNavigate("home");
      window.setTimeout(
        () =>
          document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-stone-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button
            onClick={() => onNavigate("home")}
            className="flex items-center gap-2 group"
          >
            <div className="w-9 h-9 bg-stone-900 rounded-lg flex items-center justify-center group-hover:bg-amber-600 transition-colors">
              <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="text-left leading-tight">
              <div className="font-bold text-stone-900 text-sm sm:text-base">
                Solid Edge AI
              </div>
              <div className="text-stone-500 text-xs hidden sm:block">
                AI that earns its place
              </div>
            </div>
          </button>

          <nav className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => scrollTo("explore")}
              className="hidden lg:inline text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
            >
              Explore
            </button>
            <button
              onClick={() => onNavigate("programs")}
              className={`hidden md:inline text-sm font-medium transition-colors ${currentPage === "programs" ? "text-amber-700" : "text-stone-600 hover:text-stone-900"}`}
            >
              Programs
            </button>
            <button
              onClick={() => onNavigate("resources")}
              className={`inline-flex items-center gap-1.5 text-sm font-semibold transition-colors ${currentPage === "resources" ? "text-amber-700" : "text-stone-700 hover:text-stone-900"}`}
            >
              <Library className="w-4 h-4" />
              <span className="hidden sm:inline">Resources</span>
            </button>
            <button
              onClick={() => onNavigate("academy")}
              className={`text-sm font-semibold transition-colors ${currentPage === "academy" ? "text-amber-700" : "text-stone-700 hover:text-stone-900"}`}
            >
              Academy
            </button>
            <button
              onClick={() => onNavigate("assessment")}
              className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg transition-colors ${
                currentPage === "assessment"
                  ? "bg-amber-100 text-amber-800"
                  : "text-stone-700 hover:bg-stone-100"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>
                <span className="hidden sm:inline">Free AI </span>Assessment
              </span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
