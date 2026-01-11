import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { ProductVariant, Artwork } from '../types/types';
import { getProductVariants } from '../services/cartService';
import { useCart } from '../contexts/CartContext';
import { Button } from './Button';

interface ProductSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  artwork: Artwork;
}

export const ProductSelector: React.FC<ProductSelectorProps> = ({
  isOpen,
  onClose,
  productId,
  productName,
  artwork,
}) => {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { addToCart } = useCart();

  useEffect(() => {
    if (isOpen && productId) {
      loadVariants();
    }
  }, [isOpen, productId]);

  const loadVariants = async () => {
    try {
      setIsLoading(true);
      const data = await getProductVariants(productId);
      setVariants(data);
      if (data.length > 0) {
        setSelectedVariant(data[0]);
      }
    } catch (error) {
      console.error('Failed to load variants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!selectedVariant) return;

    try {
      setIsLoading(true);
      await addToCart(artwork, selectedVariant, 1);
      onClose();
    } catch (error) {
      console.error('Failed to add to cart:', error);
      alert('Failed to add item to cart. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-lg max-w-md w-full p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="font-serif text-2xl text-stone-900 mb-1">{productName}</h2>
              <p className="text-sm text-stone-500">Select your size and options</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-stone-100 rounded-full transition-colors"
            >
              <X size={20} className="text-stone-600" />
            </button>
          </div>

          <div className="mb-6">
            <img
              src={artwork.processedUrl}
              alt={artwork.title}
              className="w-full h-48 object-contain bg-stone-50 rounded"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-stone-500">Loading options...</div>
          ) : variants.length === 0 ? (
            <div className="text-center py-8 text-stone-500">
              No variants available for this product.
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-6">
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Size & Options
                </label>
                {variants.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => setSelectedVariant(variant)}
                    className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                      selectedVariant?.id === variant.id
                        ? 'border-stone-900 bg-stone-50'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-stone-900">{variant.name}</div>
                        <div className="text-sm text-stone-500 mt-1">
                          {variant.size}
                          {variant.material && ` • ${variant.material}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-stone-900">
                          {formatPrice(variant.priceCents)}
                        </span>
                        {selectedVariant?.id === variant.id && (
                          <div className="w-6 h-6 bg-stone-900 rounded-full flex items-center justify-center">
                            <Check size={14} className="text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <Button
                onClick={handleAddToCart}
                disabled={!selectedVariant || isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? 'Adding...' : 'Add to Cart'}
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
};
