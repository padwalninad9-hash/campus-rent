export default function DateRangePicker({ startDate, endDate, onChange }) {
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs font-mono text-ink/60 block mb-1">FROM</label>
        <input
          type="date"
          className="input"
          min={today}
          value={startDate}
          onChange={(e) => onChange({ startDate: e.target.value, endDate })}
        />
      </div>
      <div>
        <label className="text-xs font-mono text-ink/60 block mb-1">TO</label>
        <input
          type="date"
          className="input"
          min={startDate || today}
          value={endDate}
          onChange={(e) => onChange({ startDate, endDate: e.target.value })}
        />
      </div>
    </div>
  );
}
