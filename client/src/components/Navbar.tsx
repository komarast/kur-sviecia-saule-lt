import React from 'react';
import { Sun, Navigation, RefreshCw, Compass, Globe } from 'lucide-react';
import type { Language, SunnySummaryResponse } from '../types';
import { getT } from '../translations';

interface NavbarProps {
  summary: SunnySummaryResponse | null;
  loading: boolean;
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  onFindNearestSun: () => void;
  onRefresh: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  summary,
  loading,
  lang,
  onLanguageChange,
  onFindNearestSun,
  onRefresh,
  onToggleSidebar,
  sidebarOpen
}) => {
  const t = getT(lang);

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-amber-500/20 text-white px-4 py-3 sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Logo and title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/30 animate-pulse">
            <Sun className="w-6 h-6 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight bg-gradient-to-r from-amber-300 via-yellow-200 to-white bg-clip-text text-transparent flex items-center gap-2">
              {t.appTitle}
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">
              {t.appSubtitle}
            </p>
          </div>
        </div>

        {/* Live status badge */}
        {summary && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-amber-500/30 text-xs">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="text-slate-300">
              <strong className="text-amber-400 font-semibold">{summary.sunnyStationsCount}</strong> / {summary.totalStations} {t.liveStatTitle}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Find nearest sun */}
          <button
            onClick={onFindNearestSun}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-semibold text-xs md:text-sm shadow-md shadow-amber-500/20 active:scale-95 transition-all"
            title={t.findNearestSun}
          >
            <Navigation className="w-4 h-4 fill-slate-950" />
            <span>{t.findNearestSun}</span>
          </button>

          {/* Top sunny drawer toggle */}
          <button
            onClick={onToggleSidebar}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs md:text-sm font-medium transition-all ${
              sidebarOpen
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span className="hidden sm:inline">{t.topSunnyTitle}</span>
          </button>

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800/80 border border-slate-700 hover:bg-slate-700 text-slate-300 transition-all disabled:opacity-50"
            title={t.refresh}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          {/* Language selector */}
          <button
            onClick={() => onLanguageChange(lang === 'lt' ? 'en' : 'lt')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-all uppercase"
            title="Language"
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>{lang}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
