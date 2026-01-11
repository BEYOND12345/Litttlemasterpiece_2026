import React from 'react';
import { X, ShoppingBag, Minus, Plus, Trash2 } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { Button } from './Button';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export const CartSidebar: React.FC<CartSidebarProps> = ({ isOpen, onClose, onCheckout }) => {
  const { cartItems, cartCount, cartTotal, updateQuantity, removeItem, isLoading } = useCart();

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-stone-200">
            <div className="flex items-center gap-2">
              <ShoppingBag size={24} className="text-stone-900" />
              <h2 className="font-serif text-2xl text-stone-900">
                Cart {cartCount > 0 && `(${cartCount})`}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-stone-100 rounded-full transition-colors"
            >
              <X size={20} className="text-stone-600" />
            </button>
          </div>

          {cartItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <ShoppingBag size={64} className="text-stone-300 mb-4" />
              <p className="text-stone-500 text-center mb-2">Your cart is empty</p>
              <p className="text-stone-400 text-sm text-center">
                Add some artwork to get started
              </p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 pb-4 border-b border-stone-100 last:border-0"
                  >
                    <div className="w-24 h-24 bg-stone-100 rounded overflow-hidden flex-shrink-0">
                      {item.artwork && (
                        <img
                          src={item.artwork.thumbnailUrl || item.artwork.processedUrl}
                          alt={item.artwork.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-stone-900 truncate">
                        {item.artwork?.title || 'Artwork'}
                      </h3>
                      <p className="text-sm text-stone-500 mt-1">
                        {item.product?.name || 'Product'} • {item.productVariant?.size}
                      </p>
                      <p className="text-sm font-medium text-stone-900 mt-2">
                        {formatPrice(item.priceCents)}
                      </p>

                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center border border-stone-300 rounded">
                          <button
                            onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                            disabled={isLoading || item.quantity <= 1}
                            className="p-1 hover:bg-stone-100 disabled:opacity-50"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="px-3 text-sm font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={isLoading}
                            className="p-1 hover:bg-stone-100 disabled:opacity-50"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <button
                          onClick={() => removeItem(item.id)}
                          disabled={isLoading}
                          className="p-1 text-stone-400 hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-stone-200 p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-stone-900">Subtotal</span>
                  <span className="font-serif text-xl text-stone-900">
                    {formatPrice(cartTotal)}
                  </span>
                </div>
                <p className="text-xs text-stone-500">
                  Shipping and taxes calculated at checkout
                </p>
                <Button
                  onClick={onCheckout}
                  className="w-full"
                  size="lg"
                  disabled={isLoading}
                >
                  Checkout
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};
