
import { Artwork, ArtStyle, Order, Product, User } from "../types/types";
import { DUOTONE_PAIRS } from "../constants/constants";

/**
 * FAKE DATABASE
 * 
 * This file acts as the "Backend" data store.
 * The backend team can use this to understand the data relationships.
 */

export const fakeUsers: User[] = [
  {
    id: 'user_1',
    name: 'Daniel',
    email: 'daniel@littlemasterpiece.co',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200',
    createdAt: '2024-01-01T10:00:00Z'
  }
];

export const fakeProducts: Product[] = [
  {
    id: 'prod_frame',
    name: 'The Gallery Frame (Oak)',
    type: 'framed',
    priceCents: 8900,
    mockupImageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=500'
  },
  {
    id: 'prod_tote',
    name: 'Everyday Tote Bag',
    type: 'tote',
    priceCents: 2900,
    mockupImageUrl: 'https://images.unsplash.com/photo-1597484662317-9bd7bdda2907?auto=format&fit=crop&q=80&w=500'
  },
  {
    id: 'prod_digital',
    name: 'Digital Master File',
    type: 'digital',
    priceCents: 1500,
  },
  {
    id: 'prod_mug',
    name: 'Ceramic Artist Mug',
    type: 'mug',
    priceCents: 2400,
    mockupImageUrl: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&q=80&w=500'
  }
];

export const fakeArtworks: Artwork[] = [
  {
    id: 'art_101',
    userId: 'user_1',
    title: 'The Blue Elephant',
    originalUrl: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&q=80&w=800',
    processedUrl: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&q=80&w=800',
    thumbnailUrl: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&q=80&w=400',
    medium: 'Crayon',
    subject: 'Elephant',
    style: ArtStyle.ORIGINAL,
    backgroundColor: '#FAFAF9', // Warm White
    signature: { text: 'Leo', descriptor: 'Age 4', year: '2023' },
    createdAt: '2024-02-15T14:30:00Z',
  },
  {
    id: 'art_102',
    userId: 'user_1',
    title: 'Garden in Spring',
    originalUrl: 'https://images.unsplash.com/photo-1615460599027-db5a13328e19?auto=format&fit=crop&q=80&w=800',
    processedUrl: 'https://images.unsplash.com/photo-1615460599027-db5a13328e19?auto=format&fit=crop&q=80&w=800',
    thumbnailUrl: 'https://images.unsplash.com/photo-1615460599027-db5a13328e19?auto=format&fit=crop&q=80&w=400',
    medium: 'Watercolor',
    subject: 'Flowers',
    style: ArtStyle.MONOCHROME,
    backgroundColor: '#FFFFFF',
    inkColor: '#264653', // Navy
    signature: { text: 'Mia', descriptor: 'For Nana', year: '2024' },
    createdAt: '2024-03-01T09:15:00Z',
  },
  {
    id: 'art_103',
    userId: 'user_1',
    title: 'Speed Racer',
    originalUrl: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&q=80&w=800',
    processedUrl: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&q=80&w=800',
    thumbnailUrl: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&q=80&w=400',
    medium: 'Marker',
    subject: 'Race Car',
    style: ArtStyle.DUOTONE,
    backgroundColor: '#E7E5E4', // Linen
    duotonePair: DUOTONE_PAIRS[0], // Charcoal + Terracotta
    signature: { text: 'Tom', descriptor: 'Fast!', year: '2024' },
    createdAt: '2024-03-10T11:20:00Z',
  }
];

export const fakeOrders: Order[] = [
  {
    id: 'order_5501',
    userId: 'user_1',
    status: 'shipped',
    totalCents: 11800, // $118.00
    createdAt: '2024-02-20T10:00:00Z',
    updatedAt: '2024-02-22T14:30:00Z',
    items: [
      {
        productId: 'prod_frame',
        artworkId: 'art_101',
        quantity: 1,
        priceCents: 8900
      },
      {
        productId: 'prod_tote',
        artworkId: 'art_101',
        quantity: 1,
        priceCents: 2900
      }
    ]
  }
];
