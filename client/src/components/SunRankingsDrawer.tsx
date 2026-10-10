import React from 'react';
import type { StationObservation, Coordinates, FilterMode, Language } from '../types';
import { getT } from '../translations';
import { Sun, MapPin, X, CloudSun } from 'lucide-react';

interface SunRankingsDrawerProps {
  stations: StationObservation[];
  open: boolean;
  onClose: () => void;
  onSelectLocation: (coords: Coordinates) => void;
  filterMode: FilterMode;
  onFilterChange: (mode: FilterMode) => void;
  lang: Language;
}

export const SunRankingsDrawer: React.FC<SunRankingsDrawerProps> = ({
  stations,
  open,
  onClose,
  onSelectLocation,
  filterMode,
  onFilterChange,
  lang
}) => {
  const t = getT(lang);

  const filteredStations = React.useMemo(() => {
    if (filterMode === 'clear-only') {
      return stations.filter((s) => s.isClear);
    }
    if (filterMode === 'all-sun') {
      return stations.filter((s) => s.isSunny);
    }
    return stations;
  }, [stations, filterMode]);

  if (!open) return null;

  return (
    <div className="absolute top-0 right-0 h-full w-full sm:w-96 bg-slate-900/95 backdrop-blur-xl border-l border-amber-500/20 text-white z-40 flex flex-col shadow-2xl transition-all animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm sm:text-base text-slate-100">{t.topSunnyTitle}</h2>
            <p className="text-xs text-slate-400">{filteredStations.length} {t.placesCount}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label={t.close}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-1.5 p-1 bg-slate-800/60 rounded-xl text-xs font-semibold">
          <button
            onClick={() => onFilterChange('all-sun')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-all ${
              filterMode === 'all-sun'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.filterAllSun}
          </button>
          <button
            onClick={() => onFilterChange('clear-only')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-all ${
              filterMode === 'clear-only'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.filterClearOnly}
          </button>
          <button
            onClick={() => onFilterChange('all-stations')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-all ${
              filterMode === 'all-stations'
                ? 'bg-slate-700 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.filterAllStations}
          </button>
        </div>
      </div>

      {/* Stations list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredStations.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-400">
            <CloudSun className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">{t.noResultsTitle}</p>
            <p className="text-xs text-slate-500 mt-1">{t.noResultsHint}</p>
          </div>
        ) : (
          filteredStations.map((st, index) => (
            <div
              key={st.stationCode}
              onClick={() => onSelectLocation(st.coordinates)}
              className="group p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-amber-500/50 transition-all cursor-pointer shadow-sm hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                    index < 3
                      ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-400/40'
                      : 'bg-slate-700 text-slate-300'
                  }`}>
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100 group-hover:text-amber-300 transition-colors">
                      {st.stationName}
                    </h3>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                      <span>{st.coordinates.latitude.toFixed(4)}°, {st.coordinates.longitude.toFixed(4)}°</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-extrabold text-amber-400">
                    {st.airTemperature > 0 ? `+${st.airTemperature.toFixed(1)}` : st.airTemperature.toFixed(1)}°C
                  </span>
                  <div className="text-[10px] text-slate-400">
                    {t.sunshineScore}: <strong className="text-slate-200">{st.sunshineScore}%</strong>
                  </div>
                </div>
              </div>

              {/* Progress bar and cloud status */}
              <div className="mt-2.5 pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1 text-[11px]">
                  {!st.isDaylight ? '🌙' : st.isClear ? '☀️' : st.isSunny ? '🌤️' : '☁️'}
                  <span>{lang === 'lt' ? st.conditionNameLt : st.conditionNameEn}</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {t.cloudCover}: <strong className="text-slate-300">{st.cloudCover}%</strong>
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

