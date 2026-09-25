import React from 'react';
import { Calendar, CheckCircle2, Clock, FileText, User } from 'lucide-react';
import { TimelineEvent } from '../../types';

interface TimelineTabProps {
  timeline: TimelineEvent[];
}

export const TimelineTab: React.FC<TimelineTabProps> = ({ timeline }) => {
  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold text-foreground-muted uppercase tracking-wider font-heading mb-2">
        Judicial Procedural Timeline
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E7E5E4] dark:before:bg-[#27272A]">
        {timeline.map((event) => {
          const isCompleted = event.status === 'Completed';
          return (
            <div key={event.id} className="relative group">
              {/* Dot Icon */}
              <div
                className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center bg-surface transition-colors ${
                  isCompleted
                    ? 'border-[#2E7D32] text-success'
                    : 'border-primary text-foreground'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 fill-current text-white dark:text-[#18181A]" />
                ) : (
                  <Clock className="w-3 h-3" />
                )}
              </div>

              {/* Event Content Card */}
              <div className="p-3.5 rounded-xl bg-surface border border-border shadow-2xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-heading font-extrabold text-xs text-foreground">
                    {event.title}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAFAF8] dark:bg-[#222225] text-foreground border border-border">
                    {event.date}
                  </span>
                </div>

                <p className="text-xs text-foreground-muted leading-relaxed">
                  {event.description}
                </p>

                <div className="flex items-center gap-3 pt-1 border-t border-border text-[10px] text-foreground-muted">
                  <span className="flex items-center gap-1 font-medium">
                    <User className="w-3 h-3 text-foreground" />
                    {event.actor}
                  </span>
                  {event.documentsAttached && (
                    <span className="flex items-center gap-1 text-foreground font-mono">
                      <FileText className="w-3 h-3" />
                      {event.documentsAttached} Files Attached
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
