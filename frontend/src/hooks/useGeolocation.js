import { useCallback, useState } from "react";

// status: idle | locating | granted | denied | unsupported
export default function useGeolocation() {
  const [status, setStatus] = useState("idle");
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState("");

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    setStatus("locating");
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setStatus("granted");
      },
      (geoError) => {
        setError(geoError.code === geoError.PERMISSION_DENIED ? "Location permission denied" : "Couldn't get your location");
        setStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return { status, coords, error, request };
}
