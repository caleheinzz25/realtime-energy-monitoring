import { NextResponse } from 'next/server';
import { getLatestEnergyData, getMidnightKWh } from '@/lib/influxdb';
import { calculateTodayUsage, calculateCost } from '@/lib/business-logic';
import { getLatestDataFromCache } from '@/lib/mqtt-client';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ panelCode: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { panelCode } = await params;
    
    if (!panelCode) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: 'Panel code is required',
        },
        { status: 400 }
      );
    }

    // Get current kWh reading - first try cache, then InfluxDB
    let currentKWh = 0;
    
    // Try MQTT cache first (most recent data)
    const cachedData = getLatestDataFromCache(panelCode);
    if (cachedData) {
      currentKWh = cachedData.energyKWh || 0;
    }
    
    // Fallback to InfluxDB if cache is empty
    if (currentKWh === 0) {
      const latestData = await getLatestEnergyData(panelCode);
      currentKWh = latestData?.energyKWh || 0;
    }

    // Get midnight kWh reading
    const midnightKWh = await getMidnightKWh(panelCode);

    // Calculate today's usage
    const todayUsageKWh = calculateTodayUsage(currentKWh, midnightKWh);
    const todayCost = calculateCost(todayUsageKWh);

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    return NextResponse.json({
      status: 'OK',
      data: {
        panelCode,
        date: dateStr,
        todayUsageKWh: parseFloat(todayUsageKWh.toFixed(2)),
        todayCost,
        currency: 'IDR',
        currentKWh: parseFloat(currentKWh.toFixed(2)),
        midnightKWh: parseFloat(midnightKWh.toFixed(2)),
      },
    });
  } catch (error) {
    console.error('Error fetching today usage:', error);
    return NextResponse.json(
      {
        status: 'ERROR',
        message: 'Failed to fetch today usage',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
