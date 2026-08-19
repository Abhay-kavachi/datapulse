'use client';

import React, { useState, useEffect } from 'react';

interface ScenarioInfo {
  id: string;
  name: string;
  description: string;
  timeRange: { start: string; end: string };
  isActive: boolean;
}

interface ScenarioSelectorProps {
  onScenarioChange: (scenarioId: string, timeRange: { start: string; end: string }) => void;
}

export default function ScenarioSelector({ onScenarioChange }: ScenarioSelectorProps) {
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetch('/api/scenarios')
      .then((r) => r.json())
      .then((data) => {
        setScenarios(data.scenarios);
        setActiveId(data.activeScenarioId);
      })
      .catch(console.error);
  }, []);

  const handleSelect = async (id: string) => {
    if (id === activeId || isLoading) return;
    setIsLoading(true);

    try {
      const res = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: id }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveId(id);
        onScenarioChange(id, data.timeRange);
        setIsOpen(false);
      }
    } catch (e) {
      console.error('Failed to switch scenario:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const active = scenarios.find((s) => s.id === activeId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-dp-surface-secondary
                   border border-dp-border hover:border-state-info/50 transition-colors
                   text-sm text-text-secondary hover:text-text-primary"
        aria-label="Select incident scenario"
        aria-expanded={isOpen}
      >
        <svg className="w-4 h-4 text-state-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <span className="max-w-[180px] truncate">
          {active?.name || 'Select Scenario'}
        </span>
        <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-dp-surface-elevated border border-dp-border
                        rounded-lg shadow-2xl z-50 overflow-hidden animate-fade-in">
          <div className="px-3 py-2 border-b border-dp-border">
            <p className="text-xs text-text-tertiary uppercase tracking-wider font-medium">
              Select Incident Scenario
            </p>
          </div>
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSelect(s.id)}
              disabled={isLoading}
              className={`w-full text-left px-3 py-3 border-b border-dp-border-subtle
                         hover:bg-dp-surface-secondary transition-colors
                         ${s.id === activeId ? 'bg-dp-surface-secondary' : ''}
                         ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              aria-label={`Switch to ${s.name} scenario`}
            >
              <div className="flex items-center gap-2">
                {s.id === activeId && (
                  <span className="w-2 h-2 rounded-full bg-state-info flex-shrink-0" />
                )}
                <span className={`text-sm font-medium ${s.id === activeId ? 'text-text-primary' : 'text-text-secondary'}`}>
                  {s.name}
                </span>
              </div>
              <p className="text-xs text-text-tertiary mt-1 ml-4">
                {s.description}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
