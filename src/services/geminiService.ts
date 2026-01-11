import { GoogleGenerativeAI } from "@google/generative-ai";
import { ArtworkAnalysis, V1PhotoAnalysis } from "../types/types";

const getGeminiApiKey = (): string | null => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
      return import.meta.env.VITE_GEMINI_API_KEY;
    }
  } catch (e) {
    console.warn("Could not access Gemini API key");
  }
  return null;
};

const getRemoveBgApiKey = (): string | null => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_REMOVEBG_API_KEY) {
      return import.meta.env.VITE_REMOVEBG_API_KEY;
    }
  } catch (e) {
    console.warn("Could not access Remove.bg API key");
  }
  return null;
};

export const removeBackgroundWithAI = async (base64Image: string): Promise<string | null> => {
  const apiKey = getRemoveBgApiKey();

  if (!apiKey) {
    console.warn("No Remove.bg API key. Using fallback.");
    return null;
  }

  try {
    const blob = base64ToBlob(base64Image);
    const formData = new FormData();
    formData.append('image_file', blob);
    formData.append('size', 'auto');

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Remove.bg API error: ${response.status}`);
    }

    const resultBlob = await response.blob();
    return blobToBase64(resultBlob);
  } catch (error) {
    console.error("Remove.bg API failed:", error);
    return null;
  }
};

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

export const enhanceWithAI = async (
  base64Image: string,
  enhancementPrompt: string
): Promise<string | null> => {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    console.warn("No Gemini API key. Using fallback canvas processing.");
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash"
    });

    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/png',
          data: base64Data
        }
      },
      enhancementPrompt + '\n\nIMPORTANT: Describe EXACTLY what visual enhancements to apply (colors, contrast, saturation levels, edge treatments, etc.) in detailed technical terms.'
    ]);

    const response = await result.response;
    const enhancementInstructions = response.text();

    console.log('AI Enhancement Instructions:', enhancementInstructions);

    return null;

  } catch (error) {
    console.error("AI Enhancement Failed:", error);
    return null;
  }
};

export const analyzeArtwork = async (base64Image: string): Promise<ArtworkAnalysis> => {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    console.warn("No Gemini API Key found. Using mock analysis.");
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          medium: "Crayon",
          subject: "Sunny Garden",
          colorPalette: ["#E07A5F", "#264653"],
        });
      }, 1500);
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash"
    });

    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data
        }
      },
      `You are an expert art curator. Analyze this child's artwork for a high-end design studio.
1. Detect the specific Medium (e.g., 'Crayon', 'Watercolor', 'Pencil', 'Marker', 'Finger Paint').
2. Describe Subject (Max 3 words, elegant tone).
3. Extract 2 Dominant Hex Colors that would match well with premium interior design.

Return strict JSON: { "medium": string, "subject": string, "colorPalette": string[] }`
    ]);

    const response = await result.response;
    const text = response.text();

    if (!text) throw new Error("No response from Gemini");

    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanedText) as ArtworkAnalysis;

  } catch (error: any) {
    const errorMessage = error?.message || String(error);

    // Check for quota exceeded error
    if (errorMessage.includes('quota') || errorMessage.includes('429')) {
      console.warn("⚠️ Gemini API quota exceeded. Using default analysis. Consider upgrading your API plan.");
    } else {
      console.error("❌ Gemini Analysis Failed:", error);
    }

    // Gracefully fallback to default analysis
    return {
      medium: "Mixed Media",
      subject: "Masterpiece",
      colorPalette: ["#292524", "#fafaf9"]
    };
  }
};

export const analyzePhotoForV1 = async (base64Image: string): Promise<V1PhotoAnalysis | null> => {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    console.warn("No Gemini API Key found. Skipping V1 photo analysis.");
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash"
    });

    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data
        }
      },
      `You are an image analysis assistant for a product called Little Masterpiece.

Parents upload photos of their child's drawings from a phone camera.
We need to clean the photo for print without changing the artwork itself.

Your job is to look at the image and return a JSON object that describes:
1. where the paper is
2. how it is rotated or distorted
3. where shadows and glare are
4. what background objects and artefacts are present
5. what the paper colour cast is
6. whether the drawing quality is good enough for print
7. what cleanup steps we should apply

Important rules:
- Do not invent or change any part of the drawing
- Do not suggest creative changes
- You are only describing what you see and what to clean in the photo capture

Respond only with valid JSON in this format:

{
  "paper_bbox": {
    "x": float between 0 and 1,
    "y": float between 0 and 1,
    "width": float between 0 and 1,
    "height": float between 0 and 1
  },
  "rotation_degrees": float,
  "has_perspective_warp": boolean,
  "shadow_regions": [
    {
      "x": float between 0 and 1,
      "y": float between 0 and 1,
      "width": float between 0 and 1,
      "height": float between 0 and 1,
      "severity": "low" or "medium" or "high"
    }
  ],
  "glare_regions": [
    {
      "x": float between 0 and 1,
      "y": float between 0 and 1,
      "width": float between 0 and 1,
      "height": float between 0 and 1,
      "severity": "low" or "medium" or "high"
    }
  ],
  "background_objects": [
    {
      "type": "desk" or "floor" or "hand" or "other",
      "x": float between 0 and 1,
      "y": float between 0 and 1,
      "width": float between 0 and 1,
      "height": float between 0 and 1
    }
  ],
  "paper_color_cast": {
    "has_cast": boolean,
    "description": "none" or "warm_yellow" or "cool_blue" or "mixed",
    "strength": "low" or "medium" or "high"
  },
  "drawing_quality": {
    "resolution_ok_for_print": boolean,
    "blurry": boolean,
    "notes": "short plain language note about sharpness and clarity"
  },
  "cleanup_recommendations": {
    "needs_crop_and_straighten": boolean,
    "needs_background_removal": boolean,
    "needs_shadow_removal": "none" or "light" or "strong",
    "needs_glare_reduction": "none" or "light" or "strong",
    "needs_color_normalisation": boolean,
    "needs_contrast_boost": "none" or "light" or "medium",
    "noise_reduction_level": "none" or "light" or "medium"
  },
  "user_message": "one short sentence we can show the parent about overall image quality"
}

Instructions:
1. Use normalised coordinates from 0 to 1 for all x y width and height values relative to the full image size
2. If there are no shadows or glare return an empty list for those fields
3. Keep notes and user_message short and plain
4. Never suggest changing the drawing itself. Only talk about cleaning the photo capture`
    ]);

    const response = await result.response;
    const text = response.text();

    if (!text) throw new Error("No response from Gemini");

    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(cleanedText) as V1PhotoAnalysis;

    console.log('V1 Photo Analysis:', analysis);
    return analysis;

  } catch (error: any) {
    const errorMessage = error?.message || String(error);

    // Check for quota exceeded error
    if (errorMessage.includes('quota') || errorMessage.includes('429')) {
      console.warn("⚠️ Gemini API quota exceeded for photo analysis. Skipping AI enhancements.");
    } else {
      console.error("❌ V1 Photo Analysis Failed:", error);
    }

    return null;
  }
};
