'use client';

import { useState, useEffect } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type TimeRange = '1h' | '6h' | '12h' | '24h' | '7d' | '30d' | '1y';

interface PanelData {
  pmCode: string;
}

interface EnergyChartProps {
  panels: PanelData[];
}

interface ChartDataPoint {
  index: number;
  label: string;
  [key: string]: number | string;
}

export default function EnergyChart({ panels }: EnergyChartProps) {
  const [range, setRange] = useState<TimeRange>('24h');
  const [selectedPanel, setSelectedPanel] = useState<string>('all');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const rangeOptions: { value: TimeRange; label: string }[] = [
    { value: '1h', label: '1H' },
    { value: '6h', label: '6H' },
    { value: '12h', label: '12H' },
    { value: '24h', label: '24H' },
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
    { value: '1y', label: '1Y' },
  ];

  useEffect(() => {
    const fetchChartData = async () => {
      console.log('EnergyChart panels:', panels);
      if (panels.length === 0) {
        console.log('No panels available');
        return;
      }
      
      setLoading(true);
      try {
        // Use range directly - API now supports 1y
        const apiRange = range;

        if (selectedPanel === 'all') {
          // Fetch data for all panels and combine totals
          const allPanelData: { energy: number[]; cost: number[] }[] = [];
          
          for (const panel of panels) {
            const res = await fetch(`/api/v1/panels/history/${panel.pmCode}?range=${apiRange}`);
            const data = await res.json();
            
            if (data.status === 'OK' && data.data.energy) {
              allPanelData.push({
                energy: data.data.energy,
                cost: data.data.cost,
              });
            }
          }

          // Find max length
          const maxLen = Math.max(...allPanelData.map(d => d.energy.length));
          
          // Combine data - sum all panels for each time point
          const combinedData: ChartDataPoint[] = [];
          for (let i = 0; i < maxLen; i++) {
            let totalEnergy = 0;
            let totalCost = 0;
            
            for (const panelData of allPanelData) {
              totalEnergy += panelData.energy[i] || 0;
              totalCost += panelData.cost[i] || 0;
            }
            
            combinedData.push({
              index: i,
              label: getLabel(i, range, maxLen),
              energy_total: parseFloat(totalEnergy.toFixed(3)),
              cost_total: totalCost,
            });
          }
          
          setChartData(combinedData);
        } else {
          // Fetch data for single panel
          const res = await fetch(`/api/v1/panels/history/${selectedPanel}?range=${apiRange}`);
          const data = await res.json();

          if (data.status === 'OK' && data.data.energy) {
            const singlePanelData: ChartDataPoint[] = data.data.energy.map((energy: number, index: number) => ({
              index,
              label: getLabel(index, range, data.data.energy.length),
              [`energy_${selectedPanel}`]: energy,
              [`cost_${selectedPanel}`]: data.data.cost[index] || 0,
            }));
            setChartData(singlePanelData);
          } else {
            setChartData([]);
          }
        }
      } catch (error) {
        console.error('Error fetching chart data:', error);
        setChartData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [panels, range, selectedPanel]);

  // Generate labels based on range and actual time
  const getLabel = (index: number, range: TimeRange, total: number): string => {
    const now = new Date();
    
    if (range === '1y') {
      // Monthly labels for yearly view
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const startMonth = now.getMonth() - total + 1 + index;
      const adjustedMonth = ((startMonth % 12) + 12) % 12;
      return months[adjustedMonth];
    } else if (range === '30d') {
      // Day of month - oldest first
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 29); // 30 days ago
      startDate.setDate(startDate.getDate() + index);
      return `${startDate.getDate()}/${startDate.getMonth() + 1}`;
    } else if (range === '7d') {
      // Show day of week
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6); // 7 days ago
      const hoursOffset = index * 6; // 6h aggregation
      startDate.setHours(startDate.getHours() + hoursOffset);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return days[startDate.getDay()];
    } else {
      // Hourly labels - calculate from range start
      // Get range in hours
      const rangeHours = parseInt(range.replace('h', '')) || 24;
      const startHour = new Date(now);
      startHour.setHours(startHour.getHours() - rangeHours + index);
      return `${startHour.getHours().toString().padStart(2, '0')}:00`;
    }
  };

  const panelColors: Record<string, { bar: string; line: string }> = {
    PANEL_LANTAI_1: { bar: '#3b82f6', line: '#60a5fa' },
    PANEL_LANTAI_2: { bar: '#8b5cf6', line: '#a78bfa' },
    PANEL_LANTAI_3: { bar: '#10b981', line: '#34d399' },
    total: { bar: '#f59e0b', line: '#fbbf24' }, // For combined view
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        {/* Panel selector */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedPanel('all')}
            className={`btn-secondary text-sm ${selectedPanel === 'all' ? 'active' : ''}`}
          >
            All Panels
          </button>
          {panels.map((panel) => (
            <button
              key={panel.pmCode}
              onClick={() => setSelectedPanel(panel.pmCode)}
              className={`btn-secondary text-sm ${selectedPanel === panel.pmCode ? 'active' : ''}`}
            >
              Lantai {panel.pmCode.split('_')[2]}
            </button>
          ))}
        </div>

        {/* Time range selector */}
        <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg">
          {rangeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setRange(option.value)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                range === option.value
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-400">Loading chart data...</div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-slate-400 mb-2">No data available</p>
              <p className="text-sm text-slate-500">
                Start the MQTT listener to receive sensor data
              </p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
              />
              <YAxis
                yAxisId="left"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                label={{ value: 'kWh', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                label={{ value: 'Cost (IDR)', angle: 90, position: 'insideRight', fill: '#94a3b8' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#f1f5f9' }}
                formatter={(value: number, name: string) => {
                  const isEnergy = name.includes('energy');
                  if (selectedPanel === 'all') {
                    return [
                      isEnergy ? `${value.toFixed(3)} kWh` : `Rp ${value.toLocaleString('id-ID')}`,
                      isEnergy ? 'Total Energy' : 'Total Cost',
                    ];
                  } else {
                    const panelNum = name.split('_')[2];
                    return [
                      isEnergy ? `${value.toFixed(3)} kWh` : `Rp ${value.toLocaleString('id-ID')}`,
                      `Lantai ${panelNum} ${isEnergy ? 'Energy' : 'Cost'}`,
                    ];
                  }
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value: string) => {
                  if (selectedPanel === 'all') {
                    return value.includes('energy') ? 'Total Energy' : 'Total Cost';
                  }
                  const parts = value.split('_');
                  const type = parts[0] === 'energy' ? 'Energy' : 'Cost';
                  return `Lantai ${parts[2]} ${type}`;
                }}
              />
              
              {selectedPanel === 'all' ? (
                // Combined view - show total energy and cost
                <>
                  <Bar
                    yAxisId="left"
                    dataKey="energy_total"
                    fill={panelColors.total.bar}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={30}
                    name="energy_total"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cost_total"
                    stroke={panelColors.total.line}
                    strokeWidth={2}
                    dot={false}
                    name="cost_total"
                  />
                </>
              ) : (
                // Single panel view
                <>
                  <Bar
                    yAxisId="left"
                    dataKey={`energy_${selectedPanel}`}
                    fill={panelColors[selectedPanel]?.bar || '#3b82f6'}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={30}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey={`cost_${selectedPanel}`}
                    stroke={panelColors[selectedPanel]?.line || '#60a5fa'}
                    strokeWidth={2}
                    dot={false}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend explanation */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className={`w-4 h-3 rounded ${selectedPanel === 'all' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
          <span>Bar = {selectedPanel === 'all' ? 'Total' : ''} Energy (kWh)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-6 h-0.5 ${selectedPanel === 'all' ? 'bg-amber-400' : 'bg-blue-400'}`}></div>
          <span>Line = {selectedPanel === 'all' ? 'Total' : ''} Cost (IDR)</span>
        </div>
      </div>
    </div>
  );
}
