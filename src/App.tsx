import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LandingPage from '@/pages/LandingPage';
import CheckoutPage from '@/pages/CheckoutPage';
import DownloadPage from '@/pages/DownloadPage';

type Page = 'home' | 'checkout' | 'download';

function getRouteInfo(): { page: Page; token?: string; sessionId?: string } {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || undefined;
  const sessionId = params.get('session_id') || undefined;
  const path = window.location.pathname;

  if (path === '/download') {
    return { page: 'download', token, sessionId };
  } else if (path === '/checkout') {
    return { page: 'checkout' };
  }
  return { page: 'home' };
}

function App() {
  const initial = getRouteInfo();
  const [page, setPage] = useState<Page>(initial.page);
  const [downloadToken, setDownloadToken] = useState<string | undefined>(
    initial.token
  );
  const [sessionId, setSessionId] = useState<string | undefined>(
    initial.sessionId
  );

  useEffect(() => {
    const handlePopState = () => {
      const info = getRouteInfo();
      setPage(info.page);
      setDownloadToken(info.token);
      setSessionId(info.sessionId);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (target: string) => {
    if (target === 'home') {
      window.history.pushState({}, '', '/');
      setPage('home');
    } else if (target === 'checkout') {
      window.history.pushState({}, '', '/checkout');
      setPage('checkout');
    } else if (target === 'download') {
      window.history.pushState({}, '', '/download');
      setPage('download');
      setDownloadToken(undefined);
      setSessionId(undefined);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 font-sans">
      <Header onNavigate={navigate} currentPage={page} />
      <main className="flex-1">
        {page === 'home' && <LandingPage onNavigate={navigate} />}
        {page === 'checkout' && <CheckoutPage onNavigate={navigate} />}
        {page === 'download' && (
          <DownloadPage
            onNavigate={navigate}
            token={downloadToken}
            sessionId={sessionId}
          />
        )}
      </main>
      <Footer onNavigate={navigate} />
    </div>
  );
}

export default App;
