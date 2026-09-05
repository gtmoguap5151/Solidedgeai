import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Clock,
  BookOpen,
  Loader2,
  Lock,
} from 'lucide-react';
import { COURSE, MODULES } from '@/lib/courseData';

interface CheckoutPageProps {
  onNavigate: (page: string) => void;
}

export default function CheckoutPage({ onNavigate }: CheckoutPageProps) {
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    setRedirecting(true);
    setError('');

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error || `Checkout setup failed (${response.status})`
        );
      }

      const data = await response.json();

      if (!data.url) {
        throw new Error('No checkout URL received from server.');
      }

      window.location.href = data.url;
    } catch (err) {
      setRedirecting(false);
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong setting up checkout. Please try again.'
      );
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-stone-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors mb-8 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to course details
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Order Summary */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8">
              <h1 className="text-2xl font-bold text-stone-900 mb-1">
                Order Summary
              </h1>
              <p className="text-stone-500 text-sm mb-6">
                You're one step away from getting all four PDF guides.
              </p>

              <div className="bg-amber-50 rounded-xl p-5 border border-amber-200 mb-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-14 h-14 bg-amber-600 rounded-xl flex items-center justify-center">
                    <FileText className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-bold text-stone-900 text-lg">
                      {COURSE.name}
                    </h2>
                    <p className="text-stone-600 text-sm mt-0.5">
                      Complete course — all {COURSE.totalModules} PDF guides
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {MODULES.map((m) => (
                  <div
                    key={m.number}
                    className="flex items-start gap-3 py-2 border-b border-stone-100 last:border-0"
                  >
                    <div className="flex-shrink-0 w-7 h-7 bg-stone-100 rounded-lg flex items-center justify-center">
                      <span className="text-stone-700 font-bold text-sm">
                        {m.number}
                      </span>
                    </div>
                    <div className="flex-1">
                      <span className="text-stone-800 text-sm font-medium">
                        {m.title}
                      </span>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-4 border-t-2 border-stone-200">
                <div className="flex items-center justify-between text-stone-600">
                  <span>Course price</span>
                  <span className="font-medium">{COURSE.priceFormatted}</span>
                </div>
                <div className="flex items-center justify-between text-stone-600">
                  <span>Delivery</span>
                  <span className="font-medium text-green-600">
                    Instant PDF download
                  </span>
                </div>
                <div className="flex items-center justify-between text-stone-600">
                  <span>Access period</span>
                  <span className="font-medium">30 days, up to 5 downloads</span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-stone-200">
                  <span className="font-bold text-stone-900 text-lg">Total</span>
                  <span className="font-bold text-amber-700 text-2xl">
                    {COURSE.priceFormatted}
                  </span>
                </div>
              </div>
            </div>

            {/* What you get */}
            <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 mt-6">
              <h3 className="font-bold text-stone-900 mb-4">What you get</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-stone-800 font-medium text-sm">
                      4 PDF guides
                    </div>
                    <div className="text-stone-500 text-xs">
                      Read on any device
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-stone-800 font-medium text-sm">
                      Instant access
                    </div>
                    <div className="text-stone-500 text-xs">
                      Download right after purchase
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-stone-800 font-medium text-sm">
                      No tech jargon
                    </div>
                    <div className="text-stone-500 text-xs">
                      Written for contractors
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Checkout Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 lg:sticky lg:top-24">
              <h2 className="font-bold text-stone-900 text-lg mb-1">
                Secure checkout
              </h2>
              <p className="text-stone-500 text-sm mb-6">
                Payment is processed securely by Stripe. You'll get your
                download links immediately after purchase.
              </p>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleCheckout}
                disabled={redirecting}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg py-4 rounded-xl transition-colors shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {redirecting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Redirecting to secure checkout...
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    Pay {COURSE.priceFormatted} with Stripe
                  </>
                )}
              </button>

              <div className="mt-5 space-y-3">
                <div className="flex items-center gap-2 text-stone-600 text-sm">
                  <Lock className="w-5 h-5 text-stone-400 flex-shrink-0" />
                  Secure payment by Stripe
                </div>
                <div className="flex items-center gap-2 text-stone-600 text-sm">
                  <FileText className="w-5 h-5 text-stone-400 flex-shrink-0" />
                  Instant PDF download after purchase
                </div>
              </div>

              <p className="mt-6 text-xs text-stone-400 leading-relaxed">
                After payment, you'll receive a secure download link on screen.
                Your download link is valid for 30 days with up
                to 5 downloads. Be sure to bookmark it.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
