import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import { Link } from "react-router-dom";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { LocateFixed, Loader2, MapPin, Search } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import useGeolocation from "../hooks/useGeolocation";
import ItemCard from "./ItemCard";

const pinIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function NearbyListings() {
  const geolocation = useGeolocation();
  const [center, setCenter] = useState(null); // { latitude, longitude }
  const [radiusKm, setRadiusKm] = useState(10);
  const [manualQuery, setManualQuery] = useState("");
  const [manualStatus, setManualStatus] = useState("idle"); // idle | searching | error
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (geolocation.status === "granted" && geolocation.coords) setCenter(geolocation.coords);
  }, [geolocation.status, geolocation.coords]);

  useEffect(() => {
    if (!center) return;
    let cancelled = false;

    async function loadNearby() {
      setLoading(true);
      setError("");

      const { data: nearby, error: rpcError } = await supabase.rpc("nearby_listings", {
        p_lat: center.latitude,
        p_lng: center.longitude,
        p_radius_km: radiusKm,
      });

      if (cancelled) return;
      if (rpcError) {
        setError(rpcError.message);
        setItems([]);
        setLoading(false);
        return;
      }
      if (!nearby || nearby.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      // The RPC returns bare rows for the distance math; pull the images/category
      // joins used elsewhere in the app so this renders with the same ItemCard.
      const { data: full, error: fullError } = await supabase
        .from("items")
        .select("*, item_images(url, sort_order), categories(name, icon)")
        .in("id", nearby.map((row) => row.id));

      if (cancelled) return;
      if (fullError) {
        setError(fullError.message);
        setItems([]);
      } else {
        const distanceById = new Map(nearby.map((row) => [row.id, row.distance_km]));
        const merged = full
          .map((item) => ({ ...item, distance_km: distanceById.get(item.id) }))
          .sort((a, b) => a.distance_km - b.distance_km);
        setItems(merged);
      }
      setLoading(false);
    }

    loadNearby();
    return () => { cancelled = true; };
  }, [center, radiusKm]);

  async function searchManualLocation(event) {
    event.preventDefault();
    if (!manualQuery.trim()) return;
    setManualStatus("searching");
    try {
      // Nominatim is OpenStreetMap's own free geocoder — no API key needed,
      // used only as the fallback when browser geolocation isn't available.
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(manualQuery.trim())}`
      );
      const results = await response.json();
      if (!results?.length) {
        setManualStatus("error");
        return;
      }
      setCenter({ latitude: Number(results[0].lat), longitude: Number(results[0].lon) });
      setManualStatus("idle");
    } catch {
      setManualStatus("error");
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
          <MapPin size={15} /> Rentals near you
        </span>
        {!center && (
          <button
            type="button"
            onClick={geolocation.request}
            disabled={geolocation.status === "locating"}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-bold text-white shadow disabled:opacity-70"
          >
            {geolocation.status === "locating" ? <Loader2 size={15} className="animate-spin" /> : <LocateFixed size={15} />}
            {geolocation.status === "locating" ? "Locating…" : "Use my location"}
          </button>
        )}
        {center && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500">Within {radiusKm} km</span>
            <input
              type="range"
              min="1"
              max="50"
              value={radiusKm}
              onChange={(event) => setRadiusKm(Number(event.target.value))}
              className="w-40 accent-indigo-600"
            />
            <button
              type="button"
              onClick={() => { setCenter(null); setItems([]); }}
              className="text-xs font-bold text-slate-400 hover:text-indigo-600"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {(geolocation.status === "denied" || geolocation.status === "unsupported") && !center && (
        <form onSubmit={searchManualLocation} className="mt-3 flex flex-wrap items-center gap-2">
          <p className="w-full text-xs text-slate-500">
            {geolocation.status === "unsupported"
              ? "Your browser doesn't support location access."
              : "Location permission was denied."}{" "}
            Search by city or pincode instead.
          </p>
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-400 focus-within:border-indigo-400 focus-within:bg-white">
            <Search size={16} />
            <input
              value={manualQuery}
              onChange={(event) => setManualQuery(event.target.value)}
              placeholder="e.g. HSR Layout, Bengaluru or 560102"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none"
            />
          </label>
          <button type="submit" disabled={manualStatus === "searching"} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70">
            {manualStatus === "searching" ? "Searching…" : "Search"}
          </button>
          {manualStatus === "error" && <p className="w-full text-xs font-semibold text-rose-600">Couldn't find that place. Try a nearby city name.</p>}
        </form>
      )}

      {center && (
        <>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200" style={{ height: 280 }}>
            <MapContainer center={[center.latitude, center.longitude]} zoom={12} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <CircleMarker center={[center.latitude, center.longitude]} radius={9} pathOptions={{ color: "#4f46e5", fillColor: "#818cf8", fillOpacity: 0.9 }}>
                <Popup>You are here</Popup>
              </CircleMarker>
              {items.filter((item) => item.latitude != null && item.longitude != null).map((item) => (
                <Marker key={item.id} position={[item.latitude, item.longitude]} icon={pinIcon}>
                  <Popup>
                    <Link to={`/item/${item.id}`} className="font-semibold text-indigo-700">{item.title}</Link>
                    <br />₹{Number(item.price_per_day).toFixed(0)}/day · {item.distance_km?.toFixed(1)} km away
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {error ? (
            <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p>
          ) : loading ? (
            <div className="loading-state mt-4"><Loader2 className="animate-spin" /> Finding rentals near you…</div>
          ) : items.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No listed items with a pinned location within {radiusKm} km yet. Try a larger radius.</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item, index) => (
                <div key={item.id} className="relative">
                  <ItemCard item={item} index={index} />
                  <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
                    {item.distance_km?.toFixed(1)} km
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
