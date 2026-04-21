import { Link, useNavigate, useLocation } from "react-router-dom";
import { allArrangements as ritt, getNextRitt, type Discipline, type RittEntry } from "../lib/ritt";

type Race = RittEntry;

const DISCIPLINE_ORDER: Discipline[] = ["terreng", "landevei", "langrenn", "triathlon", "ultraløp"];

const DISCIPLINE_LABEL: Record<Discipline, string> = {
  terreng: "🚵 Terreng",
  landevei: "🚴 Landevei",
  langrenn: "⛷️ Langrenn",
  triathlon: "🏊 Triathlon",
  ultraløp: "🏃 Ultraløp",
};

function groupByDiscipline(races: Race[]): Map<Discipline, Race[]> {
  const sorted = [...races].sort(
    (a, b) => new Date(a.officialDate + "T00:00:00").getTime() - new Date(b.officialDate + "T00:00:00").getTime()
  );
  const grouped = new Map<Discipline, Race[]>();
  for (const discipline of DISCIPLINE_ORDER) grouped.set(discipline, []);
  for (const race of sorted) {
    grouped.get(race.discipline)!.push(race);
  }
  return grouped;
}

// Computed once at module load — both are derived from static ritt data.
const grouped = groupByDiscipline(ritt);
const nextId = getNextRitt(ritt)?.id ?? ritt[0]?.id ?? "";

export function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const match = location.pathname.match(/^\/ritt\/([^/]+)/);
  const currentId = match ? match[1] : "";

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value) void navigate(`/ritt/${value}`);
  }

  return (
    <div className="site-nav-wrapper">
      <nav className="site-nav">
        <Link to="/" className="site-nav__logo">
          Løypevær
        </Link>
        <div className="site-nav__selector">
          <select
            className="site-nav__select"
            value={currentId}
            onChange={handleChange}
            aria-label="Velg arrangement"
          >
            <option value="" disabled>
              Velg arrangement…
            </option>
            {DISCIPLINE_ORDER.filter((d) => (grouped.get(d)?.length ?? 0) > 0).map((d) => (
              <optgroup key={d} label={DISCIPLINE_LABEL[d]}>
                {grouped.get(d)!.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.distance} km
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {nextId && (
            <Link to={`/ritt/${nextId}`} className="site-nav__cta">
              Sjekk været →
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
