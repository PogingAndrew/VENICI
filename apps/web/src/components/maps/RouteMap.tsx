import { MapContainer, Polyline, TileLayer, CircleMarker, useMap } from "react-leaflet";
import { useEffect } from "react";

export interface LatLng {
  lat: number;
  lng: number;
}

// Keeps the map centered on the latest GPS point as new ones arrive,
// without forcing a full re-render of the MapContainer each time.
function AutoPan({ target }: { target: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.panTo(target, { animate: true });
  }, [target, map]);
  return null;
}

export function RouteMap({ points }: { points: LatLng[] }) {
  const center = points.length > 0 ? points[points.length - 1] : { lat: 14.5995, lng: 120.9842 };

  return (
    <MapContainer center={center} zoom={16} className="h-full w-full" zoomControl={false}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.length > 1 && <Polyline positions={points} color="#ea580c" weight={5} opacity={0.9} />}
      {points.length > 0 && (
        <CircleMarker center={points[points.length - 1]} radius={7} pathOptions={{ color: "#ea580c", fillColor: "#f97316", fillOpacity: 1 }} />
      )}
      <AutoPan target={points.length > 0 ? points[points.length - 1] : null} />
    </MapContainer>
  );
}
