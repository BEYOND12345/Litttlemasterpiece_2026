import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CartItem, Artwork, ProductVariant } from '../types/types';
import {
  getCartItems,
  addCartItem,
  updateCartItemQuantity,
  removeCartItem,
  clearCart
} from '../services/cartService';
import { getCurrentUser } from '../services/authService';

interface CartContextValue {
  cartItems: CartItem[];
  cartCount: number;
  cartTotal: number;
  isLoading: boolean;
  addToCart: (artwork: Artwork, variant: ProductVariant, quantity?: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearAllItems: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadCart = async () => {
    try {
      setIsLoading(true);
      const user = await getCurrentUser();
      if (user) {
        const items = await getCartItems();
        setCartItems(items);
      } else {
        const localCart = localStorage.getItem('cart');
        if (localCart) {
          setCartItems(JSON.parse(localCart));
        }
      }
    } catch (error) {
      console.error('Failed to load cart:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCart();
  }, []);

  useEffect(() => {
    const syncLocalCart = async () => {
      const user = await getCurrentUser();
      if (!user) {
        localStorage.setItem('cart', JSON.stringify(cartItems));
      }
    };
    syncLocalCart();
  }, [cartItems]);

  const addToCart = async (artwork: Artwork, variant: ProductVariant, quantity: number = 1) => {
    try {
      setIsLoading(true);
      const user = await getCurrentUser();

      if (user) {
        const newItem = await addCartItem({
          artworkId: artwork.id,
          productVariantId: variant.id,
          quantity,
          priceCents: variant.priceCents,
        });
        setCartItems(prev => [...prev, newItem]);
      } else {
        const tempItem: CartItem = {
          id: `temp-${Date.now()}`,
          userId: '',
          artworkId: artwork.id,
          productVariantId: variant.id,
          quantity,
          priceCents: variant.priceCents,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          artwork,
          productVariant: variant,
        };
        setCartItems(prev => [...prev, tempItem]);
      }
    } catch (error) {
      console.error('Failed to add to cart:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    try {
      setIsLoading(true);
      const user = await getCurrentUser();

      if (user && !itemId.startsWith('temp-')) {
        await updateCartItemQuantity(itemId, quantity);
      }

      setCartItems(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, quantity } : item
        )
      );
    } catch (error) {
      console.error('Failed to update quantity:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      setIsLoading(true);
      const user = await getCurrentUser();

      if (user && !itemId.startsWith('temp-')) {
        await removeCartItem(itemId);
      }

      setCartItems(prev => prev.filter(item => item.id !== itemId));
    } catch (error) {
      console.error('Failed to remove item:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllItems = async () => {
    try {
      setIsLoading(true);
      const user = await getCurrentUser();

      if (user) {
        await clearCart();
      }

      setCartItems([]);
      localStorage.removeItem('cart');
    } catch (error) {
      console.error('Failed to clear cart:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshCart = async () => {
    await loadCart();
  };

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cartItems.reduce((total, item) => total + (item.priceCents * item.quantity), 0);

  const value: CartContextValue = {
    cartItems,
    cartCount,
    cartTotal,
    isLoading,
    addToCart,
    updateQuantity,
    removeItem,
    clearAllItems: clearAllItems,
    refreshCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
