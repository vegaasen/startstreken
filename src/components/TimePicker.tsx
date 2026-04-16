import { calcFinishTimeFromSpeed } from "../lib/timing";

const SPEED_OPTIONS = [15, 18, 20, 22, 25, 28, 30, 32, 35, 38, 40] as const;

type Props = {
  startTime: string;
  finishTime: string;
  onStartChange: (time: string) => void;
  onFinishChange: (time: string) => void;
  onClear: () => void;
  /** Race distance in km. When provided, enables speed-based finish time calculation. */
  distanceKm?: number;
  /** Known mass-start time in "HH:MM". When provided and startTime is empty, shows a prefill hint. */
  officialStartTime?: string;
};

export function TimePicker({
  startTime,
  finishTime,
  onStartChange,
  onFinishChange,
  onClear,
  distanceKm,
  officialStartTime,
}: Props) {
  const hasValues = startTime !== "" || finishTime !== "";
  const timingActive = startTime !== "" && finishTime !== "";

  function handleSpeedChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const speed = Number(e.target.value);
    if (!speed || !startTime || !distanceKm) return;
    const computed = calcFinishTimeFromSpeed(startTime, distanceKm, speed);
    onFinishChange(computed);
  }

  return (
    <div className="time-picker">
      <div className="time-picker__controls">
        <div className="time-picker__field">
          <label htmlFor="ritt-start-time" className="time-picker__label">
            Starttid
            {officialStartTime && !startTime && (
              <button
                type="button"
                className="time-picker__prefill"
                onClick={() => onStartChange(officialStartTime)}
              >
                Bruk offisiell starttid ({officialStartTime})
              </button>
            )}
          </label>
          <input
            id="ritt-start-time"
            type="time"
            value={startTime}
            onChange={(e) => onStartChange(e.target.value)}
            className="time-picker__input"
          />
        </div>

        {distanceKm != null && (
          <div className="time-picker__field">
            <label htmlFor="ritt-speed" className="time-picker__label">
              Fart (km/t)
            </label>
            <select
              id="ritt-speed"
              className="time-picker__input time-picker__speed-select"
              defaultValue=""
              onChange={handleSpeedChange}
              disabled={!startTime}
            >
              <option value="" disabled>
                Velg fart…
              </option>
              {SPEED_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s} km/t
                  {distanceKm
                    ? ` ≈ ${Math.round((distanceKm / s) * 10) / 10} t`
                    : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="time-picker__field">
          <label htmlFor="ritt-finish-time" className="time-picker__label">
            Forventet slutttid
          </label>
          <input
            id="ritt-finish-time"
            type="time"
            value={finishTime}
            onChange={(e) => onFinishChange(e.target.value)}
            className="time-picker__input"
          />
        </div>

        {hasValues && (
          <button
            type="button"
            onClick={onClear}
            className="time-picker__clear"
          >
            Fjern tider
          </button>
        )}
      </div>
      {timingActive && (
        <div className="time-picker__hint">
          Viser vær ved forventet ankomsttid på hvert punkt
        </div>
      )}
    </div>
  );
}
