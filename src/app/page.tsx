'use client';

import { useState, useEffect, useCallback } from 'react';
import PanelStatusCard from '@/components/PanelStatusCard';
import EnergyChart from '@/components/EnergyChart';
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

interface TodayUsage {
  panelCode: string;
  todayUsageKWh: number;
  todayCost: number;
}

export default function Dashboard() {
  const [panels, setPanels] = useState<PanelData[]>([]);
  const [todayUsages, setTodayUsages] = useState<TodayUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [mqttStatus, setMqttStatus] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    try {
      // Fetch realtime panel data
      const realtimeRes = await fetch('/api/v1/panels/realtime');
      const realtimeData = await realtimeRes.json();

      if (realtimeData.status === 'OK') {
        // panels is now flat array directly
        const panelList = realtimeData.data.panels;
        setPanels(panelList);

        // Fetch today's usage for each panel
        const usagePromises = panelList.map(async (panel: PanelData) => {
          const res = await fetch(`/api/v1/panels/usage/today/${panel.pmCode}`);
          const data = await res.json();
          return {
            panelCode: panel.pmCode,
            todayUsageKWh: data.data?.todayUsageKWh || 0,
            todayCost: data.data?.todayCost || 0,
          };
        });

        const usages = await Promise.all(usagePromises);
        setTodayUsages(usages);
      } else {
        setError(realtimeData.message || 'Failed to fetch data');
      }

      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkMqttStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/mqtt/start');
      const data = await res.json();
      setMqttStatus(data.connected);
    } catch {
      setMqttStatus(false);
    }
  }, []);

  const startMqtt = async () => {
    try {
      await fetch('/api/mqtt/start', { method: 'POST' });
      await checkMqttStatus();
    } catch (err) {
      console.error('Error starting MQTT:', err);
    }
  };

  // Initial fetch and MQTT check
  useEffect(() => {
    fetchData();
    checkMqttStatus();
  }, [fetchData, checkMqttStatus]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
      checkMqttStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchData, checkMqttStatus]);

  // Calculate totals
  const totalKWh = todayUsages.reduce((sum, u) => sum + u.todayUsageKWh, 0);
  const totalCost = todayUsages.reduce((sum, u) => sum + u.todayCost, 0);

  // Helper to get usage for a panel
  const getUsage = (pmCode: string) => {
    return todayUsages.find((u) => u.panelCode === pmCode);
  };

  return (
    <main className="min-h-screen p-6 md:p-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">
              Energy Monitoring
            </h1>
            <p className="text-slate-400">
              Ravelware Office • Real-time Dashboard
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className={`status-indicator ${mqttStatus ? 'online' : 'offline'}`}></span>
              <span className="text-slate-400">MQTT: {mqttStatus ? 'Connected' : 'Disconnected'}</span>
            </div>
            {!mqttStatus && (
              <button onClick={startMqtt} className="btn-primary text-sm">
                Start MQTT
              </button>
            )}
            <button onClick={fetchData} className="btn-secondary text-sm">
              Refresh
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Last updated: {lastRefresh.toLocaleTimeString('id-ID')} • Auto-refresh: 30s
        </p>
      </header>

      {/* Error message */}
      {error && (
        <div className="glass-card p-4 mb-6 border-l-4 border-red-500 bg-red-500/10">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Panel Status Cards with Today's Usage */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-300">Panel Status</h2>
          {/* Building Total Summary */}
          {!loading && (
            <div className="glass-card px-4 py-2 flex items-center gap-4">
              <span className="text-sm text-slate-400">Building Total:</span>
              <span className="text-lg font-bold text-white">{totalKWh.toFixed(2)} kWh</span>
              <span className="text-lg font-semibold text-emerald-400">{formatRupiah(totalCost)}</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card p-6 h-72">
                  <div className="skeleton h-6 w-32 mb-4"></div>
                  <div className="skeleton h-4 w-24 mb-6"></div>
                  <div className="skeleton h-16 w-full mb-4"></div>
                  <div className="skeleton h-8 w-full mb-2"></div>
                  <div className="skeleton h-8 w-full"></div>
                </div>
              ))}
            </>
          ) : (
            panels.map((panel) => {
              const usage = getUsage(panel.pmCode);
              return (
                <PanelStatusCard
                  key={panel.pmCode}
                  panel={panel}
                  todayUsageKWh={usage?.todayUsageKWh || 0}
                  todayCost={usage?.todayCost || 0}
                />
              );
            })
          )}
        </div>
      </section>

      {/* Energy Chart */}
      <section>
        <h2 className="text-xl font-semibold text-slate-300 mb-4">Energy Usage Chart</h2>
        <div className="glass-card p-6">
          <EnergyChart panels={panels} />
        </div>
      </section>
    </main>
  );
}
