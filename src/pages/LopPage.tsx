import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { PageMeta } from "../components/PageMeta";
import { RunningEventRow } from "../components/RunningEventRow";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMyEvents } from "../hooks/useMyEvents";
import { allArrangements } from "../lib/arrangements";
import { daysUntil, formatCountdown } from "../lib/dates";
import { groupByYearMonth } from "../lib/grouping";
import { monthName } from "../lib/month";
import { SITE_URL } from "../lib/seo";

const lopingRaces = allArrangements.filter((r) => r.discipline === "løping");

type DistanceFilter = "alle" | "10k" | "10-20km" | "halvmaraton" | "halvmaraton-pluss" | "maraton";

const DISTANCE_LABELS: Record<DistanceFilter, string> = {
  alle: "Alle",
  "10k": "≤ 10 km",
  "10-20km": "10–20 km",
  halvmaraton: "Halvmaraton",
  "halvmaraton-pluss": "Halvmaraton+",
  maraton: "Maraton",
};

function matchesDistance(distance: number, filter: DistanceFilter): boolean {
  if (filter === "alle") return true;
  if (filter === "10k") return distance <= 10;
  if (filter === "10-20km") return distance > 10 && distance <= 20;
  if (filter === "halvmaraton") return distance > 20 && distance <= 22;
  if (filter === "halvmaraton-pluss") return distance > 22 && distance <= 44;
  if (filter === "maraton") return distance > 44 && distance <= 46;
  return true;
}

export function LopPage() {
  const { isPlanned, add, remove } = useMyEvents();
  const [search, setSearch] = useState("");
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>("alle");

  const debouncedSearch = useDebouncedValue(search);
  const searchQuery = debouncedSearch.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      lopingRaces.filter(
        (r) =>
          matchesDistance(r.distance, distanceFilter) &&
          (!searchQuery ||
            r.name.toLowerCase().includes(searchQuery) ||
            r.region.toLowerCase().includes(searchQuery)),
      ),
    [searchQuery, distanceFilter],
  );

  const grouped = useMemo(() => groupByYearMonth(filtered), [filtered]);
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const years = useMemo(() => [...grouped.keys()].sort((a, b) => b - a), [grouped]);
  const currentAndPastYears = useMemo(
    () => years.filter((y) => y <= currentYear),
    [years, currentYear],
  );
  const futureYears = useMemo(() => years.filter((y) => y > currentYear), [years, currentYear]);

  const pageTitle = "Løpsvær – Vær for norske løp | Løypevær";
  const description = `Sjekk løpsvær for ${lopingRaces.length} norske løp — 10 km, halvmaraton og maraton. Sanntidsvarsler for temperatur, vind og nedbør langs hele ruten, tilpasset din starttid.`;
  const pageUrl = `${SITE_URL}/lop`;

  function handleToggle(id: string, officialDate: string, e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (isPlanned(id)) {
      remove(id);
    } else {
      add(id, { date: officialDate, startTime: "", finishTime: "" });
    }
  }

  return (
    <div className="home-page">
      <PageMeta title={pageTitle} description={description} canonicalUrl={pageUrl} />
      <Helmet>
        <meta
          name="keywords"
          content="løpsvær, maratonvær, halvmaratonvær, 10 km vær, løp vær Norge, vær løpsdag, norske løp vær"
        />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Norske løp – løpsvær og værmeldinger",
            url: pageUrl,
            numberOfItems: lopingRaces.length,
            itemListElement: lopingRaces.map((r, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: r.name,
              url: `${SITE_URL}/arrangement/${r.id}`,
            })),
          })}
        </script>
      </Helmet>

      <section className="home-page__hero">
        <div className="home-page__hero-eyebrow">Løping</div>
        <h1>
          Sjekk været.
          <br />
          Løp forberedt.
        </h1>
        <p className="home-page__hero-sub">
          Sjekk temperatur, vind og nedbør langs hele ruten din — sanntidsvarsler for løp innenfor
          16 dager. Tilpasset din starttid.
        </p>
        <div className="home-page__hero-stats">
          <span>
            <strong>{lopingRaces.length}</strong> løp
          </span>
        </div>
      </section>

      <div className="home-page__filter">
        <div role="group" aria-label="Filtrer etter distanse" className="home-page__filter-pills">
          {(
            [
              "alle",
              "10k",
              "10-20km",
              "halvmaraton",
              "halvmaraton-pluss",
              "maraton",
            ] as DistanceFilter[]
          ).map((d) => (
            <button
              key={d}
              className={`home-page__filter-pill${distanceFilter === d ? " home-page__filter-pill--active" : ""}`}
              onClick={() => setDistanceFilter(d)}
              aria-pressed={distanceFilter === d}
            >
              {DISTANCE_LABELS[d]}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="home-page__search"
          placeholder="Filtrer løp…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Filtrer løp"
        />
      </div>

      <main className="home-page__sections">
        {years.length === 0 && <p className="home-page__empty">Ingen løp funnet.</p>}
        {currentAndPastYears.map((year) => {
          const byMonth = grouped.get(year)!;
          const months = [...byMonth.keys()].sort((a, b) => a - b);
          const isPastYear = year < currentYear;
          const yearContent = (
            <>
              {months.map((month) => {
                const monthEvents = byMonth.get(month)!;
                const isCurrentMonth = year === currentYear && month === currentMonth;
                const isCollapsedMonth =
                  monthEvents.every((r) => daysUntil(r.officialDate) < 0) && !isCurrentMonth;
                const monthInner = (
                  <div
                    key={month}
                    id={`month-${year}-${month}`}
                    className="home-page__month-section"
                  >
                    <div className="lop-list">
                      {monthEvents.map((r) => (
                        <RunningEventRow
                          key={r.id}
                          id={r.id}
                          name={r.name}
                          officialDate={r.officialDate}
                          distance={r.distance}
                          distanceLabel={r.distanceLabel}
                          region={r.region}
                          discipline={r.discipline}
                          countdown={formatCountdown(r.officialDate)}
                          planned={isPlanned(r.id)}
                          isPast={daysUntil(r.officialDate) < 0}
                          dateStatus={r.dateStatus}
                          onTogglePlanned={(e) => handleToggle(r.id, r.officialDate, e)}
                        />
                      ))}
                    </div>
                  </div>
                );
                if (isCollapsedMonth) {
                  return (
                    <details key={month} className="home-page__month-details">
                      <summary className="home-page__month-heading home-page__month-summary">
                        <span className="home-page__month-summary-label">
                          {monthName(month)}
                          <span className="month-count-badge">{monthEvents.length}</span>
                        </span>
                      </summary>
                      {monthInner}
                    </details>
                  );
                }
                return (
                  <>
                    <h3 className="home-page__month-heading">
                      <a href={`#month-${year}-${month}`} className="home-page__month-anchor">
                        {monthName(month)}
                      </a>
                      {monthEvents.length > 1 && (
                        <span className="month-count-badge">{monthEvents.length}</span>
                      )}
                    </h3>
                    {monthInner}
                  </>
                );
              })}
            </>
          );
          if (isPastYear) {
            return (
              <details key={year} className="home-page__year-details">
                <summary className="home-page__year-heading home-page__year-summary">
                  {year}
                </summary>
                <section className="home-page__year-section">{yearContent}</section>
              </details>
            );
          }
          return (
            <section key={year} className="home-page__year-section">
              <h2 className="home-page__year-heading">{year}</h2>
              {yearContent}
            </section>
          );
        })}
        {futureYears.length > 0 && (
          <details className="home-page__future-years">
            <summary className="home-page__future-years-summary">
              Kommende sesonger ({futureYears.sort((a, b) => a - b).join(", ")})
            </summary>
            {futureYears.map((year) => {
              const byMonth = grouped.get(year)!;
              const months = [...byMonth.keys()].sort((a, b) => a - b);
              return (
                <section key={year} className="home-page__year-section">
                  <h2 className="home-page__year-heading">{year}</h2>
                  {months.map((month) => (
                    <div
                      key={month}
                      id={`month-${year}-${month}`}
                      className="home-page__month-section"
                    >
                      <h3 className="home-page__month-heading">
                        <a href={`#month-${year}-${month}`} className="home-page__month-anchor">
                          {monthName(month)}
                        </a>
                        {(byMonth.get(month)?.length ?? 0) > 1 && (
                          <span className="month-count-badge">{byMonth.get(month)?.length}</span>
                        )}
                      </h3>
                      <div className="lop-list">
                        {byMonth.get(month)?.map((r) => (
                          <RunningEventRow
                            key={r.id}
                            id={r.id}
                            name={r.name}
                            officialDate={r.officialDate}
                            distance={r.distance}
                            distanceLabel={r.distanceLabel}
                            region={r.region}
                            discipline={r.discipline}
                            countdown={formatCountdown(r.officialDate)}
                            planned={isPlanned(r.id)}
                            isPast={daysUntil(r.officialDate) < 0}
                            dateStatus={r.dateStatus}
                            onTogglePlanned={(e) => handleToggle(r.id, r.officialDate, e)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              );
            })}
          </details>
        )}
      </main>

      <div className="home-page__cta-banner" style={{ marginTop: "var(--space-xl)" }}>
        <div className="home-page__cta-banner-text">
          <div className="home-page__cta-banner-eyebrow">Sykkel, langrenn og triathlon?</div>
          <h2>Se alle utholdenhetsarrangement</h2>
          <p>Sjekk værvarsler og historiske klimasnitt for lange ritt, langrenn og triathlon.</p>
        </div>
        <div className="home-page__cta-banner-action">
          <Link to="/" className="home-page__cta-banner-btn">
            Tilbake til oversikt →
          </Link>
        </div>
      </div>
    </div>
  );
}
