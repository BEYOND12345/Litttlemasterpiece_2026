import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, Clock, X } from 'lucide-react';
import { getUserGenerationQueue, getQueuePosition, cancelGeneration, GenerationQueueItem } from '../services/styleVariantsService';
import { Button } from './Button';

export const GenerationQueue: React.FC = () => {
  const [queue, setQueue] = useState<GenerationQueueItem[]>([]);
  const [positions, setPositions] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadQueue = async () => {
    try {
      const items = await getUserGenerationQueue();
      setQueue(items);

      const newPositions = new Map<string, number>();
      for (const item of items) {
        if (item.status === 'queued') {
          const position = await getQueuePosition(item.id);
          newPositions.set(item.id, position);
        }
      }
      setPositions(newPositions);
    } catch (error) {
      console.error('Failed to load generation queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (queueId: string) => {
    try {
      await cancelGeneration(queueId);
      await loadQueue();
    } catch (error) {
      console.error('Failed to cancel generation:', error);
      alert('Failed to cancel generation');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
        return <Clock size={18} className="text-blue-600" />;
      case 'processing':
        return <Loader2 size={18} className="text-blue-600 animate-spin" />;
      case 'completed':
        return <CheckCircle2 size={18} className="text-green-600" />;
      case 'failed':
        return <XCircle size={18} className="text-red-600" />;
      case 'cancelled':
        return <X size={18} className="text-stone-400" />;
      default:
        return null;
    }
  };

  const getStatusText = (item: GenerationQueueItem) => {
    switch (item.status) {
      case 'queued':
        const position = positions.get(item.id);
        return position ? `In queue (Position ${position})` : 'Queued';
      case 'processing':
        return 'Generating...';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return item.status;
    }
  };

  const getEstimatedTime = (position: number) => {
    const minutesPerItem = 2;
    const totalMinutes = position * minutesPerItem;
    if (totalMinutes < 1) return 'Less than a minute';
    if (totalMinutes === 1) return '1 minute';
    return `${totalMinutes} minutes`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-terracotta" />
      </div>
    );
  }

  if (queue.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl text-stone-900">Generation Queue</h3>
        <div className="text-sm text-stone-500">
          {queue.filter(q => q.status === 'queued' || q.status === 'processing').length} active
        </div>
      </div>

      <div className="space-y-3">
        {queue.map((item) => {
          const position = positions.get(item.id);
          const isActive = item.status === 'queued' || item.status === 'processing';

          return (
            <div
              key={item.id}
              className="flex items-center gap-4 p-4 bg-stone-50 rounded-lg border border-stone-200"
            >
              <div className="flex-shrink-0">
                {getStatusIcon(item.status)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-stone-900 capitalize">
                    {item.styleType}
                  </span>
                  <span className="text-sm text-stone-500">
                    {getStatusText(item)}
                  </span>
                </div>

                {item.status === 'queued' && position && position > 1 && (
                  <div className="text-xs text-stone-600">
                    Estimated wait: {getEstimatedTime(position)}
                  </div>
                )}

                {item.status === 'processing' && (
                  <div className="w-full bg-stone-200 rounded-full h-1.5 mt-2">
                    <div className="bg-terracotta h-1.5 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                )}

                {item.errorMessage && (
                  <div className="text-xs text-red-600 mt-1">
                    {item.errorMessage}
                  </div>
                )}
              </div>

              {isActive && item.status === 'queued' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCancel(item.id)}
                >
                  Cancel
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
