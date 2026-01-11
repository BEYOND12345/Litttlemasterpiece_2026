import { supabase } from './supabaseClient';

export interface SubscriptionTier {
  id: string;
  tierName: string;
  displayName: string;
  creditsIncluded: number;
  maxStyleVariants: number;
  maxResolution: number;
  allowsDownloads: boolean;
  priceCents: number;
  billingPeriod: string;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  transactionType: 'purchase' | 'usage' | 'refund' | 'bonus' | 'subscription';
  description: string;
  artworkId?: string;
  generationQueueId?: string;
  balanceAfter: number;
  createdAt: string;
}

export interface UserCredits {
  subscriptionTier: string;
  creditsRemaining: number;
  totalArtworksEnhanced: number;
  subscriptionExpiresAt?: string;
}

export const getUserCredits = async (): Promise<UserCredits | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    console.warn('No authenticated user found');
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_tier, credits_remaining, total_artworks_enhanced, subscription_expires_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    subscriptionTier: data.subscription_tier,
    creditsRemaining: data.credits_remaining,
    totalArtworksEnhanced: data.total_artworks_enhanced,
    subscriptionExpiresAt: data.subscription_expires_at,
  };
};

export const getSubscriptionTiers = async (): Promise<SubscriptionTier[]> => {
  const { data, error } = await supabase
    .from('subscription_tiers')
    .select('*')
    .order('price_cents', { ascending: true });

  if (error) throw error;

  return (data || []).map(item => ({
    id: item.id,
    tierName: item.tier_name,
    displayName: item.display_name,
    creditsIncluded: item.credits_included,
    maxStyleVariants: item.max_style_variants,
    maxResolution: item.max_resolution,
    allowsDownloads: item.allows_downloads,
    priceCents: item.price_cents,
    billingPeriod: item.billing_period,
  }));
};

export const getTierByName = async (tierName: string): Promise<SubscriptionTier | null> => {
  const { data, error } = await supabase
    .from('subscription_tiers')
    .select('*')
    .eq('tier_name', tierName)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    tierName: data.tier_name,
    displayName: data.display_name,
    creditsIncluded: data.credits_included,
    maxStyleVariants: data.max_style_variants,
    maxResolution: data.max_resolution,
    allowsDownloads: data.allows_downloads,
    priceCents: data.price_cents,
    billingPeriod: data.billing_period,
  };
};

export const deductCredits = async (
  amount: number,
  description: string,
  artworkId?: string,
  generationQueueId?: string
): Promise<boolean> => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    throw new Error('No authenticated user found');
  }

  const credits = await getUserCredits();
  if (!credits) {
    throw new Error('User profile not found');
  }

  if (credits.creditsRemaining < amount) {
    return false;
  }

  const newBalance = credits.creditsRemaining - amount;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ credits_remaining: newBalance })
    .eq('user_id', user.id);

  if (updateError) throw updateError;

  const { error: transactionError } = await supabase
    .from('credit_transactions')
    .insert({
      user_id: user.id,
      amount: -amount,
      transaction_type: 'usage',
      description,
      artwork_id: artworkId,
      generation_queue_id: generationQueueId,
      balance_after: newBalance,
    });

  if (transactionError) throw transactionError;

  return true;
};

export const addCredits = async (
  amount: number,
  transactionType: 'purchase' | 'refund' | 'bonus' | 'subscription',
  description: string
): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    throw new Error('No authenticated user found');
  }

  const credits = await getUserCredits();
  if (!credits) {
    throw new Error('User profile not found');
  }

  const newBalance = credits.creditsRemaining + amount;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ credits_remaining: newBalance })
    .eq('user_id', user.id);

  if (updateError) throw updateError;

  const { error: transactionError } = await supabase
    .from('credit_transactions')
    .insert({
      user_id: user.id,
      amount,
      transaction_type: transactionType,
      description,
      balance_after: newBalance,
    });

  if (transactionError) throw transactionError;
};

export const getCreditTransactions = async (limit: number = 50): Promise<CreditTransaction[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    console.warn('No authenticated user found');
    return [];
  }

  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map(item => ({
    id: item.id,
    userId: item.user_id,
    amount: item.amount,
    transactionType: item.transaction_type,
    description: item.description,
    artworkId: item.artwork_id,
    generationQueueId: item.generation_queue_id,
    balanceAfter: item.balance_after,
    createdAt: item.created_at,
  }));
};

export const hasEnoughCredits = async (requiredCredits: number): Promise<boolean> => {
  const credits = await getUserCredits();
  if (!credits) return false;
  return credits.creditsRemaining >= requiredCredits;
};

export const canGenerateStyle = async (): Promise<{ allowed: boolean; reason?: string }> => {
  const credits = await getUserCredits();

  if (!credits) {
    return { allowed: false, reason: 'User profile not found' };
  }

  if (credits.creditsRemaining < 1) {
    return { allowed: false, reason: 'Insufficient credits' };
  }

  const tier = await getTierByName(credits.subscriptionTier);

  if (!tier) {
    return { allowed: false, reason: 'Invalid subscription tier' };
  }

  return { allowed: true };
};

export const incrementArtworksEnhanced = async (): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    throw new Error('No authenticated user found');
  }

  const credits = await getUserCredits();
  if (!credits) {
    throw new Error('User profile not found');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ total_artworks_enhanced: credits.totalArtworksEnhanced + 1 })
    .eq('user_id', user.id);

  if (error) throw error;
};
