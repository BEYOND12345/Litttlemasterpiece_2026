import React, { useState, useEffect } from 'react';
import { Artwork, ArtStyle } from '../types/types';
import { Button } from './Button';
import { ArrowLeft, ShoppingBag, Loader2, RefreshCw } from 'lucide-react';
import { ProductSelector } from './ProductSelector';
import { mockupService, MockupTemplate, ArtworkMockup } from '../services/mockupService';
import { getProductsByType } from '../services/productService';
import { supabase } from '../services/supabaseClient';

interface MockupGalleryProps {
  artwork: Artwork;
  onBack: () => void;
}

export const MockupGallery: React.FC<MockupGalleryProps> = ({ artwork: initialArtwork, onBack }) => {
  const [artwork, setArtwork] = useState(initialArtwork);
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string } | null>(null);
  const [templates, setTemplates] = useState<MockupTemplate[]>([]);
  const [mockups, setMockups] = useState<Record<string, ArtworkMockup>>({});
  const [loadingMockups, setLoadingMockups] = useState<Record<string, boolean>>({});
  const [failedMockups, setFailedMockups] = useState<Record<string, boolean>>({});
  const [products, setProducts] = useState<any[]>([]);
  const [cloudinaryPending, setCloudinaryPending] = useState(!initialArtwork.cloudinaryPublicId);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!artwork.cloudinaryPublicId && cloudinaryPending) {
      console.log('⏳ Polling for Cloudinary upload completion...');
      const pollInterval = setInterval(async () => {
        try {
          const { data, error } = await supabase
            .from('artworks')
            .select('cloudinary_public_id')
            .eq('id', artwork.id)
            .single();

          if (!error && data?.cloudinary_public_id) {
            console.log('✅ Cloudinary upload completed:', data.cloudinary_public_id);
            setArtwork(prev => ({ ...prev, cloudinaryPublicId: data.cloudinary_public_id }));
            setCloudinaryPending(false);
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.error('Error polling for cloudinary_public_id:', error);
        }
      }, 2000);

      const timeout = setTimeout(() => {
        clearInterval(pollInterval);
        setCloudinaryPending(false);
        console.warn('⚠️ Cloudinary upload timed out after 30 seconds');
      }, 30000);

      return () => {
        clearInterval(pollInterval);
        clearTimeout(timeout);
      };
    }
  }, [artwork.id, artwork.cloudinaryPublicId, cloudinaryPending]);

  useEffect(() => {
    if (artwork.cloudinaryPublicId || !cloudinaryPending) {
      loadTemplatesAndMockups();
    }
  }, [artwork.id, artwork.cloudinaryPublicId, cloudinaryPending]);

  const loadTemplatesAndMockups = async () => {
    try {
      const allTemplates = await mockupService.getAllTemplates();
      setTemplates(allTemplates);

      const productData = await getProductsByType();
      setProducts(productData);

      for (const template of allTemplates) {
        await generateMockupForTemplate(template);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const generateMockupForTemplate = async (template: MockupTemplate) => {
    setLoadingMockups(prev => ({ ...prev, [template.id]: true }));

    console.log('='.repeat(80));
    console.log(`🔍 DIAGNOSTIC LOG FOR TEMPLATE: ${template.name}`);
    console.log('='.repeat(80));

    try {
      console.log('📋 STEP 1: Template Data');
      console.log('Template ID:', template.id);
      console.log('Template Name:', template.name);
      console.log('Product Type:', template.product_type);
      console.log('Cloudinary Public ID (raw):', template.cloudinary_public_id);
      console.log('Cloudinary Public ID (type):', typeof template.cloudinary_public_id);
      console.log('Placement Config:', JSON.stringify(template.placement_config, null, 2));

      console.log('\n📋 STEP 2: Artwork Data');
      console.log('Artwork ID:', artwork.id);
      console.log('Artwork Cloudinary Public ID (raw):', artwork.cloudinaryPublicId);
      console.log('Artwork Cloudinary Public ID (type):', typeof artwork.cloudinaryPublicId);

      const { mockup, url } = await mockupService.generateMockupForArtwork(
        artwork.id,
        template.id
      );

      console.log('\n📋 STEP 3: Generated Mockup URL');
      console.log('Generated URL (exact string):', url);
      console.log('Mockup Image URL from DB (exact string):', mockup.mockup_image_url);
      console.log('Generation Status:', mockup.generation_status);

      console.log('\n📋 STEP 4: Testing Cloudinary URL');
      try {
        const testResponse = await fetch(url, { method: 'HEAD' });
        console.log('HTTP Status Code:', testResponse.status);
        console.log('Status Text:', testResponse.statusText);
        console.log('Response Headers:');
        testResponse.headers.forEach((value, key) => {
          console.log(`  ${key}: ${value}`);
        });

        if (!testResponse.ok) {
          console.log('⚠️ URL is not accessible. Fetching full response...');
          const fullResponse = await fetch(url);
          const contentType = fullResponse.headers.get('content-type');
          console.log('Content-Type:', contentType);

          if (contentType?.includes('text') || contentType?.includes('json') || contentType?.includes('xml')) {
            const errorText = await fullResponse.text();
            console.log('Error Response Body:', errorText);
          } else {
            console.log('Response is binary/image data (likely image works but wrong format)');
          }
        } else {
          console.log('✅ URL is accessible and returns 200 OK');
        }
      } catch (fetchError) {
        console.error('❌ Fetch test failed:', fetchError);
      }

      console.log('\n📋 STEP 5: URL Structure Analysis');
      const urlParts = url.split('/');
      console.log('Cloud Name:', urlParts[3]);
      console.log('Resource Type:', urlParts[4]);
      console.log('Delivery Type:', urlParts[5]);
      console.log('Transformations:', urlParts.slice(6, -1).join('/'));
      console.log('Base Image Public ID:', urlParts[urlParts.length - 1]);

      console.log('\n📋 STEP 6: Public ID Validation');
      console.log('Base Image Public ID contains:');
      console.log('  - Folders:', template.cloudinary_public_id.includes('/') ? 'YES' : 'NO');
      console.log('  - Spaces:', template.cloudinary_public_id.includes(' ') ? 'YES' : 'NO');
      console.log('  - Uppercase:', /[A-Z]/.test(template.cloudinary_public_id) ? 'YES' : 'NO');
      console.log('  - Special chars:', /[^a-zA-Z0-9_\-\/]/.test(template.cloudinary_public_id) ? 'YES' : 'NO');

      if (artwork.cloudinaryPublicId) {
        console.log('Artwork Public ID contains:');
        console.log('  - Folders:', artwork.cloudinaryPublicId.includes('/') ? 'YES' : 'NO');
        console.log('  - Spaces:', artwork.cloudinaryPublicId.includes(' ') ? 'YES' : 'NO');
        console.log('  - Uppercase:', /[A-Z]/.test(artwork.cloudinaryPublicId) ? 'YES' : 'NO');
        console.log('  - Special chars:', /[^a-zA-Z0-9_\-\/]/.test(artwork.cloudinaryPublicId) ? 'YES' : 'NO');
      }

      console.log('='.repeat(80));

      setMockups(prev => ({ ...prev, [template.id]: mockup }));
      setFailedMockups(prev => ({ ...prev, [template.id]: false }));
    } catch (error: any) {
      console.error(`❌ FAILED to generate mockup for template ${template.id}:`, error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.log('='.repeat(80));
      setFailedMockups(prev => ({ ...prev, [template.id]: true }));
    } finally {
      setLoadingMockups(prev => ({ ...prev, [template.id]: false }));
    }
  };

  const retryMockup = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      await generateMockupForTemplate(template);
    }
  };

  const handleRegenerateAll = async () => {
    if (!artwork.id) return;

    setRegenerating(true);
    try {
      console.log('🔄 Regenerating ALL mockups with updated signature...');
      await mockupService.regenerateAllMockupsForArtwork(artwork.id);

      // Reload mockups
      setMockups({});
      await loadTemplatesAndMockups();

      console.log('✅ All mockups regenerated successfully');
    } catch (error) {
      console.error('Failed to regenerate mockups:', error);
      alert('Failed to regenerate mockups. Please try again.');
    } finally {
      setRegenerating(false);
    }
  };

  const isOpaqueStyle = artwork.style === ArtStyle.DUOTONE;
  const blendMode = isOpaqueStyle ? 'normal' : 'multiply';
  const opacity = isOpaqueStyle ? 'opacity-100' : 'opacity-95';

  return (
    <div className="min-h-screen bg-stone-50">
      
      {/* Header */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <button onClick={onBack} className="flex items-center text-stone-500 hover:text-stone-900 transition-colors text-sm font-medium tracking-wide">
            <ArrowLeft size={16} className="mr-2" /> Back to Studio
          </button>
          <div className="text-center hidden md:block">
            <h1 className="font-serif text-lg text-stone-900">{artwork.subject || 'The Masterpiece'}</h1>
            <p className="text-xs text-stone-400 uppercase tracking-widest">{artwork.medium} by {artwork.signature.text}</p>
          </div>
          <button
            onClick={handleRegenerateAll}
            disabled={regenerating}
            className="flex items-center text-stone-500 hover:text-stone-900 transition-colors text-sm font-medium tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
            title="Regenerate all mockups with current signature"
          >
            <RefreshCw size={16} className={`mr-2 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? 'Regenerating...' : 'Refresh Mockups'}
          </button>
        </div>
      </div>

      {/* Cloudinary Upload Pending Banner */}
      {cloudinaryPending && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between text-sm text-amber-800">
            <div className="flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} />
              <span>Processing artwork for product mockups...</span>
            </div>
            <button
              onClick={() => {
                setCloudinaryPending(false);
                loadTemplatesAndMockups();
              }}
              className="text-xs underline hover:no-underline"
            >
              Use fallback images
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16">
          
          {/* Main Hero Product (Frame) - Takes up full width on mobile, half on desktop */}
          <div className="md:col-span-2 relative mb-8">
            <div className="aspect-[16/9] md:aspect-[21/9] bg-[#e5e0d8] relative rounded-sm shadow-inner overflow-hidden flex items-center justify-center group">
               {/* Wall Shadow simulation */}
               <div className="absolute top-0 w-full h-1/3 bg-gradient-to-b from-black/5 to-transparent pointer-events-none"></div>
               
               {/* Plant Shadow Overlay */}
               <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1596392996504-20d407632646?auto=format&fit=crop&q=80&w=2000')] bg-cover opacity-10 mix-blend-multiply pointer-events-none"></div>

               {/* The Frame Mockup */}
               <div className="relative w-1/3 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] bg-white p-4 md:p-6 transform transition-transform duration-700 group-hover:scale-[1.02]">
                  <div className="border-[16px] border-[#a08a75] shadow-inner bg-white h-full w-full relative">
                    <img
                      src={artwork.processedUrl}
                      className={`w-full h-full object-contain ${opacity}`}
                      style={{ mixBlendMode: blendMode }}
                    />
                    {artwork.signature && (artwork.signature.text || artwork.signature.descriptor) && (
                      <div
                        className="absolute z-10 text-right transform rotate-[-0.5deg] select-none"
                        style={{
                          ...(artwork.signature.position && artwork.signature.position.x > 50
                            ? { right: '8%', bottom: '8%' }
                            : { left: '8%', bottom: '8%' }),
                          color: 'rgba(41, 37, 36, 0.75)'
                        }}
                      >
                        <p className="font-hand text-2xl md:text-3xl leading-none tracking-tight">
                          {artwork.signature.text || 'Artist'}
                        </p>
                        <p className="font-sans text-[9px] tracking-widest mt-1 font-semibold opacity-70">
                          {artwork.signature.descriptor}
                        </p>
                      </div>
                    )}
                  </div>
               </div>

               <div className="absolute bottom-8 left-8 md:bottom-12 md:left-12">
                  <h2 className="font-serif text-3xl md:text-4xl text-stone-900 mb-2">The Curator Collection</h2>
                  <p className="text-stone-600 max-w-sm">Premium framing with warm-toned mats and museum-grade print. Every piece here started as a drawing on the kitchen table.</p>
               </div>
            </div>
          </div>

          {/* Product List with Generic Images */}
          <div className="md:col-span-2">
            <h2 className="font-serif text-2xl text-stone-900 mb-6 mt-12">Choose Your Product</h2>
            <div className="space-y-3">
              {templates
                .filter((template, index, self) =>
                  index === self.findIndex(t => t.product_type === template.product_type)
                )
                .map((template) => {
                  const product = products.find(p => p.type === template.product_type);
                  if (!product) return null;

                  const productImages: Record<string, string> = {
                    'canvas': '/images/mockups/Mockup_Tshirt_01.jpg',
                    'frame': '/images/mockups/Mockup_LargeFrame_01.jpg',
                    'mug': '/images/mockups/Mockup_Coffecup_01.jpg',
                    'tote': '/images/mockups/Mockup_Totebag_01.jpg',
                    'phone': '/images/mockups/Mockup_phonecase_01.jpg',
                    'tshirt': '/images/mockups/Mockup_Tshirt_01.jpg',
                  };

                  return (
                    <button
                      key={template.product_type}
                      onClick={() => setSelectedProduct({ id: product.id, name: product.name })}
                      className="w-full flex items-center gap-4 p-4 bg-white border-2 border-stone-200 rounded-lg hover:border-stone-900 hover:shadow-lg transition-all group"
                    >
                      <div className="w-24 h-24 bg-stone-50 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center p-2">
                        <img
                          src={productImages[template.product_type] || productImages['canvas']}
                          alt={product.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="font-serif text-lg text-stone-900 group-hover:text-terracotta transition-colors">
                          {product.name}
                        </h3>
                        <p className="text-xs text-stone-500 mt-1">{product.description}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-medium text-stone-900">${(product.price_cents / 100).toFixed(2)}</p>
                        <p className="text-xs text-stone-400 mt-1">Starting at</p>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Product Grid - Mockups Display */}
          {templates.map((template, idx) => {
            const product = products.find(p => p.type === template.product_type);
            if (!product) return null;

            const mockup = mockups[template.id];
            const isLoading = loadingMockups[template.id];
            const hasFailed = failedMockups[template.id];

            return (
            <div key={template.id} className="group cursor-pointer">
              <div className="relative aspect-[4/5] bg-stone-200 rounded-sm overflow-hidden mb-6 shadow-sm group-hover:shadow-2xl transition-all duration-500 ease-out">

                 {/* Product Background Context */}
                 <div className="absolute inset-0 bg-white">
                   {/* Realistic Lighting Gradient */}
                   <div className="absolute inset-0 bg-gradient-to-tr from-stone-100 via-white to-stone-50 opacity-80"></div>
                 </div>

                 <div className="absolute inset-0 flex items-center justify-center p-8 md:p-12">
                   {isLoading && (
                     <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                       <div className="flex flex-col items-center gap-2">
                         <Loader2 className="animate-spin text-stone-400" size={32} />
                         <p className="text-xs text-stone-500">Generating mockup...</p>
                       </div>
                     </div>
                   )}

                   {mockup && mockup.mockup_image_url && !hasFailed && (
                     <img
                       src={mockup.mockup_image_url}
                       alt={`${template.name} mockup`}
                       className="w-full h-full object-contain"
                       onLoad={() => {
                         console.log(`✅ Image loaded successfully for ${template.name}`);
                         console.log('   URL:', mockup.mockup_image_url);
                       }}
                       onError={(e) => {
                         console.error(`❌ Image failed to load for ${template.name}`);
                         console.error('   URL:', mockup.mockup_image_url);
                         console.error('   Error event:', e);
                         setFailedMockups(prev => ({ ...prev, [template.id]: true }));
                       }}
                     />
                   )}

                   {hasFailed && (
                     <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                       <div className="flex flex-col items-center gap-2">
                         <p className="text-xs text-stone-500">Failed to load mockup</p>
                         <button
                           onClick={() => retryMockup(template.id)}
                           className="px-3 py-1 text-xs bg-stone-900 text-white rounded hover:bg-stone-800 transition-colors flex items-center gap-1"
                         >
                           <RefreshCw size={12} />
                           Retry
                         </button>
                       </div>
                     </div>
                   )}
                 </div>
              </div>

              {/* Product Info */}
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="font-serif text-xl text-stone-900 group-hover:text-terracotta transition-colors">{product.name}</h3>
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mt-1">{product.description}</p>
                </div>
                <div className="text-right">
                   <span className="block font-medium text-stone-900 mb-2">${(product.price_cents / 100).toFixed(2)}</span>
                   <Button
                     size="sm"
                     variant="outline"
                     className="opacity-0 group-hover:opacity-100 transition-opacity"
                     onClick={() => setSelectedProduct({ id: product.id, name: product.name })}
                   >
                     Add <ShoppingBag size={14} className="ml-1" />
                   </Button>
                </div>
              </div>
            </div>
            );
          })}

        </div>
      </div>

      {selectedProduct && (
        <ProductSelector
          isOpen={true}
          onClose={() => setSelectedProduct(null)}
          productId={selectedProduct.id}
          productName={selectedProduct.name}
          artwork={artwork}
        />
      )}
    </div>
  );
};