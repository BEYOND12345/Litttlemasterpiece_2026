interface PlacementConfig {
  left?: string;
  top?: string;
  width?: string;
  height?: string;
  gravity?: string;
  rotation?: number;
  scale?: number;
}

interface SignatureConfig {
  text: string;
  descriptor?: string;
  position?: { x: number; y: number };
  color?: string;
}

interface CloudinaryUploadResponse {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
}

/*
 * Browser-safe Cloudinary only: a cloud name and an UNSIGNED upload preset,
 * both public by design. Uploads used to be signed here with
 * VITE_CLOUDINARY_API_SECRET, which put the account's API secret in the
 * public bundle. That path is gone; an upload without a preset now fails
 * with a clear message. If signed uploads are ever needed, sign them in a
 * Supabase Edge Function.
 */
class CloudinaryService {
  private cloudName: string;
  private uploadPreset?: string;

  constructor() {
    this.cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
    this.uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  }

  validateConfig(): { valid: boolean; message?: string } {
    if (!this.cloudName) {
      return { valid: false, message: 'Cloudinary cloud name is not configured' };
    }
    if (!this.uploadPreset) {
      return { valid: false, message: 'Cloudinary needs an unsigned upload preset (VITE_CLOUDINARY_UPLOAD_PRESET)' };
    }
    return { valid: true };
  }

  async uploadArtwork(file: File | Blob, artworkId: string): Promise<CloudinaryUploadResponse> {
    const validation = this.validateConfig();
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'artworks');
    formData.append('public_id', `artwork_${artworkId}`);

    formData.append('upload_preset', this.uploadPreset as string);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Upload failed');
      }

      const data = await response.json();
      return {
        public_id: data.public_id,
        secure_url: data.secure_url,
        width: data.width,
        height: data.height,
        format: data.format,
      };
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error(`Failed to upload artwork: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  buildMockupTransformationUrl(
    baseImagePublicId: string,
    artworkPublicId: string,
    placementConfig: PlacementConfig,
    signature?: SignatureConfig
  ): string {
    console.log('\n🔧 buildMockupTransformationUrl() called');
    console.log('Input baseImagePublicId (exact):', baseImagePublicId);
    console.log('Input baseImagePublicId (type):', typeof baseImagePublicId);
    console.log('Input artworkPublicId (exact):', artworkPublicId);
    console.log('Input artworkPublicId (type):', typeof artworkPublicId);
    console.log('Input placementConfig:', JSON.stringify(placementConfig, null, 2));
    console.log('Input signature:', JSON.stringify(signature, null, 2));

    if (!this.cloudName) {
      throw new Error('Cloudinary cloud name is not configured');
    }

    console.log('Cloud Name:', this.cloudName);

    const transformations: string[] = [];

    transformations.push('f_auto');
    transformations.push('q_auto:good');
    transformations.push('w_1200');

    // Add artwork as an overlay layer with signature embedded if present
    const artworkLayer = artworkPublicId.replace(/\//g, ':');
    console.log('Artwork layer (after slash replacement):', artworkLayer);

    // If signature exists, add it as a nested layer with the artwork
    if (signature?.text) {
      console.log('✅ Creating artwork layer WITH signature text (nested)');
      const encodedText = encodeURIComponent(signature.text);
      const color = (signature.color || '#29251C').replace('#', '');

      // Nested transformation: artwork with text overlaid at bottom-right
      // Using larger font (72pt) and adequate padding for visibility after scaling
      // Font size needs to be large because artwork will be scaled down on mockup
      const nestedTransform = `l_${artworkLayer}/l_text:Arial_72_bold:${encodedText},co_rgb:${color},g_south_east,x_100,y_100/fl_layer_apply`;
      transformations.push(nestedTransform);
      console.log('🔍 Nested transformation:', nestedTransform);
    } else {
      transformations.push(`l_${artworkLayer}`);
    }

    const overlayTransforms: string[] = [];

    if (placementConfig.width) {
      const widthValue = placementConfig.width.replace('%', '');
      const widthDecimal = (parseInt(widthValue) / 100).toFixed(2);
      overlayTransforms.push(`w_${widthDecimal}`);
      overlayTransforms.push('fl_relative');
    }
    if (placementConfig.height) {
      const heightValue = placementConfig.height.replace('%', '');
      const heightDecimal = (parseInt(heightValue) / 100).toFixed(2);
      overlayTransforms.push(`h_${heightDecimal}`);
      overlayTransforms.push('fl_relative');
    }

    overlayTransforms.push('c_fit');

    if (placementConfig.gravity) {
      overlayTransforms.push(`g_${placementConfig.gravity}`);
    }

    if (placementConfig.left) {
      const leftValue = placementConfig.left.replace('%', '');
      overlayTransforms.push(`x_${leftValue}`);
    }

    if (placementConfig.top) {
      const topValue = placementConfig.top.replace('%', '');
      overlayTransforms.push(`y_${topValue}`);
    }

    if (placementConfig.rotation) {
      overlayTransforms.push(`a_${placementConfig.rotation}`);
    }

    if (overlayTransforms.length > 0) {
      transformations.push(overlayTransforms.join(','));
    }

    // Apply the artwork layer (with embedded signature if present)
    transformations.push('fl_layer_apply');

    const transformationString = transformations.join('/');
    console.log('Transformation string (exact):', transformationString);

    const finalUrl = `https://res.cloudinary.com/${this.cloudName}/image/upload/${transformationString}/${baseImagePublicId}`;
    console.log('Final URL (exact):', finalUrl);
    console.log('Final URL (length):', finalUrl.length);

    return finalUrl;
  }

  getOptimizedUrl(publicId: string, width?: number, height?: number): string {
    if (!this.cloudName) {
      throw new Error('Cloudinary cloud name is not configured');
    }

    const transformations: string[] = ['f_auto', 'q_auto:good'];

    if (width) {
      transformations.push(`w_${width}`);
    }
    if (height) {
      transformations.push(`h_${height}`);
    }

    transformations.push('c_limit');

    const transformationString = transformations.join(',');

    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${transformationString}/${publicId}`;
  }
}

export const cloudinaryService = new CloudinaryService();
