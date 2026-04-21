import { Link } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";

export function NotFoundPage() {
  usePageTitle("Siden finnes ikke – Løypevær");

  return (
    <div className="ritt-page ritt-page--not-found">
      <h1>404</h1>
      <p>Siden finnes ikke.</p>
      <Link to="/">Tilbake til oversikt</Link>
    </div>
  );
}
