#!/usr/bin/env node
/**
 * Seed InfluxDB with historical dummy data for chart testing
 * 
 * This script populates InfluxDB with 24 hours of historical energy data
 * to test the chart visualization.
 * 
 * Usage: npx tsx scripts/seed-influxdb.ts
 */

import { InfluxDB, Point, WriteApi } from '@influxdata/influxdb-client';

// InfluxDB Configuration
const url = process.env.INFLUX_URL || 'http://localhost:8086';
const token = process.env.INFLUX_TOKEN || '2fpmVyyPrkhesMdCAVmmhhQRTRCIqeLOa6ygcSe30Ce-JSp17AaFIjPAjYkqGh-6LRJdMpe3jyeDV4hFU7GsUg==';
const org = process.env.INFLUX_ORG || 'ravelware';
const bucket = process.env.INFLUX_BUCKET || 'energy';

// Panel configurations
const PANELS = [
  { panelId: 'PANEL_LANTAI_1', baseKW: 1.2, baseKWh: 100 },
  { panelId: 'PANEL_LANTAI_2', baseKW: 0.9, baseKWh: 80 },
  { panelId: 'PANEL_LANTAI_3', baseKW: 0.6, baseKWh: 50 },
];

// Random variation
function vary(value: number, percentage: number = 20): number {
  const variation = value * (percentage / 100);
  return value + (Math.random() * 2 - 1) * variation;
}

// Get usage multiplier based on hour
function getUsageMultiplier(hour: number): number {
  if (hour >= 8 && hour < 12) return 1.5;
  if (hour >= 12 && hour < 14) return 1.2;
  if (hour >= 14 && hour < 18) return 1.4;
  if (hour >= 18 && hour < 22) return 0.6;
  return 0.3; // Night hours
}

async function main() {
  console.log('🗄️  InfluxDB Historical Data Seeder');
  console.log('====================================');
  console.log(`URL: ${url}`);
  console.log(`Org: ${org}`);
  console.log(`Bucket: ${bucket}`);
  console.log('');

  const influxDB = new InfluxDB({ url, token });
  const writeApi = influxDB.getWriteApi(org, bucket, 'ns');

  const now = new Date();
  const hoursToSeed = 48; // 48 hours of historical data
  const intervalsPerHour = 12; // Every 5 minutes
  
  console.log(`Seeding ${hoursToSeed} hours of data...`);
  console.log('');

  let pointCount = 0;

  // Track kWh for each panel
  const panelKWh: Record<string, number> = {};
  PANELS.forEach((p) => {
    panelKWh[p.panelId] = p.baseKWh;
  });

  for (let h = hoursToSeed; h >= 0; h--) {
    for (let i = 0; i < intervalsPerHour; i++) {
      const timestamp = new Date(now.getTime() - h * 60 * 60 * 1000 - i * 5 * 60 * 1000);
      const hour = timestamp.getHours();
      const multiplier = getUsageMultiplier(hour);

      for (const panel of PANELS) {
        const kw = vary(panel.baseKW * multiplier, 25);
        const kva = kw * 1.15;
        
        // Increment kWh
        panelKWh[panel.panelId] += kw / 12; // 5 min interval
        const kwh = panelKWh[panel.panelId];

        const point = new Point('energy_data')
          .tag('panelId', panel.panelId)
          .floatField('voltage_r', vary(224, 2))
          .floatField('voltage_s', vary(224, 2))
          .floatField('voltage_t', vary(224, 2))
          .floatField('voltage_n', vary(149, 2))
          .floatField('current_r', vary(2 * multiplier, 30))
          .floatField('current_s', vary(2.5 * multiplier, 30))
          .floatField('current_t', vary(1.5 * multiplier, 30))
          .floatField('current_n', vary(0.1, 50))
          .floatField('powerKW', kw)
          .floatField('powerKVA', kva)
          .floatField('energyKWh', kwh)
          .floatField('powerFactor', vary(0.85, 5))
          .floatField('voltageUnbalance', Math.random() * 0.02)
          .floatField('currentUnbalance', Math.random() * 0.1)
          .timestamp(timestamp);

        writeApi.writePoint(point);
        pointCount++;
      }
    }
    
    if (h % 6 === 0) {
      console.log(`  Seeded ${hoursToSeed - h}/${hoursToSeed} hours...`);
    }
  }

  console.log('');
  console.log('Flushing data to InfluxDB...');
  
  await writeApi.flush();
  await writeApi.close();

  console.log('');
  console.log(`✅ Successfully seeded ${pointCount} data points!`);
  console.log('');
  console.log('Summary per panel:');
  PANELS.forEach((p) => {
    console.log(`  ${p.panelId}: ${panelKWh[p.panelId].toFixed(2)} kWh total`);
  });
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
