import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HomePage } from "./pages/HomePage";
import { RittPage } from "./pages/RittPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { NavBar } from "./components/NavBar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ReloadPrompt } from "./components/ReloadPrompt";

const queryClient = new QueryClient();

function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Startstreken — værmeldinger for norske sykkelritt</span>
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
          href="https://github.com/vegaasen/bike-ritt-weathery/issues/new?template=suggest-ritt.yml"
          target="_blank"
          rel="noopener noreferrer"
        >
          Foreslå et ritt
        </a>
      </span>
    </footer>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <NavBar />
          <Routes>
            <Route index element={<HomePage />} />
            <Route path="/ritt/:id" element={<RittPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <SiteFooter />
        </BrowserRouter>
        <ReloadPrompt />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
