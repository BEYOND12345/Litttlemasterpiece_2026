import { supabase } from './supabaseClient';
import { Order, OrderTimeline, PaymentHistory, CartItem, ShippingAddress } from '../types/types';
import { createGelatoOrder } from './gelatoService';

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

export const createOrder = async (
  cartItems: CartItem[],
  shippingAddress: ShippingAddress
): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    throw new Error('User must be authenticated to create an order');
  }

  const totalCents = cartItems.reduce((sum, item) => sum + (item.priceCents * item.quantity), 0);

  const { data: addressData, error: addressError } = await supabase
    .from('shipping_addresses')
    .insert({
      user_id: user.id,
      name: shippingAddress.name,
      address_line1: shippingAddress.addressLine1,
      address_line2: shippingAddress.addressLine2,
      city: shippingAddress.city,
      state: shippingAddress.state,
      postal_code: shippingAddress.postalCode,
      country: shippingAddress.country,
    })
    .select()
    .single();

  if (addressError) {
    console.error('Error creating shipping address:', addressError);
    throw new Error('Failed to save shipping address');
  }

  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: user.id,
      total_cents: totalCents,
      status: 'pending',
      payment_status: 'pending',
      shipping_address_id: addressData.id,
    })
    .select()
    .single();

  if (orderError) {
    console.error('Error creating order:', orderError);
    throw new Error('Failed to create order');
  }

  const orderItemsData = cartItems.map(item => ({
    order_id: orderData.id,
    product_id: item.productVariant?.productId || '',
    artwork_id: item.artworkId,
    quantity: item.quantity,
    price_cents: item.priceCents,
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItemsData);

  if (itemsError) {
    console.error('Error creating order items:', itemsError);
    throw new Error('Failed to save order items');
  }

  await supabase
    .from('order_timeline')
    .insert({
      order_id: orderData.id,
      status: 'pending',
      notes: 'Order created',
    });

  try {
    const nameParts = shippingAddress.name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;

    const gelatoOrderRequest = {
      orderReferenceId: orderData.id,
      orderType: 'draft' as const,
      items: cartItems.map((item, index) => ({
        itemReferenceId: `${orderData.id}-${index}`,
        productUid: item.product?.gelatoProductUid || 'poster_fine-art-matte_a4_pt',
        fileUrl: item.artwork?.processedUrl || '',
        quantity: item.quantity,
      })),
      shippingAddress: {
        firstName,
        lastName,
        addressLine1: shippingAddress.addressLine1,
        addressLine2: shippingAddress.addressLine2,
        city: shippingAddress.city,
        postCode: shippingAddress.postalCode,
        state: shippingAddress.state,
        country: shippingAddress.country,
        email: user.email || '',
      },
    };

    const gelatoResponse = await createGelatoOrder(gelatoOrderRequest);

    await supabase
      .from('orders')
      .update({ gelato_order_id: gelatoResponse.id })
      .eq('id', orderData.id);

    await supabase
      .from('gelato_orders')
      .insert({
        order_id: orderData.id,
        gelato_order_id: gelatoResponse.id,
        gelato_order_reference: gelatoResponse.orderReferenceId,
        status: gelatoResponse.status,
        gelato_response: gelatoResponse,
      });

    await supabase
      .from('order_timeline')
      .insert({
        order_id: orderData.id,
        status: 'processing',
        notes: 'Order submitted to Gelato for fulfillment',
      });
  } catch (gelatoError) {
    console.error('Gelato API error:', gelatoError);
    await supabase
      .from('order_timeline')
      .insert({
        order_id: orderData.id,
        status: 'pending',
        notes: 'Gelato submission failed - will retry',
      });
  }

  return orderData.id;
};
