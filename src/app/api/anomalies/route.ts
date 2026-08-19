import { NextRequest, NextResponse } from 'next/server';
import { anomaliesQuerySchema, validateQuery } from '@/lib/validation';
import { queryAnomalies } from '@/lib/data/store';

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const validation = validateQuery(anomaliesQuerySchema, params);

  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { t, region, metric, status, minSeverity } = validation.data;

  const anomalies = queryAnomalies(t, {
    region,
    metric,
    status,
    minSeverity,
  });

  return NextResponse.json({ anomalies, currentTime: t });
}
