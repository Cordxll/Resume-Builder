import { type JSX } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ApplicationStatus } from '../../types/storage';
import { SessionBundle } from '../../services/sessionFile';

interface Props {
  bundles: SessionBundle[];
  onSelectBundle: (bundle: SessionBundle) => void;
  onStatusChange: (sessionId: string, newStatus: ApplicationStatus) => void;
}

interface BoardColumn {
  label: string;
  statuses: ApplicationStatus[];
  dropStatus: ApplicationStatus;
  color: string;
  headerColor: string;
}

const BOARD_COLUMNS: BoardColumn[] = [
  {
    label: 'Pipeline',
    statuses: ['saved'],
    dropStatus: 'saved',
    color: 'border-gray-500/30',
    headerColor: 'text-gray-400',
  },
  {
    label: 'Applied',
    statuses: ['applied'],
    dropStatus: 'applied',
    color: 'border-yellow-500/30',
    headerColor: 'text-yellow-400',
  },
  {
    label: 'Interviewing',
    statuses: ['phone-screen', 'interview-1', 'interview-2', 'interview-3', 'take-home'],
    dropStatus: 'interview-1',
    color: 'border-blue-500/30',
    headerColor: 'text-blue-400',
  },
  {
    label: 'Outcomes',
    statuses: ['offered', 'accepted', 'rejected', 'withdrawn'],
    dropStatus: 'offered',
    color: 'border-green-500/30',
    headerColor: 'text-green-400',
  },
  {
    label: 'Not Tracking',
    statuses: ['none'],
    dropStatus: 'none',
    color: 'border-dark-border',
    headerColor: 'text-text-muted',
  },
];

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  none: 'No Status',
  saved: 'Saved',
  applied: 'Applied',
  'phone-screen': 'Phone Screen',
  'interview-1': 'Interview 1',
  'interview-2': 'Interview 2',
  'interview-3': 'Interview 3+',
  'take-home': 'Take-Home',
  offered: 'Offered',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

const STATUS_BADGE_COLORS: Record<ApplicationStatus, string> = {
  none: 'bg-gray-500/20 text-gray-400',
  saved: 'bg-gray-500/20 text-gray-400',
  applied: 'bg-yellow-500/20 text-yellow-400',
  'phone-screen': 'bg-blue-500/20 text-blue-400',
  'interview-1': 'bg-blue-500/20 text-blue-400',
  'interview-2': 'bg-blue-500/20 text-blue-400',
  'interview-3': 'bg-blue-500/20 text-blue-400',
  'take-home': 'bg-blue-500/20 text-blue-400',
  offered: 'bg-green-500/20 text-green-400',
  accepted: 'bg-emerald-500/20 text-emerald-400',
  rejected: 'bg-red-500/20 text-red-400',
  withdrawn: 'bg-orange-500/20 text-orange-400',
};

interface CardProps {
  bundle: SessionBundle;
  onClick: () => void;
  index: number;
}

function ApplicationCard({ bundle, onClick, index }: CardProps): JSX.Element {
  const { session, resume, jobDescription } = bundle;
  const status = session.applicationStatus ?? 'none';

  return (
    <Draggable draggableId={session.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          className={`transition-shadow ${snapshot.isDragging ? 'shadow-2xl rotate-1 opacity-95' : ''}`}
        >
          <button
            onClick={onClick}
            className="w-full text-left p-3 rounded-lg bg-dark-elevated border border-dark-border hover:border-accent-blue/40 hover:bg-dark-hover transition-all"
          >
            <p className="text-sm font-semibold text-text-primary truncate">
              {jobDescription?.title ?? 'Unknown Job'}
            </p>
            {jobDescription?.company && (
              <p className="text-xs text-text-secondary mt-0.5 truncate">{jobDescription.company}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${STATUS_BADGE_COLORS[status]}`}>
                {STATUS_LABELS[status]}
              </span>
              {session.appliedAt && (
                <span className="text-xs text-text-muted">{session.appliedAt.slice(0, 10)}</span>
              )}
            </div>
            {resume?.name && (
              <p className="text-xs text-text-muted mt-1.5 truncate">{resume.name}</p>
            )}
          </button>
        </div>
      )}
    </Draggable>
  );
}

export default function TrackerBoard({ bundles, onSelectBundle, onStatusChange }: Props): JSX.Element {
  function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const destCol = BOARD_COLUMNS.find((c) => c.label === destination.droppableId);
    if (!destCol) return;

    onStatusChange(draggableId, destCol.dropStatus);
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 h-full min-h-0">
        {BOARD_COLUMNS.map((col) => {
          const colBundles = bundles.filter((b) =>
            col.statuses.includes(b.session.applicationStatus ?? 'none')
          );

          return (
            <div
              key={col.label}
              className={`flex-shrink-0 w-64 flex flex-col rounded-xl border ${col.color} bg-dark-surface/50`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-dark-border flex-shrink-0">
                <h3 className={`text-xs font-semibold uppercase tracking-wider ${col.headerColor}`}>
                  {col.label}
                </h3>
                <span className="text-xs text-text-muted font-medium bg-dark-elevated px-1.5 py-0.5 rounded-full">
                  {colBundles.length}
                </span>
              </div>

              {/* Cards */}
              <Droppable droppableId={col.label}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px] rounded-b-xl transition-colors ${
                      snapshot.isDraggingOver ? 'bg-accent-blue/5' : ''
                    }`}
                  >
                    {colBundles.length === 0 && !snapshot.isDraggingOver ? (
                      <p className="text-xs text-text-muted text-center py-6 px-2">No applications</p>
                    ) : (
                      colBundles.map((bundle, index) => (
                        <ApplicationCard
                          key={bundle.session.id}
                          bundle={bundle}
                          onClick={() => onSelectBundle(bundle)}
                          index={index}
                        />
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
