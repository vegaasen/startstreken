type Props = {
  startTime: string;
  finishTime: string;
  onStartChange: (time: string) => void;
  onFinishChange: (time: string) => void;
  onClear: () => void;
};

export function TimePicker({
  startTime,
  finishTime,
  onStartChange,
  onFinishChange,
  onClear,
}: Props) {
  const hasValues = startTime !== "" || finishTime !== "";

  return (
    <div className="time-picker">
      <div className="time-picker__controls">
        <div className="time-picker__field">
          <label htmlFor="ritt-start-time" className="time-picker__label">
            Starttid
          </label>
          <input
            id="ritt-start-time"
            type="time"
            value={startTime}
            onChange={(e) => onStartChange(e.target.value)}
            className="time-picker__input"
          />
        </div>
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
      {startTime && finishTime && (
        <div className="time-picker__hint">
          Viser vær ved forventet ankomsttid for hvert punkt
        </div>
      )}
    </div>
  );
}
