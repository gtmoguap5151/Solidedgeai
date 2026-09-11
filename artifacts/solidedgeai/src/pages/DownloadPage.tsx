import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Download, FileText, Loader2, ShieldCheck } from 'lucide-react';

interface DownloadPageProps {
  onNavigate: (page: string) => void;
  token?: string;
  sessionId?: string;
}

interface DownloadLinkData {
  id: string;
  token: string;
  download_count: number;
  max_downloads: number;
  expires_at: string;
  purchase_id: string;
  product_key?: string;
}

const products: Record<string, { name: string; detail: string; button: string; filename: string }> = {
  starter_playbook: {
    name: 'Solid Edge AI Starter Playbook',
    detail: 'Your practical AI starting system in a downloadable offline playbook.',
    button: 'Download Starter Playbook',
    filename: 'Solid-Edge-AI-Starter-Playbook.html',
  },
  sales_marketing: {
    name: 'AI Sales & Marketing Playbook',
    detail: 'Lead response, follow-up, content, offer, and growth systems in one downloadable playbook.',
    button: 'Download Sales & Marketing Playbook',
    filename: 'AI-Sales-Marketing-Playbook.html',
  },
  operations_automation: {
    name: 'AI Operations & Automation Playbook',
    detail: 'Workflow mapping, SOPs, automation rules, and a 30-day rollout plan.',
    button: 'Download Operations Playbook',
    filename: 'AI-Operations-Automation-Playbook.html',
  },
  contractor_course: {
    name: 'A.I. Automation for Contractors — Complete Course',
    detail: 'All 4 PDF guides in one ZIP download.',
    button: 'Download All 4 Guides',
    filename: 'AI-Automation-for-Contractors-Complete-Course.zip',
  },
};

export default function DownloadPage({ onNavigate, token, sessionId }: DownloadPageProps) {
  const [linkData, setLinkData] = useState<DownloadLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    if (token) loadLinkByToken(token);
    else if (sessionId) resolveSessionId(sessionId);
    else {
      setLoading(false);
      setError('No access token was provided. Check the purchase link you received after payment.');
    }
  }, [token, sessionId]);

  const requestResolve = async (body: Record<string, string>) => {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  };

  const loadLinkByToken = async (tok: string) => {
    try {
      const { response, data } = await requestResolve({ token: tok });
      if (!response.ok) throw new Error(data.error || 'Could not verify your access link.');
      if (data.status !== 'valid' || !data.link) throw new Error('Could not verify your access link.');
      setLinkData(data.link as DownloadLinkData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify your access link.');
    } finally {
      setLoading(false);
    }
  };

  const resolveSessionId = async (sid: string, attempt = 0) => {
    try {
      const { response, data } = await requestResolve({ session_id: sid });
      if (response.status === 202 || data.status === 'pending') {
        if (attempt >= 20) throw new Error('Your payment is taking longer than expected to process. Please refresh in a few minutes.');
        window.setTimeout(() => resolveSessionId(sid, attempt + 1), 3000);
        return;
      }
      if (!response.ok || data.status !== 'ready' || !data.token) throw new Error(data.error || 'Could not resolve your purchase.');
      window.history.replaceState({}, '', `/download?token=${data.token}`);
      await loadLinkByToken(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resolve your purchase.');
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!linkData) return;
    setDownloading(true);
    setDownloadError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ token: linkData.token }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Download failed (${response.status})`);
      }

      const productKey = response.headers.get('x-product-key') || linkData.product_key || 'contractor_course';
      const product = products[productKey] || products.contractor_course;
      const headerFilename = response.headers.get('x-download-filename');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = headerFilename || product.filename;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setLinkData({ ...linkData, product_key: productKey, download_count: linkData.download_count + 1 });
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Something went wrong delivering your purchase.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <div className="min-h-[calc(100vh-4rem)] bg-stone-50 flex items-center justify-center px-4"><div className="text-center"><Loader2 className="w-10 h-10 text-amber-600 animate-spin mx-auto mb-4" /><p className="text-stone-600 font-medium">{sessionId ? 'Processing your payment and preparing your access...' : 'Verifying your access link...'}</p></div></div>;
  }

  if (error) {
    return <div className="min-h-[calc(100vh-4rem)] bg-stone-50 flex items-center justify-center px-4 py-12"><div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-8 text-center"><AlertTriangle className="w-12 h-12 text-amber-600 mx-auto mb-4" /><h1 className="text-xl font-bold text-stone-900 mb-2">Access link issue</h1><p className="text-stone-600 mb-6">{error}</p><button onClick={() => onNavigate('programs')} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-xl">Back to programs</button></div></div>;
  }

  const productKey = linkData?.product_key || 'contractor_course';
  const product = products[productKey] || products.contractor_course;
  const downloadsLeft = linkData ? linkData.max_downloads - linkData.download_count : 0;
  const expiryDate = linkData ? new Date(linkData.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-stone-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5"><CheckCircle2 className="w-9 h-9 text-green-600" /></div>
          <h1 className="text-3xl font-bold text-stone-900">Your purchase is ready.</h1>
          <p className="mt-3 text-stone-600 text-lg">Thank you for your purchase. Your secure access is below.</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 bg-amber-600 rounded-xl flex items-center justify-center flex-shrink-0"><FileText className="w-7 h-7 text-white" /></div>
            <div><h2 className="font-bold text-stone-900 text-lg">{product.name}</h2><p className="text-stone-500 text-sm mt-1">{product.detail}</p></div>
          </div>

          {downloadError && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{downloadError}</div>}

          <button onClick={handleDownload} disabled={downloading || downloadsLeft <= 0} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
            {downloading ? <><Loader2 className="w-5 h-5 animate-spin" /> Preparing your download...</> : <><Download className="w-5 h-5" /> {product.button}</>}
          </button>

          <div className="mt-6 pt-6 border-t border-stone-100 space-y-3 text-sm">
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-stone-600"><Download className="w-4 h-4 text-stone-400" />Downloads remaining</span><span className="font-semibold text-stone-900">{downloadsLeft} of {linkData?.max_downloads}</span></div>
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-stone-600"><Clock className="w-4 h-4 text-stone-400" />Link expires</span><span className="font-semibold text-stone-900">{expiryDate}</span></div>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-2xl border border-stone-200 p-5">
          <ShieldCheck className="w-6 h-6 text-amber-600 mb-3" />
          <h3 className="font-semibold text-stone-900">Keep this page private</h3>
          <p className="text-stone-500 text-sm mt-1">Your access link is unique to your purchase and remains active for 30 days, up to five downloads.</p>
        </div>

        <div className="mt-8 text-center"><button onClick={() => onNavigate('programs')} className="text-stone-500 hover:text-stone-700 text-sm font-medium">Browse Solid Edge AI programs</button></div>
      </div>
    </div>
  );
}
