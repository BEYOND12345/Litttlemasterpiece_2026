import React, { useState, useEffect } from 'react';
import { Palette, Download, Lock, Sparkles, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from './Button';
import { DownloadModal } from './DownloadModal';
import { getUserCredits, canGenerateStyle } from '../services/creditsService';
import { getArtworkVariants, createStyleVariant, queueStyleGeneration, StyleVariant } from '../services/styleVariantsService';

interface StyleSelectorProps {
  artworkId: string;
  baseImageUrl: string;
  onStyleGenerated?: (variant: StyleVariant) => void;
}

interface StyleOption {
  type: 'original' | 'enhanced' | 'monochrome' | 'duotone' | 'primary';
  name: string;
  description: string;
  creditCost: number;
  previewFilter?: string;
  icon: React.ReactNode;
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    type: 'original',
    name: 'V1 Enhanced Original',
    description: 'AI-assisted cleanup that preserves the authentic artwork exactly as drawn',
    creditCost: 0,
    icon: <Sparkles size={20} />,
  },
  {
    type: 'enhanced',
    name: 'Enhanced',
    description: 'Improved textures, grain, contrast, and print effects',
    creditCost: 1,
    icon: <Palette size={20} />,
  },
  {
    type: 'monochrome',
    name: 'Monochrome',
    description: 'Single color with varying tones and depth',
    creditCost: 1,
    icon: <Palette size={20} />,
  },
  {
    type: 'duotone',
    name: 'Duotone',
    description: 'Two-color screen print style with complementary colors',
    creditCost: 1,
    icon: <Palette size={20} />,
  },
  {
    type: 'primary',
    name: 'Primary Colors',
    description: 'Bold three-color design (red, yellow, blue)',
    creditCost: 1,
    icon: <Palette size={20} />,
  },
];

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  artworkId,
  baseImageUrl,
  onStyleGenerated,
}) => {
  const [variants, setVariants] = useState<StyleVariant[]>([]);
  const [credits, setCredits] = useState<number>(0);
  const [subscriptionTier, setSubscriptionTier] = useState<string>('free');
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [selectedVariantForDownload, setSelectedVariantForDownload] = useState<StyleVariant | null>(null);

  useEffect(() => {
    loadData();
  }, [artworkId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [variantsData, creditsData] = await Promise.all([
        getArtworkVariants(artworkId),
        getUserCredits(),
      ]);

      setVariants(variantsData);
      setCredits(creditsData?.creditsRemaining || 0);
      setSubscriptionTier(creditsData?.subscriptionTier || 'free');
    } catch (error) {
      console.error('Failed to load style data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateStyle = async (styleType: string, creditCost: number) => {
    try {
      const { allowed, reason } = await canGenerateStyle();

      if (!allowed) {
        alert(reason || 'Cannot generate style at this time');
        return;
      }

      if (credits < creditCost) {
        alert('Insufficient credits. Please upgrade your subscription.');
        return;
      }

      setGenerating(prev => new Set(prev).add(styleType));

      await createStyleVariant(artworkId, styleType as any);
      const queueItem = await queueStyleGeneration(artworkId, styleType, creditCost);

      await loadData();

      if (onStyleGenerated) {
        const variant = variants.find(v => v.styleType === styleType);
        if (variant) onStyleGenerated(variant);
      }
    } catch (error) {
      console.error('Failed to generate style:', error);
      alert('Failed to generate style. Please try again.');
    } finally {
      setGenerating(prev => {
        const next = new Set(prev);
        next.delete(styleType);
        return next;
      });
    }
  };

  const getVariantForStyle = (styleType: string): StyleVariant | undefined => {
    return variants.find(v => v.styleType === styleType);
  };

  const getStatusIcon = (variant: StyleVariant | undefined) => {
    if (!variant) return null;

    switch (variant.generationStatus) {
      case 'completed':
        return <CheckCircle2 size={18} className="text-green-600" />;
      case 'processing':
      case 'pending':
        return <Loader2 size={18} className="text-blue-600 animate-spin" />;
      case 'failed':
        return <XCircle size={18} className="text-red-600" />;
      default:
        return null;
    }
  };

  const canGenerate = (styleType: string, creditCost: number): boolean => {
    if (styleType === 'original') return true;
    if (subscriptionTier === 'free') return false;
    return credits >= creditCost;
  };

  const isGenerating = (styleType: string): boolean => {
    return generating.has(styleType);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-terracotta" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif text-2xl text-stone-900">Choose Your Style</h3>
          <p className="text-sm text-stone-500 mt-1">
            Select styles to generate high-resolution print-ready versions
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-stone-900">{credits}</div>
          <div className="text-xs text-stone-500 uppercase tracking-wider">Credits</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {STYLE_OPTIONS.map((option) => {
          const variant = getVariantForStyle(option.type);
          const isAvailable = canGenerate(option.type, option.creditCost);
          const isProcessing = isGenerating(option.type);
          const isCompleted = variant?.generationStatus === 'completed';
          const isLocked = !isAvailable && subscriptionTier === 'free';

          return (
            <div
              key={option.type}
              className={`relative border rounded-lg p-5 transition-all ${
                isCompleted
                  ? 'border-green-600 bg-green-50'
                  : isLocked
                  ? 'border-stone-200 bg-stone-50 opacity-60'
                  : 'border-stone-200 hover:border-terracotta hover:shadow-md'
              }`}
            >
              {isLocked && (
                <div className="absolute top-3 right-3">
                  <Lock size={18} className="text-stone-400" />
                </div>
              )}

              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${isCompleted ? 'bg-green-100' : 'bg-stone-100'}`}>
                  {option.icon}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-serif text-lg text-stone-900">{option.name}</h4>
                    {getStatusIcon(variant)}
                  </div>
                  <p className="text-xs text-stone-600 mb-3">{option.description}</p>

                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      {option.creditCost === 0 ? (
                        <span className="text-green-600 font-semibold">Free</span>
                      ) : (
                        <span className="text-stone-600">
                          {option.creditCost} {option.creditCost === 1 ? 'credit' : 'credits'}
                        </span>
                      )}
                    </div>

                    {isLocked ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => alert('Upgrade to unlock all styles')}
                      >
                        Upgrade
                      </Button>
                    ) : isCompleted ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                        onClick={() => setSelectedVariantForDownload(variant)}
                      >
                        <Download size={14} />
                        Download
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleGenerateStyle(option.type, option.creditCost)}
                        disabled={isProcessing || !isAvailable}
                        isLoading={isProcessing}
                      >
                        {isProcessing ? 'Generating...' : 'Generate'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {variant?.errorMessage && (
                <div className="mt-3 text-xs text-red-600 bg-red-50 p-2 rounded">
                  {variant.errorMessage}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {subscriptionTier === 'free' && (
        <div className="bg-terracotta/10 border border-terracotta/30 rounded-lg p-6 text-center">
          <h4 className="font-serif text-xl text-stone-900 mb-2">Unlock All Styles</h4>
          <p className="text-sm text-stone-600 mb-4">
            Upgrade to generate multiple style variants and access high-resolution downloads
          </p>
          <Button>
            View Plans
          </Button>
        </div>
      )}

      {selectedVariantForDownload && (
        <DownloadModal
          variant={selectedVariantForDownload}
          onClose={() => setSelectedVariantForDownload(null)}
        />
      )}
    </div>
  );
};
