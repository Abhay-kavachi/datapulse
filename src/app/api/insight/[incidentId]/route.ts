import { NextRequest, NextResponse } from 'next/server';
import { queryInsight } from '@/lib/data/store';

export async function GET(
  request: NextRequest,
  { params }: { params: { incidentId: string } }
) {
  const incidentId = params.incidentId;
  if (!incidentId || typeof incidentId !== 'string') {
    return NextResponse.json({ error: 'Invalid incident ID' }, { status: 400 });
  }

  const insight = queryInsight(incidentId);

  if (!insight) {
    return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
  }

  return NextResponse.json(insight);
}
