import { Mail, Zap } from "lucide-react";

interface FooterProps {
  onNavigate: (page: string) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="bg-stone-900 text-stone-400 py-12 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <div className="font-bold text-white text-sm">Solid Edge AI</div>
              <div className="text-stone-500 text-xs">
                AI that earns its place
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
            <button
              onClick={() => onNavigate("home")}
              className="hover:text-white transition-colors"
            >
              Home
            </button>
            <button
              onClick={() => onNavigate("academy")}
              className="hover:text-white transition-colors"
            >
              AI Academy
            </button>
            <button
              onClick={() => onNavigate("assessment")}
              className="hover:text-white transition-colors"
            >
              Free AI Assessment
            </button>
            <button
              onClick={() => onNavigate("checkout")}
              className="hover:text-white transition-colors"
            >
              Contractor Program
            </button>
            <button
              onClick={() => onNavigate("privacy")}
              className="hover:text-white transition-colors"
            >
              Privacy
            </button>
            <button
              onClick={() => onNavigate("terms")}
              className="hover:text-white transition-colors"
            >
              Terms
            </button>
            <a
              href="mailto:support@aiautomationforcontractors.com"
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Mail className="w-4 h-4" /> Support
            </a>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-stone-800 text-xs text-stone-500 text-center">
          © {new Date().getFullYear()} Solid Edge AI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
