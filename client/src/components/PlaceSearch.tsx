import React, { useState, useEffect, useRef } from 'react';
import type { Coordinates, Language } from '../types';
import { getT } from '../translations';
import { Search, MapPin, X, Loader2 } from 'lucide-react';

interface PlaceSearchResult {
  code: string;
  name: string;
  administrativeDivision?: string;
  coordinates: Coordinates;
}

interface PlaceSearchProps {
  onSelectPlace: (place: PlaceSearchResult) => void;
  lang: Language;
}

export const PlaceSearch: React.FC<PlaceSearchProps> = ({ onSelectPlace, lang }) => {
  const t = getT(lang);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    // All state updates happen inside the async callback (debounced), never synchronously in the effect
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok && !cancelled) {
          const data: PlaceSearchResult[] = await res.json();
          setResults(data);
          setIsOpen(true);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handleSelect = (place: PlaceSearchResult) => {
    onSelectPlace(place);
    setQuery('');
    setIsOpen(false);
  };

  const showResults = isOpen && query.trim().length > 0 && results.length > 0;

  return (
    <div ref={containerRef} className="absolute top-4 left-4 z-30 w-72 sm:w-80">
      <div className="relative">
        <div className="flex items-center bg-slate-900/90 backdrop-blur-md border border-slate-700/80 focus-within:border-amber-400 rounded-xl px-3 py-2 text-white shadow-xl transition-all">
          <Search className="w-4 h-4 text-amber-400 mr-2 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchPlaceholder}
            maxLength={60}
            className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none"
          />
          {loading ? (
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
          ) : query ? (
            <button
              onClick={() => {
                setQuery('');
                setIsOpen(false);
              }}
              aria-label={t.close}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        {showResults && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
            {results.map((place) => (
              <div
                key={place.code}
                onClick={() => handleSelect(place)}
                className="px-3 py-2.5 hover:bg-slate-800/80 cursor-pointer border-b border-slate-800/50 last:border-b-0 transition-colors flex items-center justify-between gap-2"
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-100">{place.name}</h4>
                  {place.administrativeDivision && (
                    <p className="text-[10px] text-slate-400">{place.administrativeDivision}</p>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-500" />
                  <span>{place.coordinates.latitude.toFixed(2)}°, {place.coordinates.longitude.toFixed(2)}°</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
