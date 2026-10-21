import { Zap } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-stone-950 border-t border-white/10 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-stone-950" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="font-serif font-bold text-white text-sm tracking-tight">
              SOLIDEDGE AI ACADEMY
            </div>
            <div className="text-stone-500 text-xs">
              Practical AI education for construction business owners.
            </div>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-white/10 text-xs text-stone-600 text-center">
          © {new Date().getFullYear()} SolidEdge AI Academy. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
