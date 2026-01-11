import React, { useState, useEffect } from 'react';
import { useCart } from '../contexts/CartContext';
import { ShippingAddress, Artwork, Product } from '../types/types';
import { Button } from './Button';
import { ArrowLeft, Package, CreditCard, ShoppingBag, Loader2 } from 'lucide-react';
import { createOrder } from '../services/orderService';
import { getCurrentUser } from '../services/authService';
import { getAllProducts } from '../services/productService';
import { mockupService } from '../services/mockupService';
import { supabase } from '../services/supabaseClient';

interface CheckoutPageProps {
  onBack: () => void;
  onOrderComplete: (orderId: string) => void;
  artwork?: Artwork;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ onBack, onOrderComplete, artwork }) => {
  const { cartItems, cartTotal, clearAllItems } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [mockupUrl, setMockupUrl] = useState<string>('');
  const [isLoadingMockup, setIsLoadingMockup] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [currentArtwork, setCurrentArtwork] = useState<Artwork | undefined>(artwork);
  const [hasRegeneratedMockups, setHasRegeneratedMockups] = useState(false);

  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    name: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
  });

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct && currentArtwork) {
      generateMockup();
    }
  }, [selectedProduct, currentArtwork]);

  const refreshArtworkData = async () => {
    if (!artwork?.id) return;

    try {
      console.log('🔄 Refreshing artwork data from database...');
      const { data: freshArtwork, error } = await supabase
        .from('artworks')
        .select('*')
        .eq('id', artwork.id)
        .maybeSingle();

      if (error || !freshArtwork) {
        console.error('❌ Failed to refresh artwork:', error);
        return;
      }

      const updatedArtwork: Artwork = {
        id: freshArtwork.id,
        userId: freshArtwork.user_id,
        title: freshArtwork.title,
        originalUrl: freshArtwork.original_url,
        processedUrl: freshArtwork.processed_url,
        thumbnailUrl: freshArtwork.thumbnail_url,
        originalNoBgUrl: freshArtwork.original_no_bg_url,
        cloudinaryPublicId: freshArtwork.cloudinary_public_id,
        isPrintReady: freshArtwork.is_print_ready,
        medium: freshArtwork.medium,
        subject: freshArtwork.subject,
        style: freshArtwork.style,
        backgroundColor: freshArtwork.background_color,
        inkColor: freshArtwork.ink_color,
        duotonePair: freshArtwork.duotone_pair,
        signature: freshArtwork.signature,
        transform: freshArtwork.transform,
        createdAt: freshArtwork.created_at
      };

      console.log('✅ Artwork refreshed:', {
        cloudinaryPublicId: updatedArtwork.cloudinaryPublicId,
        signature: updatedArtwork.signature
      });

      setCurrentArtwork(updatedArtwork);

      // Reset regeneration flag to allow fresh generation with updated data
      setHasRegeneratedMockups(false);

      // Trigger mockup regeneration with fresh data
      if (selectedProduct) {
        generateMockup();
      }
    } catch (err) {
      console.error('❌ Error refreshing artwork:', err);
    }
  };

  const loadProducts = async () => {
    try {
      const allProducts = await getAllProducts();
      setProducts(allProducts);
      if (allProducts.length > 0) {
        setSelectedProduct(allProducts[0]);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const generateMockup = async () => {
    if (!currentArtwork || !selectedProduct) return;

    console.log('🎨 CheckoutPage - Generating mockup for artwork:', {
      artworkId: currentArtwork.id,
      cloudinaryPublicId: currentArtwork.cloudinaryPublicId,
      signature: currentArtwork.signature,
      productType: selectedProduct.type
    });

    try {
      setIsLoadingMockup(true);

      // Check if artwork has been uploaded to Cloudinary
      if (!currentArtwork.cloudinaryPublicId) {
        console.warn('⚠️ Artwork has no Cloudinary public ID yet, using fallback image');
        setMockupUrl(currentArtwork.processedUrl);
        setIsLoadingMockup(false);
        return;
      }

      const templates = await mockupService.getTemplatesByProductType(selectedProduct.type);
      console.log(`📋 Found ${templates.length} templates for product type: ${selectedProduct.type}`);

      if (templates.length > 0) {
        console.log('🚀 Generating mockup with template:', templates[0].id);

        // CRITICAL FIX: If artwork has a signature, force regenerate ONCE to ensure it's included
        if (currentArtwork.signature?.text && !hasRegeneratedMockups) {
          console.log('🔄 Signature detected, force regenerating mockups to ensure signature is included...');
          console.log('   Signature data:', currentArtwork.signature);

          // Delete existing mockups to force fresh generation with signature
          await mockupService.regenerateAllMockupsForArtwork(currentArtwork.id);
          console.log('✅ Mockups regenerated with signature');
          setHasRegeneratedMockups(true);
        }

        const { url } = await mockupService.generateMockupForArtwork(currentArtwork.id, templates[0].id);
        console.log('✅ Mockup generated successfully:', url);
        setMockupUrl(url);
      } else {
        console.log('ℹ️ No templates found, using processed artwork URL');
        setMockupUrl(currentArtwork.processedUrl);
      }
    } catch (err: any) {
      console.error('❌ Failed to generate mockup:', err);
      console.error('Error details:', {
        message: err?.message,
        artworkId: currentArtwork?.id,
        cloudinaryPublicId: currentArtwork?.cloudinaryPublicId
      });
      setMockupUrl(currentArtwork.processedUrl);
    } finally {
      setIsLoadingMockup(false);
    }
  };

  const handleAddToCart = async () => {
    if (!currentArtwork || !selectedProduct) return;

    try {
      await addItem(currentArtwork, selectedProduct, quantity);
      setShowCheckoutForm(true);
    } catch (err) {
      console.error('Failed to add to cart:', err);
      setError('Failed to add item to cart');
    }
  };

  const handleInputChange = (field: keyof ShippingAddress, value: string) => {
    setShippingAddress(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    if (!shippingAddress.name.trim()) {
      setError('Please enter your full name');
      return false;
    }
    if (!shippingAddress.addressLine1.trim()) {
      setError('Please enter your street address');
      return false;
    }
    if (!shippingAddress.city.trim()) {
      setError('Please enter your city');
      return false;
    }
    if (!shippingAddress.postalCode.trim()) {
      setError('Please enter your postal code');
      return false;
    }
    if (!shippingAddress.country.trim()) {
      setError('Please select your country');
      return false;
    }
    return true;
  };

  const handleSubmitOrder = async () => {
    setError(null);

    if (!validateForm()) {
      return;
    }

    try {
      setIsProcessing(true);
      const user = await getCurrentUser();

      if (!user) {
        setError('You must be signed in to place an order');
        return;
      }

      const orderId = await createOrder(cartItems, shippingAddress);

      await clearAllItems();

      onOrderComplete(orderId);
    } catch (err) {
      console.error('Order submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const shippingEstimate = 999;
  const taxEstimate = Math.round(cartTotal * 0.08);
  const orderTotal = cartTotal + shippingEstimate + taxEstimate;

  if (artwork && !showCheckoutForm) {
    return (
      <div className="min-h-screen bg-stone-50 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <button
            onClick={onBack}
            className="flex items-center text-stone-600 hover:text-stone-900 transition-colors mb-8"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Studio
          </button>

          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <div className="sticky top-24">
                <h1 className="font-serif text-4xl text-stone-900 mb-8">Your Artwork on Products</h1>
                {currentArtwork && !currentArtwork.cloudinaryPublicId && (
                  <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Loader2 className="text-amber-600 animate-spin flex-shrink-0 mt-0.5" size={20} />
                      <div className="flex-1">
                        <p className="text-sm text-amber-900 font-medium mb-1">
                          Preparing your artwork for products...
                        </p>
                        <p className="text-xs text-amber-700">
                          Your artwork is still being processed. Product mockups with your signature will be available in a moment.
                        </p>
                        <button
                          onClick={refreshArtworkData}
                          disabled={isLoadingMockup}
                          className="mt-3 text-xs text-amber-800 underline hover:text-amber-900 disabled:opacity-50"
                        >
                          {isLoadingMockup ? 'Checking...' : 'Refresh to check status'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden aspect-square relative">
                  {isLoadingMockup && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                      <Loader2 className="animate-spin text-terracotta" size={40} />
                    </div>
                  )}
                  {mockupUrl ? (
                    <img
                      src={mockupUrl}
                      alt="Product mockup"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-stone-100">
                      <p className="text-stone-400">Select a product to preview</p>
                    </div>
                  )}
                </div>
                {mockupUrl && currentArtwork && (
                  <button
                    onClick={async () => {
                      if (!currentArtwork?.id) return;
                      setIsLoadingMockup(true);
                      try {
                        console.log('🔄 Manually regenerating all mockups...');
                        await mockupService.regenerateAllMockupsForArtwork(currentArtwork.id);
                        console.log('✅ Mockups regenerated, reloading...');
                        await generateMockup();
                      } catch (err) {
                        console.error('Failed to regenerate:', err);
                        alert('Failed to regenerate mockup. Please try again.');
                      } finally {
                        setIsLoadingMockup(false);
                      }
                    }}
                    disabled={isLoadingMockup}
                    className="mt-3 text-sm text-terracotta hover:text-terracotta/80 underline disabled:opacity-50"
                  >
                    {isLoadingMockup ? 'Regenerating...' : 'Regenerate Mockup'}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <h2 className="font-serif text-2xl text-stone-900 mb-4">Choose Your Product</h2>
                <div className="grid grid-cols-2 gap-4">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className={`p-4 border-2 rounded-lg transition-all text-left ${
                        selectedProduct?.id === product.id
                          ? 'border-terracotta bg-terracotta/5'
                          : 'border-stone-200 hover:border-stone-300 bg-white'
                      }`}
                    >
                      <h3 className="font-medium text-stone-900 mb-1">{product.name}</h3>
                      <p className="text-sm text-stone-500 mb-2">{product.description}</p>
                      <p className="font-serif text-lg text-stone-900">{formatPrice(product.priceCents)}</p>
                    </button>
                  ))}
                </div>
              </div>

              {selectedProduct && (
                <div className="bg-white rounded-lg p-6 shadow-sm border border-stone-200">
                  <h3 className="font-serif text-xl text-stone-900 mb-4">Product Details</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-4 border-b border-stone-100">
                      <span className="text-stone-600">Product</span>
                      <span className="font-medium text-stone-900">{selectedProduct.name}</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-stone-100">
                      <span className="text-stone-600">Price</span>
                      <span className="font-medium text-stone-900">{formatPrice(selectedProduct.priceCents)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-stone-100">
                      <span className="text-stone-600">Quantity</span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="w-8 h-8 rounded border border-stone-300 hover:bg-stone-100 flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="font-medium text-stone-900 w-8 text-center">{quantity}</span>
                        <button
                          onClick={() => setQuantity(quantity + 1)}
                          className="w-8 h-8 rounded border border-stone-300 hover:bg-stone-100 flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="font-serif text-lg text-stone-900">Total</span>
                      <span className="font-serif text-2xl text-stone-900">
                        {formatPrice(selectedProduct.priceCents * quantity)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleAddToCart}
                    className="w-full mt-6 px-6 py-4 bg-terracotta hover:bg-terracotta/90 text-white text-base font-medium rounded-lg transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                  >
                    <ShoppingBag size={20} />
                    Add to Cart & Continue
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <button
          onClick={() => artwork ? setShowCheckoutForm(false) : onBack()}
          className="flex items-center text-stone-600 hover:text-stone-900 transition-colors mb-8"
        >
          <ArrowLeft size={20} className="mr-2" />
          {artwork ? 'Back to Products' : 'Back to Cart'}
        </button>

        <h1 className="font-serif text-4xl text-stone-900 mb-12">Checkout</h1>

        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <div className="bg-white rounded-lg p-8 shadow-sm mb-8">
              <div className="flex items-center gap-3 mb-6">
                <Package size={24} className="text-stone-900" />
                <h2 className="font-serif text-2xl text-stone-900">Shipping Address</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={shippingAddress.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-4 py-3 border border-stone-300 rounded focus:outline-none focus:border-stone-900"
                    placeholder="John Smith"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    value={shippingAddress.addressLine1}
                    onChange={(e) => handleInputChange('addressLine1', e.target.value)}
                    className="w-full px-4 py-3 border border-stone-300 rounded focus:outline-none focus:border-stone-900"
                    placeholder="123 Main Street"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Apartment, suite, etc. (optional)
                  </label>
                  <input
                    type="text"
                    value={shippingAddress.addressLine2 || ''}
                    onChange={(e) => handleInputChange('addressLine2', e.target.value)}
                    className="w-full px-4 py-3 border border-stone-300 rounded focus:outline-none focus:border-stone-900"
                    placeholder="Apt 4B"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">
                      City *
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      className="w-full px-4 py-3 border border-stone-300 rounded focus:outline-none focus:border-stone-900"
                      placeholder="New York"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">
                      State / Province
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.state || ''}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      className="w-full px-4 py-3 border border-stone-300 rounded focus:outline-none focus:border-stone-900"
                      placeholder="NY"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">
                      Postal Code *
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.postalCode}
                      onChange={(e) => handleInputChange('postalCode', e.target.value)}
                      className="w-full px-4 py-3 border border-stone-300 rounded focus:outline-none focus:border-stone-900"
                      placeholder="10001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">
                      Country *
                    </label>
                    <select
                      value={shippingAddress.country}
                      onChange={(e) => handleInputChange('country', e.target.value)}
                      className="w-full px-4 py-3 border border-stone-300 rounded focus:outline-none focus:border-stone-900"
                    >
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                      <option value="GB">United Kingdom</option>
                      <option value="AU">Australia</option>
                      <option value="DE">Germany</option>
                      <option value="FR">France</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <CreditCard size={24} className="text-stone-900" />
                <h2 className="font-serif text-2xl text-stone-900">Payment</h2>
              </div>
              <p className="text-stone-600">
                Payment integration coming soon. For now, orders will be created in pending status.
              </p>
            </div>
          </div>

          <div>
            <div className="bg-white rounded-lg p-8 shadow-sm sticky top-24">
              <h2 className="font-serif text-2xl text-stone-900 mb-6">Order Summary</h2>

              <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex gap-4 pb-4 border-b border-stone-100">
                    <div className="w-20 h-20 bg-stone-100 rounded overflow-hidden flex-shrink-0">
                      {item.artwork && (
                        <img
                          src={item.artwork.thumbnailUrl || item.artwork.processedUrl}
                          alt={item.artwork.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-stone-900 text-sm truncate">
                        {item.artwork?.title || 'Artwork'}
                      </h3>
                      <p className="text-xs text-stone-500 mt-1">
                        {item.product?.name} • {item.productVariant?.size}
                      </p>
                      <p className="text-sm text-stone-700 mt-1">
                        Qty: {item.quantity} × {formatPrice(item.priceCents)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 mb-6 pb-6 border-b border-stone-200">
                <div className="flex justify-between text-stone-700">
                  <span>Subtotal</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-stone-700">
                  <span>Shipping (estimated)</span>
                  <span>{formatPrice(shippingEstimate)}</span>
                </div>
                <div className="flex justify-between text-stone-700">
                  <span>Tax (estimated)</span>
                  <span>{formatPrice(taxEstimate)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center mb-6">
                <span className="font-serif text-xl text-stone-900">Total</span>
                <span className="font-serif text-2xl text-stone-900">
                  {formatPrice(orderTotal)}
                </span>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {error}
                </div>
              )}

              <Button
                onClick={handleSubmitOrder}
                disabled={isProcessing || cartItems.length === 0}
                className="w-full"
                size="lg"
              >
                {isProcessing ? 'Processing...' : 'Place Order'}
              </Button>

              <p className="text-xs text-stone-500 text-center mt-4">
                By placing your order, you agree to our terms and conditions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
