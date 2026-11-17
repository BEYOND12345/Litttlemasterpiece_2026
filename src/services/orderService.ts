import { supabase } from './supabaseClient';
import { Order, OrderTimeline, PaymentHistory, CartItem, ShippingAddress } from '../types/types';

export const getUserOrders = async (): Promise<Order[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        *,
        product:products (*),
        artwork:artworks (*)
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    throw new Error(error.message);
  }

  return data.map((order) => ({
    id: order.id,
    userId: order.user_id,
    items: order.order_items.map((item: any) => ({
      productId: item.product_id,
      artworkId: item.artwork_id,
      quantity: item.quantity,
      priceCents: item.price_cents,
    })),
    totalCents: order.total_cents,
    status: order.status,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  }));
};

export const getOrderById = async (orderId: string): Promise<Order | null> => {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        *,
        product:products (*),
        artwork:artworks (*)
      ),
      shipping_address:shipping_addresses (*)
    `)
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching order:', error);
    throw new Error(error.message);
  }

  if (!data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    items: data.order_items.map((item: any) => ({
      productId: item.product_id,
      artworkId: item.artwork_id,
      quantity: item.quantity,
      priceCents: item.price_cents,
    })),
    totalCents: data.total_cents,
    status: data.status,
    shippingAddress: data.shipping_address ? {
      id: data.shipping_address.id,
      userId: data.shipping_address.user_id,
      name: data.shipping_address.name,
      addressLine1: data.shipping_address.address_line1,
      addressLine2: data.shipping_address.address_line2,
      city: data.shipping_address.city,
      state: data.shipping_address.state,
      postalCode: data.shipping_address.postal_code,
      country: data.shipping_address.country,
    } : undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};

export const getOrderTimeline = async (orderId: string): Promise<OrderTimeline[]> => {
  const { data, error } = await supabase
    .from('order_timeline')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching order timeline:', error);
    throw new Error(error.message);
  }

  return data.map((event) => ({
    id: event.id,
    orderId: event.order_id,
    status: event.status,
    timestamp: event.created_at,
    notes: event.notes,
  }));
};

export const getUserPaymentHistory = async (): Promise<PaymentHistory[]> => {
  const { data, error } = await supabase
    .from('payment_history')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching payment history:', error);
    throw new Error(error.message);
  }

  return data.map((payment) => ({
    id: payment.id,
    userId: payment.user_id,
    orderId: payment.order_id,
    amountCents: payment.amount_cents,
    description: payment.description,
    status: payment.status,
    createdAt: payment.created_at,
  }));
};

/**
 * SWITCHED OFF. This was the old studio's checkout: it wrote the order with
 * a total the browser computed (and RLS lets a user write their own), then
 * called Gelato straight from the browser with a VITE_ key, with no payment
 * taken at all. Gelato's client is deleted; this now refuses before it
 * writes anything, so the legacy cart and CheckoutPage cannot order even if
 * they are reachable.
 *
 * Gifts are paid for in src/flow/checkout.ts: Stripe Checkout, priced on the
 * server, and sent to Gelato only by the stripe-webhook function after a
 * verified payment (docs/PAYMENTS.md).
 */
export const createOrder: (cartItems: CartItem[], shippingAddress: ShippingAddress) => Promise<string> = async () => {
  throw new Error(
    'Ordering from this page is switched off. To order a gift, use Create, choose your photo, and pay on the secure checkout.'
  );
};
