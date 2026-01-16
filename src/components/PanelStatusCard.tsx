'use client';

import { formatRupiah } from '@/lib/business-logic';

interface PanelData {
  pmCode: string;
  location: string;
  floor: number;
  panelStatus: 'ONLINE' | 'OFFLINE';
  lastUpdateRelative: string;
  v: number[];
  i: number[];
  kw: string;
  kVA: string;
  kWh: string;
  pf: number;
  vunbal: number;
  iunbal: number;
  time: string | null;
}

interface PanelStatusCardProps {
  panel: PanelData;
  todayUsageKWh?: number;
  todayCost?: number;
}

export default function PanelStatusCard({ panel, todayUsageKWh = 0, todayCost = 0 }: PanelStatusCardProps) {
  const isOnline = panel.panelStatus === 'ONLINE';
  
  // Calculate average voltage and current for display
  const avgVoltage = panel.v.slice(0, 3).filter(v => v > 0);
  const displayVoltage = avgVoltage.length > 0 
    ? (avgVoltage.reduce((a, b) => a + b, 0) / avgVoltage.length).toFixed(1)
    : '---';
  
  const avgCurrent = panel.i.filter(i => i > 0);
  const displayCurrent = avgCurrent.length > 0
    ? avgCurrent.reduce((a, b) => a + b, 0).toFixed(2)
    : '---';

  const powerKW = parseFloat(panel.kw) || 0;
  const powerKVA = parseFloat(panel.kVA) || 0;
  const energyKWh = parseFloat(panel.kWh) || 0;

  return (
    <div className={`glass-card p-6 transition-all duration-300 hover:scale-[1.02] ${
      isOnline ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-slate-600'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Lantai {panel.floor}
          </h3>
          <p className="text-xs text-slate-400">{panel.location}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`status-indicator ${isOnline ? 'online' : 'offline'}`}></span>
          <span className={`text-sm font-medium ${isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
            {panel.panelStatus}
          </span>
        </div>
      </div>

      {/* Last update */}
      <p className="text-xs text-slate-500 mb-4">
        {isOnline ? `Updated ${panel.lastUpdateRelative}` : 'No recent data'}
      </p>

      {/* Today's Usage - Highlighted Section */}
      <div className="bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-lg p-4 mb-4 border border-emerald-500/30">
        <p className="text-xs text-slate-300 mb-1">Today&apos;s Usage</p>
        <div className="flex items-center justify-between">
          <p className="text-2xl font-bold text-white">
            {todayUsageKWh.toFixed(2)} <span className="text-sm font-normal text-slate-400">kWh</span>
          </p>
          <p className="text-lg font-semibold text-emerald-400">
            {formatRupiah(todayCost)}
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Voltage */}
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Voltage</p>
          <p className={`text-lg font-bold ${isOnline ? 'text-blue-400' : 'text-slate-600'}`}>
            {displayVoltage}
            <span className="text-xs font-normal text-slate-500 ml-1">V</span>
          </p>
        </div>

        {/* Current */}
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Current</p>
          <p className={`text-lg font-bold ${isOnline ? 'text-amber-400' : 'text-slate-600'}`}>
            {displayCurrent}
            <span className="text-xs font-normal text-slate-500 ml-1">A</span>
          </p>
        </div>

        {/* Power */}
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Power</p>
          <p className={`text-lg font-bold ${isOnline ? 'text-purple-400' : 'text-slate-600'}`}>
            {isOnline ? powerKW.toFixed(2) : '---'}
            <span className="text-xs font-normal text-slate-500 ml-1">kW</span>
          </p>
        </div>

        {/* Total Energy */}
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Total Energy</p>
          <p className={`text-lg font-bold ${isOnline ? 'text-cyan-400' : 'text-slate-600'}`}>
            {isOnline ? energyKWh.toFixed(2) : '---'}
            <span className="text-xs font-normal text-slate-500 ml-1">kWh</span>
          </p>
        </div>
      </div>

      {/* Power Factor & kVA (smaller) */}
      <div className="mt-3 flex justify-between text-xs text-slate-500">
        <span>PF: {isOnline ? panel.pf.toFixed(2) : '---'}</span>
        <span>kVA: {isOnline ? powerKVA.toFixed(2) : '---'}</span>
      </div>
    </div>
  );
}
