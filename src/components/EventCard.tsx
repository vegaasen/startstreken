import { Link } from "react-router-dom";
import { type Discipline } from "../lib/arrangements";
import { DISCIPLINE_LABEL } from "../lib/disciplines";

type Props = {
  id: string;
  name: string;
  officialDate: string;
  distance: number;
  /** Human-readable distance label (e.g. "750m / 20km / 5km" for triathlon). Falls back to `{distance} km`. */
  distanceLabel?: string;
  region: string;
  discipline: Discipline;
  /** Override the displayed date (e.g. show saved planned date instead of official date) */
  displayDate?: string;
  planned?: boolean;
  onTogglePlanned?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Countdown string, e.g. "om 3 dager" or "i dag" */
  countdown?: string;
  /** True when the race date has already passed */
  isPast?: boolean;
  /** "pending" = date not yet officially confirmed */
  dateStatus?: "pending";
};

export function EventCard({
  id,
  name,
  officialDate,
  distance,
  distanceLabel,
  region,
  discipline,
  displayDate,
  planned = false,
  onTogglePlanned,
  countdown,
  isPast = false,
  dateStatus,
}: Props) {
  const dateStr = displayDate ?? officialDate;
  const formattedDate = new Date(dateStr + "T00:00:00").toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Link
      to={`arrangement/${id}`}
      className={`ritt-card${planned ? " ritt-card--planned" : ""}${isPast ? " ritt-card--past" : ""}`}
    >
      <div className="ritt-card__name">
        <span>{name}</span>
        {onTogglePlanned && (
          <button
            className={`ritt-card__bookmark${planned ? " ritt-card__bookmark--active" : ""}`}
            onClick={onTogglePlanned}
            aria-label={planned ? "Fjern fra mine arrangement" : "Legg til mine arrangement"}
            aria-pressed={planned}
          >
            <span aria-hidden="true">{planned ? "📌" : "📍"}</span>
            <span className="ritt-card__bookmark-label">{planned ? "Lagret" : "Lagre"}</span>
          </button>
        )}
      </div>
      <div className="ritt-card__meta">
        <span className="ritt-card__region">{region}</span>
        <span className="ritt-card__distance">{distanceLabel ?? `${distance} km`}</span>
      </div>
      <div className={`ritt-card__footer${dateStatus === "pending" ? " ritt-card__footer--pending" : ""}`}>
        <div className="ritt-card__footer-main">
          <span className={`ritt-card__discipline ritt-card__discipline--${discipline}`}>
            {DISCIPLINE_LABEL[discipline]}
          </span>
          <div className="ritt-card__footer-right">
            <span className="ritt-card__date">{formattedDate}</span>
            {countdown && (
              <span className="ritt-card__countdown">{countdown}</span>
            )}
          </div>
        </div>
        {dateStatus === "pending" && (
          <div className="ritt-card__footer-tentative">
            <span className="ritt-card__pending" title="Datoen er ikke offisielt bekreftet ennå">Tentativ dato</span>
          </div>
        )}
      </div>
    </Link>
  );
}
