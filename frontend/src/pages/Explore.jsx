import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import CategoryChips from "../components/CategoryChips";
import ItemCard from "../components/ItemCard";

export default function Explore() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadExplore() {
      setLoading(true);
      const [{ data: itemData, error: itemError }, { data: categoryData, error: categoryError }] = await Promise.all([
        supabase.from("items").select("*, item_images(url, sort_order), categories(name, icon)").eq("is_available", true).order("created_at", { ascending: false }),
        supabase.from("categories").select("*").order("id"),
      ]);
      if (itemError || categoryError) setError((itemError || categoryError).message);
      setItems(itemData || []);
      setCategories(categoryData || []);
      setLoading(false);
    }
    loadExplore();
  }, []);

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !term || [item.title, item.description, item.location].filter(Boolean).some((value) => value.toLowerCase().includes(term));
      return matchesSearch && (!categoryId || item.category_id === categoryId);
    });
  }, [items, search, categoryId]);

  return <section className="market-page explore-page"><div className="market-wrap">
    <div className="page-heading"><div><p className="section-kicker">Community marketplace</p><h1>Explore rentals</h1><p>Browse items shared by the Rentify community. Open any item to choose dates and book it.</p></div><span className="explore-count"><SlidersHorizontal size={16} /> {results.length} available</span></div>
    <div className="explore-toolbar"><label><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search cameras, cycles, tools and more…" aria-label="Search available items" /></label></div>
    <div className="mt-6"><CategoryChips categories={categories} activeId={categoryId} onSelect={setCategoryId} /></div>
    {error ? <p className="form-alert" role="alert">Couldn’t load available items: {error}</p> : loading ? <div className="loading-state"><Loader2 className="animate-spin" /> Finding community rentals…</div> : results.length ? <div className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{results.map((item, index) => <ItemCard key={item.id} item={item} index={index} />)}</div> : <div className="empty-market"><Search size={34} /><h2>No rentals found</h2><p>Try another search or category. New items appear here as soon as people list them.</p></div>}
  </div></section>;
}
