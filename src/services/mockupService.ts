import { supabase } from './supabaseClient';
import { cloudinaryService } from './cloudinaryService';

// In-memory lock to prevent concurrent mockup generation for the same artwork
const generationLocks = new Set<string>();

export interface MockupTemplate {
  id: string;
  name: string;
  product_type: string;
  cloudinary_public_id: string;
  placement_config: {
    left?: string;
    top?: string;
    width?: string;
    height?: string;
    gravity?: string;
    rotation?: number;
    scale?: number;
  };
  display_order: number;
  is_active: boolean;
}

export interface ArtworkMockup {
  id: string;
  artwork_id: string;
  template_id: string;
  mockup_image_url: string;
  generation_status: 'pending' | 'completed' | 'failed';
  is_public: boolean;
  created_at: string;
  template?: MockupTemplate;
}

class MockupService {
  private getSignatureColor(backgroundColor?: string): string {
    if (!backgroundColor) return '#29251C';

    // Convert hex to RGB to determine if background is dark
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    // Return white for dark backgrounds, dark gray for light backgrounds
    return brightness < 128 ? '#FFFFFF' : '#29251C';
  }

  async getAllTemplates(): Promise<MockupTemplate[]> {
    const { data, error } = await supabase
      .from('mockup_templates')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching mockup templates:', error);
      throw new Error('Failed to fetch mockup templates');
    }

    return data || [];
  }

  async getTemplatesByProductType(productType: string): Promise<MockupTemplate[]> {
    const { data, error } = await supabase
      .from('mockup_templates')
      .select('*')
      .eq('product_type', productType)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching mockup templates by product type:', error);
      throw new Error('Failed to fetch mockup templates');
    }

    return data || [];
  }

  async getMockupsForArtwork(artworkId: string): Promise<ArtworkMockup[]> {
    const { data, error } = await supabase
      .from('artwork_mockups')
      .select(`
        *,
        template:mockup_templates(*)
      `)
      .eq('artwork_id', artworkId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching artwork mockups:', error);
      throw new Error('Failed to fetch artwork mockups');
    }

    return data || [];
  }

  async generateMockupForArtwork(
    artworkId: string,
    templateId: string
  ): Promise<{ mockup: ArtworkMockup; url: string }> {
    try {
      const { data: existingMockup } = await supabase
        .from('artwork_mockups')
        .select('*')
        .eq('artwork_id', artworkId)
        .eq('template_id', templateId)
        .maybeSingle();

      if (existingMockup && existingMockup.generation_status === 'completed') {
        return {
          mockup: existingMockup,
          url: existingMockup.mockup_image_url,
        };
      }

      const { data: artwork, error: artworkError } = await supabase
        .from('artworks')
        .select('cloudinary_public_id, signature, background_color, processed_url')
        .eq('id', artworkId)
        .single();

      if (artworkError || !artwork) {
        throw new Error('Artwork not found');
      }

      if (!artwork.cloudinary_public_id) {
        console.warn(`Artwork ${artworkId} has not been uploaded to Cloudinary yet, skipping mockup generation`);
        throw new Error('Artwork not yet uploaded to cloud storage. Please try again in a moment.');
      }

      const { data: template, error: templateError } = await supabase
        .from('mockup_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError || !template) {
        throw new Error('Template not found');
      }

      let mockupUrl: string;

      if (!artwork.cloudinary_public_id) {
        throw new Error('Artwork must be uploaded to Cloudinary before generating mockups');
      }

      if (template.cloudinary_public_id.startsWith('/')) {
        throw new Error('Mockup template must be a valid Cloudinary public_id, not a local path. Please upload mockup templates to Cloudinary first.');
      }

      // The cloudinary_public_id already contains the processed/styled artwork with signature rendered
      // Do NOT add signature as text overlay - it's already in the image
      console.log('✅ Using Cloudinary public ID (processed artwork with signature already rendered)');
      console.log('🔍 DEBUG: Cloudinary public ID:', artwork.cloudinary_public_id);
      console.log('🔍 DEBUG: NOT adding signature overlay - signature is already rendered in the artwork');

      mockupUrl = cloudinaryService.buildMockupTransformationUrl(
        template.cloudinary_public_id,
        artwork.cloudinary_public_id,
        template.placement_config,
        undefined // No signature overlay needed
      );

      console.log(`✅ Generated Cloudinary mockup URL: ${mockupUrl}`);

      if (existingMockup) {
        const { data: updatedMockup, error: updateError } = await supabase
          .from('artwork_mockups')
          .update({
            mockup_image_url: mockupUrl,
            generation_status: 'completed',
          })
          .eq('id', existingMockup.id)
          .select()
          .single();

        if (updateError) {
          throw new Error('Failed to update mockup');
        }

        return {
          mockup: updatedMockup,
          url: mockupUrl,
        };
      } else {
        // Use upsert to avoid duplicate key errors in race conditions
        const { data: newMockup, error: insertError } = await supabase
          .from('artwork_mockups')
          .upsert({
            artwork_id: artworkId,
            template_id: templateId,
            mockup_image_url: mockupUrl,
            generation_status: 'completed',
          }, {
            onConflict: 'artwork_id,template_id'
          })
          .select()
          .single();

        if (insertError) {
          console.error('Failed to create/update mockup:', insertError);
          throw new Error('Failed to create mockup');
        }

        return {
          mockup: newMockup,
          url: mockupUrl,
        };
      }
    } catch (error) {
      console.error('Error generating mockup:', error);

      // Use upsert with conflict resolution to avoid duplicate key errors
      const { data: failedMockup } = await supabase
        .from('artwork_mockups')
        .upsert({
          artwork_id: artworkId,
          template_id: templateId,
          mockup_image_url: '',
          generation_status: 'failed',
        }, {
          onConflict: 'artwork_id,template_id'
        })
        .select()
        .single();

      throw error;
    }
  }

  async generateAllMockupsForArtwork(artworkId: string): Promise<ArtworkMockup[]> {
    // Check if mockup generation is already in progress for this artwork
    if (generationLocks.has(artworkId)) {
      console.log(`⏳ Mockup generation already in progress for artwork ${artworkId}, skipping duplicate request`);
      return [];
    }

    // Acquire lock
    generationLocks.add(artworkId);

    try {
      const templates = await this.getAllTemplates();
      const mockups: ArtworkMockup[] = [];

      for (const template of templates) {
        try {
          const { mockup } = await this.generateMockupForArtwork(artworkId, template.id);
          mockups.push(mockup);
        } catch (error) {
          console.error(`Failed to generate mockup for template ${template.id}:`, error);
        }
      }

      return mockups;
    } finally {
      // Always release lock
      generationLocks.delete(artworkId);
    }
  }

  async retryFailedMockup(mockupId: string): Promise<ArtworkMockup> {
    const { data: mockup, error } = await supabase
      .from('artwork_mockups')
      .select('artwork_id, template_id')
      .eq('id', mockupId)
      .single();

    if (error || !mockup) {
      throw new Error('Mockup not found');
    }

    const { mockup: regeneratedMockup } = await this.generateMockupForArtwork(
      mockup.artwork_id,
      mockup.template_id
    );

    return regeneratedMockup;
  }

  async deleteMockup(mockupId: string): Promise<void> {
    const { error } = await supabase
      .from('artwork_mockups')
      .delete()
      .eq('id', mockupId);

    if (error) {
      console.error('Error deleting mockup:', error);
      throw new Error('Failed to delete mockup');
    }
  }

  async getMockupsByTemplate(templateId: string): Promise<ArtworkMockup[]> {
    const { data, error } = await supabase
      .from('artwork_mockups')
      .select('*')
      .eq('template_id', templateId)
      .eq('generation_status', 'completed')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching mockups by template:', error);
      throw new Error('Failed to fetch mockups');
    }

    return data || [];
  }

  async regenerateAllMockupsForArtwork(artworkId: string): Promise<ArtworkMockup[]> {
    console.log(`🔄 Force regenerating ALL mockups for artwork ${artworkId}`);

    // Delete all existing mockups for this artwork
    const { error: deleteError } = await supabase
      .from('artwork_mockups')
      .delete()
      .eq('artwork_id', artworkId);

    if (deleteError) {
      console.error('Error deleting old mockups:', deleteError);
      throw new Error('Failed to delete old mockups');
    }

    console.log('✅ Deleted old mockups, generating fresh ones...');

    // Generate fresh mockups with current signature settings
    return await this.generateAllMockupsForArtwork(artworkId);
  }
}

export const mockupService = new MockupService();
