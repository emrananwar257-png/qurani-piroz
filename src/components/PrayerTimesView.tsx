import React from 'react';
import { Compass, Clock, MapPin, Loader2 } from 'lucide-react';
import { CityPrayerData } from '../types';

interface PrayerTimesViewProps {
  cities: CityPrayerData[];
  selectedCity: string;
  onSelectCity: (id: string) => void;
  prayerTimes: any;
  loadingPrayer: boolean;
}

export const PrayerTimesView: React.FC<PrayerTimesViewProps> = ({
  cities,
  selectedCity,
  onSelectCity,
  prayerTimes,
  loadingPrayer
}) => {
  const currentCityObj = cities.find(c => c.id === selectedCity) || cities[0];

  return (
    <div className="space-y-5 max-w-xl mx-auto p-4 select-none">
      {/* هەڵبژاردنی شار */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-amber-700" />
          <div>
            <h3 className="font-bold text-sm text-slate-900">شاری هەڵبژێردراو:</h3>
            <p className="text-[10px] text-slate-500">کاتەکانی بانگ بەپێی کاتی عێراق و کوردستان</p>
          </div>
        </div>
        <select
          value={selectedCity}
          onChange={(e) => onSelectCity(e.target.value)}
          className="bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
        >
          {cities.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* کارتی کاتەکانی بانگ */}
      {loadingPrayer || !prayerTimes ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 mx-auto text-amber-700 animate-spin" />
          <p className="text-xs text-slate-500 pt-2">کاتەکانی بانگ باردەکرێن...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[
            { name: 'بەیانی (الفجر)', time: prayerTimes.Fajr },
            { name: 'ڕۆژهەڵاتن (الشروق)', time: prayerTimes.Sunrise },
            { name: 'نیوەڕۆ (الظهر)', time: prayerTimes.Dhuhr },
            { name: 'عەسر (العصر)', time: prayerTimes.Asr },
            { name: 'مەغریب (المغرب)', time: prayerTimes.Maghrib },
            { name: 'عیشا (العشاء)', time: prayerTimes.Isha }
          ].map((p, idx) => (
            <div key={idx} className="p-4 rounded-3xl bg-white border border-slate-200 text-center space-y-1 shadow-xs">
              <span className="text-xs text-slate-500 block font-medium">{p.name}</span>
              <span className="text-lg font-bold text-slate-900 font-mono tracking-wider">{p.time}</span>
            </div>
          ))}
        </div>
      )}

      {/* قیبلەنما */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 text-center space-y-3 shadow-xs">
        <div className="flex items-center justify-center gap-2 text-slate-900 font-bold text-sm">
          <Compass className="w-5 h-5 text-amber-700 animate-pulse" />
          <span>قیبلەنمای کەعبەی پیرۆز</span>
        </div>

        <div className="relative w-32 h-32 mx-auto rounded-full border-4 border-slate-200 flex items-center justify-center bg-slate-50 shadow-inner">
          <div 
            className="w-1.5 h-14 bg-amber-600 rounded-full transform origin-bottom transition-transform duration-700"
            style={{ transform: `rotate(${currentCityObj.qiblaAngle}deg)` }}
          />
          <span className="absolute top-1.5 text-[10px] text-slate-400 font-bold">N</span>
          <span className="absolute bottom-1.5 text-[10px] text-amber-800 font-bold">قیبلە</span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          ئاڕاستەی قیبلە بۆ شاری <strong>{currentCityObj.name}</strong> بریتییە لە <strong>{currentCityObj.qiblaAngle}° پلە</strong> بەرەو باشووری ڕۆژئاوا.
        </p>
      </div>
    </div>
  );
};
