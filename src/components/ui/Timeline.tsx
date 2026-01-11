import React from 'react';
import { Check, Circle } from 'lucide-react';

export interface TimelineEvent {
  id?: string;
  status: string;
  timestamp: string;
  notes?: string;
  isCompleted?: boolean;
}

interface TimelineProps {
  events: TimelineEvent[];
}

export const Timeline: React.FC<TimelineProps> = ({ events }) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        const isCompleted = event.isCompleted !== false;

        return (
          <div key={event.id || index} className="relative flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isCompleted
                    ? 'bg-terracotta text-white'
                    : 'bg-stone-100 text-stone-400'
                }`}
              >
                {isCompleted ? <Check size={16} /> : <Circle size={16} />}
              </div>
              {!isLast && (
                <div
                  className={`w-0.5 h-full mt-2 ${
                    isCompleted ? 'bg-terracotta' : 'bg-stone-200'
                  }`}
                />
              )}
            </div>

            <div className="flex-1 pb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-medium text-stone-900 capitalize">
                    {event.status}
                  </h4>
                  <p className="text-sm text-stone-500 mt-1">
                    {formatDate(event.timestamp)}
                  </p>
                  {event.notes && (
                    <p className="text-sm text-stone-600 mt-2">{event.notes}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
