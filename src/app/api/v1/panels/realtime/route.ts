import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLatestEnergyData } from '@/lib/influxdb';
import { getPanelStatus, getRelativeTime } from '@/lib/business-logic';
import { getLatestDataFromCache } from '@/lib/mqtt-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get all panels from PostgreSQL
    const panels = await prisma.panel.findMany({
      orderBy: { floor: 'asc' },
    });

    const panelData = await Promise.all(
      panels.map(async (panel) => {
        // Try cache first, then InfluxDB
        let energyData = getLatestDataFromCache(panel.panelCode);
        
        if (!energyData) {
          const influxData = await getLatestEnergyData(panel.panelCode);
          if (influxData) {
            energyData = {
              ...influxData,
              lastUpdate: influxData.timestamp || new Date(0),
            };
          }
        }

        const lastUpdate = energyData?.lastUpdate || panel.lastOnline;
        const status = getPanelStatus(lastUpdate);

        // Format time as "YYYY-MM-DD HH:mm:ss"
        const timeStr = lastUpdate 
          ? new Date(lastUpdate).toISOString().replace('T', ' ').substring(0, 19)
          : null;

        // Return in flat format (easier for frontend)
        return {
          pmCode: panel.panelCode,
          location: panel.location,
          floor: panel.floor,
          panelStatus: status,
          lastUpdateRelative: getRelativeTime(lastUpdate),
          v: energyData?.voltage || [0, 0, 0, 0],
          i: energyData?.current || [0, 0, 0, 0],
          kw: energyData?.powerKW?.toString() || '0',
          kVA: energyData?.powerKVA?.toString() || '0',
          kWh: energyData?.energyKWh?.toString() || '0',
          pf: energyData?.powerFactor || 0,
          vunbal: energyData?.voltageUnbalance || 0,
          iunbal: energyData?.currentUnbalance || 0,
          time: timeStr,
        };
      })
    );

    return NextResponse.json({
      status: 'OK',
      data: {
        panels: panelData,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      },
    });
  } catch (error) {
    console.error('Error fetching realtime data:', error);
    return NextResponse.json(
      {
        status: 'ERROR',
        message: 'Failed to fetch realtime data',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
