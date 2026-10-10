import { useState, useEffect, useCallback } from 'react';
import type {
  SunnySummaryResponse,
  Coordinates,
  FilterMode,
  ForecastHourOffset,
  Language
} from './types';
import { Navbar } from './components/Navbar';
import { MapComponent } from './components/MapComponent';
import { SunRankingsDrawer } from './components/SunRankingsDrawer';
import { TimeScrubber } from './components/TimeScrubber';
import { NearestSunModal } from './components/NearestSunModal';
import { PlaceSearch } from './components/PlaceSearch';
import { getT } from './translations';
import { ShieldCheck, Loader2, CloudOff, RefreshCw } from 'lucide-react';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const RETRY_WHEN_EMPTY_MS = 15 * 1000;

export function App() {
  const [summary, setSummary] = useState<SunnySummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [lang, setLang] = useState<Language>('lt');
  const [selectedLocation, setSelectedLocation] = useState<Coordinates | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all-sun');
  const [hourOffset, setHourOffset] = useState<ForecastHourOffset>(0);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [nearestModalOpen, setNearestModalOpen] = useState<boolean>(false);

  const t = getT(lang);

  // Never sets state synchronously: all updates happen after the awaited request
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/sunny-summary');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SunnySummaryResponse = await res.json();
      setSummary(data);
      setError(false);
    } catch (err) {
      console.error('Failed to fetch summary:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const interval = setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [load]);

  // While we have nothing to show, retry quickly instead of waiting for the next 5-minute tick
  useEffect(() => {
    if (!error || summary) return;
    const timer = setTimeout(() => void load(), RETRY_WHEN_EMPTY_MS);
    return () => clearTimeout(timer);
  }, [error, summary, load]);

  const refresh = () => {
    setLoading(true);
    void load();
  };

  const handleSelectLocation = (coords: Coordinates) => {
    setSelectedLocation(coords);
  };

  const showInitialLoading = !summary && loading;
  const showFatalError = !summary && !loading && error;
  const showStaleBanner = !!summary && error;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* Top Navbar */}
      <Navbar
        summary={summary}
        loading={loading}
        lang={lang}
        onLanguageChange={setLang}
        onFindNearestSun={() => setNearestModalOpen(true)}
        onRefresh={refresh}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        sidebarOpen={sidebarOpen}
      />

      {/* Main Map Content Area */}
      <main className="relative flex-1 w-full h-full overflow-hidden flex">
        {/* Search Input Floating on Map */}
        <PlaceSearch
          onSelectPlace={(place) => {
            setSelectedLocation(place.coordinates);
          }}
          lang={lang}
        />

        {/* Interactive Leaflet Map */}
        <MapComponent
          stations={summary?.stations || []}
          majorCities={summary?.majorCities || []}
          selectedLocation={selectedLocation}
          filterMode={filterMode}
          hourOffset={hourOffset}
          lang={lang}
        />

        {/* Bottom Forecast Time Slider */}
        <TimeScrubber
          currentOffset={hourOffset}
          onSelectOffset={setHourOffset}
          lang={lang}
        />

        {/* Sun Rankings Sidebar / Drawer */}
        <SunRankingsDrawer
          stations={summary?.stations || []}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onSelectLocation={handleSelectLocation}
          filterMode={filterMode}
          onFilterChange={setFilterMode}
          lang={lang}
        />

        {/* Nearest Sun Finder Modal */}
        <NearestSunModal
          open={nearestModalOpen}
          onClose={() => setNearestModalOpen(false)}
          onNavigateToMap={handleSelectLocation}
          lang={lang}
        />

        {/* Initial loading state */}
        {showInitialLoading && (
          <div
            role="status"
            className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm pointer-events-none"
          >
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/95 border border-amber-500/30 text-slate-100 shadow-2xl">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
              <span className="text-sm font-medium">{t.loadingData}</span>
            </div>
          </div>
        )}

        {/* Fatal error: nothing to show yet */}
        {showFatalError && (
          <div role="alert" className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
            <div className="max-w-sm w-full text-center p-6 rounded-2xl bg-slate-900/95 border border-rose-500/30 text-slate-100 shadow-2xl">
              <CloudOff className="w-10 h-10 text-rose-400 mx-auto mb-3" />
              <h2 className="font-bold text-base mb-1">{t.errorTitle}</h2>
              <p className="text-xs text-slate-400 mb-4">{t.errorBody}</p>
              <button
                onClick={refresh}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {t.retry}
              </button>
            </div>
          </div>
        )}

        {/* Soft warning: refresh failed but we still have older data */}
        {showStaleBanner && (
          <div
            role="status"
            className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs backdrop-blur-md"
          >
            {t.staleData}
          </div>
        )}

        {/* Footer data disclaimer badge */}
        <div className="absolute bottom-1 right-2 z-20 pointer-events-none hidden md:block">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 backdrop-blur-sm">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>{t.officialDataSource}</span>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
