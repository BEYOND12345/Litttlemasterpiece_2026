import { supabase } from './supabaseClient';
import { analyzeArtwork, enhanceWithAI, analyzePhotoForV1 } from './geminiService';
import { removeBackground, upscaleImage, getImageDimensions } from './enhancementService';
import { V1PhotoAnalysis } from '../types/types';

export interface MasterMetadata {
  medium: string;
  dominantColors: string[];
  subject: string;
  edgeCount: number;
  resolution: { width: number; height: number };
  paperColor: string;
  v1Analysis?: V1PhotoAnalysis;
}

export interface MasterDigitizationResult {
  masterId: string;
  masterUrl: string;
  metadata: MasterMetadata;
}

export interface StyleVariantResult {
  variantId: string;
  variantUrl: string;
  processingApplied: string[];
}

export type StyleType = 'original_clean' | 'enhanced_print' | 'monochrome' | 'duotone';

export interface StyleOptions {
  inkColor?: string;
  duotoneDark?: string;
  duotoneLight?: string;
  backgroundColor?: string;
}

const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 0));

export const createArtworkMaster = async (
  artworkId: string,
  imageBase64: string,
  onProgress?: (step: string) => void
): Promise<MasterDigitizationResult> => {
  try {
    // V1: Analyze the photo first to understand what cleanup is needed
    onProgress?.('Analyzing photo quality...');
    const v1Analysis = await analyzePhotoForV1(imageBase64);
    await yieldToBrowser();

    onProgress?.('Removing background...');
    const noBgImage = await removeBackground(imageBase64);
    await yieldToBrowser();

    // V1: Skip color balance to preserve original colors exactly as drawn
    // Only upscale the cleaned image
    onProgress?.('Preparing for print...');
    const upscaled = await upscaleImage(noBgImage, 4000);
    await yieldToBrowser();

    onProgress?.('Analyzing artwork...');
    const analysis = await analyzeArtwork(upscaled);
    const dimensions = await getImageDimensions(upscaled);
    const edgeCount = await detectEdgeCount(upscaled);
    await yieldToBrowser();

    const metadata: MasterMetadata = {
      medium: analysis.medium,
      dominantColors: analysis.colorPalette,
      subject: analysis.subject,
      edgeCount,
      resolution: dimensions,
      paperColor: '#FFFFFF',
      v1Analysis: v1Analysis || undefined,
    };

    return {
      masterId: 'temp',
      masterUrl: upscaled,
      metadata,
    };
  } catch (error) {
    console.error('Master digitization failed:', error);
    throw error;
  }
};

export const generateStyleVariant = async (
  masterBase64: string,
  styleType: StyleType,
  options: StyleOptions,
  metadata?: any,
  onProgress?: (step: string) => void
): Promise<StyleVariantResult> => {
  try {

    let processedImage: string;
    let processingSteps: string[];

    switch (styleType) {
      case 'original_clean':
        onProgress?.('Applying clean paper...');
        ({ image: processedImage, steps: processingSteps } = await processOriginalClean(
          masterBase64,
          options.backgroundColor || '#FFFFFF',
          metadata
        ));
        break;

      case 'enhanced_print':
        onProgress?.('Enhancing for print...');
        ({ image: processedImage, steps: processingSteps } = await processEnhancedPrint(
          masterBase64,
          options.backgroundColor || '#FFFFFF',
          metadata
        ));
        break;

      case 'monochrome':
        onProgress?.('Refining strokes...');
        ({ image: processedImage, steps: processingSteps } = await processMonochrome(
          masterBase64,
          options.inkColor || '#292524',
          options.backgroundColor || '#FAFAF9',
          metadata
        ));
        break;

      case 'duotone':
        onProgress?.('Creating screenprint...');
        ({ image: processedImage, steps: processingSteps } = await processDuotone(
          masterBase64,
          options.duotoneDark || '#292524',
          options.duotoneLight || '#E07A5F',
          options.backgroundColor || '#FAFAF9',
          metadata
        ));
        break;

      default:
        throw new Error(`Unknown style type: ${styleType}`);
    }

    return {
      variantId: 'temp',
      variantUrl: processedImage,
      processingApplied: processingSteps,
    };
  } catch (error) {
    console.error('Style variant generation failed:', error);
    throw error;
  }
};

async function processOriginalClean(
  masterBase64: string,
  backgroundColor: string,
  metadata: any
): Promise<{ image: string; steps: string[] }> {
  const steps: string[] = [];

  let processed = masterBase64;

  // V1: Pure cleanup pipeline - preserve original artwork exactly
  // Only remove camera artifacts (shadows, glare, paper texture)
  // Use V1 analysis recommendations if available

  const v1Analysis = metadata?.v1Analysis;

  steps.push('background_segmentation');
  processed = await applyCleanPaperTexture(processed, backgroundColor);

  // Apply color normalization if recommended
  if (!v1Analysis || v1Analysis.cleanup_recommendations?.needs_color_normalisation) {
    steps.push('lighting_normalization');
    processed = await neutralizeYellowCast(processed);
  }

  // Apply contrast boost based on recommendation
  const contrastLevel = v1Analysis?.cleanup_recommendations?.needs_contrast_boost || 'light';
  if (contrastLevel === 'medium') {
    steps.push('clarity_enhancement');
    processed = await applyMicroContrast(processed, 1.15);
  } else if (contrastLevel === 'light') {
    steps.push('gentle_clarity_enhancement');
    processed = await applyMicroContrast(processed, 1.08);
  }

  // Apply noise reduction based on recommendation
  const noiseLevel = v1Analysis?.cleanup_recommendations?.noise_reduction_level || 'light';
  if (noiseLevel === 'medium') {
    steps.push('noise_reduction');
    processed = await applyEdgeSharpening(processed, 1.1);
  } else if (noiseLevel === 'light') {
    steps.push('mild_noise_reduction');
    processed = await applyEdgeSharpening(processed, 1.05);
  }

  // No saturation boost - preserve original colors exactly as drawn

  return { image: processed, steps };
}

async function processEnhancedPrint(
  masterBase64: string,
  backgroundColor: string,
  metadata: any
): Promise<{ image: string; steps: string[] }> {
  const steps: string[] = [];

  let { image: processed } = await processOriginalClean(masterBase64, backgroundColor, metadata);
  steps.push('original_clean_base');

  steps.push('dramatic_contrast');
  processed = await applyLocalContrast(processed, 1.6);

  steps.push('deep_saturation');
  processed = await applySmartSaturation(processed, 1.5);

  steps.push('crisp_edges');
  processed = await applyEdgeSharpening(processed, 1.5);

  steps.push('center_emphasis');
  processed = await applySubtleVignette(processed, 0.2);

  return { image: processed, steps };
}

async function processMonochrome(
  masterBase64: string,
  inkColor: string,
  backgroundColor: string,
  metadata: any
): Promise<{ image: string; steps: string[] }> {
  const steps: string[] = [];

  let processed = masterBase64;

  steps.push('tone_mapping');
  processed = await applyToneMapping(processed);

  steps.push('dramatic_line_boost');
  processed = await reinforceLines(processed, 2.5);

  steps.push('black_level_crush');
  processed = await crushBlacks(processed, 0.4);

  steps.push('ink_color_mapping');
  processed = await mapToInkColor(processed, inkColor);

  steps.push('texture_addition');
  processed = await applyCharcoalTexture(processed, 0.15);

  steps.push('background_composite');
  processed = await compositeOnBackground(processed, backgroundColor);

  return { image: processed, steps };
}

async function processDuotone(
  masterBase64: string,
  darkColor: string,
  lightColor: string,
  backgroundColor: string,
  metadata: any
): Promise<{ image: string; steps: string[] }> {
  const steps: string[] = [];

  let processed = masterBase64;

  steps.push('high_contrast_prep');
  processed = await applyLocalContrast(processed, 1.8);

  steps.push('aggressive_posterization');
  processed = await applyPosterization(processed, 4);

  steps.push('edge_simplification');
  processed = await simplifyEdges(processed);

  steps.push('color_separation');
  processed = await applyDuotoneColors(processed, darkColor, lightColor);

  steps.push('halftone_texture');
  processed = await applySubtleGrain(processed, 0.08);

  steps.push('background_composite');
  processed = await compositeOnBackground(processed, backgroundColor);

  return { image: processed, steps };
}

async function applyColorBalance(base64Image: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let avgR = 0, avgG = 0, avgB = 0, count = 0;

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 128) {
            avgR += data[i];
            avgG += data[i + 1];
            avgB += data[i + 2];
            count++;
          }
        }

        if (count > 0) {
          avgR /= count;
          avgG /= count;
          avgB /= count;

          const targetGray = (avgR + avgG + avgB) / 3;
          const rFactor = targetGray / avgR;
          const gFactor = targetGray / avgG;
          const bFactor = targetGray / avgB;

          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 10) {
              data[i] = Math.min(255, data[i] * rFactor * 0.95 + data[i] * 0.05);
              data[i + 1] = Math.min(255, data[i + 1] * gFactor * 0.95 + data[i + 1] * 0.05);
              data[i + 2] = Math.min(255, data[i + 2] * bFactor * 0.95 + data[i + 2] * 0.05);
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

async function detectEdgeCount(base64Image: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(0);
          return;
        }

        const scale = Math.min(512 / img.width, 512 / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let edgeCount = 0;

        for (let y = 1; y < canvas.height - 1; y++) {
          for (let x = 1; x < canvas.width - 1; x++) {
            const idx = (y * canvas.width + x) * 4;
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

            const lumLeft = 0.299 * data[idx - 4] + 0.587 * data[idx - 3] + 0.114 * data[idx - 2];
            const lumRight = 0.299 * data[idx + 4] + 0.587 * data[idx + 5] + 0.114 * data[idx + 6];

            if (Math.abs(lum - lumLeft) > 50 || Math.abs(lum - lumRight) > 50) {
              edgeCount++;
            }
          }
        }

        resolve(edgeCount);
      } catch (err) {
        resolve(0);
      }
    };

    img.onerror = () => resolve(0);
  });
}

async function applyCleanPaperTexture(base64Image: string, bgColor: string): Promise<string> {
  return compositeOnBackground(base64Image, bgColor);
}

async function neutralizeYellowCast(base64Image: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 10) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            if (r > 200 && g > 180 && b < 150) {
              data[i + 2] = Math.min(255, b * 1.15);
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

async function applyMicroContrast(base64Image: string, amount: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 10) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            data[i] = Math.min(255, Math.max(0, (r - 128) * amount + 128));
            data[i + 1] = Math.min(255, Math.max(0, (g - 128) * amount + 128));
            data[i + 2] = Math.min(255, Math.max(0, (b - 128) * amount + 128));
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

async function applySubtleGrain(base64Image: string, intensity: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 10) {
            const noise = (Math.random() - 0.5) * intensity * 255;
            data[i] = Math.min(255, Math.max(0, data[i] + noise));
            data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
            data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

async function applyLocalContrast(base64Image: string, strength: number): Promise<string> {
  return applyMicroContrast(base64Image, strength);
}

async function applySmartSaturation(base64Image: string, boost: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 10) {
            const r = data[i] / 255;
            const g = data[i + 1] / 255;
            const b = data[i + 2] / 255;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const sat = max === 0 ? 0 : (max - min) / max;

            if (sat > 0.1 && sat < 0.8) {
              const newSat = Math.min(1, sat * boost);
              const ratio = newSat / sat;

              data[i] = Math.min(255, Math.max(0, ((r - min) * ratio + min) * 255));
              data[i + 1] = Math.min(255, Math.max(0, ((g - min) * ratio + min) * 255));
              data[i + 2] = Math.min(255, Math.max(0, ((b - min) * ratio + min) * 255));
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

async function applyEdgeSharpening(base64Image: string, amount: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        const kernel = [
          0, -amount, 0,
          -amount, 1 + 4 * amount, -amount,
          0, -amount, 0
        ];

        const output = new Uint8ClampedArray(data.length);

        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;

            let r = 0, g = 0, b = 0;

            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const pixelIdx = ((y + ky) * width + (x + kx)) * 4;
                const kernelIdx = (ky + 1) * 3 + (kx + 1);
                const weight = kernel[kernelIdx];

                r += data[pixelIdx] * weight;
                g += data[pixelIdx + 1] * weight;
                b += data[pixelIdx + 2] * weight;
              }
            }

            output[idx] = Math.max(0, Math.min(255, r));
            output[idx + 1] = Math.max(0, Math.min(255, g));
            output[idx + 2] = Math.max(0, Math.min(255, b));
            output[idx + 3] = data[idx + 3];
          }
        }

        for (let i = 0; i < data.length; i++) {
          if (output[i] !== 0 || i % 4 === 3) {
            data[i] = output[i];
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

async function applySubtleVignette(base64Image: string, intensity: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const dx = x - centerX;
            const dy = y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const vignette = 1 - (dist / maxDist) * intensity;

            if (data[idx + 3] > 10) {
              data[idx] = Math.max(0, data[idx] * vignette);
              data[idx + 1] = Math.max(0, data[idx + 1] * vignette);
              data[idx + 2] = Math.max(0, data[idx + 2] * vignette);
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

async function applyToneMapping(base64Image: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let minLum = 255, maxLum = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 10) {
            const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            if (lum < minLum) minLum = lum;
            if (lum > maxLum) maxLum = lum;
          }
        }

        const range = maxLum - minLum || 1;

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 10) {
            const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            let normalized = (lum - minLum) / range;

            normalized = Math.pow(normalized, 0.5);

            const finalLum = normalized * 255;
            data[i] = finalLum;
            data[i + 1] = finalLum;
            data[i + 2] = finalLum;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

async function reinforceLines(base64Image: string, strength: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 10) {
            const lum = data[i];
            const enhanced = Math.max(0, Math.min(255, (lum - 128) * strength + 128));
            data[i] = enhanced;
            data[i + 1] = enhanced;
            data[i + 2] = enhanced;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

async function mapToInkColor(base64Image: string, inkColor: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const inkRgb = hexToRgb(inkColor);

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 10) {
            const lum = data[i] / 255;
            const opacity = 1 - lum;

            data[i] = 255 + (inkRgb.r - 255) * opacity;
            data[i + 1] = 255 + (inkRgb.g - 255) * opacity;
            data[i + 2] = 255 + (inkRgb.b - 255) * opacity;
            data[i + 3] = 255;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

async function applyCharcoalTexture(base64Image: string, intensity: number): Promise<string> {
  return applySubtleGrain(base64Image, intensity);
}

async function compositeOnBackground(base64Image: string, bgColor: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.drawImage(img, 0, 0);

        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

async function applyPosterization(base64Image: string, levels: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 10) {
            const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const step = 255 / (levels - 1);
            const posterized = Math.round(lum / step) * step;

            data[i] = posterized;
            data[i + 1] = posterized;
            data[i + 2] = posterized;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

async function simplifyEdges(base64Image: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.filter = 'blur(1px)';
        ctx.drawImage(img, 0, 0);
        ctx.filter = 'none';

        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

async function applyDuotoneColors(
  base64Image: string,
  darkColor: string,
  lightColor: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const darkRgb = hexToRgb(darkColor);
        const lightRgb = hexToRgb(lightColor);

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 10) {
            const lum = data[i] / 255;

            data[i] = lightRgb.r + (darkRgb.r - lightRgb.r) * (1 - lum);
            data[i + 1] = lightRgb.g + (darkRgb.g - lightRgb.g) * (1 - lum);
            data[i + 2] = lightRgb.b + (darkRgb.b - lightRgb.b) * (1 - lum);
            data[i + 3] = 255;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

async function crushBlacks(base64Image: string, threshold: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 10) {
            const lum = data[i] / 255;

            let newLum;
            if (lum < threshold) {
              newLum = 0;
            } else {
              newLum = (lum - threshold) / (1 - threshold);
            }

            const finalLum = newLum * 255;
            data[i] = finalLum;
            data[i + 1] = finalLum;
            data[i + 2] = finalLum;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

function base64ToBlob(base64: string): Blob {
  const base64Data = base64.split(',')[1];
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: 'image/png' });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
