import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

export default function CatalogFilterBar({ search, minPrice, maxPrice, availableOnly, onChange, onClear }) {
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => setSearchInput(search), [search]);
  useEffect(() => {
    const timeout = window.setTimeout(() => onChange({ search: searchInput }), 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput, onChange]);

  return <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-slate-400 focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-100">
        <Search size={19} />
        <input className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search by item name or description…" aria-label="Search catalog" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><SlidersHorizontal size={15} /> Price / day</span>
        <input type="number" min="0" inputMode="numeric" value={minPrice} onChange={(event) => onChange({ minPrice: event.target.value })} className="w-24 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" placeholder="Min ₹" aria-label="Minimum price per day" />
        <span className="text-slate-400">–</span>
        <input type="number" min="0" inputMode="numeric" value={maxPrice} onChange={(event) => onChange({ maxPrice: event.target.value })} className="w-24 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" placeholder="Max ₹" aria-label="Maximum price per day" />
      </div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50">
        <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={availableOnly} onChange={(event) => onChange({ availableOnly: event.target.checked })} /> Available now
      </label>
      <button type="button" onClick={onClear} className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"><X size={16} /> Clear</button>
    </div>
  </div>;
}
