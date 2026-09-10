import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Download,
  FileText,
  AlertTriangle,
  Loader2,
  Mail,
  Clock,
  ShieldCheck,
} from 'lucide-react';

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
}

export default function DownloadPage({
  onNavigate,
  token,
  sessionId,
}: DownloadPageProps) {
  const [linkData, setLinkData] = useState<DownloadLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    if (token) {
      loadLinkByToken(token);
    } else if (sessionId) {
      resolveSessionId(sessionId);
    } else {
      setLoading(false);
      setError('No download token provided. Check your email for the correct link.');
    }
  }, [token, sessionId]);

  const loadLinkByToken = async (tok: string) => {
    // download_links is not readable by the browser; the edge function verifies the token.
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-download`;
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ token: tok }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          data.error ||
            'Could not verify your download link. Please try again.'
        );
      } else if (data.status === 'valid' && data.link) {
        setLinkData(data.link as DownloadLinkData);
      } else {
        setError('Could not verify your download link. Please try again.');
      }
    } catch {
      setError('Could not verify your download link. Please try again.');
    }
    setLoading(false);
  };

  const resolveSessionId = async (sid: string, attempt = 0) => {
    const MAX_RETRIES = 20;
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-download`;
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ session_id: sid }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 202 || data.status === 'pending') {
        if (attempt >= MAX_RETRIES) {
          setError('Your payment is taking longer than expected to process. Please wait a few minutes and refresh this page, or contact support.');
          setLoading(false);
          return;
        }
        setTimeout(() => resolveSessionId(sid, attempt + 1), 3000);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Could not resolve your purchase.');
      }

      if (data.status === 'ready' && data.token) {
        loadLinkByToken(data.token);
        window.history.replaceState({}, '', `/download?token=${data.token}`);
      } else {
        throw new Error('Unexpected response from server.');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not resolve your purchase. Please try again or contact support.'
      );
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!linkData) return;
    setDownloading(true);
    setDownloadError('');

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-pdfs`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ token: linkData.token }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Download failed (${response.status})`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/zip')) {
        throw new Error('Unexpected response from server. Please try again.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = 'AI-Automation-for-Contractors-Complete-Course.zip';
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setLinkData({
        ...linkData,
        download_count: linkData.download_count + 1,
      });
    } catch (err) {
      setDownloadError(
        err instanceof Error
          ? err.message
          : 'Something went wrong downloading your files. Please try again.'
      );
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-stone-50 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-amber-600 animate-spin mx-auto mb-4" />
          <p className="text-stone-600 font-medium">
            {sessionId
              ? 'Processing your payment and preparing your downloads...'
              : 'Verifying your download link...'}
          </p>
          {sessionId && (
            <p className="text-stone-400 text-sm mt-2">
              This usually takes a few seconds.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-stone-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-stone-900 mb-2">
            Download link issue
          </h1>
          <p className="text-stone-600 mb-6">{error}</p>
          <button
            onClick={() => onNavigate('home')}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Back to course page
          </button>
        </div>
      </div>
    );
  }

  const downloadsLeft = linkData
    ? linkData.max_downloads - linkData.download_count
    : 0;
  const expiryDate = linkData
    ? new Date(linkData.expires_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-stone-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Success banner */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-9 h-9 text-green-600" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-bold text-stone-900">
            Your course is ready!
          </h1>
          <p className="mt-3 text-stone-600 text-lg">
            Thank you for your purchase. Download your four PDF guides below.
          </p>
        </div>

        {/* Download card */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-14 h-14 bg-amber-600 rounded-xl flex items-center justify-center">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-stone-900 text-lg">
                A.I. Automation for Contractors — Complete Course
              </h2>
              <p className="text-stone-500 text-sm mt-0.5">
                All 4 PDF guides in one download (ZIP file)
              </p>
            </div>
          </div>

          {downloadError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-sm">{downloadError}</p>
            </div>
          )}

          <button
            onClick={handleDownload}
            disabled={downloading || downloadsLeft <= 0}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg py-4 rounded-xl transition-colors shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {downloading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Preparing your download...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Download All 4 Guides
              </>
            )}
          </button>

          <div className="mt-6 pt-6 border-t border-stone-100 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-stone-600">
                <Download className="w-4 h-4 text-stone-400" />
                Downloads remaining
              </span>
              <span className="font-semibold text-stone-900">
                {downloadsLeft} of {linkData?.max_downloads}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-stone-600">
                <Clock className="w-4 h-4 text-stone-400" />
                Link expires
              </span>
              <span className="font-semibold text-stone-900">{expiryDate}</span>
            </div>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <Mail className="w-6 h-6 text-amber-600 mb-3" />
            <h3 className="font-semibold text-stone-900 text-sm">
              Save your link
            </h3>
            <p className="text-stone-500 text-sm mt-1">
              Bookmark this page so you can come back and download again
              later. Your link stays active for 30 days.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <ShieldCheck className="w-6 h-6 text-amber-600 mb-3" />
            <h3 className="font-semibold text-stone-900 text-sm">
              Need help?
            </h3>
            <p className="text-stone-500 text-sm mt-1">
              Having trouble downloading? Email{' '}
              <a
                href="mailto:support@aiautomationforcontractors.com"
                className="text-amber-700 font-medium hover:underline"
              >
                support@aiautomationforcontractors.com
              </a>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => onNavigate('home')}
            className="text-stone-500 hover:text-stone-700 text-sm font-medium transition-colors"
          >
            Back to course page
          </button>
        </div>
      </div>
    </div>
  );
}
