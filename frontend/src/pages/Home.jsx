import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, Moon, Search, ShieldCheck, Sparkles, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import CategoryChips from "../components/CategoryChips";
import ItemCard from "../components/ItemCard";

const rise = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

export default function Home() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState(null);
  const [seasonIndex, setSeasonIndex] = useState(0);
  const [manualNight, setManualNight] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState("Morning");
  const seasons = ["summer", "winter", "autumn", "spring", "rain"];
  const season = seasons[seasonIndex];
  const isNight = manualNight || timeOfDay === "Night";

  useEffect(() => {
    async function loadMarketplace() {
      setLoading(true);
      const [itemsResult, categoriesResult] = await Promise.all([
        supabase
          .from("items")
          .select("*, item_images(url, sort_order), categories(name, icon)")
          .order("created_at", { ascending: false }),
        supabase.from("categories").select("*").order("id"),
      ]);
      setItems(itemsResult.data || []);
      setCategories(categoriesResult.data || []);
      setLoading(false);
    }
    loadMarketplace();
  }, []);

  useEffect(() => {
    async function loadKycStatus() {
      if (!user) return;
      const { data } = await supabase.from("kyc_submissions").select("status").eq("user_id", user.id).maybeSingle();
      setKycStatus(data?.status || "not_started");
    }
    loadKycStatus();
  }, [user]);

  useEffect(() => {
    const updateTime = () => {
      const hour = new Date().getHours();
      setTimeOfDay(hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 20 ? "Evening" : "Night");
    };
    updateTime();
    const timer = window.setInterval(updateTime, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !term || [item.title, item.location, item.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term));
      return matchesSearch && (!activeCategory || item.category_id === activeCategory);
    });
  }, [items, search, activeCategory]);

  const scrollToListings = () => document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" });

  const changeSeason = (event) => {
    if (event.target.closest("a, button, input, textarea, select, label, [role='button'], .theme-interactive")) return;
    setSeasonIndex((current) => (current + 1) % seasons.length);
  };

  return (
    <div className={`home-theme season-${season} ${isNight ? "is-night" : ""} overflow-hidden`} onClick={changeSeason}>
      <div className={`season-particles ${season}`} aria-hidden="true">
        {Array.from({ length: season === "rain" ? 30 : 18 }).map((_, index) => <i key={index} style={{ left: `${(index * 17) % 106}%`, animationDelay: `${-(index % 9) * 0.55}s`, animationDuration: `${3.2 + (index % 7) * 0.45}s` }} />)}
      </div>
      {user && kycStatus !== "verified" && <section className="mx-auto max-w-7xl px-5 pt-5 sm:px-7"><div className="kyc-nudge"><div className="kyc-nudge-ring"><span>{kycStatus === "pending" ? "80" : "60"}<small>%</small></span></div><div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900">{kycStatus === "pending" ? "Your verification is being reviewed" : "Your profile is 60% authenticated"}</p><p className="mt-1 text-sm text-slate-500">{kycStatus === "pending" ? "You’re almost there. We’ll update your profile after review." : "Complete the remaining 40% to become a Verified member."}</p><div className="kyc-nudge-bar"><i style={{ width: kycStatus === "pending" ? "80%" : "60%" }} /></div></div>{kycStatus !== "pending" && <Link to="/verify-identity" className="btn-primary shrink-0">Complete verification <ArrowRight size={17} /></Link>}</div></section>}
      <section className="hero-shell relative">
        <div className="hero-grid" />
        <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-14 sm:px-7 lg:pb-24 lg:pt-24">
          <div className="theme-controls theme-interactive">
            <span>{manualNight ? "Night mode" : timeOfDay}</span>
            <button type="button" onClick={() => setManualNight((current) => !current)} aria-pressed={isNight} aria-label="Toggle night mode" className="theme-interactive">
              {isNight ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
          <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_.92fr]">
            <motion.div initial="hidden" animate="visible" transition={{ staggerChildren: 0.1 }}>
              <motion.div variants={rise} className="eyebrow">
                <Sparkles size={15} /> Rent what you need, when you need it
              </motion.div>
              <motion.h1 variants={rise} className="hero-title mt-6">
                Rent <span>anything.</span> Live more freely.
              </motion.h1>
              <motion.p variants={rise} className="hero-copy mt-6 max-w-xl text-lg leading-8 text-slate-600">
                Find the things you need for a day, a project, or your next adventure—directly from people nearby.
              </motion.p>
              <motion.div variants={rise} className="search-panel mt-9">
                <Search className="text-indigo-500" size={21} />
                <input aria-label="Search rentals" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && scrollToListings()} placeholder="Search cameras, cycles, books..." />
                <button onClick={scrollToListings} className="btn-primary shrink-0">Explore <ArrowRight size={17} /></button>
              </motion.div>
              <motion.div variants={rise} className="hero-proof mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-slate-600">
                <span className="inline-flex items-center gap-2"><ShieldCheck className="text-emerald-500" size={18} /> Verified rental community</span>
                <span className="inline-flex items-center gap-2"><MapPin className="text-rose-500" size={18} /> Local pickup, no shipping</span>
              </motion.div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.92, rotate: 3 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: 0.7, delay: 0.15 }} className="relative mx-auto w-full max-w-[460px]">
              <div className="hero-showcase">
                <div className="showcase-top"><span>Rentify picks</span><span className="availability-dot">Available now</span></div>
                <div className="showcase-image">📷<div className="image-shine" /></div>
                <div className="mt-5 flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-indigo-600">Creative essentials</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Make your next idea happen.</h2></div><span className="rounded-full bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700">from ₹99</span></div>
                <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-5 text-sm text-slate-500"><div className="avatar-stack"><i>R</i><i>S</i><i>A</i></div> Loved by renters near you</div>
              </div>
              <div className="floating-note note-one"><span>⚡</span><div><b>Fast pickup</b><small>Right nearby</small></div></div>
              <div className="floating-note note-two"><span>✦</span><div><b>Save more</b><small>Rent, don’t buy</small></div></div>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="stat-strip mt-14 grid grid-cols-2 divide-x divide-white/60 overflow-hidden rounded-2xl sm:grid-cols-4">
            {[{ value: `${items.length || "—"}+`, label: "items to discover" }, { value: "24/7", label: "browse anytime" }, { value: "100%", label: "rental community" }, { value: "₹", label: "budget-friendly" }].map((stat) => <div className="px-5 py-5 text-center" key={stat.label}><p className="text-2xl font-bold text-slate-900">{stat.value}</p><p className="mt-1 text-xs font-medium text-slate-500">{stat.label}</p></div>)}
          </motion.div>
        </div>
      </section>
      <p className="season-hint" aria-hidden="true">Click open space to change the season · {season}</p>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-7">
        <div className="section-heading"><div><p className="section-kicker">Find your thing</p><h2>Browse by category</h2><p>All the useful stuff, close to home.</p></div><span className="hidden rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 sm:block">{categories.length} categories</span></div>
        <div className="mt-7"><CategoryChips categories={categories} activeId={activeCategory} onSelect={setActiveCategory} /></div>
      </section>

      <section id="listings" className="listing-section">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-7">
          <div className="section-heading"><div><p className="section-kicker">Recently listed</p><h2>Ready when you are</h2><p>{search ? `Results for “${search}”` : "Fresh finds from people around you."}</p></div><span className="results-count">{visibleItems.length} {visibleItems.length === 1 ? "item" : "items"}</span></div>
          {loading ? <div className="mt-9 grid grid-cols-2 gap-5 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="loading-card" />)}</div> : visibleItems.length ? <motion.div layout className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{visibleItems.map((item, index) => <ItemCard key={item.id} item={item} index={index} />)}</motion.div> : <div className="empty-state mt-9"><span>🔎</span><h3>Nothing matched that search</h3><p>Try a broader term or choose another category.</p><button onClick={() => { setSearch(""); setActiveCategory(null); }} className="btn-outline mt-5">Clear filters</button></div>}
        </div>
      </section>
    </div>
  );
}
