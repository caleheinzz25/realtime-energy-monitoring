#!/usr/bin/env node
/**
 * MQTT Data Simulator for Energy Monitoring Dashboard
 * 
 * This script simulates 3 electrical panels sending realtime data via MQTT.
 * Run this script to test the dashboard with realistic dummy data.
 * 
 * Usage: npx tsx scripts/mqtt-simulator.ts
 */

import mqtt from 'mqtt';

// MQTT Configuration
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

// Panel configurations with base values
const PANELS = [
  {
    topic: 'DATA/PM/PANEL_LANTAI_1',
    panelCode: 'PANEL_LANTAI_1',
    baseVoltage: [224.5, 224.5, 224.5, 149.8],
    baseCurrent: [2.5, 3.2, 1.8, 0.1],
    baseKW: 1.2,
    baseKVA: 1.4,
    baseKWh: 150.0, // Starting kWh
    basePF: 0.85,
  },
  {
    topic: 'DATA/PM/PANEL_LANTAI_2',
    panelCode: 'PANEL_LANTAI_2',
    baseVoltage: [223.8, 223.8, 223.8, 148.5],
    baseCurrent: [1.8, 2.1, 1.5, 0.08],
    baseKW: 0.9,
    baseKVA: 1.1,
    baseKWh: 120.0,
    basePF: 0.82,
  },
  {
    topic: 'DATA/PM/PANEL_LANTAI_3',
    panelCode: 'PANEL_LANTAI_3',
    baseVoltage: [225.2, 225.2, 225.2, 150.2],
    baseCurrent: [1.2, 1.5, 0.9, 0.05],
    baseKW: 0.6,
    baseKVA: 0.75,
    baseKWh: 80.0,
    basePF: 0.80,
  },
];

// Track kWh for each panel (accumulating)
const panelKWh: Record<string, number> = {};
PANELS.forEach((p) => {
  panelKWh[p.panelCode] = p.baseKWh;
});

// Random variation helper
function vary(value: number, percentage: number = 5): number {
  const variation = value * (percentage / 100);
  return value + (Math.random() * 2 - 1) * variation;
}

// Generate simulated data for a panel
function generatePanelData(panel: typeof PANELS[0]): object {
  const now = new Date();
  const hour = now.getHours();
  
  // Simulate higher usage during work hours (8AM - 6PM)
  let usageMultiplier = 1.0;
  if (hour >= 8 && hour < 12) {
    usageMultiplier = 1.5; // Morning peak
  } else if (hour >= 12 && hour < 14) {
    usageMultiplier = 1.2; // Lunch time
  } else if (hour >= 14 && hour < 18) {
    usageMultiplier = 1.4; // Afternoon
  } else if (hour >= 18 || hour < 8) {
    usageMultiplier = 0.3; // Night/off hours
  }

  // Generate varied values
  const voltage = panel.baseVoltage.map((v) => parseFloat(vary(v, 2).toFixed(1)));
  const current = panel.baseCurrent.map((c) => 
    parseFloat((vary(c, 10) * usageMultiplier).toFixed(2))
  );
  
  const kw = parseFloat((vary(panel.baseKW, 15) * usageMultiplier).toFixed(2));
  const kva = parseFloat((vary(panel.baseKVA, 15) * usageMultiplier).toFixed(2));
  
  // Accumulate kWh (small increment based on power)
  panelKWh[panel.panelCode] += kw / 3600 * 5; // 5 second interval
  const kwh = parseFloat(panelKWh[panel.panelCode].toFixed(2));
  
  const pf = parseFloat(vary(panel.basePF, 5).toFixed(2));
  const vunbal = parseFloat((Math.random() * 0.02).toFixed(3));
  const iunbal = parseFloat((Math.random() * 0.1).toFixed(3));
  
  // Format time as expected
  const time = now.toISOString().replace('T', ' ').substring(0, 19);

  return {
    status: 'OK',
    data: {
      v: voltage,
      i: current,
      kw: kw.toString(),
      kVA: kva.toString(),
      kWh: kwh.toString(),
      pf: pf,
      vunbal: vunbal,
      iunbal: iunbal,
      time: time,
    },
  };
}

// Main function
async function main() {
  console.log('🔌 Energy Monitoring MQTT Simulator');
  console.log('====================================');
  console.log(`Connecting to broker: ${MQTT_BROKER_URL}`);

  const client = mqtt.connect(MQTT_BROKER_URL, {
    clientId: `simulator-${Date.now()}`,
    clean: true,
  });

  client.on('connect', () => {
    console.log('✅ Connected to MQTT broker');
    console.log('');
    console.log('Publishing data to:');
    PANELS.forEach((p) => console.log(`  📡 ${p.topic}`));
    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('');

    // Start publishing data
    setInterval(() => {
      PANELS.forEach((panel) => {
        const data = generatePanelData(panel);
        const payload = JSON.stringify(data);
        
        client.publish(panel.topic, payload, { qos: 1 }, (err) => {
          if (err) {
            console.error(`❌ Error publishing to ${panel.topic}:`, err);
          } else {
            const kw = JSON.parse(payload).data.kw;
            const kwh = JSON.parse(payload).data.kWh;
            console.log(
              `📨 ${new Date().toLocaleTimeString('id-ID')} | ${panel.panelCode} | kW: ${kw} | kWh: ${kwh}`
            );
          }
        });
      });
    }, 5000); // Publish every 5 seconds
  });

  client.on('error', (err) => {
    console.error('❌ MQTT connection error:', err.message);
    process.exit(1);
  });

  client.on('close', () => {
    console.log('Connection closed');
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping simulator...');
    client.end();
    process.exit(0);
  });
}

main().catch(console.error);
