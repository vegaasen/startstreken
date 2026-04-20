import { Link } from "react-router-dom";
import { type Discipline } from "../lib/ritt";

type Props = {
  id: string;
  name: string;
  officialDate: string;
  distance: number;
  region: string;
  discipline: "landevei" | "terreng" | "langrenn" | "triathlon" | "ultraløp";
  /** Override the displayed date (e.g. show saved planned date instead of official date) */
  displayDate?: string;
  planned?: boolean;
  onTogglePlanned?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Countdown string, e.g. "om 3 dager" or "i dag" */
  countdown?: string;
  /** True when the race date has already passed */
  isPast?: boolean;
};

const DISCIPLINE_LABEL: Record<Discipline, string> = {
  landevei: "Landevei",
  terreng: "Terreng",
  langrenn: "Langrenn",
  triathlon: "Triathlon",
  ultraløp: "Ultraløp",
};

export function RittCard({
  id,
  name,
  officialDate,
  distance,
  region,
  discipline,
  displayDate,
  planned = false,
  onTogglePlanned,
  countdown,
  isPast = false,
}: Props) {
  const dateStr = displayDate ?? officialDate;
  const formattedDate = new Date(dateStr + "T00:00:00").toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Link
      to={`ritt/${id}`}
      className={`ritt-card${planned ? " ritt-card--planned" : ""}${isPast ? " ritt-card--past" : ""}`}
    >
      <div className="ritt-card__name">{name}</div>
      <div className="ritt-card__meta">
        <span className="ritt-card__region">{region}</span>
        <span className="ritt-card__distance">{distance} km</span>
        <span className={`ritt-card__discipline ritt-card__discipline--${discipline}`}>
          {DISCIPLINE_LABEL[discipline]}
        </span>
      </div>
      <div className="ritt-card__footer">
        <div className="ritt-card__footer-left">
          <span className="ritt-card__date">{formattedDate}</span>
          {countdown && (
            <span className="ritt-card__countdown">{countdown}</span>
          )}
        </div>
        {onTogglePlanned && (
          <button
            className={`ritt-card__bookmark${planned ? " ritt-card__bookmark--active" : ""}`}
            onClick={onTogglePlanned}
            title={planned ? "Fjern fra mine arrangement" : "Legg til mine arrangement"}
            aria-label={planned ? "Fjern fra mine arrangement" : "Legg til mine arrangement"}
            aria-pressed={planned}
          >
            {planned ? "📌" : "📍"}
          </button>
        )}
      </div>
    </Link>
  );
}
