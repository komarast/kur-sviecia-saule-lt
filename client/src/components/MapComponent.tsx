import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { StationObservation, PlaceSummary, Coordinates, Language, FilterMode, ForecastHourOffset } from '../types';
import { getT } from '../translations';
import { formatVilniusTime } from '../utils/time';
import { Navigation, ExternalLink, Copy, Check, Wind, Cloud, Compass } from 'lucide-react';

// Tile source defaults to CARTO Voyager (OpenStreetMap-based tiles hosted on global CDN)
// which avoids OSM's strict Referer/User-Agent blocks and rate-limiting on cloud hosts like Render.
const DEFAULT_TILE_URL =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const DEFAULT_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>';

const TILE_URL: string = import.meta.env.VITE_TILE_URL || DEFAULT_TILE_URL;
const TILE_ATTRIBUTION: string =
  import.meta.env.VITE_TILE_ATTRIBUTION || DEFAULT_TILE_ATTRIBUTION;

interface MapComponentProps {
  stations: StationObservation[];
  majorCities: PlaceSummary[];
  selectedLocation: Coordinates | null;
  filterMode: FilterMode;
  hourOffset: ForecastHourOffset;
  lang: Language;
}

// Controller component to smoothly pan/zoom to coordinates
const FlyToLocation: React.FC<{ coords: Coordinates | null }> = ({ coords }) => {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.flyTo([coords.latitude, coords.longitude], 11, {
        duration: 1.2
      });
    }
  }, [coords, map]);
  return null;
};

const markerEmoji = (isDaylight: boolean, isClear: boolean, isSunny: boolean) =>
  !isDaylight ? '🌙' : isClear ? '☀️' : isSunny ? '🌤️' : '☁️';

// Create custom animated Leaflet DivIcon
const createCustomMarkerIcon = (
  score: number,
  isClear: boolean,
  isSunny: boolean,
  isDaylight: boolean,
  temperature: number
) => {
  let bgClass = 'bg-slate-600/80 border-slate-400 text-slate-200';
  let pulseHtml = '';

  if (isDaylight && (isClear || score >= 80)) {
    bgClass = 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 border-amber-200 shadow-amber-500/50 shadow-lg';
    pulseHtml = '<span class="absolute -inset-1 rounded-full bg-amber-400/40 animate-ping"></span>';
  } else if (isDaylight && (isSunny || score >= 50)) {
    bgClass = 'bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 border-amber-300 shadow-md';
    pulseHtml = '<span class="absolute -inset-0.5 rounded-full bg-amber-400/20"></span>';
  } else if (!isDaylight) {
    bgClass = 'bg-slate-800/90 border-indigo-300/60 text-indigo-100';
  }

  const emoji = markerEmoji(isDaylight, isClear, isSunny);
  const temp = Math.round(temperature);

  const html = `
    <div class="relative flex items-center justify-center cursor-pointer transform hover:scale-125 transition-transform duration-200">
      ${pulseHtml}
      <div class="relative flex items-center gap-1 px-2 py-1 rounded-full border ${bgClass} text-[11px] font-bold shadow-md">
        <span class="text-xs leading-none">${emoji}</span>
        <span class="leading-none">${temp > 0 ? `+${temp}` : temp}°</span>
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-sun-marker',
    html,
    iconSize: [44, 26],
    iconAnchor: [22, 13],
    popupAnchor: [0, -14]
  });
};

export const MapComponent: React.FC<MapComponentProps> = ({
  stations,
  majorCities,
  selectedLocation,
  filterMode,
  hourOffset,
  lang
}) => {
  const t = getT(lang);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopyCoords = (lat: number, lon: number, id: string) => {
    const text = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderedMarkers = React.useMemo(() => {
    if (hourOffset === 0) {
      return stations
        .filter((st) => {
          if (filterMode === 'clear-only') return st.isClear;
          if (filterMode === 'all-sun') return st.isSunny;
          return true; // all-stations
        })
        .map((st) => ({
          id: st.stationCode,
          name: st.stationName,
          type: 'station' as const,
          coordinates: st.coordinates,
          temperature: st.airTemperature,
          cloudCover: st.cloudCover,
          conditionName: lang === 'lt' ? st.conditionNameLt : st.conditionNameEn,
          conditionCode: st.conditionCode,
          sunshineScore: st.sunshineScore,
          isDaylight: st.isDaylight,
          isSunny: st.isSunny,
          isClear: st.isClear,
          windSpeed: st.windSpeed,
          googleMapsUrl: st.googleMapsUrl,
          wazeUrl: st.wazeUrl,
          timeLabel: formatVilniusTime(st.observationTimeUtc)
        }));
    }

    return majorCities
      .map((city) => {
        const forecastList = city.hourlyForecast || [];
        const targetItem = forecastList[Math.min(hourOffset, forecastList.length - 1)] || city.currentForecast;
        if (!targetItem) return null;

        return {
          id: city.code,
          name: city.name,
          type: 'city' as const,
          coordinates: city.coordinates,
          temperature: targetItem.airTemperature,
          cloudCover: targetItem.cloudCover,
          conditionName: lang === 'lt' ? targetItem.conditionNameLt : targetItem.conditionNameEn,
          conditionCode: targetItem.conditionCode,
          sunshineScore: targetItem.sunshineScore,
          isDaylight: targetItem.isDaylight,
          isSunny: targetItem.isSunny,
          isClear: targetItem.isClear,
          windSpeed: targetItem.windSpeed || 0,
          googleMapsUrl: city.googleMapsUrl,
          wazeUrl: city.wazeUrl,
          timeLabel: formatVilniusTime(targetItem.forecastTimeUtc)
        };
      })
      .filter((m): m is NonNullable<typeof m> => {
        if (!m) return false;
        if (filterMode === 'clear-only') return m.isClear;
        if (filterMode === 'all-sun') return m.isSunny;
        return true;
      });
  }, [stations, majorCities, hourOffset, filterMode, lang]);

  return (
    <div className="absolute inset-0 w-full h-full">
      <MapContainer
        center={[55.1694, 23.8813]}
        zoom={7.5}
        minZoom={6}
        maxZoom={14}
        maxBounds={[
          [53.2, 20.0],
          [56.9, 27.5]
        ]}
        scrollWheelZoom={true}
        className="w-full h-full z-0 bg-slate-950"
      >
        <TileLayer
          attribution={TILE_ATTRIBUTION}
          url={TILE_URL}
          subdomains={TILE_URL.includes('{s}') ? 'abcd' : 'abc'}
          maxZoom={19}
        />

        <FlyToLocation coords={selectedLocation} />

        {renderedMarkers.map((marker) => {
          const icon = createCustomMarkerIcon(
            marker.sunshineScore,
            marker.isClear,
            marker.isSunny,
            marker.isDaylight,
            marker.temperature
          );

          return (
            <Marker
              key={marker.id}
              position={[marker.coordinates.latitude, marker.coordinates.longitude]}
              icon={icon}
            >
              <Popup className="custom-popup" maxWidth={320}>
                <div className="p-3 text-slate-900 font-sans">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                    <div>
                      <h3 className="font-bold text-base text-slate-900 leading-snug">
                        {marker.name}
                      </h3>
                      <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                        <Compass className="w-3 h-3 text-amber-500" />
                        <span>{marker.type === 'station' ? t.stationType : t.cityType}</span>
                        {marker.timeLabel && <span>• {marker.timeLabel}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xl font-extrabold text-amber-600 leading-none">
                        {marker.temperature > 0 ? `+${marker.temperature.toFixed(1)}` : marker.temperature.toFixed(1)}°C
                      </span>
                    </div>
                  </div>

                  {/* Sunshine & Condition badge */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-700 flex items-center gap-1">
                        {markerEmoji(marker.isDaylight, marker.isClear, marker.isSunny)} {marker.conditionName}
                        {!marker.isDaylight && <span className="text-indigo-600">({t.nightLabel})</span>}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        marker.isClear ? 'bg-amber-100 text-amber-800' :
                        marker.isSunny ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {t.sunshineScore}: {marker.sunshineScore}%
                      </span>
                    </div>

                    {/* Cloud progress bar */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          marker.cloudCover <= 20 ? 'bg-amber-400' :
                          marker.cloudCover <= 50 ? 'bg-yellow-500' : 'bg-slate-400'
                        }`}
                        style={{ width: `${100 - marker.cloudCover}%` }}
                        title={`${t.cloudCover}: ${marker.cloudCover}%`}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                      <span>{t.cloudCover}: {marker.cloudCover}%</span>
                      <span>{t.sunLabel}: {100 - marker.cloudCover}%</span>
                    </div>
                  </div>

                  {/* Weather Stats grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2 rounded-lg mb-3">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Wind className="w-3.5 h-3.5 text-sky-500" />
                      <span>{t.wind}: <strong>{marker.windSpeed} m/s</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Cloud className="w-3.5 h-3.5 text-slate-500" />
                      <span>{t.cloudsLabel}: <strong>{marker.cloudCover}%</strong></span>
                    </div>
                  </div>

                  {/* Exact Coordinates */}
                  <div className="bg-slate-100 p-2 rounded-lg mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                        {t.exactCoords}
                      </div>
                      <div className="text-xs font-mono font-bold text-slate-800">
                        {marker.coordinates.latitude.toFixed(6)}°, {marker.coordinates.longitude.toFixed(6)}°
                      </div>
                    </div>
                    <button
                      onClick={() => handleCopyCoords(marker.coordinates.latitude, marker.coordinates.longitude, marker.id)}
                      className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 transition-colors"
                      title={t.copyCoords}
                      aria-label={t.copyCoords}
                    >
                      {copiedId === marker.id ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Navigation Links */}
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={marker.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="popup-btn popup-btn-google"
                    >
                      <Navigation className="w-4 h-4" />
                      <span>{t.openGoogleMaps}</span>
                    </a>
                    <a
                      href={marker.wazeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="popup-btn popup-btn-waze"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>{t.openWaze}</span>
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};
