import { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { LocateFixed } from "lucide-react";

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
  const [locating, setLocating] = useState(false);
  const hasPin = latitude != null && longitude != null;
  const center = hasPin ? [latitude, longitude] : DEFAULT_CENTER;

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange(position.coords.latitude, position.coords.longitude);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">
          {hasPin ? `Pinned at ${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : "Click the map to drop a pin, or drag it once placed"}
        </span>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-60"
        >
          <LocateFixed size={14} /> {locating ? "Locating…" : "Use my location"}
        </button>
      </div>
      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200" style={{ height: 260 }}>
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
