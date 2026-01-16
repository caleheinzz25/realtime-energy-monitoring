import { NextResponse } from 'next/server';
import { initMqttClient, isMqttConnected } from '@/lib/mqtt-client';

export const dynamic = 'force-dynamic';

// Global flag to track MQTT initialization
let mqttInitialized = false;

export async function POST() {
  try {
    if (mqttInitialized && isMqttConnected()) {
      return NextResponse.json({
        status: 'OK',
        message: 'MQTT client already running',
        connected: true,
      });
    }

    // Initialize MQTT client (now async)
    await initMqttClient();
    mqttInitialized = true;

    // Give it a moment to connect
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return NextResponse.json({
      status: 'OK',
      message: 'MQTT client started',
      connected: isMqttConnected(),
    });
  } catch (error) {
    console.error('Error starting MQTT client:', error);
    return NextResponse.json(
      {
        status: 'ERROR',
        message: 'Failed to start MQTT client',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'OK',
    connected: isMqttConnected(),
    initialized: mqttInitialized,
  });
}
