export default function DateRangePicker({ startDate, endDate, onChange, minDate }) {
  const today = new Date().toISOString().split("T")[0];
  const firstAvailableDate = minDate && minDate > today ? minDate : today;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs font-mono text-ink/60 block mb-1">FROM</label>
        <input
          type="date"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          min={firstAvailableDate}
          value={startDate}
          onChange={(e) => onChange({ startDate: e.target.value, endDate })}
        />
      </div>
      <div>
        <label className="text-xs font-mono text-ink/60 block mb-1">TO</label>
        <input
          type="date"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          min={startDate || firstAvailableDate}
          value={endDate}
          onChange={(e) => onChange({ startDate, endDate: e.target.value })}
        />
      </div>
    </div>
  );
}
