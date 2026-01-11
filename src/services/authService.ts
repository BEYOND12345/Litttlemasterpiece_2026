import { supabase } from './supabaseClient';
import { User } from '../types/types';

// Session cache to prevent multiple auth lookups during operations
let cachedUser: User | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5000; // 5 seconds

export const signUp = async (email: string, password: string, name: string): Promise<User> => {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name
      }
    }
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('Failed to create user');

  if (!authData.session) {
    throw new Error('Please check your email to confirm your account before signing in.');
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (userError) throw userError;
  if (!userData) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const { data: retryData } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (!retryData) throw new Error('Failed to create user profile');

    return {
      id: retryData.id,
      email: retryData.email,
      name: retryData.name,
      avatarUrl: retryData.avatar_url,
      createdAt: retryData.created_at
    };
  }

  return {
    id: userData.id,
    email: userData.email,
    name: userData.name,
    avatarUrl: userData.avatar_url,
    createdAt: userData.created_at
  };
};

export const signIn = async (email: string, password: string): Promise<User> => {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('Failed to sign in');

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (userError) throw userError;
  if (!userData) throw new Error('User profile not found');

  return {
    id: userData.id,
    email: userData.email,
    name: userData.name,
    avatarUrl: userData.avatar_url,
    createdAt: userData.created_at
  };
};

export const signOut = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentUser = async (useCache = false): Promise<User | null> => {
  // Use cache if requested and cache is fresh
  if (useCache && cachedUser && Date.now() - cacheTimestamp < CACHE_DURATION) {
    console.log('📦 Using cached user:', cachedUser.email);
    return cachedUser;
  }

  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    cachedUser = null;
    cacheTimestamp = Date.now();
    return null;
  }

  const { data: userData, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error || !userData) {
    cachedUser = null;
    cacheTimestamp = Date.now();
    return null;
  }

  const user = {
    id: userData.id,
    email: userData.email,
    name: userData.name,
    avatarUrl: userData.avatar_url,
    createdAt: userData.created_at
  };

  // Update cache
  cachedUser = user;
  cacheTimestamp = Date.now();

  return user;
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return supabase.auth.onAuthStateChange((_event, session) => {
    // CRITICAL FIX: Must NOT use async directly in the callback
    // Wrap in IIFE to prevent Supabase deadlock
    (async () => {
      try {
        if (session?.user) {
          // Use fresh lookup (don't use cache in auth change handler)
          const user = await getCurrentUser(false);
          callback(user);
        } else {
          // Clear cache on logout
          cachedUser = null;
          cacheTimestamp = 0;
          callback(null);
        }
      } catch (error) {
        console.error('❌ Error in auth state change:', error);
        cachedUser = null;
        cacheTimestamp = 0;
        callback(null);
      }
    })();
  });
};
