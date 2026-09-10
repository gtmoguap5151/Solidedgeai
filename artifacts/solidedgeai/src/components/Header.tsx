import { HardHat, Sparkles } from 'lucide-react';

interface HeaderProps {
  onNavigate: (page: string) => void;
  currentPage: string;
}

export default function Header({ onNavigate, currentPage }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-stone-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 group"
          >
            <div className="w-9 h-9 bg-amber-600 rounded-lg flex items-center justify-center group-hover:bg-amber-700 transition-colors">
              <HardHat className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="text-left leading-tight">
              <div className="font-bold text-stone-900 text-sm sm:text-base">Solid Edge AI</div>
              <div className="text-stone-500 text-xs hidden sm:block">Practical AI for business</div>
            </div>
          </button>

          <nav className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => onNavigate('home')}
              className={`hidden sm:inline text-sm font-medium transition-colors ${
                currentPage === 'home'
                  ? 'text-amber-700'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Course
            </button>
            <button
              onClick={() => onNavigate('assessment')}
              className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg transition-colors ${
                currentPage === 'assessment'
                  ? 'bg-amber-100 text-amber-800'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Free AI Assessment
            </button>
            <button
              onClick={() => onNavigate('checkout')}
              className="hidden sm:inline-flex bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              Get the Course
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
