import { useRef, useState, useCallback } from 'react';
import { Sankey, Tooltip, Rectangle } from 'recharts';
import { toPng } from 'html-to-image';
import { SessionBundle } from '../../services/sessionFile';
import { ApplicationStatus } from '../../types/storage';

interface Props {
  bundles: SessionBundle[];
}

// Pipeline stage nodes in display order
const STAGE_NODES = [
  { name: 'Saved', color: '#6b7280' },
  { name: 'Applied', color: '#eab308' },
  { name: 'Screened', color: '#3b82f6' },
  { name: 'Interviewing', color: '#2563eb' },
  { name: 'Take-Home', color: '#8b5cf6' },
  { name: 'Offered', color: '#16a34a' },
  { name: 'Accepted', color: '#059669' },
  { name: 'Rejected', color: '#dc2626' },
  { name: 'Withdrawn', color: '#f97316' },
] as const;

type StageName = (typeof STAGE_NODES)[number]['name'];

const NODE_INDEX: Record<StageName, number> = Object.fromEntries(
  STAGE_NODES.map((n, i) => [n.name, i])
) as Record<StageName, number>;

/** Map each ApplicationStatus to the canonical Sankey stage it ends at */
const STATUS_TO_STAGE: Record<ApplicationStatus, StageName> = {
  saved: 'Saved',
  applied: 'Applied',
  'phone-screen': 'Screened',
  'interview-1': 'Interviewing',
  'interview-2': 'Interviewing',
  'interview-3': 'Interviewing',
  'take-home': 'Take-Home',
  offered: 'Offered',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  none: 'Saved',
};

/** The ordered path each terminal stage implies */
const STAGE_PATH: Record<StageName, StageName[]> = {
  Saved: ['Saved'],
  Applied: ['Saved', 'Applied'],
  Screened: ['Saved', 'Applied', 'Screened'],
  Interviewing: ['Saved', 'Applied', 'Screened', 'Interviewing'],
  'Take-Home': ['Saved', 'Applied', 'Screened', 'Take-Home'],
  Offered: ['Saved', 'Applied', 'Screened', 'Interviewing', 'Offered'],
  Accepted: ['Saved', 'Applied', 'Screened', 'Interviewing', 'Offered', 'Accepted'],
  Rejected: ['Saved', 'Applied', 'Rejected'],
  Withdrawn: ['Saved', 'Applied', 'Withdrawn'],
};

interface SankeyLink {
  source: number;
  target: number;
  value: number;
  jobs: string[]; // job titles for tooltip
}

function buildSankeyData(bundles: SessionBundle[]) {
  // Accumulate link flows: key = "sourceIdx-targetIdx"
  const linkMap = new Map<string, { value: number; jobs: string[] }>();

  for (const bundle of bundles) {
    const status = bundle.session.applicationStatus ?? 'none';
    const stage = STATUS_TO_STAGE[status];
    const path = STAGE_PATH[stage];
    const jobTitle = bundle.jobDescription?.title ?? 'Unknown';

    for (let i = 0; i < path.length - 1; i++) {
      const src = NODE_INDEX[path[i]];
      const tgt = NODE_INDEX[path[i + 1]];
      const key = `${src}-${tgt}`;
      const existing = linkMap.get(key);
      if (existing) {
        existing.value += 1;
        if (!existing.jobs.includes(jobTitle)) existing.jobs.push(jobTitle);
      } else {
        linkMap.set(key, { value: 1, jobs: [jobTitle] });
      }
    }
  }

  const links: SankeyLink[] = [];
  for (const [key, data] of linkMap) {
    const [source, target] = key.split('-').map(Number);
    links.push({ source, target, value: data.value, jobs: data.jobs });
  }

  // Only include nodes that appear in at least one link
  const usedNodeIndices = new Set(links.flatMap((l) => [l.source, l.target]));
  const nodeIndexRemap = new Map<number, number>();
  const nodes: { name: string; color: string }[] = [];
  STAGE_NODES.forEach((node, origIdx) => {
    if (usedNodeIndices.has(origIdx)) {
      nodeIndexRemap.set(origIdx, nodes.length);
      nodes.push({ name: node.name, color: node.color });
    }
  });

  const remappedLinks = links.map((l) => ({
    ...l,
    source: nodeIndexRemap.get(l.source)!,
    target: nodeIndexRemap.get(l.target)!,
  }));

  return { nodes, links: remappedLinks };
}

interface CustomNodeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  payload?: { name: string; color: string; value: number };
}

function CustomNode({ x = 0, y = 0, width = 0, height = 0, payload }: CustomNodeProps) {
  if (!payload) return null;
  return (
    <g>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={payload.color}
        fillOpacity={0.85}
        radius={3}
      />
      <text
        x={x + width + 8}
        y={y + height / 2}
        textAnchor="start"
        dominantBaseline="middle"
        className="fill-current"
        style={{ fill: '#e2e8f0', fontSize: 12, fontWeight: 500 }}
      >
        {payload.name}
        <tspan style={{ fill: '#94a3b8', fontSize: 11 }}> ({payload.value})</tspan>
      </text>
    </g>
  );
}

interface TooltipPayload {
  payload?: {
    source?: { name: string };
    target?: { name: string };
    value?: number;
    jobs?: string[];
    name?: string;
  };
}

function CustomTooltip({ payload }: { payload?: TooltipPayload[] }) {
  if (!payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  // Link tooltip
  if (data.source && data.target) {
    const jobs = data.jobs ?? [];
    const shown = jobs.slice(0, 5);
    const extra = jobs.length - shown.length;
    return (
      <div className="bg-dark-surface border border-dark-border rounded-lg p-3 shadow-xl text-sm max-w-[220px]">
        <p className="font-semibold text-text-primary mb-1">
          {data.source.name} → {data.target.name}
        </p>
        <p className="text-accent-blue mb-2">{data.value} application{(data.value ?? 0) !== 1 ? 's' : ''}</p>
        {shown.length > 0 && (
          <ul className="space-y-0.5">
            {shown.map((j: string) => (
              <li key={j} className="text-xs text-text-secondary truncate">• {j}</li>
            ))}
            {extra > 0 && <li className="text-xs text-text-muted">+{extra} more</li>}
          </ul>
        )}
      </div>
    );
  }

  // Node tooltip
  return (
    <div className="bg-dark-surface border border-dark-border rounded-lg p-3 shadow-xl text-sm">
      <p className="font-semibold text-text-primary">{data.name}</p>
      <p className="text-text-secondary">{data.value} application{(data.value ?? 0) !== 1 ? 's' : ''}</p>
    </div>
  );
}

export default function SankeyChart({ bundles }: Props): JSX.Element {
  const chartRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const { nodes, links } = buildSankeyData(bundles);

  const handleExport = useCallback(async () => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(chartRef.current, { backgroundColor: '#0f172a', pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `application-flow-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }, []);

  if (bundles.length === 0 || links.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-center">
        <p className="text-sm text-text-muted max-w-xs">
          Add more applications to see your pipeline flow.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Export button */}
      <div className="flex justify-end">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-dark-border text-text-secondary hover:text-text-primary hover:bg-dark-hover transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {exporting ? 'Exporting...' : 'Export Chart'}
        </button>
      </div>

      {/* Chart */}
      <div ref={chartRef} className="bg-dark-bg rounded-xl p-4 overflow-x-auto">
        <Sankey
          width={700}
          height={420}
          data={{ nodes, links }}
          node={<CustomNode />}
          nodePadding={24}
          nodeWidth={14}
          margin={{ top: 10, right: 160, bottom: 10, left: 10 }}
          link={{ stroke: '#334155', strokeOpacity: 0.5 }}
        >
          <Tooltip content={<CustomTooltip />} />
        </Sankey>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-2">
        {STAGE_NODES.map((node) => (
          <div key={node.name} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: node.color }} />
            <span className="text-xs text-text-secondary">{node.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
