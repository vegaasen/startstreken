import { useNavigate, useLocation } from "react-router-dom";
import ritt from "../data/ritt.json";

type Race = (typeof ritt)[number];

function groupByYear(races: Race[]): Map<number, Race[]> {
  const sorted = [...races].sort(
    (a, b) => new Date(a.officialDate).getTime() - new Date(b.officialDate).getTime()
  );
  const grouped = new Map<number, Race[]>();
  for (const race of sorted) {
    const year = new Date(race.officialDate).getFullYear();
    if (!grouped.has(year)) grouped.set(year, []);
    grouped.get(year)!.push(race);
  }
  return grouped;
}

export function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  // Derive current ritt id from URL path, e.g. /ritt/birkebeinerrittet
  const match = location.pathname.match(/^\/ritt\/([^/]+)/);
  const currentId = match ? match[1] : "";

  const grouped = groupByYear(ritt);
  const years = [...grouped.keys()].sort((a, b) => b - a);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value) navigate(`/ritt/${value}`);
  }

  return (
    <nav className="site-nav">
      <a href="/" className="site-nav__logo">
        Rittvær
      </a>
      <div className="site-nav__selector">
        <select
          className="site-nav__select"
          value={currentId}
          onChange={handleChange}
          aria-label="Velg ritt"
        >
          <option value="" disabled>
            Velg ritt…
          </option>
          {years.map((year) => (
            <optgroup key={year} label={String(year)}>
              {grouped.get(year)!.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.distance} km
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </nav>
  );
}
