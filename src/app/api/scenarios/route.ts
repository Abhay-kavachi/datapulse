import { NextRequest, NextResponse } from 'next/server';
import { SCENARIOS } from '@/lib/data/scenarios';
import { initializeStore, getCurrentScenarioId } from '@/lib/data/store';

export async function GET() {
  const currentId = getCurrentScenarioId();
  const scenarios = SCENARIOS.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    timeRange: s.timeRange,
    isActive: s.id === currentId,
  }));

  return NextResponse.json({ scenarios, activeScenarioId: currentId });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const scenarioId = body?.scenarioId;

    if (!scenarioId || typeof scenarioId !== 'string') {
      return NextResponse.json({ error: 'scenarioId required' }, { status: 400 });
    }

    const scenario = SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) {
      return NextResponse.json({ error: 'Invalid scenarioId' }, { status: 400 });
    }

    // Re-initialize the store with the new scenario
    initializeStore(scenarioId);

    return NextResponse.json({
      success: true,
      scenarioId,
      timeRange: scenario.timeRange,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
