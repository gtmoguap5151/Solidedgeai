import { useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

interface ProgramsPageProps {
  onNavigate: (page: string) => void;
}

const offers = [
  {
    key: 'starter_playbook',
    name: 'Solid Edge AI Starter Playbook',
    price: '$49',
    tag: 'START HERE',
    description: 'A practical system for choosing the right AI use cases, building reusable prompts, and measuring whether the work actually pays off.',
    features: ['ROI filter for AI ideas', 'Reusable prompt framework', '7-day implementation plan', 'Simple AI workflow scorecard'],
  },
  {
    key: 'sales_marketing',
    name: 'AI Sales & Marketing Playbook',
    price: '$97',
    tag: 'GROWTH',
    description: 'Turn AI into faster lead response, better follow-up, stronger offers, and a repeatable content and outreach system.',
    features: ['Lead-response framework', '5-touch follow-up sequence', 'Content repurposing system', 'Weekly growth dashboard'],
  },
  {
    key: 'operations_automation',
    name: 'AI Operations & Automation Playbook',
    price: '$147',
    tag: 'OPERATIONS',
    description: 'Map repetitive work, standardize it, and build AI-assisted workflows that reduce admin friction without losing control.',
    features: ['Workflow mapping system', 'Automation maturity ladder', 'SOP builder', '30-day rollout plan'],
  },
  {
    key: 'contractor_course',
    name: 'AI Automation for Contractors',
    price: '$197',
    tag: 'FLAGSHIP',
    description: 'Four focused guides for bids, crew operations, paperwork, invoices, change orders, marketing, and business growth.',
    features: ['4 complete PDF guides', 'Built for contractors', 'Secure 30-day access', 'Up to 5 downloads'],
  },
];

export default function ProgramsPage({ onNavigate }: ProgramsPageProps) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  const buy = async (productKey: string) => {
    if (productKey === 'contractor_course') {
      onNavigate('checkout');
      return;
    }

    setLoadingKey(productKey);
    setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ product_key: productKey }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || 'Could not start checkout.');
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout. Please try again.');
      setLoadingKey(null);
    }
  };

  return (
    <div className="bg-stone-50 min-h-[70vh]">
      <section className="bg-stone-950 text-white py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 text-amber-300 font-semibold text-sm mb-4">
            <Sparkles className="w-4 h-4" /> Solid Edge AI Programs
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Buy the level of leverage you need.</h1>
          <p className="mt-5 text-lg text-stone-300 max-w-3xl mx-auto">
            Start small or go straight to the flagship program. Every paid offer is built around one rule: AI should save time, make money, or make the business easier to run.
          </p>
        </div>
      </section>

      <section className="py-14 sm:py-18">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {error && <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>}
          <div className="grid md:grid-cols-2 gap-6">
            {offers.map((offer) => (
              <div key={offer.key} className={`bg-white rounded-3xl border p-7 sm:p-8 shadow-sm ${offer.key === 'contractor_course' ? 'border-amber-300 ring-1 ring-amber-200' : 'border-stone-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-xs font-bold tracking-wider text-amber-800 bg-amber-100 px-3 py-1.5 rounded-full">{offer.tag}</span>
                  <div className="text-3xl font-bold text-stone-900">{offer.price}</div>
                </div>
                <h2 className="mt-5 text-2xl font-bold text-stone-900">{offer.name}</h2>
                <p className="mt-3 text-stone-600 leading-relaxed">{offer.description}</p>
                <div className="mt-6 space-y-3">
                  {offer.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3 text-sm text-stone-700">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => buy(offer.key)}
                  disabled={loadingKey !== null}
                  className="mt-7 w-full inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-bold px-6 py-4 rounded-xl transition-colors disabled:opacity-60"
                >
                  {loadingKey === offer.key ? <><Loader2 className="w-5 h-5 animate-spin" /> Opening secure checkout...</> : <>{offer.key === 'contractor_course' ? 'See contractor program' : `Buy for ${offer.price}`}<ArrowRight className="w-5 h-5" /></>}
                </button>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center text-sm text-stone-500">
            Payments are processed securely by Stripe. Paid digital access is issued after successful payment.
          </div>
        </div>
      </section>
    </div>
  );
}
