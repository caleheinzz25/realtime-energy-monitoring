import { InfluxDB, Point, WriteApi, QueryApi } from '@influxdata/influxdb-client';

const url = process.env.INFLUX_URL || 'http://localhost:8086';
const token = process.env.INFLUX_TOKEN || '';
const org = process.env.INFLUX_ORG || 'ravelware';
const bucket = process.env.INFLUX_BUCKET || 'energy';

// Create InfluxDB client
const influxDB = new InfluxDB({ url, token });

// Write API
let writeApi: WriteApi | null = null;

export function getWriteApi(): WriteApi {
  if (!writeApi) {
    writeApi = influxDB.getWriteApi(org, bucket, 'ns');
  }
  return writeApi;
}

// Query API
export function getQueryApi(): QueryApi {
  return influxDB.getQueryApi(org);
}

// Energy data interface
export interface EnergyData {
  panelId: string;
  voltage: number[];
  current: number[];
  powerKW: number;
  powerKVA: number;
  energyKWh: number;
  powerFactor: number;
  voltageUnbalance: number;
  currentUnbalance: number;
  timestamp?: Date;
}

// Write energy data to InfluxDB
export async function writeEnergyData(data: EnergyData): Promise<void> {
  const writeApi = getWriteApi();
  
  const point = new Point('energy_data')
    .tag('panelId', data.panelId)
    .floatField('voltage_r', data.voltage[0] || 0)
    .floatField('voltage_s', data.voltage[1] || 0)
    .floatField('voltage_t', data.voltage[2] || 0)
    .floatField('voltage_n', data.voltage[3] || 0)
    .floatField('current_r', data.current[0] || 0)
    .floatField('current_s', data.current[1] || 0)
    .floatField('current_t', data.current[2] || 0)
    .floatField('current_n', data.current[3] || 0)
    .floatField('powerKW', data.powerKW)
    .floatField('powerKVA', data.powerKVA)
    .floatField('energyKWh', data.energyKWh)
    .floatField('powerFactor', data.powerFactor)
    .floatField('voltageUnbalance', data.voltageUnbalance)
    .floatField('currentUnbalance', data.currentUnbalance);

  if (data.timestamp) {
    point.timestamp(data.timestamp);
  }

  writeApi.writePoint(point);
  await writeApi.flush();
}

// Query latest data for a panel
export async function getLatestEnergyData(panelId: string): Promise<EnergyData | null> {
  const queryApi = getQueryApi();
  
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "energy_data")
      |> filter(fn: (r) => r.panelId == "${panelId}")
      |> last()
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  `;

  const result: EnergyData = {
    panelId,
    voltage: [0, 0, 0, 0],
    current: [0, 0, 0, 0],
    powerKW: 0,
    powerKVA: 0,
    energyKWh: 0,
    powerFactor: 0,
    voltageUnbalance: 0,
    currentUnbalance: 0,
  };

  let hasData = false;

  try {
    const rows = await queryApi.collectRows(query);
    
    if (rows.length > 0) {
      const row = rows[0] as Record<string, unknown>;
      hasData = true;
      
      result.voltage = [
        (row.voltage_r as number) || 0,
        (row.voltage_s as number) || 0,
        (row.voltage_t as number) || 0,
        (row.voltage_n as number) || 0,
      ];
      result.current = [
        (row.current_r as number) || 0,
        (row.current_s as number) || 0,
        (row.current_t as number) || 0,
        (row.current_n as number) || 0,
      ];
      result.powerKW = (row.powerKW as number) || 0;
      result.powerKVA = (row.powerKVA as number) || 0;
      result.energyKWh = (row.energyKWh as number) || 0;
      result.powerFactor = (row.powerFactor as number) || 0;
      result.voltageUnbalance = (row.voltageUnbalance as number) || 0;
      result.currentUnbalance = (row.currentUnbalance as number) || 0;
      result.timestamp = new Date(row._time as string);
    }
  } catch (error) {
    console.error('Error querying InfluxDB:', error);
  }

  return hasData ? result : null;
}

// Query historical data for charts
export async function getHistoricalData(
  panelId: string,
  range: string = '24h'
): Promise<{ time: string; energyKWh: number; powerKW: number }[]> {
  const queryApi = getQueryApi();
  
  // Convert 1y to 365d for InfluxDB
  const influxRange = range === '1y' ? '365d' : range;
  
  // Determine aggregation window based on range
  let aggregateWindow = '1h'; // default hourly
  if (range === '1y' || range === '365d') {
    aggregateWindow = '30d'; // monthly for yearly
  } else if (range === '30d') {
    aggregateWindow = '1d'; // daily for monthly
  } else if (range === '7d') {
    aggregateWindow = '6h'; // 6-hourly for weekly
  }
  
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${influxRange})
      |> filter(fn: (r) => r._measurement == "energy_data")
      |> filter(fn: (r) => r.panelId == "${panelId}")
      |> filter(fn: (r) => r._field == "energyKWh" or r._field == "powerKW")
      |> aggregateWindow(every: ${aggregateWindow}, fn: mean, createEmpty: false)
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  `;

  const results: { time: string; energyKWh: number; powerKW: number }[] = [];

  try {
    const rows = await queryApi.collectRows(query);
    
    for (const row of rows as Record<string, unknown>[]) {
      results.push({
        time: new Date(row._time as string).toISOString(),
        energyKWh: (row.energyKWh as number) || 0,
        powerKW: (row.powerKW as number) || 0,
      });
    }
  } catch (error) {
    console.error('Error querying historical data:', error);
  }

  return results;
}

// Get midnight kWh for today's usage calculation
export async function getMidnightKWh(panelId: string): Promise<number> {
  const queryApi = getQueryApi();
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const query = `
    from(bucket: "${bucket}")
      |> range(start: ${today.toISOString()})
      |> filter(fn: (r) => r._measurement == "energy_data")
      |> filter(fn: (r) => r.panelId == "${panelId}")
      |> filter(fn: (r) => r._field == "energyKWh")
      |> first()
  `;

  try {
    const rows = await queryApi.collectRows(query);
    if (rows.length > 0) {
      const row = rows[0] as Record<string, unknown>;
      return (row._value as number) || 0;
    }
  } catch (error) {
    console.error('Error getting midnight kWh:', error);
  }

  return 0;
}

// Get monthly aggregated data
export async function getMonthlyData(
  year: number,
  month: number
): Promise<{ panelId: string; totalKWh: number }[]> {
  const queryApi = getQueryApi();
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  const query = `
    from(bucket: "${bucket}")
      |> range(start: ${startDate.toISOString()}, stop: ${endDate.toISOString()})
      |> filter(fn: (r) => r._measurement == "energy_data")
      |> filter(fn: (r) => r._field == "energyKWh")
      |> group(columns: ["panelId"])
      |> last()
      |> first()
  `;

  // For monthly calculation, we need first and last readings
  const panelData: Record<string, { first: number; last: number }> = {};

  try {
    // Get first readings
    const firstQuery = `
      from(bucket: "${bucket}")
        |> range(start: ${startDate.toISOString()}, stop: ${endDate.toISOString()})
        |> filter(fn: (r) => r._measurement == "energy_data")
        |> filter(fn: (r) => r._field == "energyKWh")
        |> group(columns: ["panelId"])
        |> first()
    `;
    
    const firstRows = await queryApi.collectRows(firstQuery);
    for (const row of firstRows as Record<string, unknown>[]) {
      const pid = row.panelId as string;
      if (!panelData[pid]) {
        panelData[pid] = { first: 0, last: 0 };
      }
      panelData[pid].first = (row._value as number) || 0;
    }

    // Get last readings
    const lastQuery = `
      from(bucket: "${bucket}")
        |> range(start: ${startDate.toISOString()}, stop: ${endDate.toISOString()})
        |> filter(fn: (r) => r._measurement == "energy_data")
        |> filter(fn: (r) => r._field == "energyKWh")
        |> group(columns: ["panelId"])
        |> last()
    `;
    
    const lastRows = await queryApi.collectRows(lastQuery);
    for (const row of lastRows as Record<string, unknown>[]) {
      const pid = row.panelId as string;
      if (!panelData[pid]) {
        panelData[pid] = { first: 0, last: 0 };
      }
      panelData[pid].last = (row._value as number) || 0;
    }
  } catch (error) {
    console.error('Error getting monthly data:', error);
  }

  return Object.entries(panelData).map(([panelId, data]) => ({
    panelId,
    totalKWh: Math.max(0, data.last - data.first),
  }));
}
