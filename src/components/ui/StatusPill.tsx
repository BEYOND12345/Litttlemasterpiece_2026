import React from 'react';

interface StatusPillProps {
  status: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, variant }) => {
  const getVariantStyles = () => {
    const normalized = status.toLowerCase();

    if (variant === 'success' || normalized === 'delivered' || normalized === 'completed') {
      return 'bg-green-50 text-green-700 border-green-200';
    }
    if (variant === 'warning' || normalized === 'processing' || normalized === 'pending') {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (variant === 'error' || normalized === 'failed' || normalized === 'cancelled') {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    if (normalized === 'shipped') {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }

    return 'bg-stone-50 text-stone-700 border-stone-200';
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getVariantStyles()}`}
    >
      {status}
    </span>
  );
};
