import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { LocateFixed } from "lucide-react";
import useGeolocation from "../hooks/useGeolocation";

// Vite bundles Leaflet's marker images with hashed URLs, which breaks the
// library's default icon lookup — point it at the bundled assets directly.
const pinIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_CENTER = [12.9716, 77.5946]; // Bengaluru — a reasonable default when no location is known yet

function ClickToPlace({ onPlace }) {
  useMapEvents({
    click(event) {
      onPlace(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export default function LocationPicker({ latitude, longitude, onChange }) {
  const geolocation = useGeolocation();
  const hasPin = latitude != null && longitude != null;
  const center = hasPin ? [latitude, longitude] : DEFAULT_CENTER;

  useEffect(() => {
    // onChange intentionally left out of deps — callers pass a fresh inline
    // function each render, and this should only re-fire when a new
    // position actually comes in, not on every parent re-render.
    if (geolocation.status === "granted" && geolocation.coords) {
      onChange(geolocation.coords.latitude, geolocation.coords.longitude);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geolocation.status, geolocation.coords]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {hasPin ? `Pinned at ${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : "Click the map to drop a pin, or drag it once placed"}
        </span>
        <button
          type="button"
          onClick={geolocation.request}
          disabled={geolocation.status === "locating"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-60"
        >
          <LocateFixed size={14} /> {geolocation.status === "locating" ? "Locating…" : "Use my location"}
        </button>
      </div>
      {geolocation.error && <p className="mt-1.5 text-xs font-semibold text-rose-600">{geolocation.error}</p>}
      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700" style={{ height: 260 }}>
        <MapContainer center={center} zoom={hasPin ? 15 : 12} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPlace onPlace={onChange} />
          {hasPin && (
            <Marker
              position={center}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: (event) => {
                  const { lat, lng } = event.target.getLatLng();
                  onChange(lat, lng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
