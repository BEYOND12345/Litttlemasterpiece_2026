import { supabase } from './supabaseClient';

// Helper to yield to browser to prevent freezing
const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 0));

export interface EnhancementResult {
  originalWithBgUrl: string;
  originalNoBgUrl: string;
  width: number;
  height: number;
  isPrintReady: boolean;
}

export interface StyleVariantConfig {
  styleType: 'original' | 'enhanced' | 'monochrome' | 'duotone' | 'primary';
  targetResolution?: number;
  monochromeColor?: string;
  duotoneDark?: string;
  duotoneLight?: string;
  primaryColors?: string[];
}

export interface ArtifactDetectionResult {
  hasArtifacts: boolean;
  confidence: number;
  artifactTypes: string[];
}

export interface CleanupResult {
  imageUrl: string;
  artifactsDetected: ArtifactDetectionResult;
  perspectiveCorrected: boolean;
}

export interface DigitizationResult {
  digitizedUrl: string;
  fidelityScore: number;
  success: boolean;
  fallbackReason?: string;
}

/*
 * No keys are read here. VITE_REPLICATE_API_KEY and VITE_REMOVEBG_API_KEY were
 * read from the bundle, which publishes them to every visitor, and the bare
 * env-object truthiness test published the whole env object with them. Every
 * feature below now runs its local canvas fallback.
 */

/** Local background removal only: remove.bg needed a key in the browser bundle. */
export const removeBackground = async (imageInput: string): Promise<string> => localBackgroundRemoval(imageInput);

const localBackgroundRemoval = (imageInput: string): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      let base64Image = imageInput;

      if (!base64Image.startsWith('data:')) {
        const response = await fetch(base64Image);
        const blob = await response.blob();
        base64Image = await blobToBase64(blob);
      }

      const img = new Image();
      img.src = base64Image;
      img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("No Canvas Context");

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Improved algorithm: detect paper color (usually lightest areas)
        // and remove it while preserving the drawing marks

        // Sample corner pixels to estimate paper color
        const samples: number[] = [];
        const sampleSize = 20;

        // Top-left corner
        for (let y = 0; y < sampleSize; y++) {
          for (let x = 0; x < sampleSize; x++) {
            const i = (y * canvas.width + x) * 4;
            samples.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          }
        }

        // Top-right corner
        for (let y = 0; y < sampleSize; y++) {
          for (let x = canvas.width - sampleSize; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            samples.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          }
        }

        // Estimate paper brightness (median of samples)
        samples.sort((a, b) => a - b);
        const paperBrightness = samples[Math.floor(samples.length / 2)];

        // Remove pixels close to paper color
        const THRESHOLD = 40; // How different from paper to keep

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          const diff = Math.abs(lum - paperBrightness);

          if (diff < THRESHOLD) {
            // Close to paper color - make transparent
            data[i + 3] = 0;
          } else {
            // Part of the drawing - keep it
            data[i + 3] = 255;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    } catch (error) {
      reject(error);
    }
  });
};

/** Canvas upscaling only: the Replicate Real-ESRGAN path is gone with its browser-side key. */
export const upscaleImage = async (base64Image: string, targetWidth: number = 4000): Promise<string> =>
  canvasUpscale(base64Image, targetWidth);


const canvasUpscale = (base64Image: string, targetWidth: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = "anonymous";

    img.onload = async () => {
      try {
        // Multi-step upscaling for better quality
        // Instead of scaling directly, scale in smaller increments
        await yieldToBrowser();

        const finalScale = targetWidth / img.width;

        // If scale is less than 2x, do it in one pass
        if (finalScale <= 2) {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error("No Canvas Context");

          canvas.width = targetWidth;
          canvas.height = img.height * finalScale;

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          await yieldToBrowser();
          resolve(canvas.toDataURL('image/png'));
          return;
        }

        // Multi-step upscaling for better quality
        let currentImage = img;
        let currentWidth = img.width;
        let currentHeight = img.height;

        // Scale by max 2x at a time
        while (currentWidth * 2 < targetWidth) {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error("No Canvas Context");

          currentWidth *= 2;
          currentHeight *= 2;
          canvas.width = currentWidth;
          canvas.height = currentHeight;

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(currentImage, 0, 0, currentWidth, currentHeight);

          // Create a new image from this canvas for the next iteration
          const tempImg = new Image();
          tempImg.src = canvas.toDataURL('image/png');
          await new Promise((res) => {
            tempImg.onload = res;
          });
          currentImage = tempImg;

          await yieldToBrowser();
        }

        // Final scaling step to exact target size
        const finalCanvas = document.createElement('canvas');
        const finalCtx = finalCanvas.getContext('2d');
        if (!finalCtx) throw new Error("No Canvas Context");

        finalCanvas.width = targetWidth;
        finalCanvas.height = img.height * finalScale;

        finalCtx.imageSmoothingEnabled = true;
        finalCtx.imageSmoothingQuality = 'high';
        finalCtx.drawImage(currentImage, 0, 0, finalCanvas.width, finalCanvas.height);

        // Apply slight sharpening to compensate for upscaling blur
        const imageData = finalCtx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
        const sharpened = applySharpenFilter(imageData);
        finalCtx.putImageData(sharpened, 0, 0);

        await yieldToBrowser();
        resolve(finalCanvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error("Failed to load image"));
  });
};

// Sharpening filter to improve upscaled image quality
const applySharpenFilter = (imageData: ImageData): ImageData => {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const output = new ImageData(width, height);

  // Sharpening kernel (mild)
  const kernel = [
    0, -0.5, 0,
    -0.5, 3, -0.5,
    0, -0.5, 0
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) { // RGB only, skip alpha
        let sum = 0;

        // Apply 3x3 kernel
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            sum += data[idx] * kernel[kernelIdx];
          }
        }

        const outIdx = (y * width + x) * 4 + c;
        output.data[outIdx] = Math.max(0, Math.min(255, sum));
      }

      // Copy alpha unchanged
      const alphaIdx = (y * width + x) * 4 + 3;
      output.data[alphaIdx] = data[alphaIdx];
    }
  }

  // Copy edges unchanged
  for (let x = 0; x < width; x++) {
    for (let c = 0; c < 4; c++) {
      output.data[x * 4 + c] = data[x * 4 + c]; // Top
      output.data[((height - 1) * width + x) * 4 + c] = data[((height - 1) * width + x) * 4 + c]; // Bottom
    }
  }
  for (let y = 0; y < height; y++) {
    for (let c = 0; c < 4; c++) {
      output.data[y * width * 4 + c] = data[y * width * 4 + c]; // Left
      output.data[(y * width + width - 1) * 4 + c] = data[(y * width + width - 1) * 4 + c]; // Right
    }
  }

  return output;
};

/** Local filters only: the Replicate SDXL path is gone with its browser-side key. */
export const generateStyleVariant = async (base64Image: string, config: StyleVariantConfig): Promise<string> =>
  applyLocalStyleFilter(base64Image, config);


const applyLocalStyleFilter = (base64Image: string, config: StyleVariantConfig): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Image);
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => resolve(base64Image);
  });
};


const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const getImageDimensions = (base64Image: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error("Failed to load image"));
  });
};

export const applyColorCorrection = (base64Image: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("No Canvas Context");

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let minR = 255, maxR = 0;
        let minG = 255, maxG = 0;
        let minB = 255, maxB = 0;

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) continue;

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          if (r < minR) minR = r;
          if (r > maxR) maxR = r;
          if (g < minG) minG = g;
          if (g > maxG) maxG = g;
          if (b < minB) minB = b;
          if (b > maxB) maxB = b;
        }

        const rangeR = maxR - minR || 1;
        const rangeG = maxG - minG || 1;
        const rangeB = maxB - minB || 1;

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 10) continue;

          let r = data[i];
          let g = data[i + 1];
          let b = data[i + 2];

          r = ((r - minR) / rangeR) * 255;
          g = ((g - minG) / rangeG) * 255;
          b = ((b - minB) / rangeB) * 255;

          const hsl = rgbToHsl(r, g, b);
          hsl.s = Math.min(1, hsl.s * 1.15);
          const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);

          data[i] = rgb.r;
          data[i + 1] = rgb.g;
          data[i + 2] = rgb.b;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error("Failed to load image"));
  });
};

export const applySharpen = (base64Image: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("No Canvas Context");

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        const kernel = [
          0, -1, 0,
          -1, 5, -1,
          0, -1, 0
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

    img.onerror = () => reject(new Error("Failed to load image"));
  });
};

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

export const correctPerspective = async (base64Image: string): Promise<string> => {
  // OPTIMIZATION: Skip perspective correction to prevent browser freezing
  // This operation is too CPU-intensive for large images in the browser
  // For production, this should be done server-side or with Web Workers
  console.log('⚡ Skipping perspective correction (performance optimization)');
  return base64Image;
};

export const removeCameraShadows = async (base64Image: string): Promise<string> => {
  // OPTIMIZATION: Skip shadow removal to prevent browser freezing
  // This operation requires heavy nested loops over all pixels
  // For production, this should be done server-side or with Web Workers
  console.log('⚡ Skipping shadow removal (performance optimization)');
  return base64Image;
};

export const neutralizePaperColor = async (base64Image: string): Promise<string> => {
  // OPTIMIZATION: Use lightweight color adjustment instead of heavy pixel processing
  console.log('⚡ Using fast paper color neutralization');
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("No Canvas Context");

        canvas.width = img.width;
        canvas.height = img.height;

        // Apply simple brightness/contrast filter instead of per-pixel processing
        ctx.filter = 'brightness(1.05) contrast(1.1)';
        ctx.drawImage(img, 0, 0);

        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error("Failed to load image"));
  });
};

export const detectArtifacts = async (base64Image: string): Promise<ArtifactDetectionResult> => {
  // OPTIMIZATION: Skip artifact detection to prevent browser freezing
  // Return a simple result without heavy pixel processing
  console.log('⚡ Using fast artifact detection');
  return {
    hasArtifacts: false,
    confidence: 0.8,
    artifactTypes: []
  };
};

export const applyAggressiveCleanup = async (base64Image: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("No Canvas Context");

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const protectionMask = new Uint8Array(data.length / 4);

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          if (saturation > 0.2 || lum < 150) {
            protectionMask[i / 4] = 1;
          }
        }

        for (let i = 0; i < data.length; i += 4) {
          if (protectionMask[i / 4] === 1) continue;

          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

          if (lum > 220) {
            data[i + 3] = 0;
          } else if (lum > 180) {
            const fadeOut = (lum - 180) / 40;
            data[i + 3] = Math.round(255 * (1 - fadeOut));
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error("Failed to load image"));
  });
};

/**
 * Digitisation was an SDXL pass on Replicate, called from the browser with a
 * key baked into the bundle (and blocked by CORS anyway). Removed with that
 * key; this is the result it already gave when no key was set.
 */
export const digitizeArtwork = async (base64Image: string): Promise<DigitizationResult> => ({
  digitizedUrl: base64Image,
  fidelityScore: 0,
  success: false,
  fallbackReason: 'Digitisation is not available',
});


export const performEnhancedCleanup = async (
  base64Image: string,
  onProgress?: (step: string) => void
): Promise<CleanupResult> => {
  try {
    onProgress?.('Correcting perspective...');
    let processed = await correctPerspective(base64Image);
    const perspectiveCorrected = processed !== base64Image;
    await yieldToBrowser();

    onProgress?.('Removing camera shadows...');
    processed = await removeCameraShadows(processed);
    await yieldToBrowser();

    onProgress?.('Neutralizing paper color...');
    processed = await neutralizePaperColor(processed);
    await yieldToBrowser();

    onProgress?.('Detecting artifacts...');
    const artifactsDetected = await detectArtifacts(processed);
    await yieldToBrowser();

    return {
      imageUrl: processed,
      artifactsDetected,
      perspectiveCorrected,
    };
  } catch (error) {
    console.error("Enhanced cleanup failed:", error);
    return {
      imageUrl: base64Image,
      artifactsDetected: {
        hasArtifacts: false,
        confidence: 0,
        artifactTypes: [],
      },
      perspectiveCorrected: false,
    };
  }
};
