import { supabase } from './supabaseClient';
import { Profile, ShippingAddress } from '../types/types';

export const getProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile:', error);
    throw new Error(error.message);
  }

  if (!data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    childNames: data.child_names || [],
    defaultSignature: data.default_signature,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};

export const createProfile = async (
  userId: string,
  profileData: Partial<Profile>
): Promise<Profile> => {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      user_id: userId,
      child_names: profileData.childNames || [],
      default_signature: profileData.defaultSignature || {},
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating profile:', error);
    throw new Error(error.message);
  }

  return {
    id: data.id,
    userId: data.user_id,
    childNames: data.child_names || [],
    defaultSignature: data.default_signature,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};

export const updateProfile = async (
  userId: string,
  updates: Partial<Profile>
): Promise<Profile> => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      child_names: updates.childNames,
      default_signature: updates.defaultSignature,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating profile:', error);
    throw new Error(error.message);
  }

  return {
    id: data.id,
    userId: data.user_id,
    childNames: data.child_names || [],
    defaultSignature: data.default_signature,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};

export const getUserShippingAddresses = async (): Promise<ShippingAddress[]> => {
  const { data, error } = await supabase
    .from('shipping_addresses')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching shipping addresses:', error);
    throw new Error(error.message);
  }

  return data.map((addr) => ({
    id: addr.id,
    userId: addr.user_id,
    name: addr.name,
    addressLine1: addr.address_line1,
    addressLine2: addr.address_line2,
    city: addr.city,
    state: addr.state,
    postalCode: addr.postal_code,
    country: addr.country,
  }));
};

export const createShippingAddress = async (
  address: Omit<ShippingAddress, 'id'>
): Promise<ShippingAddress> => {
  const { data, error } = await supabase
    .from('shipping_addresses')
    .insert({
      user_id: address.userId,
      name: address.name,
      address_line1: address.addressLine1,
      address_line2: address.addressLine2,
      city: address.city,
      state: address.state,
      postal_code: address.postalCode,
      country: address.country,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating shipping address:', error);
    throw new Error(error.message);
  }

  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    addressLine1: data.address_line1,
    addressLine2: data.address_line2,
    city: data.city,
    state: data.state,
    postalCode: data.postal_code,
    country: data.country,
  };
};
