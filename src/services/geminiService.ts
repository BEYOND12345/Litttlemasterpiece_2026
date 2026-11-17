import { ArtworkAnalysis, V1PhotoAnalysis } from "../types/types";

/*
 * The old studio's AI helpers, with the AI taken out.
 *
 * These used to read VITE_GEMINI_API_KEY and VITE_REMOVEBG_API_KEY and call
 * Gemini and remove.bg straight from the browser. Anything a VITE_ variable
 * holds is baked into the public bundle, so both keys shipped to every
 * visitor (and the bare truthiness test on the env object shipped the WHOLE env
 * object, unread variables included). The new flow (src/flow, src/pipeline)
 * needs neither, so the calls are gone and each function returns the
 * fallback it already returned when no key was set. If these features come
 * back, they come back as Supabase Edge Functions holding the key
 * server-side, never as a VITE_ variable.
 */

export const removeBackgroundWithAI: (base64Image: string) => Promise<string | null> = async () => null;

export const enhanceWithAI: (base64Image: string, enhancementPrompt: string) => Promise<string | null> = async () =>
  null;

/** The keyless fallback the old studio always had. */
export const analyzeArtwork: (base64Image: string) => Promise<ArtworkAnalysis> = () =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        medium: "Crayon",
        subject: "Sunny Garden",
        colorPalette: ["#E07A5F", "#264653"],
      });
    }, 1500);
  });

export const analyzePhotoForV1: (base64Image: string) => Promise<V1PhotoAnalysis | null> = async () => null;
