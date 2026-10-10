import React, { useState, useEffect } from 'react';
import type { NearestSunResponse, Coordinates, Language } from '../types';
import { getT } from '../translations';
import { Navigation, X, ExternalLink, Clock, MapPin, Loader2, AlertCircle, Sun } from 'lucide-react';

interface NearestSunModalProps {
  open: boolean;
  onClose: () => void;
  onNavigateToMap: (coords: Coordinates) => void;
  lang: Language;
}

const VILNIUS: Coordinates = { latitude: 54.6872, longitude: 25.2797 };

/** Outer shell: the content is only mounted while open, so state resets naturally on every open. */
export const NearestSunModal: React.FC<NearestSunModalProps> = (props) => {
  if (!props.open) return null;
  return <NearestSunContent {...props} />;
};

const NearestSunContent: React.FC<NearestSunModalProps> = ({ onClose, onNavigateToMap, lang }) => {
  const t = getT(lang);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [data, setData] = useState<NearestSunResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchNearest = async (coords: Coordinates) => {
      try {
        const res = await fetch(`/api/nearest-sun?lat=${coords.latitude}&lon=${coords.longitude}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: NearestSunResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        console.error('Nearest sun request failed:', e);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (!navigator.geolocation) {
      // No geolocation support: fall back to the centre of Vilnius
      void fetchNearest(VILNIUS);
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => void fetchNearest({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => void fetchNearest(VILNIUS), // permission denied / unavailable
        { timeout: 7000 }
      );
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const station = data?.nearestSunnyStation ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.nearestSunTitle}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-md w-full p-5 text-white shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label={t.close}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Sun className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-100">{t.nearestSunTitle}</h3>
            <p className="text-xs text-slate-400">{t.nearestSunSubtitle}</p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <p className="text-sm text-slate-300 font-medium">{t.locating}</p>
          </div>
        ) : error || !station ? (
          <div className="py-8 text-center text-rose-400 flex flex-col items-center gap-2">
            <AlertCircle className="w-8 h-8" />
            <p className="text-sm font-semibold">{t.locationError}</p>
          </div>
        ) : (
          <div>
            {data?.noSunnyNow && (
              <div className="mb-3 p-2.5 rounded-lg bg-indigo-500/15 border border-indigo-400/30 text-xs text-indigo-100">
                {t.noSunnyFound}
              </div>
            )}

            {/* Highlight card */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/15 via-slate-800 to-slate-800/80 border border-amber-400/30 mb-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
                    {t.nearestPoint}
                  </span>
                  <h4 className="text-xl font-black text-white">{station.stationName}</h4>
                  <div className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      {station.coordinates.latitude.toFixed(4)}°, {station.coordinates.longitude.toFixed(4)}°
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-amber-400">
                    {station.airTemperature > 0 ? '+' : ''}
                    {Math.round(station.airTemperature)}°C
                  </div>
                  <span className="text-xs font-medium text-slate-300">
                    {lang === 'lt' ? station.conditionNameLt : station.conditionNameEn}
                  </span>
                </div>
              </div>

              {/* Stats badges */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-700/60">
                <div className="bg-slate-900/60 p-2.5 rounded-lg">
                  <div className="text-[11px] text-slate-400">{t.distanceAway}</div>
                  <div className="text-base font-extrabold text-white">{data?.distanceKm} km</div>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-lg">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>{t.drivingEst}</span>
                  </div>
                  <div className="text-base font-extrabold text-amber-300">
                    ~{data?.drivingEtaMinutesEstimate} {t.minutesShort}
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              <button
                onClick={() => {
                  onNavigateToMap(station.coordinates);
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <Navigation className="w-4 h-4 fill-slate-950" />
                <span>{t.viewOnMap}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={station.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{t.openGoogleMaps}</span>
                </a>
                <a
                  href={station.wazeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t.openWaze}</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
