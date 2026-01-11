import { supabase } from './supabaseClient';
import { generateStyleVariant, StyleVariantConfig } from './enhancementService';
import { uploadImage, base64ToBlob } from './artworkService';
import { deductCredits, incrementArtworksEnhanced } from './creditsService';

export interface StyleVariant {
  id: string;
  artworkId: string;
  styleType: 'original' | 'enhanced' | 'monochrome' | 'duotone' | 'primary';
  fileUrl?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  fileSizeBytes?: number;
  generationStatus: 'pending' | 'processing' | 'completed' | 'failed';
  qualityScore?: number;
  aiModelUsed?: string;
  generationParameters?: Record<string, unknown>;
  isDownloadable: boolean;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationQueueItem {
  id: string;
  userId: string;
  artworkId: string;
  styleType: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  queuePosition?: number;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export const getArtworkVariants = async (artworkId: string): Promise<StyleVariant[]> => {
  const { data, error } = await supabase
    .from('artwork_style_variants')
    .select('*')
    .eq('artwork_id', artworkId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || []).map(mapVariantFromDb);
};

export const getVariantByStyle = async (
  artworkId: string,
  styleType: string
): Promise<StyleVariant | null> => {
  const { data, error } = await supabase
    .from('artwork_style_variants')
    .select('*')
    .eq('artwork_id', artworkId)
    .eq('style_type', styleType)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapVariantFromDb(data);
};

export const createStyleVariant = async (
  artworkId: string,
  styleType: 'original' | 'enhanced' | 'monochrome' | 'duotone' | 'primary',
  config?: StyleVariantConfig
): Promise<StyleVariant> => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    throw new Error('No authenticated user found');
  }

  const existingVariant = await getVariantByStyle(artworkId, styleType);
  if (existingVariant) {
    return existingVariant;
  }

  const { data, error } = await supabase
    .from('artwork_style_variants')
    .insert({
      artwork_id: artworkId,
      style_type: styleType,
      generation_status: 'pending',
      generation_parameters: config || {},
      is_downloadable: true,
    })
    .select()
    .single();

  if (error) throw error;

  return mapVariantFromDb(data);
};

export const queueStyleGeneration = async (
  artworkId: string,
  styleType: string,
  creditCost: number = 1
): Promise<GenerationQueueItem> => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    throw new Error('No authenticated user found');
  }

  const hasCredits = await deductCredits(
    creditCost,
    `Generate ${styleType} style variant`,
    artworkId
  );

  if (!hasCredits) {
    throw new Error('Insufficient credits');
  }

  const { data, error } = await supabase
    .from('generation_queue')
    .insert({
      user_id: user.id,
      artwork_id: artworkId,
      style_type: styleType,
      status: 'queued',
      retry_count: 0,
    })
    .select()
    .single();

  if (error) throw error;

  return mapQueueItemFromDb(data);
};

export const processStyleGeneration = async (
  queueId: string,
  baseImageUrl: string,
  config: StyleVariantConfig
): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    throw new Error('No authenticated user found');
  }

  await supabase
    .from('generation_queue')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
    })
    .eq('id', queueId);

  try {
    const generatedImage = await generateStyleVariant(baseImageUrl, config);

    const imageBlob = base64ToBlob(generatedImage);
    const fileName = `${config.styleType}-${Date.now()}.png`;
    const fileUrl = await uploadImage(imageBlob, user.id, fileName);

    const img = new Image();
    img.src = generatedImage;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const { data: queueItem } = await supabase
      .from('generation_queue')
      .select('artwork_id')
      .eq('id', queueId)
      .single();

    if (queueItem) {
      await supabase
        .from('artwork_style_variants')
        .update({
          file_url: fileUrl,
          width: img.width,
          height: img.height,
          generation_status: 'completed',
          ai_model_used: 'replicate-sdxl',
        })
        .eq('artwork_id', queueItem.artwork_id)
        .eq('style_type', config.styleType);
    }

    await supabase
      .from('generation_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', queueId);

    await incrementArtworksEnhanced();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await supabase
      .from('generation_queue')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', queueId);

    const { data: queueItem } = await supabase
      .from('generation_queue')
      .select('artwork_id, style_type')
      .eq('id', queueId)
      .single();

    if (queueItem) {
      await supabase
        .from('artwork_style_variants')
        .update({
          generation_status: 'failed',
          error_message: errorMessage,
        })
        .eq('artwork_id', queueItem.artwork_id)
        .eq('style_type', queueItem.style_type);
    }

    throw error;
  }
};

export const getUserGenerationQueue = async (): Promise<GenerationQueueItem[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    console.warn('No authenticated user found');
    return [];
  }

  const { data, error } = await supabase
    .from('generation_queue')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['queued', 'processing'])
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || []).map(mapQueueItemFromDb);
};

export const getQueuePosition = async (queueId: string): Promise<number> => {
  const { data: queueItem } = await supabase
    .from('generation_queue')
    .select('created_at, status')
    .eq('id', queueId)
    .single();

  if (!queueItem || queueItem.status !== 'queued') return 0;

  const { count } = await supabase
    .from('generation_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'queued')
    .lt('created_at', queueItem.created_at);

  return (count || 0) + 1;
};

export const cancelGeneration = async (queueId: string): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    throw new Error('No authenticated user found');
  }

  const { error } = await supabase
    .from('generation_queue')
    .update({ status: 'cancelled' })
    .eq('id', queueId)
    .eq('user_id', user.id)
    .eq('status', 'queued');

  if (error) throw error;
};

const mapVariantFromDb = (data: any): StyleVariant => ({
  id: data.id,
  artworkId: data.artwork_id,
  styleType: data.style_type,
  fileUrl: data.file_url,
  thumbnailUrl: data.thumbnail_url,
  width: data.width,
  height: data.height,
  fileSizeBytes: data.file_size_bytes,
  generationStatus: data.generation_status,
  qualityScore: data.quality_score,
  aiModelUsed: data.ai_model_used,
  generationParameters: data.generation_parameters,
  isDownloadable: data.is_downloadable,
  errorMessage: data.error_message,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
});

const mapQueueItemFromDb = (data: any): GenerationQueueItem => ({
  id: data.id,
  userId: data.user_id,
  artworkId: data.artwork_id,
  styleType: data.style_type,
  status: data.status,
  queuePosition: data.queue_position,
  startedAt: data.started_at,
  completedAt: data.completed_at,
  errorMessage: data.error_message,
  retryCount: data.retry_count,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
});
