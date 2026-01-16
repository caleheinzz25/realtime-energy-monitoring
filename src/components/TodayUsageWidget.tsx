'use client';

import { formatRupiah } from '@/lib/business-logic';

interface TodayUsageWidgetProps {
  panelCode: string;
  location: string;
  floor: number;
  todayKWh: number;
  todayCost: number;
}

export default function TodayUsageWidget({
  location,
  floor,
  todayKWh,
  todayCost,
}: TodayUsageWidgetProps) {
  // Determine color based on usage level
  const getUsageColor = (kwh: number) => {
    if (kwh === 0) return 'text-slate-500';
    if (kwh < 10) return 'text-emerald-400';
    if (kwh < 30) return 'text-amber-400';
    return 'text-orange-400';
  };

  return (
    <div className="flex items-center justify-between py-3 px-4 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors">
      {/* Panel info */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <span className="text-white font-bold">{floor}</span>
        </div>
        <div>
          <p className="font-medium text-white">{location}</p>
          <p className="text-xs text-slate-400">Floor {floor}</p>
        </div>
      </div>

      {/* Usage stats */}
      <div className="text-right">
        <p className={`text-lg font-bold ${getUsageColor(todayKWh)}`}>
          {todayKWh.toFixed(2)} kWh
        </p>
        <p className="text-sm text-emerald-400">
          {formatRupiah(todayCost)}
        </p>
      </div>
    </div>
  );
}
