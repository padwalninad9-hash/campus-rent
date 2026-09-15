import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, MapPin, RefreshCw, Rows3 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import CategoryChips from "../components/CategoryChips";
import CatalogFilterBar from "../components/CatalogFilterBar";
import CatalogGrid from "../components/CatalogGrid";
import CatalogSortControl from "../components/CatalogSortControl";
import NearbyListings from "../components/NearbyListings";

const PAGE_SIZE = 12;
const SORTS = { newest: ["created_at", false], price_asc: ["price_per_day", true], price_desc: ["price_per_day", false] };

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [mode, setMode] = useState("all"); // all | nearby
  const filters = useMemo(() => ({ search: searchParams.get("q") || "", categoryId: Number(searchParams.get("category")) || null, minPrice: searchParams.get("min") || "", maxPrice: searchParams.get("max") || "", availableOnly: searchParams.get("available") === "1", sort: SORTS[searchParams.get("sort")] ? searchParams.get("sort") : "newest", page: Math.max(1, Number(searchParams.get("page")) || 1) }), [searchParams]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const updateFilters = useCallback((updates) => {
    const next = new URLSearchParams(searchParams);
    const entries = { q: updates.search, category: updates.categoryId, min: updates.minPrice, max: updates.maxPrice, available: updates.availableOnly === undefined ? undefined : updates.availableOnly ? "1" : "", sort: updates.sort, page: updates.page };
    Object.entries(entries).forEach(([key, value]) => { if (value === undefined) return; if (value === "" || value === null || value === false || (key === "sort" && value === "newest") || (key === "page" && Number(value) <= 1)) next.delete(key); else next.set(key, String(value)); });
    if (!Object.hasOwn(updates, "page")) next.delete("page");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    async function loadCatalog() {
      setLoading(true); setError("");
      const [sortColumn, ascending] = SORTS[filters.sort];
      let query = supabase.from("items").select("*, item_images(url, sort_order), categories(name, icon)", { count: "exact" });
      if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
      if (filters.availableOnly) query = query.eq("is_available", true);
      if (filters.minPrice !== "") query = query.gte("price_per_day", Number(filters.minPrice));
      if (filters.maxPrice !== "") query = query.lte("price_per_day", Number(filters.maxPrice));
      if (filters.search.trim()) { const term = filters.search.trim().replace(/[(),]/g, " "); query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`); }
      // Offset pagination keeps the filters shareable in the URL and provides predictable page links.
      query = query.order(sortColumn, { ascending }).range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE - 1);
      const [{ data, count, error: itemsError }, { data: categoryData, error: categoryError }] = await Promise.all([query, supabase.from("categories").select("*").order("id")]);
      if (itemsError || categoryError) { setError((itemsError || categoryError).message || "Could not load the catalog."); setItems([]); } else { setItems(data || []); setTotal(count || 0); setCategories(categoryData || []); }
      setLoading(false);
    }
    loadCatalog();
  }, [filters, reloadKey]);

  const modeToggle = <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"><button type="button" onClick={() => setMode("all")} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition ${mode === "all" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-indigo-700"}`}><Rows3 size={15} /> All listings</button><button type="button" onClick={() => setMode("nearby")} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition ${mode === "nearby" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-indigo-700"}`}><MapPin size={15} /> Near me</button></div>;

  return <section className="mx-auto max-w-7xl px-5 py-14 sm:px-7"><div className="section-heading"><div><p className="section-kicker">Community marketplace</p><h2>Explore rentals</h2><p>Find useful things shared by people nearby, ready when you need them.</p></div><div className="flex items-center gap-3">{modeToggle}{mode === "all" && <CatalogSortControl value={filters.sort} onChange={(sort) => updateFilters({ sort })} />}</div></div>
  {mode === "nearby" ? <div className="mt-7"><NearbyListings /></div> : <>
  <CatalogFilterBar search={filters.search} minPrice={filters.minPrice} maxPrice={filters.maxPrice} availableOnly={filters.availableOnly} onChange={updateFilters} onClear={() => setSearchParams({}, { replace: true })} /><div className="mt-6 flex items-center justify-between"><CategoryChips categories={categories} activeId={filters.categoryId} onSelect={(categoryId) => updateFilters({ categoryId })} /><span className="results-count ml-4 shrink-0">{total} {total === 1 ? "item" : "items"}</span></div>{error ? <div className="empty-state mt-9"><AlertCircle className="mx-auto text-rose-500" size={36} /><h3>Couldn’t load the catalog</h3><p>{error}</p><button onClick={() => setReloadKey((key) => key + 1)} className="btn-primary mt-5"><RefreshCw size={17} /> Retry</button></div> : !loading && !items.length ? <div className="empty-state mt-9"><span>🔎</span><h3>No items match your filters</h3><p>Try changing the price range, category, or search term.</p><button onClick={() => setSearchParams({}, { replace: true })} className="btn-outline mt-5">Clear filters</button></div> : <CatalogGrid items={items} loading={loading} />}{!loading && !error && pageCount > 1 && <div className="mt-10 flex items-center justify-center gap-3"><button className="btn-outline !px-4 !py-2.5" disabled={filters.page === 1} onClick={() => updateFilters({ page: filters.page - 1 })}><ChevronLeft size={18} /> Previous</button><span className="text-sm font-bold text-slate-500">Page {filters.page} of {pageCount}</span><button className="btn-outline !px-4 !py-2.5" disabled={filters.page >= pageCount} onClick={() => updateFilters({ page: filters.page + 1 })}>Next <ChevronRight size={18} /></button></div>}
  </>}</section>;
}
