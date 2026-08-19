import { NextRequest, NextResponse } from 'next/server';
import { whatChangedQuerySchema, validateQuery } from '@/lib/validation';
import { getWhatChanged } from '@/lib/data/store';

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const validation = validateQuery(whatChangedQuerySchema, params);

  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { t, window: windowPreset } = validation.data;
  const entries = getWhatChanged(t, windowPreset);

  return NextResponse.json({ entries, currentTime: t, window: windowPreset });
}
