import { NextRequest, NextResponse } from 'next/server';
import { evidenceQuerySchema, validateQuery, metricSchema, regionSchema } from '@/lib/validation';
import { getEvidence } from '@/lib/data/store';
import type { MetricType, Region } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { signalId: string } }
) {
  const signalId = params.signalId;
  if (!signalId || typeof signalId !== 'string') {
    return NextResponse.json({ error: 'Invalid signal ID' }, { status: 400 });
  }

  // Parse signalId format: "metric-region" (e.g., "checkout_latency_ms-APAC")
  const lastDash = signalId.lastIndexOf('-');
  if (lastDash === -1) {
    return NextResponse.json({ error: 'Invalid signal ID format. Expected: metric-region' }, { status: 400 });
  }

  const metricStr = signalId.substring(0, lastDash);
  const regionStr = signalId.substring(lastDash + 1);

  const metricResult = metricSchema.safeParse(metricStr);
  const regionResult = regionSchema.safeParse(regionStr);

  if (!metricResult.success) {
    return NextResponse.json({ error: `Invalid metric: ${metricStr}` }, { status: 400 });
  }
  if (!regionResult.success) {
    return NextResponse.json({ error: `Invalid region: ${regionStr}` }, { status: 400 });
  }

  const queryParams = Object.fromEntries(request.nextUrl.searchParams);
  const validation = validateQuery(evidenceQuerySchema, queryParams);

  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { t } = validation.data;
  const evidence = getEvidence(metricResult.data, regionResult.data, t);

  return NextResponse.json(evidence);
}
