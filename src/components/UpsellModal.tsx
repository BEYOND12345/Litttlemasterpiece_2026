import React from 'react';
import { X, Sparkles, Check } from 'lucide-react';

interface UpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPayPerUse: () => void;
  onUpgrade: () => void;
  creditCost: number;
}

export const UpsellModal: React.FC<UpsellModalProps> = ({
  isOpen,
  onClose,
  onPayPerUse,
  onUpgrade,
  creditCost,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-stone-200 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-stone-900">Get a beautifully digitised version</h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-start gap-3 mb-4">
              <Sparkles className="text-blue-600 flex-shrink-0 mt-1" size={24} />
              <div>
                <p className="text-stone-700 mb-2">
                  Digitised Original recreates their drawing on a clean digital canvas for a sharper, premium finish.
                </p>
                <p className="text-stone-700 font-medium">
                  Perfect for framed prints and gifts.
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-stone-900 mb-3">What you get with Digitised Original:</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-stone-700">
                  <Check className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                  <span>Professional-quality digital recreation with crisp, clean lines</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-stone-700">
                  <Check className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                  <span>Removes camera shadows, desk texture, and paper imperfections</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-stone-700">
                  <Check className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                  <span>Perfect for large format prints and gallery-quality displays</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-stone-700">
                  <Check className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                  <span>100% preservation of your child's original composition and creativity</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={onPayPerUse}
              className="flex flex-col items-center gap-2 p-6 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <div className="text-2xl font-bold text-blue-600">{creditCost} Credits</div>
              <div className="text-sm font-semibold text-stone-900">Unlock for this artwork</div>
              <div className="text-xs text-stone-600 text-center">
                One-time digitization for this drawing
              </div>
            </button>

            <button
              onClick={onUpgrade}
              className="flex flex-col items-center gap-2 p-6 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
            >
              <div className="text-sm uppercase tracking-wide font-bold">Best Value</div>
              <div className="text-2xl font-bold">Upgrade to Premium</div>
              <div className="text-xs text-center opacity-90">
                Unlimited digitised artwork + more features
              </div>
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 text-stone-600 hover:text-stone-800 transition-colors text-sm font-medium"
          >
            Continue without digitising
          </button>

          <div className="mt-4 pt-4 border-t border-stone-200">
            <p className="text-xs text-stone-500 text-center italic">
              Your drawing stays exactly the same. We never change their characters, shapes or imagination.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
