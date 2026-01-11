import { supabase } from './supabaseClient';
import { Artwork } from '../types/types';

export const uploadImage = async (
  file: Blob,
  userId: string,
  filename: string
): Promise<string> => {
  const filePath = `${userId}/${Date.now()}_${filename}`;

  const { data, error } = await supabase.storage
    .from('artworks')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('artworks')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
};

export const base64ToBlob = (base64: string): Blob => {
  const base64Data = base64.split(',')[1];
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: 'image/png' });
};

export const createThumbnail = (base64Image: string, maxSize: number = 400): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      const scale = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
};

// Helper to convert URL or base64 string to Blob
const urlOrBase64ToBlob = async (input: string): Promise<Blob> => {
  if (input.startsWith('data:')) {
    // It's a base64 string
    return base64ToBlob(input);
  } else if (input.startsWith('http://') || input.startsWith('https://') || input.startsWith('blob:')) {
    // It's a URL - fetch it
    const response = await fetch(input);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
    }
    return await response.blob();
  } else {
    throw new Error('Invalid image format: must be base64 or URL');
  }
};

export const saveArtwork = async (
  artwork: Omit<Artwork, 'id' | 'createdAt'>,
  cloudinaryPublicId?: string
): Promise<Artwork> => {
  console.log('💾 saveArtwork called');

  // CRITICAL: Use getSession() instead of getUser() to avoid triggering auth state changes
  let { data: sessionData } = await supabase.auth.getSession();
  let session = sessionData?.session;
  let user = session?.user;

  console.log('🔐 Session check:', session ? 'exists' : 'null', 'User:', user ? user.email : 'null');

  // If no session, try to refresh it (handles timing issue after fresh login)
  if (!user) {
    console.log('🔄 No session found, attempting refresh...');
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError) {
      console.error('❌ Session refresh failed:', refreshError);
      throw new Error('Please sign in to save your artwork');
    }

    if (refreshData.session?.user) {
      console.log('✅ Session refreshed successfully:', refreshData.session.user.email);
      session = refreshData.session;
      user = refreshData.session.user;
    } else {
      console.error('❌ No authenticated user - cannot save artwork');
      throw new Error('Please sign in to save your artwork');
    }
  }

  console.log('✅ Session verified, user:', user.email);

  // Convert URLs or base64 strings to blobs
  console.log('📥 Converting images to blobs...');
  const originalBlob = await urlOrBase64ToBlob(artwork.originalUrl);
  const processedBlob = await urlOrBase64ToBlob(artwork.processedUrl);

  // Create thumbnail from the processed image
  console.log('🖼️ Creating thumbnail...');
  const thumbnailBase64 = await createThumbnail(artwork.processedUrl);
  const thumbnailBlob = base64ToBlob(thumbnailBase64);

  console.log('☁️ Uploading images to Supabase storage...');
  const originalUrl = await uploadImage(originalBlob, user.id, 'original.png');
  const processedUrl = await uploadImage(processedBlob, user.id, 'processed.png');
  const thumbnailUrl = await uploadImage(thumbnailBlob, user.id, 'thumbnail.jpg');

  const { data, error } = await supabase
    .from('artworks')
    .insert([{
      user_id: user.id,
      title: artwork.title,
      original_url: originalUrl,
      processed_url: processedUrl,
      thumbnail_url: thumbnailUrl,
      cloudinary_public_id: cloudinaryPublicId,
      medium: artwork.medium,
      subject: artwork.subject,
      style: artwork.style,
      background_color: artwork.backgroundColor,
      ink_color: artwork.inkColor,
      duotone_pair: artwork.duotonePair,
      signature: artwork.signature,
      transform: artwork.transform
    }])
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('artwork_style_variants')
    .insert({
      artwork_id: data.id,
      style_type: 'original',
      generation_status: 'completed',
      file_url: processedUrl,
      is_downloadable: true,
      generation_parameters: {}
    });

  console.log('✅ Artwork saved to DB, ID:', data.id);

  // Verify session still exists after save
  const { data: { session: verifySession } } = await supabase.auth.getSession();
  if (!verifySession) {
    console.error('❌ SESSION LOST AFTER SAVE!');
  } else {
    console.log('✅ Session verified after save:', verifySession.user.email);
  }

  return {
    id: data.id,
    userId: data.user_id,
    title: data.title,
    originalUrl: data.original_url,
    processedUrl: data.processed_url,
    thumbnailUrl: data.thumbnail_url,
    cloudinaryPublicId: data.cloudinary_public_id,
    medium: data.medium,
    subject: data.subject,
    style: data.style,
    backgroundColor: data.background_color,
    inkColor: data.ink_color,
    duotonePair: data.duotone_pair,
    signature: data.signature,
    transform: data.transform,
    createdAt: data.created_at
  };
};

export const getUserArtworks = async (): Promise<Artwork[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    console.warn('No Supabase user found - using dummy mode');
    return [];
  }

  const { data, error } = await supabase
    .from('artworks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(item => ({
    id: item.id,
    userId: item.user_id,
    title: item.title,
    originalUrl: item.original_url,
    processedUrl: item.processed_url,
    thumbnailUrl: item.thumbnail_url,
    cloudinaryPublicId: item.cloudinary_public_id,
    medium: item.medium,
    subject: item.subject,
    style: item.style,
    backgroundColor: item.background_color,
    inkColor: item.ink_color,
    duotonePair: item.duotone_pair,
    signature: item.signature,
    transform: item.transform,
    createdAt: item.created_at
  }));
};

export const getArtworkById = async (artworkId: string): Promise<Artwork | null> => {
  const { data, error } = await supabase
    .from('artworks')
    .select('*')
    .eq('id', artworkId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    title: data.title,
    originalUrl: data.original_url,
    processedUrl: data.processed_url,
    thumbnailUrl: data.thumbnail_url,
    cloudinaryPublicId: data.cloudinary_public_id,
    medium: data.medium,
    subject: data.subject,
    style: data.style,
    backgroundColor: data.background_color,
    inkColor: data.ink_color,
    duotonePair: data.duotone_pair,
    signature: data.signature,
    transform: data.transform,
    createdAt: data.created_at
  };
};

export const deleteArtwork = async (artworkId: string): Promise<void> => {
  const { error } = await supabase
    .from('artworks')
    .delete()
    .eq('id', artworkId);

  if (error) throw error;
};
