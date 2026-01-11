import { supabase } from './supabaseClient';
import { Guide } from '../types/types';

export const getAllGuides = async (): Promise<Guide[]> => {
  const { data, error } = await supabase
    .from('guides')
    .select('*')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false });

  if (error) {
    console.error('Error fetching guides:', error);
    throw new Error(error.message);
  }

  return data.map((guide) => ({
    id: guide.id,
    slug: guide.slug,
    title: guide.title,
    summary: guide.summary,
    content: guide.content,
    thumbnailUrl: guide.thumbnail_url,
    readTimeMinutes: guide.read_time_minutes,
    publishedAt: guide.published_at,
    updatedAt: guide.updated_at,
  }));
};

export const getGuideBySlug = async (slug: string): Promise<Guide | null> => {
  const { data, error} = await supabase
    .from('guides')
    .select('*')
    .eq('slug', slug)
    .lte('published_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error('Error fetching guide:', error);
    throw new Error(error.message);
  }

  if (!data) return null;

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    summary: data.summary,
    content: data.content,
    thumbnailUrl: data.thumbnail_url,
    readTimeMinutes: data.read_time_minutes,
    publishedAt: data.published_at,
    updatedAt: data.updated_at,
  };
};
