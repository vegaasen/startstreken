import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HomePage } from "./pages/HomePage";
import { NavBar } from "./components/NavBar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ReloadPrompt } from "./components/ReloadPrompt";
import { usePageTracking } from "./hooks/usePageTracking";

const RittPage = lazy(() => import("./pages/RittPage").then((m) => ({ default: m.RittPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));

const queryClient = new QueryClient();

function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Startstreken — værmeldinger for norske utholdenhetsarrangement</span>
      <span>
        Data:{" "}
        <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">
          Open-Meteo
        </a>{" "}
        &{" "}
        <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer">
          OpenStreetMap
        </a>
      </span>
      <span>
        <a
          href="https://github.com/vegaasen/startstreken/issues/new?template=suggest-ritt.yml"
          target="_blank"
          rel="noopener noreferrer"
        >
          Foreslå et arrangement
        </a>
      </span>
      <span>
        Laget av{" "}
        <a href="https://www.vegaasen.com" target="_blank" rel="noopener noreferrer">
          Vegard Aasen
        </a>
      </span>
    </footer>
  );
}

function RouterContent() {
  usePageTracking();
  return (
    <>
      <NavBar />
      <Suspense fallback={null}>
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="/ritt/:id" element={<RittPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <SiteFooter />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <RouterContent />
        </BrowserRouter>
        <ReloadPrompt />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
