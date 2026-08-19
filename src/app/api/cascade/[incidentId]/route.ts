import { NextRequest, NextResponse } from 'next/server';
import { cascadeQuerySchema, validateQuery } from '@/lib/validation';
import { queryCascadeState } from '@/lib/data/store';

export async function GET(
  request: NextRequest,
  { params }: { params: { incidentId: string } }
) {
  const incidentId = params.incidentId;
  if (!incidentId || typeof incidentId !== 'string') {
    return NextResponse.json({ error: 'Invalid incident ID' }, { status: 400 });
  }

  const queryParams = Object.fromEntries(request.nextUrl.searchParams);
  const validation = validateQuery(cascadeQuerySchema, queryParams);

  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { t } = validation.data;
  const state = queryCascadeState(incidentId, t);

  if (!state) {
    return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
  }

  return NextResponse.json(state);
}
