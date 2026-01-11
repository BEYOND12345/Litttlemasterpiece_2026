import { supabase } from './supabaseClient';
import { Product, ProductType } from '../types/types';

export const getAllProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching products:', error);
    throw new Error(error.message);
  }

  return data.map((product) => ({
    id: product.id,
    name: product.name,
    type: product.type as ProductType,
    description: product.description,
    priceCents: product.price_cents,
    mockupImageUrl: product.mockup_image_url,
  }));
};

export const getProductById = async (productId: string): Promise<Product | null> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching product:', error);
    throw new Error(error.message);
  }

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    type: data.type as ProductType,
    description: data.description,
    priceCents: data.price_cents,
    mockupImageUrl: data.mockup_image_url,
  };
};

export const getProductsByType = async (productType?: string): Promise<any[]> => {
  let query = supabase
    .from('products')
    .select('*')
    .order('name');

  if (productType) {
    query = query.eq('type', productType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching products:', error);
    throw new Error(error.message);
  }

  return data || [];
};
