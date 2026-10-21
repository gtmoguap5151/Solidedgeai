import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LandingPage from "@/pages/LandingPage";

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-stone-950 font-sans text-stone-100">
      <Header />
      <main className="flex-1">
        <LandingPage />
      </main>
      <Footer />
    </div>
  );
}

export default App;
