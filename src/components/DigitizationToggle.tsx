import React, { useState } from 'react';
import { Sparkles, Lock, Info } from 'lucide-react';

interface DigitizationToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  isPremium: boolean;
  creditCost: number;
  disabled?: boolean;
}

export const DigitizationToggle: React.FC<DigitizationToggleProps> = ({
  enabled,
  onChange,
  isPremium,
  creditCost,
  disabled = false,
}) => {
  const [showInfo, setShowInfo] = useState(false);

  const handleToggle = () => {
    if (disabled) return;
    onChange(!enabled);
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="text-blue-600" size={20} />
            <h3 className="font-semibold text-stone-900">Digitise this drawing</h3>
            {!isPremium && (
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                <Lock size={12} />
                {creditCost} credits
              </div>
            )}
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="text-blue-600 hover:text-blue-700 transition-colors"
              aria-label="More information"
            >
              <Info size={16} />
            </button>
          </div>

          <p className="text-sm text-stone-600 mb-3">
            We recreate the artwork on a clean digital canvas so it looks sharper and more consistent for print.
            All of their lines and shapes stay exactly the same.
          </p>

          {showInfo && (
            <div className="bg-white border border-blue-200 rounded-lg p-4 mb-3 text-sm text-stone-700">
              <p className="font-medium mb-2">What is Digitised Original?</p>
              <p className="mb-2">
                Digitised Original removes camera imperfections and redraws the artwork cleanly,
                without changing anything your child created.
              </p>
              <p>
                This option gives you the highest quality result for printing and gifting.
              </p>
            </div>
          )}

          <button
            onClick={handleToggle}
            disabled={disabled}
            className={`
              relative inline-flex h-8 w-14 items-center rounded-full transition-colors
              ${enabled ? 'bg-blue-600' : 'bg-stone-300'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            role="switch"
            aria-checked={enabled}
          >
            <span
              className={`
                inline-block h-6 w-6 transform rounded-full bg-white transition-transform
                ${enabled ? 'translate-x-7' : 'translate-x-1'}
              `}
            />
          </button>

          {enabled && !isPremium && (
            <p className="text-xs text-blue-700 mt-2">
              This will use {creditCost} credits when you continue
            </p>
          )}
        </div>
      </div>

      {!isPremium && (
        <div className="mt-4 pt-4 border-t border-blue-200">
          <p className="text-xs text-stone-500 italic">
            Your drawing stays exactly the same. We never change their characters, shapes or imagination.
          </p>
        </div>
      )}
    </div>
  );
};
