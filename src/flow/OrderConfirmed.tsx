/**
 * Where Stripe sends the parent back (?session_id=cs_...). Shows the order's
 * real status from order-status, and re-checks a bounded number of times
 * while the webhook is still catching up. It never says more than the status
 * says: "pending" is "confirming", not "paid".
 */
import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getOrderStatus, type OrderStatusResponse } from './checkout';
import { STATUS_POLL_MAX, STATUS_POLL_MS, statusCopy } from './checkoutLogic';
import { PRODUCTS } from './products';

interface OrderConfirmedProps {
  sessionId: string;
  onDone: () => void;
}

const LOOK_NAMES: Record<string, string> = { as_drawn: 'As drawn', screen_print: 'Screen print' };

export const OrderConfirmed: React.FC<OrderConfirmedProps> = ({ sessionId, onDone }) => {
  const [order, setOrder] = useState<OrderStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getOrderStatus(sessionId)
      .then((o) => {
        if (cancelled) return;
        setOrder(o);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [sessionId, attempt]);

  // Re-check while the order is still moving; stop after STATUS_POLL_MAX.
  const settled = order ? statusCopy(order.status).settled : false;
  useEffect(() => {
    if (!order || settled || attempt >= STATUS_POLL_MAX) return;
    const t = setTimeout(() => setAttempt((a) => a + 1), STATUS_POLL_MS);
    return () => clearTimeout(t);
  }, [order, settled, attempt]);

  const copy = order ? statusCopy(order.status) : null;
  const productName = order ? PRODUCTS.find((p) => p.id === order.product)?.name : undefined;

  return (
    <div className="bg-stone-50 min-h-screen">
      <div className="max-w-xl mx-auto px-4 py-16 text-center" data-testid="order-confirmed">
        {/* One live region for "checking" and then the status itself, so a
            screen reader hears it move from Confirming to Paid without the
            parent having to go looking. It is there from the first render,
            which is what lets the changes be announced. */}
        <div role="status" data-testid="order-status">
          {!order && !error && (
            <>
              <Loader2 className="animate-spin mx-auto text-terracotta mb-4" size={36} aria-hidden="true" />
              <p className="font-serif text-2xl text-stone-900">Checking your order</p>
            </>
          )}

          {order && copy && (
            <>
              <h1 className="font-serif text-4xl text-stone-900 mb-3" data-testid="order-status-title">{copy.title}</h1>
              <p className="text-stone-600 mb-2">{copy.body}</p>
              {productName && (
                <p className="text-sm text-stone-500 mb-8">
                  {productName}, {LOOK_NAMES[order.look] ?? order.look}
                </p>
              )}
            </>
          )}
        </div>

        {error && !order && (
          <>
            <div role="alert">
              <p className="font-serif text-2xl text-stone-900 mb-2">{error}</p>
              <p className="text-stone-600 mb-6">This page couldn't check your order. If you paid, your payment is not affected.</p>
            </div>
            <button
              onClick={() => setAttempt((a) => a + 1)}
              className="min-h-[48px] px-6 py-3 bg-terracotta text-white rounded-lg font-medium"
            >
              Check again
            </button>
          </>
        )}

        {order && copy && !copy.settled && attempt >= STATUS_POLL_MAX && (
          <button
            onClick={() => setAttempt(0)}
            className="min-h-[44px] px-5 py-2 border border-stone-300 rounded-lg text-stone-700 mb-6"
          >
            Check again
          </button>
        )}

        <div>
          <button onClick={onDone} className="min-h-[48px] px-6 py-3 text-stone-700 underline">
            Make another gift
          </button>
        </div>
      </div>
    </div>
  );
};
