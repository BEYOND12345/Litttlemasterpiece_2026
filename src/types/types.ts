
export enum AppView {
  HOME = 'HOME',
  STUDIO = 'STUDIO',
  ENHANCEMENT = 'ENHANCEMENT',
  MOCKUP_GALLERY = 'MOCKUP_GALLERY',
  DASHBOARD = 'DASHBOARD',
  AUTH = 'AUTH',
  CHECKOUT = 'CHECKOUT',
  ABOUT = 'ABOUT',
  BLOG = 'BLOG',
  ADMIN = 'ADMIN',
  DIAGNOSTIC = 'DIAGNOSTIC',
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  PROCESSING = 'PROCESSING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}

export enum ArtStyle {
  ORIGINAL = 'Original Clean',
  ENHANCED = 'Enhanced Print',
  MONOCHROME = 'Monochrome',
  DUOTONE = 'Duotone',
}

export interface BrandColor {
  name: string;
  hex: string;
  isDark?: boolean;
}

export interface DuotonePair {
  name: string;
  dark: string; // Shadow color
  light: string; // Highlight color
}

// --- DOMAIN MODELS ---

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Artwork {
  id: string;
  userId: string;
  title: string;

  // Image Assets
  originalUrl: string;
  processedUrl: string;
  thumbnailUrl: string;
  originalWithBgUrl?: string;
  originalNoBgUrl?: string;
  cloudinaryPublicId?: string;

  // Metadata
  medium: string;
  subject: string;
  originalWidth?: number;
  originalHeight?: number;
  isPrintReady?: boolean;

  // Enhanced Cleanup Tracking
  cleanupLevel?: 'basic' | 'aggressive' | 'custom';
  artifactsDetected?: boolean;
  perspectiveCorrected?: boolean;
  secondaryCleanupApplied?: boolean;

  // Digitization System
  digitizationEnabled?: boolean;
  digitizedUrl?: string;
  digitizationFidelityScore?: number;
  digitizationFailed?: boolean;
  digitizationFallbackReason?: string;

  // Styling State
  style: ArtStyle;
  backgroundColor: string;
  inkColor?: string;
  duotonePair?: DuotonePair;

  // Transformations
  signature: {
    text: string;
    descriptor: string;
    year: string;
    position?: { x: number; y: number };
  };

  transform?: {
    x: number;
    y: number;
    scale: number;
  };

  createdAt: string;
}

export type ProductType = 'framed' | 'tote' | 'canvas' | 'digital' | 'mug';

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  description?: string;
  priceCents: number;
  mockupImageUrl?: string;
  gelatoTemplateId?: string;
  gelatoProductUid?: string;
  basePriceCents?: number;
}

export interface OrderItem {
  productId: string;
  artworkId: string;
  quantity: number;
  priceCents: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalCents: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  shippingAddress?: ShippingAddress;
  createdAt: string;
  updatedAt: string;
}

export interface OrderTimeline {
  id: string;
  orderId: string;
  status: string;
  timestamp: string;
  notes?: string;
}

export interface ShippingAddress {
  id?: string;
  userId?: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface Profile {
  id: string;
  userId: string;
  childNames: ChildInfo[];
  defaultSignature?: SignatureDefaults;
  createdAt: string;
  updatedAt: string;
}

export interface ChildInfo {
  name: string;
  age: number;
}

export interface SignatureDefaults {
  format: 'name-age-year' | 'for-recipient' | 'custom';
  defaultName?: string;
  defaultRecipient?: string;
}

export interface Guide {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  thumbnailUrl?: string;
  readTimeMinutes: number;
  publishedAt: string;
  updatedAt: string;
}

export interface PaymentHistory {
  id: string;
  userId: string;
  orderId?: string;
  amountCents: number;
  description: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: string;
}

export interface ArtworkAnalysis {
  medium: string;
  subject: string;
  colorPalette: string[];
}

// V1 Photo Analysis for cleanup pipeline
export interface V1PhotoAnalysis {
  paper_bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  rotation_degrees: number;
  has_perspective_warp: boolean;
  shadow_regions: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    severity: 'low' | 'medium' | 'high';
  }>;
  glare_regions: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    severity: 'low' | 'medium' | 'high';
  }>;
  background_objects: Array<{
    type: 'desk' | 'floor' | 'hand' | 'other';
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  paper_color_cast: {
    has_cast: boolean;
    description: 'none' | 'warm_yellow' | 'cool_blue' | 'mixed';
    strength: 'low' | 'medium' | 'high';
  };
  drawing_quality: {
    resolution_ok_for_print: boolean;
    blurry: boolean;
    notes: string;
  };
  cleanup_recommendations: {
    needs_crop_and_straighten: boolean;
    needs_background_removal: boolean;
    needs_shadow_removal: 'none' | 'light' | 'strong';
    needs_glare_reduction: 'none' | 'light' | 'strong';
    needs_color_normalisation: boolean;
    needs_contrast_boost: 'none' | 'light' | 'medium';
    noise_reduction_level: 'none' | 'light' | 'medium';
  };
  user_message: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  size: string;
  material?: string;
  color: string;
  gelatoVariantUid?: string;
  priceCents: number;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  userId: string;
  artworkId: string;
  productVariantId: string;
  quantity: number;
  priceCents: number;
  gelatoMockupUrl?: string;
  createdAt: string;
  updatedAt: string;
  artwork?: Artwork;
  productVariant?: ProductVariant;
  product?: Product;
}
