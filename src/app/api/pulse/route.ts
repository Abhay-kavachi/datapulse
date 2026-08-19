import { NextRequest, NextResponse } from 'next/server';
import { pulseQuerySchema, validateQuery } from '@/lib/validation';
import {
  getHealthStatus,
  getRegionSummaries,
  getMetricSummaries,
  getActivityFeed,
} from '@/lib/data/store';
import type { PulseResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const validation = validateQuery(pulseQuerySchema, params);

  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { t, region } = validation.data;

  const response: PulseResponse = {
    health: getHealthStatus(t),
    regions: getRegionSummaries(t, region),
    metrics: getMetricSummaries(t, region),
    activityFeed: getActivityFeed(t, region),
    currentTime: t,
  };

  return NextResponse.json(response);
}
