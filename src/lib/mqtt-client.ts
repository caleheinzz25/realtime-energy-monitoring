import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { writeEnergyData, EnergyData } from './influxdb';
import { parseMqttPayload, extractPanelCode } from './business-logic';
import { prisma } from './prisma';

// MQTT Topics for 3 panels
const MQTT_TOPICS = [
  'DATA/PM/+',
];

// Singleton MQTT client instance
let mqttClient: MqttClient | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 5000;

// In-memory cache for latest data
const latestDataCache: Map<string, EnergyData & { lastUpdate: Date }> = new Map();

export function getLatestDataFromCache(panelId: string) {
  return latestDataCache.get(panelId);
}

export function getAllLatestDataFromCache() {
  return Array.from(latestDataCache.entries()).map(([panelId, data]) => ({
    ...data,
    panelId,
  }));
}

/**
 * Initialize MQTT client and connect to broker
 */
export function initMqttClient(): MqttClient {
  if (mqttClient) {
    return mqttClient;
  }

  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
  
  const options: IClientOptions = {
    clientId: `energy-monitor-${Date.now()}`,
    clean: true,
    connectTimeout: 30000,
    reconnectPeriod: RECONNECT_INTERVAL,
  };

  console.log(`Connecting to MQTT broker: ${brokerUrl}`);
  mqttClient = mqtt.connect(brokerUrl, options);

  mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT broker');
    reconnectAttempts = 0;
    
    // Subscribe to all panel topics
    MQTT_TOPICS.forEach((topic) => {
      mqttClient?.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`📡 Subscribed to ${topic}`);
        }
      });
    });
  });

  mqttClient.on('message', async (topic, message) => {
    const panelCode = extractPanelCode(topic);
    if (!panelCode) {
      console.warn(`Unknown topic format: ${topic}`);
      return;
    }

    const payload = message.toString();
    console.log(`📨 Received data from ${panelCode}`);

    const parsedData = parseMqttPayload(payload);
    if (!parsedData) {
      console.warn(`Invalid payload from ${panelCode}`);
      return;
    }

    const energyData: EnergyData = {
      panelId: panelCode,
      ...parsedData,
    };

    try {
      // Write to InfluxDB
      await writeEnergyData(energyData);
      console.log(`💾 Saved data for ${panelCode} to InfluxDB`);

      // Update cache
      latestDataCache.set(panelCode, {
        ...energyData,
        lastUpdate: new Date(),
      });

      // Update panel status in PostgreSQL
      await prisma.panel.update({
        where: { panelCode },
        data: {
          status: 'ONLINE',
          lastOnline: new Date(),
        },
      });
    } catch (error) {
      console.error(`Error processing data for ${panelCode}:`, error);
    }
  });

  mqttClient.on('error', (err) => {
    console.error('MQTT client error:', err);
  });

  mqttClient.on('reconnect', () => {
    reconnectAttempts++;
    console.log(`🔄 Reconnecting to MQTT broker (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      mqttClient?.end();
    }
  });

  mqttClient.on('close', () => {
    console.log('MQTT connection closed');
  });

  mqttClient.on('offline', () => {
    console.log('MQTT client is offline');
  });

  return mqttClient;
}

/**
 * Disconnect MQTT client
 */
export function disconnectMqtt(): void {
  if (mqttClient) {
    mqttClient.end();
    mqttClient = null;
    console.log('MQTT client disconnected');
  }
}

/**
 * Check if MQTT client is connected
 */
export function isMqttConnected(): boolean {
  return mqttClient?.connected ?? false;
}

/**
 * Get MQTT client instance
 */
export function getMqttClient(): MqttClient | null {
  return mqttClient;
}
