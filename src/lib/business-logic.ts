// Business logic constants and utility functions

// Cost per kWh in IDR
export const COST_PER_KWH = parseInt(process.env.COST_PER_KWH || '1500', 10);

// Offline threshold in milliseconds (5 minutes)
export const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Check if panel is offline based on last update time
 * Panel is offline if no data received in the last 5 minutes
 */
export function isOffline(lastUpdate: Date | null | undefined): boolean {
  if (!lastUpdate) return true;
  const fiveMinutesAgo = new Date(Date.now() - OFFLINE_THRESHOLD_MS);
  return new Date(lastUpdate) < fiveMinutesAgo;
}

/**
 * Get panel status based on last update time
 */
export function getPanelStatus(lastUpdate: Date | null | undefined): 'ONLINE' | 'OFFLINE' {
  return isOffline(lastUpdate) ? 'OFFLINE' : 'ONLINE';
}

/**
 * Calculate today's energy usage
 * Today's usage = current kWh - midnight kWh
 */
export function calculateTodayUsage(currentKWh: number, midnightKWh: number): number {
  const usage = currentKWh - midnightKWh;
  return Math.max(0, parseFloat(usage.toFixed(2)));
}

/**
 * Calculate cost based on kWh usage
 * 1 kWh = Rp 1.500 (configurable via COST_PER_KWH env)
 */
export function calculateCost(kwh: number): number {
  return Math.round(kwh * COST_PER_KWH);
}

/**
 * Format currency to IDR
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get relative time string (e.g., "2m ago", "1h ago")
 */
export function getRelativeTime(date: Date | null | undefined): string {
  if (!date) return 'Never';
  
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

/**
 * Parse MQTT payload to structured energy data
 */
export interface MqttPayload {
  status: string;
  data: {
    v: number[];
    i: number[];
    kw: string;
    kVA: string;
    kWh: string;
    pf: number;
    vunbal: number;
    iunbal: number;
    time: string;
  };
}

export interface ParsedEnergyData {
  voltage: number[];
  current: number[];
  powerKW: number;
  powerKVA: number;
  energyKWh: number;
  powerFactor: number;
  voltageUnbalance: number;
  currentUnbalance: number;
  timestamp: Date;
}

/**
 * Parse and validate MQTT payload
 */
export function parseMqttPayload(payload: string): ParsedEnergyData | null {
  try {
    const parsed: MqttPayload = JSON.parse(payload);
    
    if (parsed.status !== 'OK' || !parsed.data) {
      console.warn('Invalid MQTT payload status:', parsed.status);
      return null;
    }

    const data = parsed.data;
    
    return {
      voltage: data.v || [0, 0, 0, 0],
      current: data.i || [0, 0, 0, 0],
      powerKW: parseFloat(data.kw) || 0,
      powerKVA: parseFloat(data.kVA) || 0,
      energyKWh: parseFloat(data.kWh) || 0,
      powerFactor: data.pf || 0,
      voltageUnbalance: data.vunbal || 0,
      currentUnbalance: data.iunbal || 0,
      timestamp: data.time ? new Date(data.time) : new Date(),
    };
  } catch (error) {
    console.error('Error parsing MQTT payload:', error);
    return null;
  }
}

/**
 * Extract panel code from MQTT topic
 * e.g., "DATA/PM/PANEL_LANTAI_1" -> "PANEL_LANTAI_1"
 */
export function extractPanelCode(topic: string): string | null {
  const parts = topic.split('/');
  if (parts.length >= 3 && parts[0] === 'DATA' && parts[1] === 'PM') {
    return parts[2];
  }
  return null;
}
