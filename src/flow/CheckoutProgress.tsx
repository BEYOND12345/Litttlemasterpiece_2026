/**
 * What the parent sees between pressing Order and arriving on Stripe's page:
 * each step as it happens, and if one fails, what failed, that nothing was
 * charged, and a way to try again. It sits OVER the flow, so Back returns to
 * the parent's choices rather than to an empty flow.
 */
import React from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { CHECKOUT_STEPS, type CheckoutStep } from './checkoutLogic';

interface CheckoutProgressProps {
  step: CheckoutStep;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
}

export const CheckoutProgress: React.FC<CheckoutProgressProps> = ({ step, error, onRetry, onBack }) => {
  const current = CHECKOUT_STEPS.findIndex((s) => s.id === step);
  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" data-testid="checkout-progress">
        {error ? (
          <div role="alert">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="text-terracotta shrink-0 mt-1" size={22} />
              <div>
                <h2 className="font-serif text-2xl text-stone-900">That didn't work</h2>
                <p className="text-stone-600 mt-2" data-testid="checkout-error">{error}</p>
              </div>
            </div>
            <button
              onClick={onRetry}
              className="w-full min-h-[48px] px-6 py-3 bg-terracotta text-white rounded-lg font-medium mb-2"
            >
              Try again
            </button>
            <button onClick={onBack} className="w-full min-h-[44px] text-stone-600">
              Back to my choices
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-serif text-2xl text-stone-900 mb-4">Getting your order ready</h2>
            <ol className="space-y-3" aria-live="polite">
              {CHECKOUT_STEPS.map((s, i) => (
                <li key={s.id} className={`flex items-center gap-3 ${i > current ? 'text-stone-400' : 'text-stone-800'}`}>
                  {i < current ? (
                    <Check size={18} className="text-terracotta" />
                  ) : i === current ? (
                    <Loader2 size={18} className="animate-spin text-terracotta" />
                  ) : (
                    <span className="inline-block w-[18px]" />
                  )}
                  {s.label}
                </li>
              ))}
            </ol>
            <p className="text-xs text-stone-500 mt-5">You'll pay on Stripe's secure page. Nothing is charged until you do.</p>
          </>
        )}
      </div>
    </div>
  );
};
