import { supabase } from './supabaseClient';
import { CartItem } from '../types/types';

interface AddCartItemData {
  artworkId: string;
  productVariantId: string;
  quantity: number;
  priceCents: number;
  gelatoMockupUrl?: string;
}

export const getCartItems = async (): Promise<CartItem[]> => {
  const { data, error } = await supabase
    .from('cart_items')
    .select(`
      *,
      artwork:artworks (*),
      productVariant:product_variants (
        *,
        product:products (*)
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching cart items:', error);
    throw new Error(error.message);
  }

  return data.map((item: any) => ({
    id: item.id,
    userId: item.user_id,
    artworkId: item.artwork_id,
    productVariantId: item.product_variant_id,
    quantity: item.quantity,
    priceCents: item.price_cents,
    gelatoMockupUrl: item.gelato_mockup_url,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    artwork: item.artwork ? {
      id: item.artwork.id,
      userId: item.artwork.user_id,
      title: item.artwork.title,
      originalUrl: item.artwork.original_url,
      processedUrl: item.artwork.processed_url,
      thumbnailUrl: item.artwork.thumbnail_url,
      medium: item.artwork.medium,
      subject: item.artwork.subject,
      style: item.artwork.style,
      backgroundColor: item.artwork.background_color,
      inkColor: item.artwork.ink_color,
      duotonePair: item.artwork.duotone_pair,
      signature: item.artwork.signature,
      transform: item.artwork.transform,
      createdAt: item.artwork.created_at,
    } : undefined,
    productVariant: item.productVariant ? {
      id: item.productVariant.id,
      productId: item.productVariant.product_id,
      name: item.productVariant.name,
      size: item.productVariant.size,
      material: item.productVariant.material,
      color: item.productVariant.color,
      gelatoVariantUid: item.productVariant.gelato_variant_uid,
      priceCents: item.productVariant.price_cents,
      isAvailable: item.productVariant.is_available,
      createdAt: item.productVariant.created_at,
      updatedAt: item.productVariant.updated_at,
    } : undefined,
    product: item.productVariant?.product ? {
      id: item.productVariant.product.id,
      name: item.productVariant.product.name,
      type: item.productVariant.product.type,
      description: item.productVariant.product.description,
      priceCents: item.productVariant.product.price_cents,
      mockupImageUrl: item.productVariant.product.mockup_image_url,
      gelatoTemplateId: item.productVariant.product.gelato_template_id,
      gelatoProductUid: item.productVariant.product.gelato_product_uid,
      basePriceCents: item.productVariant.product.base_price_cents,
    } : undefined,
  }));
};

export const addCartItem = async (itemData: AddCartItemData): Promise<CartItem> => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    throw new Error('User must be authenticated to add items to cart');
  }

  const existingItem = await supabase
    .from('cart_items')
    .select('*')
    .eq('user_id', user.id)
    .eq('artwork_id', itemData.artworkId)
    .eq('product_variant_id', itemData.productVariantId)
    .maybeSingle();

  if (existingItem.data) {
    return updateCartItemQuantity(
      existingItem.data.id,
      existingItem.data.quantity + itemData.quantity
    );
  }

  const { data, error } = await supabase
    .from('cart_items')
    .insert({
      user_id: user.id,
      artwork_id: itemData.artworkId,
      product_variant_id: itemData.productVariantId,
      quantity: itemData.quantity,
      price_cents: itemData.priceCents,
      gelato_mockup_url: itemData.gelatoMockupUrl,
    })
    .select(`
      *,
      artwork:artworks (*),
      productVariant:product_variants (
        *,
        product:products (*)
      )
    `)
    .single();

  if (error) {
    console.error('Error adding cart item:', error);
    throw new Error(error.message);
  }

  return {
    id: data.id,
    userId: data.user_id,
    artworkId: data.artwork_id,
    productVariantId: data.product_variant_id,
    quantity: data.quantity,
    priceCents: data.price_cents,
    gelatoMockupUrl: data.gelato_mockup_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};

export const updateCartItemQuantity = async (
  itemId: string,
  quantity: number
): Promise<CartItem> => {
  if (quantity <= 0) {
    throw new Error('Quantity must be greater than 0');
  }

  const { data, error } = await supabase
    .from('cart_items')
    .update({ quantity })
    .eq('id', itemId)
    .select(`
      *,
      artwork:artworks (*),
      productVariant:product_variants (
        *,
        product:products (*)
      )
    `)
    .single();

  if (error) {
    console.error('Error updating cart item:', error);
    throw new Error(error.message);
  }

  return {
    id: data.id,
    userId: data.user_id,
    artworkId: data.artwork_id,
    productVariantId: data.product_variant_id,
    quantity: data.quantity,
    priceCents: data.price_cents,
    gelatoMockupUrl: data.gelato_mockup_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};

export const removeCartItem = async (itemId: string): Promise<void> => {
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    console.error('Error removing cart item:', error);
    throw new Error(error.message);
  }
};

export const clearCart = async (): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    throw new Error('User must be authenticated');
  }

  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    console.error('Error clearing cart:', error);
    throw new Error(error.message);
  }
};

export const getProductVariants = async (productId: string) => {
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .eq('is_available', true)
    .order('size');

  if (error) {
    console.error('Error fetching product variants:', error);
    throw new Error(error.message);
  }

  return data.map((variant: any) => ({
    id: variant.id,
    productId: variant.product_id,
    name: variant.name,
    size: variant.size,
    material: variant.material,
    color: variant.color,
    gelatoVariantUid: variant.gelato_variant_uid,
    priceCents: variant.price_cents,
    isAvailable: variant.is_available,
    createdAt: variant.created_at,
    updatedAt: variant.updated_at,
  }));
};
