import { NextResponse } from 'next/server';
import { getHistoricalData } from '@/lib/influxdb';
import { calculateCost } from '@/lib/business-logic';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ panelCode: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { panelCode } = await params;
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '24h';

    // Validate range parameter
    const validRanges = ['1h', '6h', '12h', '24h', '7d', '30d', '1y', '365d'];
    if (!validRanges.includes(range)) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: `Invalid range. Valid values: ${validRanges.join(', ')}`,
        },
        { status: 400 }
      );
    }

    if (!panelCode) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: 'Panel code is required',
        },
        { status: 400 }
      );
    }

    // Get historical data from InfluxDB
    const historicalData = await getHistoricalData(panelCode, range);

    // Get current date info
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const date = now.getDate().toString().padStart(2, '0');

    // Format data for response - matching requested format
    const energy: number[] = [];
    const cost: number[] = [];

    historicalData.forEach((point) => {
      energy.push(parseFloat(point.energyKWh.toFixed(3)));
      cost.push(calculateCost(point.energyKWh));
    });

    return NextResponse.json({
      status: 'OK',
      message: '',
      data: {
        pmCode: panelCode,
        year,
        month,
        date,
        range,
        energy,
        cost,
        dataPoints: historicalData.length,
      },
    });
  } catch (error) {
    console.error('Error fetching historical data:', error);
    return NextResponse.json(
      {
        status: 'ERROR',
        message: 'Failed to fetch historical data',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
