import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMonthlyData } from '@/lib/influxdb';
import { calculateCost } from '@/lib/business-logic';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ year: string; month: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { year, month } = await params;
    
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: 'Invalid year or month',
        },
        { status: 400 }
      );
    }

    // Get all panels
    const panels = await prisma.panel.findMany({
      orderBy: { floor: 'asc' },
    });

    // Get monthly data from InfluxDB
    const monthlyData = await getMonthlyData(yearNum, monthNum);

    // Create a map for quick lookup
    const usageMap = new Map(
      monthlyData.map((d) => [d.panelId, d.totalKWh])
    );

    // Build response
    let buildingTotalKWh = 0;
    const panelUsages = panels.map((panel) => {
      const totalKWh = usageMap.get(panel.panelCode) || 0;
      const totalCost = calculateCost(totalKWh);
      buildingTotalKWh += totalKWh;

      return {
        panelCode: panel.panelCode,
        location: panel.location,
        floor: panel.floor,
        totalKWh: parseFloat(totalKWh.toFixed(2)),
        totalCost,
      };
    });

    const buildingTotalCost = calculateCost(buildingTotalKWh);

    return NextResponse.json({
      status: 'OK',
      data: {
        year: year.padStart(4, '0'),
        month: month.padStart(2, '0'),
        panels: panelUsages,
        buildingTotal: {
          totalKWh: parseFloat(buildingTotalKWh.toFixed(2)),
          totalCost: buildingTotalCost,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching monthly usage:', error);
    return NextResponse.json(
      {
        status: 'ERROR',
        message: 'Failed to fetch monthly usage',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
