import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LandingPage from "@/pages/LandingPage";
import CheckoutPage from "@/pages/CheckoutPage";
import DownloadPage from "@/pages/DownloadPage";
import AssessmentPage from "@/pages/AssessmentPage";
import ProgramsPage from "@/pages/ProgramsPage";
import AcademyPage from "@/pages/AcademyPage";
import ResourcesPage from "@/pages/ResourcesPage";
import PrivacyPage from "@/pages/PrivacyPage";
import TermsPage from "@/pages/TermsPage";

type Page =
  | "home"
  | "academy"
  | "resources"
  | "checkout"
  | "download"
  | "assessment"
  | "programs"
  | "privacy"
  | "terms";

function getRouteInfo(): { page: Page; token?: string; sessionId?: string } {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || undefined;
  const sessionId = params.get("session_id") || undefined;
  const path = window.location.pathname;

  if (path === "/download") return { page: "download", token, sessionId };
  if (path === "/checkout") return { page: "checkout" };
  if (path === "/assessment") return { page: "assessment" };
  if (path === "/academy") return { page: "academy" };
  if (path === "/resources") return { page: "resources" };
  if (path === "/programs") return { page: "programs" };
  if (path === "/privacy") return { page: "privacy" };
  if (path === "/terms") return { page: "terms" };
  return { page: "home" };
}

function App() {
  const initial = getRouteInfo();
  const [page, setPage] = useState<Page>(initial.page);
  const [downloadToken, setDownloadToken] = useState<string | undefined>(
    initial.token,
  );
  const [sessionId, setSessionId] = useState<string | undefined>(
    initial.sessionId,
  );

  useEffect(() => {
    const handlePopState = () => {
      const info = getRouteInfo();
      setPage(info.page);
      setDownloadToken(info.token);
      setSessionId(info.sessionId);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (target: string) => {
    const routes: Record<string, Page> = {
      home: "home",
      checkout: "checkout",
      assessment: "assessment",
      academy: "academy",
      resources: "resources",
      programs: "programs",
      download: "download",
      privacy: "privacy",
      terms: "terms",
    };
    const paths: Record<Page, string> = {
      home: "/",
      checkout: "/checkout",
      assessment: "/assessment",
      academy: "/academy",
      resources: "/resources",
      programs: "/programs",
      download: "/download",
      privacy: "/privacy",
      terms: "/terms",
    };
    const nextPage = routes[target];
    if (!nextPage) return;

    window.history.pushState({}, "", paths[nextPage]);
    setPage(nextPage);
    if (nextPage === "download") {
      setDownloadToken(undefined);
      setSessionId(undefined);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 font-sans">
      <Header onNavigate={navigate} currentPage={page} />
      <main className="flex-1">
        {page === "home" && <LandingPage onNavigate={navigate} />}
        {page === "assessment" && <AssessmentPage onNavigate={navigate} />}
        {page === "academy" && <AcademyPage onNavigate={navigate} />}
        {page === "resources" && <ResourcesPage />}
        {page === "programs" && <ProgramsPage onNavigate={navigate} />}
        {page === "checkout" && <CheckoutPage onNavigate={navigate} />}
        {page === "download" && (
          <DownloadPage
            onNavigate={navigate}
            token={downloadToken}
            sessionId={sessionId}
          />
        )}
        {page === "privacy" && <PrivacyPage />}
        {page === "terms" && <TermsPage />}
      </main>
      <Footer onNavigate={navigate} />
    </div>
  );
}

export default App;
