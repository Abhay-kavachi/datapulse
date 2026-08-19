import React, { useMemo, useEffect, useRef } from 'react';
import { usePlayback } from '@/contexts/PlaybackContext';
import { CascadeState, CascadeNodeStatus, METRIC_LABELS, METRIC_UNITS, CascadeNode } from '@/lib/types';
import { PlayIcon, PauseIcon, ArrowPathIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline';

interface CascadeReplayProps {
  cascadeState: CascadeState | null;
  incidentTimeRange: { start: string; end: string };
  onSelectSignal: (signalId: string) => void;
  onScrubTimeChange: (time: string) => void;
  isLoading?: boolean;
}

const NODE_LAYOUT: Record<string, { x: number; y: number }> = {
  traffic: { x: 50, y: 160 },
  checkout_latency_ms: { x: 320, y: 160 },
  payment_failure_rate: { x: 590, y: 160 },
  conversion_rate: { x: 860, y: 160 },
  error_rate: { x: 1130, y: 160 },
  revenue_index: { x: 1400, y: 160 },
};

function getNodeStyles(status: CascadeNodeStatus) {
  switch(status) {
    case 'inactive': return { bg: '#111620', border: '#2A3144', text: '#94A3B8', valueText: '#94A3B8' };
    case 'forming': return { bg: '#1E293B', border: '#F59E0B', text: '#F1F5F9', valueText: '#F59E0B' };
    case 'active': return { bg: '#F59E0B', border: '#F59E0B', text: '#111620', valueText: '#111620' };
    case 'critical': return { bg: '#EF4444', border: '#EF4444', text: '#F1F5F9', valueText: '#FFFFFF' };
    case 'resolved': return { bg: '#111620', border: '#22C55E', text: '#94A3B8', valueText: '#22C55E' };
  }
  return { bg: '#111620', border: '#2A3144', text: '#94A3B8', valueText: '#94A3B8' };
}

function formatValue(val: number) {
  if (val > 1000) return (val / 1000).toFixed(1) + 'k';
  if (Number.isInteger(val)) return val.toString();
  return val.toFixed(2);
}

export default function CascadeReplay({
  cascadeState,
  incidentTimeRange,
  onSelectSignal,
  onScrubTimeChange,
  isLoading
}: CascadeReplayProps) {
  const { currentTime, isPlaying, play, pause, scrubTo, selectIncident } = usePlayback();

  const startMs = new Date(incidentTimeRange.start).getTime();
  const endMs = new Date(incidentTimeRange.end).getTime();
  const currentMs = currentTime.getTime();

  // Auto-pause when hitting the end of the incident
  useEffect(() => {
    if (isPlaying && currentMs >= endMs) {
      pause();
      scrubTo(new Date(endMs));
    }
  }, [currentMs, endMs, isPlaying, pause, scrubTo]);

  // Sync back local scrubbing to parent if needed
  useEffect(() => {
    onScrubTimeChange(currentTime.toISOString());
  }, [currentTime, onScrubTimeChange]);

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = new Date(Number(e.target.value));
    scrubTo(time);
  };

  const handleReplay = () => {
    scrubTo(new Date(startMs));
    if (!isPlaying) play();
  };

  const togglePlay = () => {
    if (isPlaying) {
      pause();
    } else {
      if (currentMs >= endMs) {
        scrubTo(new Date(startMs));
      }
      play();
    }
  };

  const handleExit = () => {
    selectIncident(null);
  };

  const progressPercent = Math.max(0, Math.min(100, ((currentMs - startMs) / (endMs - startMs)) * 100));

  const nodes = cascadeState?.nodes || [];
  const edges = cascadeState?.edges || [];

  const nodeMap = useMemo(() => {
    const map = new Map<string, CascadeNode>();
    nodes.forEach(n => map.set(n.metric, n));
    return map;
  }, [nodes]);

  const nodeWidth = 200;
  const nodeHeight = 84;
  const rx = 8;

  return (
    <div className="flex flex-col h-full bg-dp-surface-primary border border-dp-border rounded-lg relative overflow-hidden select-none">
      {/* SVG Canvas */}
      <div className="flex-1 overflow-auto bg-[#0B0E14] relative flex items-center justify-center p-4">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="text-text-secondary animate-pulse">Loading Cascade...</div>
          </div>
        )}
        <div className="w-full h-full max-w-[1700px] overflow-auto">
          <svg viewBox="0 0 1700 400" className="w-full h-full min-w-[1200px]">
            <defs>
              <style>{`
                @keyframes draw-edge {
                  from { stroke-dasharray: 1000; stroke-dashoffset: 1000; }
                  to { stroke-dasharray: 1000; stroke-dashoffset: 0; }
                }
                .animate-draw-edge {
                  animation: draw-edge 1.5s ease-out forwards;
                }
                @media (prefers-reduced-motion: reduce) {
                  .animate-draw-edge {
                    animation: none;
                    stroke-dasharray: none;
                  }
                }
              `}</style>
              <marker id="arrow-gray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#2A3144" />
              </marker>
              <marker id="arrow-amber" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#F59E0B" />
              </marker>
              <marker id="arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#EF4444" />
              </marker>
            </defs>

            {/* Edges */}
            {edges.map((edge, i) => {
              const fromPos = NODE_LAYOUT[edge.from];
              const toPos = NODE_LAYOUT[edge.to];
              if (!fromPos || !toPos) return null;

              const fromNode = nodeMap.get(edge.from);
              const toNode = nodeMap.get(edge.to);

              const fromAnomalous = fromNode && ['forming', 'active', 'critical'].includes(fromNode.status);
              const toAnomalous = toNode && ['forming', 'active', 'critical'].includes(toNode.status);
              const bothAnomalous = fromAnomalous && toAnomalous;

              let severityColor = '#2A3144';
              let markerId = 'url(#arrow-gray)';
              if (bothAnomalous) {
                if (fromNode?.status === 'critical' || toNode?.status === 'critical') {
                  severityColor = '#EF4444';
                  markerId = 'url(#arrow-red)';
                } else {
                  severityColor = '#F59E0B';
                  markerId = 'url(#arrow-amber)';
                }
              }

              const x1 = fromPos.x + nodeWidth;
              const y1 = fromPos.y + nodeHeight / 2;
              const x2 = toPos.x;
              const y2 = toPos.y + nodeHeight / 2;

              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              // Cubic bezier curve for smooth edges
              const pathD = `M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}`;

              return (
                <g key={`edge-${i}`} className="transition-all duration-300 motion-reduce:transition-none">
                  <path
                    d={pathD}
                    fill="none"
                    stroke={severityColor}
                    strokeWidth={bothAnomalous ? 2 : 1}
                    markerEnd={markerId}
                    strokeDasharray={bothAnomalous ? undefined : "4 4"}
                    className={bothAnomalous ? 'animate-draw-edge' : ''}
                  />
                  {/* Label background to ensure text is readable */}
                  <rect
                    x={midX - 45}
                    y={midY - 24}
                    width={90}
                    height={36}
                    fill="#0B0E14"
                    rx={4}
                  />
                  <text x={midX} y={midY - 8} fill={severityColor} fontSize={11} textAnchor="middle" className="uppercase tracking-wider font-semibold">
                    correlated
                  </text>
                  <text x={midX} y={midY + 6} fill="#94A3B8" fontSize={11} textAnchor="middle">
                    {edge.lagMinutes} min lag
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map(node => {
              const pos = NODE_LAYOUT[node.metric];
              if (!pos) return null;
              const styles = getNodeStyles(node.status);
              const label = METRIC_LABELS[node.metric] || node.metric;
              const unit = METRIC_UNITS[node.metric] || '';
              const valStr = formatValue(node.value);
              const pct = node.percentChange;
              const pctStr = (pct > 0 ? '+' : '') + pct.toFixed(1) + '%';

              return (
                <g
                  key={node.metric}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  className="cursor-pointer transition-all duration-300 motion-reduce:transition-none hover:brightness-110"
                  onClick={() => onSelectSignal(node.metric)}
                >
                  <rect
                    width={nodeWidth}
                    height={nodeHeight}
                    rx={rx}
                    fill={styles.bg}
                    stroke={styles.border}
                    strokeWidth={node.status !== 'inactive' ? 2 : 1}
                  />
                  <text x={16} y={26} fill={styles.text} fontSize={13} fontWeight="600" className="uppercase tracking-wide">
                    {label}
                  </text>
                  <text x={16} y={60} fill={styles.valueText} fontSize={22} fontWeight="700" className="tabular-nums">
                    {valStr} <tspan fontSize={14} fill={styles.text} fontWeight="normal">{unit}</tspan>
                  </text>
                  <text x={nodeWidth - 16} y={60} fill={styles.text} fontSize={14} textAnchor="end" className="tabular-nums">
                    {pctStr}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Scrubber Footer */}
      <div className="h-16 border-t border-dp-border bg-[#111620] flex items-center px-6 gap-4 z-20 shrink-0">
        <button
          onClick={togglePlay}
          className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-primary"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
        </button>

        <button
          onClick={handleReplay}
          className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-secondary"
          title="Replay from start"
        >
          <ArrowPathIcon className="w-5 h-5" />
        </button>

        <div className="text-sm font-medium text-text-secondary w-20 text-right tabular-nums">
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>

        <div className="flex-1 relative flex items-center h-full px-4 group">
          <div className="absolute inset-x-4 h-1 bg-[#2A3144] rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-dp-accent/80 group-hover:bg-dp-accent transition-colors duration-150"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <input
            type="range"
            min={startMs}
            max={endMs}
            value={currentMs}
            onChange={handleScrubChange}
            className="absolute inset-x-4 w-[calc(100%-2rem)] h-8 opacity-0 cursor-pointer"
          />
        </div>

        <button
          onClick={handleExit}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-white/5 rounded transition-colors"
        >
          <ArrowLeftOnRectangleIcon className="w-4 h-4" />
          <span>Exit Incident</span>
        </button>
      </div>
    </div>
  );
}
