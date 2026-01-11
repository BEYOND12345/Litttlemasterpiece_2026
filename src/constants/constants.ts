import { BrandColor, DuotonePair } from "../types/types";

export const APP_NAME = "Little Masterpiece";

// Simplified: 4 Premium Backgrounds
export const BRAND_BACKGROUNDS: BrandColor[] = [
  { name: "Pure White", hex: "#FFFFFF", isDark: false },
  { name: "Warm White", hex: "#FAFAF9", isDark: false },
  { name: "Sand", hex: "#D6D3D1", isDark: false },
  { name: "Clay", hex: "#D4A373", isDark: false },
];

// Simplified: 5 Curated Ink Colors
export const BRAND_INKS: BrandColor[] = [
  { name: "Charcoal", hex: "#292524" },
  { name: "Navy", hex: "#264653" },
  { name: "Forest", hex: "#2A9D8F" },
  { name: "Terracotta", hex: "#E07A5F" },
  { name: "Warm Grey", hex: "#78716C" },
];

// Simplified: 4 Curated Duotone Pairs
export const DUOTONE_PAIRS: DuotonePair[] = [
  { name: "Charcoal + Terracotta", dark: "#292524", light: "#E07A5F" },
  { name: "Navy + Linen", dark: "#264653", light: "#E7E5E4" },
  { name: "Forest + Clay", dark: "#2A9D8F", light: "#D4A373" },
  { name: "Berry + Blush", dark: "#7209B7", light: "#FAD2E1" },
];
