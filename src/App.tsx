import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HomePage } from "./pages/HomePage";
import { RittPage } from "./pages/RittPage";
import { NavBar } from "./components/NavBar";

const queryClient = new QueryClient();

function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Rittvær — værmeldinger for norske sykkelritt</span>
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
    </footer>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <NavBar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/ritt/:id" element={<RittPage />} />
        </Routes>
        <SiteFooter />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
