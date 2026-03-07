import { ImportStatus, IMPORT_STATUS_ORDER, IMPORT_STATUS_LABELS } from '@/types';
import { Check } from 'lucide-react';

interface Props {
  currentStatus: ImportStatus;
}

export default function ImportTimeline({ currentStatus }: Props) {
  const currentIndex = IMPORT_STATUS_ORDER.indexOf(currentStatus);

  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-2">
      {IMPORT_STATUS_ORDER.map((status, i) => {
        const isComplete = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isPending = i > currentIndex;

        return (
          <div key={status} className="flex items-center shrink-0">
            <div className="flex flex-col items-center">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                  isComplete
                    ? 'bg-success border-success text-success-foreground'
                    : isCurrent
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'bg-card border-border text-muted-foreground'
                }`}
              >
                {isComplete ? <Check size={12} /> : i + 1}
              </div>
              <span className={`text-[9px] mt-1 text-center max-w-[60px] leading-tight ${
                isCurrent ? 'font-semibold text-primary' : isComplete ? 'text-success' : 'text-muted-foreground'
              }`}>
                {IMPORT_STATUS_LABELS[status]}
              </span>
            </div>
            {i < IMPORT_STATUS_ORDER.length - 1 && (
              <div className={`w-4 h-0.5 mt-[-14px] ${isComplete ? 'bg-success' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
