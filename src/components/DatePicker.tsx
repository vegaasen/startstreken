type Props = {
  value: string;
  onChange: (date: string) => void;
  officialDate: string;
};

export function DatePicker({ value, onChange, officialDate }: Props) {
  const isOfficialDate = value === officialDate;

  return (
    <div className="date-picker">
      <label htmlFor="ritt-date" className="date-picker__label">
        Velg dato
      </label>
      <div className="date-picker__controls">
        <input
          id="ritt-date"
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="date-picker__input"
        />
        {!isOfficialDate && (
          <button
            type="button"
            onClick={() => onChange(officialDate)}
            className="date-picker__reset"
          >
            Tilbake til offisiell dato
          </button>
        )}
      </div>
      {isOfficialDate && (
        <div className="date-picker__hint">Dette er den offisielle startdatoen</div>
      )}
    </div>
  );
}
