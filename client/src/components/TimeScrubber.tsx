import React from 'react';
import type { ForecastHourOffset, Language } from '../types';
import { getT } from '../translations';
import { Clock, Radio } from 'lucide-react';

interface TimeScrubberProps {
  currentOffset: ForecastHourOffset;
  onSelectOffset: (offset: ForecastHourOffset) => void;
  lang: Language;
}

const OFFSETS: { labelLt: string; labelEn: string; value: ForecastHourOffset }[] = [
  { labelLt: 'Dabar (Gyvai)', labelEn: 'Now (Live)', value: 0 },
  { labelLt: '+1 val.', labelEn: '+1 h', value: 1 },
  { labelLt: '+2 val.', labelEn: '+2 h', value: 2 },
  { labelLt: '+3 val.', labelEn: '+3 h', value: 3 },
  { labelLt: '+6 val.', labelEn: '+6 h', value: 6 },
  { labelLt: '+12 val.', labelEn: '+12 h', value: 12 },
  { labelLt: 'Rytoj', labelEn: 'Tomorrow', value: 24 }
];

export const TimeScrubber: React.FC<TimeScrubberProps> = ({
  currentOffset,
  onSelectOffset,
  lang
}) => {
  const t = getT(lang);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-2xl w-[92%] sm:w-auto">
      <div className="bg-slate-900/90 backdrop-blur-md border border-amber-500/30 rounded-2xl p-1.5 shadow-2xl flex items-center gap-1 overflow-x-auto scrollbar-none">
        <div className="px-2.5 py-1 text-slate-400 flex items-center gap-1.5 text-xs font-semibold shrink-0">
          {currentOffset === 0 ? (
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          ) : (
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span className="hidden sm:inline">{t.timeSliderTitle}:</span>
        </div>

        {OFFSETS.map((item) => {
          const isActive = currentOffset === item.value;
          return (
            <button
              key={item.value}
              onClick={() => onSelectOffset(item.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-md shadow-amber-500/25 scale-105'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <span>{lang === 'lt' ? item.labelLt : item.labelEn}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
