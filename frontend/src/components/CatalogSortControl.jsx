import { ArrowDownUp } from "lucide-react";

export default function CatalogSortControl({ value, onChange }) {
  return <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600 shadow-sm">
    <ArrowDownUp size={16} className="text-indigo-600" />
    <span className="sr-only">Sort listings</span>
    <select value={value} onChange={(event) => onChange(event.target.value)} className="cursor-pointer bg-transparent outline-none">
      <option value="newest">Newest first</option>
      <option value="price_asc">Price: low to high</option>
      <option value="price_desc">Price: high to low</option>
    </select>
  </label>;
}
