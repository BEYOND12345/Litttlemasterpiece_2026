
import { Artwork, Order, Product, User } from "../types/types";
import { fakeArtworks, fakeOrders, fakeProducts, fakeUsers } from "./fakeDb";

const LATENCY = 600; // ms

// Helper to simulate network delay
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fakeApi = {
  
  // --- USER API ---
  getCurrentUser: async (): Promise<User> => {
    await wait(LATENCY);
    // For prototype, we just return the first fake user as the "session"
    return fakeUsers[0];
  },

  login: async (email: string): Promise<User> => {
    await wait(LATENCY);
    const user = fakeUsers.find(u => u.email === email);
    if (!user) {
      // Simulate registration
      const newUser: User = {
        id: `user_${Date.now()}`,
        email,
        name: email.split('@')[0],
        createdAt: new Date().toISOString()
      };
      fakeUsers.push(newUser);
      return newUser;
    }
    return user;
  },

  // --- ARTWORK API ---
  getUserArtworks: async (userId: string): Promise<Artwork[]> => {
    await wait(LATENCY);
    return fakeArtworks
      .filter(a => a.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getArtworkById: async (id: string): Promise<Artwork | undefined> => {
    await wait(LATENCY);
    return fakeArtworks.find(a => a.id === id);
  },

  saveArtwork: async (artwork: Artwork): Promise<Artwork> => {
    await wait(LATENCY + 500); // Write operations take longer
    const newArt = { ...artwork };
    
    // If ID is missing, generate one (simulating DB auto-increment/UUID)
    if (!newArt.id) {
        newArt.id = `art_${Date.now()}`;
    }
    
    fakeArtworks.unshift(newArt);
    return newArt;
  },

  // --- COMMERCE API ---
  getProducts: async (): Promise<Product[]> => {
    await wait(LATENCY);
    return fakeProducts;
  },

  getOrdersForUser: async (userId: string): Promise<Order[]> => {
    await wait(LATENCY);
    return fakeOrders
      .filter(o => o.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
};
