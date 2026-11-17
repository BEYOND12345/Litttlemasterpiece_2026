/**
 * What the parent sees between pressing Order and arriving on Stripe's page:
 * each step as it happens, and if one fails, what failed, that nothing was
 * charged, and a way to try again. It sits OVER the flow, so Back returns to
 * the parent's choices rather than to an empty flow.
 *
 * A real modal: rendered into <body> above the sticky header (z-50 in
 * Layout.tsx), with everything behind it inert, focus moved in on open and
 * handed back on close. Escape closes it only once something has failed:
 * while a step is running the order is still on its way to Stripe, and
 * closing the overlay would not stop it.
 */
import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { CHECKOUT_STEPS, type CheckoutStep } from './checkoutLogic';

interface CheckoutProgressProps {
  step: CheckoutStep;
  error: string | null;
  /** Ordering is switched off in this build: say so calmly, with no Try again. */
  previewOnly?: boolean;
  onRetry: () => void;
  onBack: () => void;
}

export const CheckoutProgress: React.FC<CheckoutProgressProps> = ({ step, error, previewOnly, onRetry, onBack }) => {
  const current = CHECKOUT_STEPS.findIndex((s) => s.id === step);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);

  // Modal while open: the app behind can't be reached by Tab or a screen
  // reader, and focus goes back to what had it (the Order button) on close.
  useEffect(() => {
    const app = document.getElementById('root');
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    app?.setAttribute('inert', '');
    return () => {
      // Un-inert first: nothing inside an inert tree can take focus.
      app?.removeAttribute('inert');
      if (before && before !== document.body && before.isConnected) before.focus();
    };
  }, []);

  // Focus follows what there is to do: the panel while the steps run, Try
  // again once one has failed (and back to the panel when it is retried).
  useEffect(() => {
    (error ? retryRef.current : panelRef.current)?.focus();
  }, [error]);

  // Escape is Back to my choices, but only when nothing is in flight.
  useEffect(() => {
    if (!error) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onBack();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [error, onBack]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-stone-900/40 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 outline-none"
        data-testid="checkout-progress"
      >
        {error && previewOnly ? (
          <>
            <div role="status" className="mb-5">
              <h2 id={titleId} className="font-serif text-2xl text-stone-900">Ordering opens soon</h2>
              <p className="text-stone-600 mt-2" data-testid="checkout-error">{error}</p>
            </div>
            <button
              ref={retryRef}
              onClick={onBack}
              className="w-full min-h-[48px] px-6 py-3 bg-terracotta text-white rounded-lg font-medium"
            >
              Back to my choices
            </button>
          </>
        ) : error ? (
          <>
            <div role="alert" className="flex items-start gap-3 mb-4">
              <AlertCircle className="text-terracotta shrink-0 mt-1" size={22} aria-hidden="true" />
              <div>
                <h2 id={titleId} className="font-serif text-2xl text-stone-900">That didn't work</h2>
                <p className="text-stone-600 mt-2" data-testid="checkout-error">{error}</p>
              </div>
            </div>
            <button
              ref={retryRef}
              onClick={onRetry}
              className="w-full min-h-[48px] px-6 py-3 bg-terracotta text-white rounded-lg font-medium mb-2"
            >
              Try again
            </button>
            <button onClick={onBack} className="w-full min-h-[44px] text-stone-600">
              Back to my choices
            </button>
          </>
        ) : (
          <>
            <h2 id={titleId} className="font-serif text-2xl text-stone-900 mb-4">Getting your order ready</h2>
            <ol className="space-y-3">
              {CHECKOUT_STEPS.map((s, i) => (
                <li key={s.id} className={`flex items-center gap-3 ${i > current ? 'text-stone-400' : 'text-stone-800'}`}>
                  {i < current ? (
                    <Check size={18} className="text-terracotta" aria-hidden="true" />
                  ) : i === current ? (
                    <Loader2 size={18} className="animate-spin text-terracotta" aria-hidden="true" />
                  ) : (
                    <span className="inline-block w-[18px]" aria-hidden="true" />
                  )}
                  {s.label}
                  {i < current && <span className="sr-only">, done</span>}
                </li>
              ))}
            </ol>
            {/* The spinner, in words: announced as each step starts. */}
            <p role="status" className="sr-only" data-testid="checkout-status">
              {current >= 0 ? `Step ${current + 1} of ${CHECKOUT_STEPS.length}: ${CHECKOUT_STEPS[current].label}` : ''}
            </p>
            <p className="text-xs text-stone-500 mt-5">You'll pay on Stripe's secure page. Nothing is charged until you do.</p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};
