import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '../contexts/CartContext';

interface CartButtonProps {
  onClick: () => void;
}

export const CartButton: React.FC<CartButtonProps> = ({ onClick }) => {
  const { cartCount } = useCart();

  return (
    <button
      onClick={onClick}
      className="relative p-2 hover:bg-stone-100 rounded-full transition-colors"
      aria-label="Shopping cart"
    >
      <ShoppingBag size={22} className="text-stone-700" />
      {cartCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-terracotta text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {cartCount > 9 ? '9+' : cartCount}
        </span>
      )}
    </button>
  );
};
