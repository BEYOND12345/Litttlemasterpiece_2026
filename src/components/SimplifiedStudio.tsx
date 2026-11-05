import React, { useState, useEffect, useRef } from 'react';
import {
  ProcessingStatus, ArtStyle, Artwork, BrandColor, DuotonePair, ArtworkAnalysis
} from '../types/types';
import { analyzeArtwork } from '../services/geminiService';
import { saveArtwork } from '../services/artworkService';
import {
  removeBackground, applyColorCorrection, applySharpen
} from '../services/enhancementService';
import {
  createArtworkMaster,
  generateStyleVariant,
  StyleType,
  StyleOptions
} from '../services/intelligentStyleService';
import { BRAND_BACKGROUNDS, BRAND_INKS, DUOTONE_PAIRS } from '../constants/constants';
import { supabase } from '../services/supabaseClient';
import { getUserCredits } from '../services/creditsService';
import { Button } from './Button';
import {
  Upload, ArrowRight, Loader2, Sparkles, Check, ShoppingBag
} from 'lucide-react';
import { cloudinaryService } from '../services/cloudinaryService';
import { mockupService } from '../services/mockupService';
import { compressImage } from '../utils/imageCompression';
import { measureSharpness, SharpnessResult } from '../utils/sharpness';

interface SimplifiedStudioProps {
  onComplete: (artwork: Artwork) => void;
  onContinueToProducts?: (artwork: Artwork) => void;
  initialFile?: File;
  existingArtwork?: Artwork;
}

const hexToRgbScale = (hex: string) => {
  if (!hex) return { r: 0, g: 0, b: 0 };
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return { r: isNaN(r) ? 0 : r, g: isNaN(g) ? 0 : g, b: isNaN(b) ? 0 : b };
};

export const SimplifiedStudio: React.FC<SimplifiedStudioProps> = ({
  onComplete, onContinueToProducts, initialFile, existingArtwork
}) => {
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [uploadedButNotStarted, setUploadedButNotStarted] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [rawOriginalUrl, setRawOriginalUrl] = useState<string>('');
  // Blur check on the raw upload, before anything is processed or paid for.
  const [sharpness, setSharpness] = useState<SharpnessResult | null>(null);
  const [checkingSharpness, setCheckingSharpness] = useState(false);
  const [useBlurryAnyway, setUseBlurryAnyway] = useState(false);
  // A slow check on an earlier photo must not overwrite the current photo's.
  const sharpnessRequest = useRef(0);

  // V1 Simple Controls
  const [scale, setScale] = useState<number>(1);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [cleanedUrl, setCleanedUrl] = useState<string>('');
  const [noBgUrl, setNoBgUrl] = useState<string>('');
  const [masterId, setMasterId] = useState<string | null>(null);
  const [masterUrl, setMasterUrl] = useState<string>('');
  const [masterMetadata, setMasterMetadata] = useState<any>(null);
  const [currentVariantUrl, setCurrentVariantUrl] = useState<string>('');
  const [styleCache, setStyleCache] = useState<Map<string, string>>(new Map());
  const [isGeneratingStyle, setIsGeneratingStyle] = useState(false);
  const [analysis, setAnalysis] = useState<ArtworkAnalysis | null>(null);
  const [processedArtwork, setProcessedArtwork] = useState<Artwork | null>(existingArtwork || null);

  const [style, setStyle] = useState<ArtStyle>(ArtStyle.ORIGINAL);
  const [inkColor, setInkColor] = useState<BrandColor>(BRAND_INKS[0]);
  const [bgColor, setBgColor] = useState<BrandColor>(BRAND_BACKGROUNDS[0]);
  const [duotonePair, setDuotonePair] = useState<DuotonePair>(DUOTONE_PAIRS[0]);

  const [sigName, setSigName] = useState<string>('');
  const [sigAge, setSigAge] = useState<string>('');
  const [sigPosition, setSigPosition] = useState<'bottom-right' | 'bottom-left'>('bottom-right');

  const [imageVersion, setImageVersion] = useState(0);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedArtworkId, setSavedArtworkId] = useState<string | null>(existingArtwork?.id || null);
  const [isPremium, setIsPremium] = useState(false);
  const [cloudinaryPublicId, setCloudinaryPublicId] = useState<string | null>(null);
  const [isUploadingToCloudinary, setIsUploadingToCloudinary] = useState(false);
  const [cloudinaryUploadComplete, setCloudinaryUploadComplete] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkUserSubscription();
  }, []);

  useEffect(() => {
    if (existingArtwork?.id && !existingArtwork.originalUrl) {
      loadFullArtworkData();
      return;
    }

    if (existingArtwork) {
      loadExistingArtwork(existingArtwork);
    } else if (initialFile && status === ProcessingStatus.IDLE) {
      handleFileLoad(initialFile);
    }
  }, [initialFile, existingArtwork]);

  useEffect(() => {
    if (masterUrl && status === ProcessingStatus.COMPLETE && !isGeneratingStyle) {
      generateCurrentStyle();
    }
  }, [style, inkColor.hex, duotonePair, bgColor.hex]);

  const checkUserSubscription = async () => {
    try {
      const credits = await getUserCredits();
      if (credits) {
        const premium = credits.subscriptionTier === 'starter' || credits.subscriptionTier === 'pro';
        setIsPremium(premium);
      }
    } catch (err) {
      console.error('Failed to check subscription:', err);
    }
  };

  const loadFullArtworkData = async () => {
    if (!existingArtwork?.id) return;

    try {
      setStatus(ProcessingStatus.PROCESSING);
      setProcessingStep('Loading artwork...');

      const { data: fullArtwork, error } = await supabase
        .from('artworks')
        .select('*')
        .eq('id', existingArtwork.id)
        .maybeSingle();

      if (error) throw error;
      if (!fullArtwork) throw new Error('Artwork not found');

      const loadedArtwork: Artwork = {
        id: fullArtwork.id,
        userId: fullArtwork.user_id,
        title: fullArtwork.title,
        originalUrl: fullArtwork.original_url,
        processedUrl: fullArtwork.processed_url,
        thumbnailUrl: fullArtwork.thumbnail_url,
        originalNoBgUrl: fullArtwork.original_no_bg_url,
        isPrintReady: fullArtwork.is_print_ready,
        medium: fullArtwork.medium,
        subject: fullArtwork.subject,
        style: fullArtwork.style,
        backgroundColor: fullArtwork.background_color,
        inkColor: fullArtwork.ink_color,
        duotonePair: fullArtwork.duotone_pair,
        signature: fullArtwork.signature,
        transform: fullArtwork.transform,
        createdAt: fullArtwork.created_at
      };

      loadExistingArtwork(loadedArtwork);
      setStatus(ProcessingStatus.COMPLETE);
    } catch (err: any) {
      console.error('Failed to load artwork:', err);
      alert(err.message || 'Failed to load artwork');
      setStatus(ProcessingStatus.COMPLETE);
    }
  };

  const loadExistingArtwork = (artwork: Artwork) => {
    setProcessedArtwork(artwork);
    setRawOriginalUrl(artwork.originalUrl);
    setCleanedUrl(artwork.processedUrl);
    setNoBgUrl(artwork.originalNoBgUrl || artwork.processedUrl);
    setSavedArtworkId(artwork.id);

    if (artwork.style) setStyle(artwork.style);
    if (artwork.backgroundColor) {
      const matchingBg = BRAND_BACKGROUNDS.find(b => b.hex === artwork.backgroundColor);
      if (matchingBg) setBgColor(matchingBg);
    }
    if (artwork.signature) {
      setSigName(artwork.signature.text || '');
      setSigAge(artwork.signature.descriptor || '');
      const pos = artwork.signature.position;
      if (pos && pos.x > 50) {
        setSigPosition('bottom-right');
      } else if (pos) {
        setSigPosition('bottom-left');
      }
    }
  };

  const handleFileLoad = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const rawBase64 = reader.result as string;
      setRawOriginalUrl(rawBase64);
      setUploadedButNotStarted(true);

      const request = ++sharpnessRequest.current;
      setSharpness(null);
      setUseBlurryAnyway(false);
      setCheckingSharpness(true);
      measureSharpness(rawBase64)
        .then((result) => {
          if (request === sharpnessRequest.current) setSharpness(result);
        })
        .catch((err) => {
          // A check that cannot run must not block the upload.
          console.warn('Blur check failed, allowing the photo:', err);
        })
        .finally(() => {
          if (request === sharpnessRequest.current) setCheckingSharpness(false);
        });
    };
    reader.readAsDataURL(file);
  };

  const retakePhoto = () => {
    setRawOriginalUrl('');
    setUploadedButNotStarted(false);
    setSharpness(null);
    setUseBlurryAnyway(false);
    fileInputRef.current?.click();
  };

  const handleStartTransformation = () => {
    if (!rawOriginalUrl) return;
    setUploadedButNotStarted(false);
    setStatus(ProcessingStatus.ANALYZING);
    setTimeout(() => {
      runAutomaticRestoration(rawOriginalUrl);
    }, 100);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileLoad(e.target.files[0]);
    }
  };

  const runAutomaticRestoration = async (rawBase64: string) => {
    try {
      setStatus(ProcessingStatus.PROCESSING);

      const tempArtworkId = `temp_${Date.now()}`;

      const masterResult = await createArtworkMaster(
        tempArtworkId,
        rawBase64,
        (step) => setProcessingStep(step)
      );

      setMasterId(masterResult.masterId);
      setMasterUrl(masterResult.masterUrl);
      setMasterMetadata(masterResult.metadata);
      setCleanedUrl(masterResult.masterUrl);
      setNoBgUrl(masterResult.masterUrl);

      setAnalysis({
        medium: masterResult.metadata.medium,
        subject: masterResult.metadata.subject,
        colorPalette: masterResult.metadata.dominantColors
      });

      // Show V1 analysis message to user if available
      if (masterResult.metadata.v1Analysis?.user_message) {
        console.log('V1 Quality Check:', masterResult.metadata.v1Analysis.user_message);
      }

      setProcessingStep('Generating Original Clean style...');
      await generateCurrentStyle();

      setProcessingStep('Ready!');
      setStatus(ProcessingStatus.COMPLETE);
    } catch (error) {
      console.error('Restoration failed:', error);
      setCleanedUrl(rawBase64);
      setNoBgUrl(rawBase64);
      setStatus(ProcessingStatus.COMPLETE);
    }
  };

  const uploadToCloudinary = async (artworkId: string, imageDataUrl: string) => {
    try {
      const validation = cloudinaryService.validateConfig();
      if (!validation.valid) {
        console.warn('Cloudinary not configured, skipping upload:', validation.message);
        return;
      }

      const blob = await fetch(imageDataUrl).then(r => r.blob());

      console.log(`Original size: ${(blob.size / (1024 * 1024)).toFixed(2)}MB`);

      const compressedBlob = await compressImage(blob, {
        maxWidth: 2000,
        maxHeight: 2000,
        quality: 0.85,
        maxSizeMB: 9.5
      });

      console.log(`Compressed size: ${(compressedBlob.size / (1024 * 1024)).toFixed(2)}MB`);

      const uploadResult = await cloudinaryService.uploadArtwork(compressedBlob, artworkId);
      setCloudinaryPublicId(uploadResult.public_id);
      console.log('✅ Artwork uploaded to Cloudinary:', uploadResult.public_id);
    } catch (error) {
      console.error('Failed to upload to Cloudinary:', error);
    }
  };

  const generateCurrentStyle = async () => {
    if (!masterUrl) return;

    try {
      setIsGeneratingStyle(true);

      const styleType = mapArtStyleToStyleType(style);
      const options: StyleOptions = {
        backgroundColor: bgColor.hex,
        ...(style === ArtStyle.MONOCHROME && { inkColor: inkColor.hex }),
        ...(style === ArtStyle.DUOTONE && {
          duotoneDark: duotonePair.dark,
          duotoneLight: duotonePair.light
        })
      };

      const cacheKey = `${styleType}_${JSON.stringify(options)}`;

      if (styleCache.has(cacheKey)) {
        setCurrentVariantUrl(styleCache.get(cacheKey)!);
        setIsGeneratingStyle(false);
        return;
      }

      const variantResult = await generateStyleVariant(
        masterUrl,
        styleType,
        options,
        masterMetadata,
        (step) => setProcessingStep(step)
      );

      setCurrentVariantUrl(variantResult.variantUrl);
      setStyleCache(new Map(styleCache.set(cacheKey, variantResult.variantUrl)));
      setIsGeneratingStyle(false);
    } catch (error) {
      console.error('Style generation failed:', error);
      setIsGeneratingStyle(false);
    }
  };

  const mapArtStyleToStyleType = (artStyle: ArtStyle): StyleType => {
    switch (artStyle) {
      case ArtStyle.ORIGINAL:
        return 'original_clean';
      case ArtStyle.ENHANCED:
        return 'enhanced_print';
      case ArtStyle.MONOCHROME:
        return 'monochrome';
      case ArtStyle.DUOTONE:
        return 'duotone';
      default:
        return 'original_clean';
    }
  };

  const handleContinueToProducts = async () => {
    if (!savedArtworkId || !onContinueToProducts) return;

    try {
      console.log('🔍 Fetching fresh artwork data before navigating to products...');

      // Fetch the latest artwork data from database including signature and cloudinary_public_id
      const { data: freshArtwork, error } = await supabase
        .from('artworks')
        .select('*')
        .eq('id', savedArtworkId)
        .maybeSingle();

      if (error) {
        console.error('❌ Failed to fetch fresh artwork:', error);
        throw error;
      }

      if (!freshArtwork) {
        throw new Error('Artwork not found in database');
      }

      console.log('✅ Fresh artwork fetched:', {
        id: freshArtwork.id,
        signature: freshArtwork.signature,
        cloudinary_public_id: freshArtwork.cloudinary_public_id
      });

      // Check if Cloudinary upload is complete
      if (!freshArtwork.cloudinary_public_id) {
        console.warn('⚠️ Cloudinary upload not complete yet');
        alert('Please wait a moment while we prepare your artwork for products...');
        return;
      }

      // Convert database format to Artwork type
      const fullArtwork: Artwork = {
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

      console.log('🚀 Navigating to products with fresh artwork data');
      onContinueToProducts(fullArtwork);
    } catch (err: any) {
      console.error('❌ Failed to continue to products:', err);
      alert('Failed to load artwork. Please try again.');
    }
  };

  const handleSave = async () => {
    console.log('🚀 handleSave called');

    // Check authentication FIRST before anything else
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.error('❌ User not authenticated - cannot save');
      alert('Your session has expired. Please sign in again to save your artwork.');
      window.location.href = '/#/auth';
      return;
    }
    console.log('✅ User authenticated:', session.user.email);

    console.log('📊 State check:', {
      hasRawOriginalUrl: !!rawOriginalUrl,
      hasCleanedUrl: !!cleanedUrl,
      savedArtworkId,
      style,
      signatureName: sigName,
      signatureAge: sigAge
    });

    if (!rawOriginalUrl) {
      alert('No original image found. Please upload an image first.');
      return;
    }

    if (!cleanedUrl) {
      alert('Image processing not complete. Please wait for processing to finish.');
      return;
    }

    setIsSaving(true);
    try {
      const signaturePosition = sigPosition === 'bottom-right' ? { x: 88, y: 88 } : { x: 15, y: 88 };

      if (savedArtworkId) {
        const { data: { session: updateSession } } = await supabase.auth.getSession();
        const user = updateSession?.user;
        if (!user) throw new Error('Please sign in to save changes');

        const { error: updateError } = await supabase
          .from('artworks')
          .update({
            processed_url: cleanedUrl,
            thumbnail_url: cleanedUrl,
            style,
            ink_color: style === ArtStyle.MONOCHROME ? inkColor.hex : null,
            background_color: bgColor.hex,
            duotone_pair: style === ArtStyle.DUOTONE ? duotonePair : null,
            cloudinary_public_id: cloudinaryPublicId,
            signature: {
              text: sigName,
              descriptor: sigAge,
              year: new Date().getFullYear().toString(),
              position: signaturePosition
            },
          })
          .eq('id', savedArtworkId);

        if (updateError) throw updateError;

        const updatedArtwork: Artwork = {
          ...processedArtwork!,
          processedUrl: cleanedUrl,
          thumbnailUrl: cleanedUrl,
          style,
          inkColor: style === ArtStyle.MONOCHROME ? inkColor.hex : undefined,
          backgroundColor: bgColor.hex,
          duotonePair: style === ArtStyle.DUOTONE ? duotonePair : undefined,
          signature: {
            text: sigName,
            descriptor: sigAge,
            year: new Date().getFullYear().toString(),
            position: signaturePosition
          },
        };

        setProcessedArtwork(updatedArtwork);
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 5000);
        onComplete(updatedArtwork);

        console.log('✅ Artwork updated in database with signature:', updatedArtwork.signature);

        // Regenerate mockups in background to include updated signature
        if (cloudinaryPublicId) {
          setIsUploadingToCloudinary(true);
          setCloudinaryUploadComplete(false);
          (async () => {
            try {
              console.log('🔄 Regenerating mockups with updated signature...');
              await mockupService.regenerateAllMockupsForArtwork(savedArtworkId);
              console.log('✅ Mockups regenerated successfully');
              setCloudinaryUploadComplete(true);
            } catch (error) {
              console.error('❌ Failed to regenerate mockups:', error);
            } finally {
              setIsUploadingToCloudinary(false);
            }
          })();
        } else {
          console.warn('⚠️ No Cloudinary public ID yet, mockups will be generated after upload completes');
        }
      } else {
        const artworkData: Omit<Artwork, 'id' | 'createdAt'> = {
          userId: '',
          title: analysis?.subject || 'My Little Masterpiece',
          originalUrl: rawOriginalUrl,
          processedUrl: cleanedUrl,
          thumbnailUrl: cleanedUrl,
          medium: analysis?.medium || 'Mixed',
          subject: analysis?.subject || 'Artwork',
          style,
          inkColor: style === ArtStyle.MONOCHROME ? inkColor.hex : undefined,
          backgroundColor: bgColor.hex,
          duotonePair: style === ArtStyle.DUOTONE ? duotonePair : undefined,
          signature: {
            text: sigName,
            descriptor: sigAge,
            year: new Date().getFullYear().toString(),
            position: signaturePosition
          },
        };

        const savedArtwork = await saveArtwork(artworkData);
        setSavedArtworkId(savedArtwork.id);
        setProcessedArtwork(savedArtwork);

        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 5000);

        onComplete(savedArtwork);

        console.log('📝 New artwork saved with signature:', savedArtwork.signature);

        // Track Cloudinary upload status
        setIsUploadingToCloudinary(true);
        setCloudinaryUploadComplete(false);

        (async () => {
          try {
            console.log('🚀 Starting background Cloudinary upload...');
            const validation = cloudinaryService.validateConfig();
            if (!validation.valid) {
              console.error('⚠️ Cloudinary not configured:', validation.message);
              alert('Warning: Cloudinary is not configured. Mockups will not be available. Please check your .env file.');
              setIsUploadingToCloudinary(false);
              return;
            }

            console.log('📥 Fetching artwork blob from:', cleanedUrl);
            const blob = await fetch(cleanedUrl).then(r => {
              if (!r.ok) throw new Error(`Failed to fetch artwork: ${r.status} ${r.statusText}`);
              return r.blob();
            });
            console.log('✅ Blob fetched, size:', blob.size, 'bytes');

            console.log('🗜️ Compressing image for Cloudinary (max 10MB)...');
            const compressedBlob = await compressImage(blob, {
              maxWidth: 1600,
              maxHeight: 1600,
              quality: 0.70,
              maxSizeMB: 7.5 // Target 8MB, stay well under 10MB limit
            });
            console.log(`✅ Compressed: ${(blob.size / (1024 * 1024)).toFixed(2)}MB → ${(compressedBlob.size / (1024 * 1024)).toFixed(2)}MB`);

            // Double-check file size before upload (Cloudinary free tier: 10MB max)
            const finalSizeMB = compressedBlob.size / (1024 * 1024);
            if (finalSizeMB > 9.5) {
              throw new Error(`Compressed file is still too large (${finalSizeMB.toFixed(2)}MB). Maximum is 10MB. Please use a smaller original image or try the "Original Clean" style.`);
            }

            console.log('☁️ Uploading to Cloudinary...');
            const uploadResult = await cloudinaryService.uploadArtwork(compressedBlob, savedArtwork.id);
            console.log('✅ Artwork uploaded to Cloudinary:', uploadResult.public_id);

            console.log('💾 Updating database with Cloudinary public ID...');
            const { error: updateError } = await supabase
              .from('artworks')
              .update({ cloudinary_public_id: uploadResult.public_id })
              .eq('id', savedArtwork.id);

            if (updateError) {
              console.error('❌ Failed to update database:', updateError);
              throw updateError;
            }

            setCloudinaryPublicId(uploadResult.public_id);
            setProcessedArtwork(prev => prev ? {
              ...prev,
              cloudinaryPublicId: uploadResult.public_id
            } : prev);

            console.log('✅ Cloudinary public ID saved to database');
            console.log('🎉 Full upload process completed successfully!');

            setCloudinaryUploadComplete(true);
            setIsUploadingToCloudinary(false);
          } catch (err: any) {
            console.error('❌ Background Cloudinary upload failed:', err);
            console.error('Error details:', {
              message: err?.message,
              status: err?.status,
              response: err?.response
            });

            let userMessage = 'Failed to prepare artwork for products. ';
            if (err?.message?.includes('too large') || err?.message?.includes('size')) {
              userMessage += 'The image file is too large. Try using a simpler style or smaller image size. Your artwork has been saved to your collection.';
            } else {
              userMessage += `${err?.message || 'Unknown error'}. Your artwork has been saved to your collection, but product mockups are not available.`;
            }

            alert(userMessage);
            setIsUploadingToCloudinary(false);
          }
        })();
      }
    } catch (error: any) {
      console.error('❌ SAVE FAILED:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack
      });

      let errorMessage = 'Failed to save artwork. ';

      if (error?.message?.includes('sign in')) {
        errorMessage += 'Please sign in to save your artwork.';
        alert(errorMessage);
        window.location.href = '/#/auth';
      } else if (error?.message?.includes('storage')) {
        errorMessage += 'Error uploading images. Please check your image size and try again.';
        alert(errorMessage);
      } else if (error?.code === '42501') {
        errorMessage += 'Permission denied. Please check your account permissions.';
        alert(errorMessage);
      } else {
        errorMessage += `Error: ${error?.message || 'Unknown error'}. Please try again or contact support.`;
        alert(errorMessage);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const renderSvgFilters = () => {
    const ink = hexToRgbScale(inkColor?.hex || '#000000');
    const dDark = hexToRgbScale(duotonePair?.dark || '#000000');
    const dLight = hexToRgbScale(duotonePair?.light || '#ffffff');

    return (
      <svg className="absolute w-0 h-0 overflow-hidden" aria-hidden="true">
        <defs>
          <filter id="filter-enhanced">
            <feConvolveMatrix order="3" kernelMatrix="0 -1 0 -1 5 -1 0 -1 0"/>
            <feColorMatrix type="saturate" values="1.2" />
          </filter>

          <filter id="filter-monochrome">
            <feColorMatrix type="saturate" values="0" result="grayscale"/>
            <feComponentTransfer in="grayscale">
              <feFuncR type="table" tableValues={`${ink.r} 1`} />
              <feFuncG type="table" tableValues={`${ink.g} 1`} />
              <feFuncB type="table" tableValues={`${ink.b} 1`} />
              <feFuncA type="identity" />
            </feComponentTransfer>
          </filter>

          <filter id="filter-duotone">
            <feColorMatrix type="saturate" values="0" result="grayscale"/>
            <feComponentTransfer in="grayscale" result="lifted">
              <feFuncR type="linear" slope="0.8" intercept="0.1" />
              <feFuncG type="linear" slope="0.8" intercept="0.1" />
              <feFuncB type="linear" slope="0.8" intercept="0.1" />
            </feComponentTransfer>
            <feComponentTransfer in="lifted" result="gamma_lifted">
              <feFuncR type="gamma" exponent="0.5" />
              <feFuncG type="gamma" exponent="0.5" />
              <feFuncB type="gamma" exponent="0.5" />
            </feComponentTransfer>
            <feComponentTransfer in="gamma_lifted">
              <feFuncR type="table" tableValues={`${dDark.r} ${dLight.r}`}/>
              <feFuncG type="table" tableValues={`${dDark.g} ${dLight.g}`}/>
              <feFuncB type="table" tableValues={`${dDark.b} ${dLight.b}`}/>
              <feFuncA type="identity" />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>
    );
  };

  const getActiveFilter = () => {
    switch (style) {
      case ArtStyle.MONOCHROME:
        return 'url(#filter-monochrome)';
      case ArtStyle.DUOTONE:
        return 'url(#filter-duotone)';
      case ArtStyle.ENHANCED:
        return 'url(#filter-enhanced)';
      case ArtStyle.ORIGINAL:
        return 'none';
      default:
        return 'none';
    }
  };

  const renderCanvasContent = () => {
    const isDarkBg = bgColor?.isDark || false;
    const signatureColor = isDarkBg ? 'rgba(255,255,255,0.7)' : 'rgba(41, 37, 36, 0.75)';

    const displayImage = currentVariantUrl || masterUrl || cleanedUrl || rawOriginalUrl;

    const sigPositionStyle = sigPosition === 'bottom-right'
      ? { right: '8%', bottom: '8%' }
      : { left: '8%', bottom: '8%' };

    return (
      <div
        className="relative w-full h-full flex items-center justify-center transition-colors duration-500 overflow-hidden"
        style={{ backgroundColor: '#fafaf9' }}
      >
        {displayImage && (
          <div
            className="relative max-w-[85%] max-h-[85%] transition-all duration-300 z-10"
            style={{
              transform: `scale(${scale}) translate(${offsetX}px, ${offsetY}px)`
            }}
          >
            {isGeneratingStyle && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-20 rounded-lg">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-stone-600" size={32} />
                  <p className="text-[11px] text-stone-600 font-medium">{processingStep || 'Processing...'}</p>
                </div>
              </div>
            )}
            <img
              key={`artwork-variant-${currentVariantUrl}`}
              src={displayImage}
              className="w-full h-full object-contain"
              alt="Artwork"
            />
          </div>
        )}

        {(sigName || sigAge) && (
          <div
            className="absolute z-30 text-right transform rotate-[-0.5deg] select-none"
            style={{
              ...sigPositionStyle,
              color: signatureColor
            }}
          >
            <p className="font-hand text-4xl leading-none tracking-tight">
              {sigName || 'Artist'}
            </p>
            <p className="font-sans text-[11px] tracking-widest mt-1 font-semibold opacity-70">
              {sigAge}
            </p>
          </div>
        )}
      </div>
    );
  };

  if ((status === ProcessingStatus.IDLE && !existingArtwork) || uploadedButNotStarted) {
    const inspirationImages = [
      { src: '/large framed rainbow.png', title: 'Framed Wall Art' },
      { src: '/Cup indoors.png', title: 'Coffee Mug' },
      { src: '/TokeBag Indoor.png', title: 'Tote Bag' },
      { src: '/Phone.png', title: 'Phone Case' },
    ];

    return (
      <div className="bg-stone-50 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-20">
          <h1 className="font-serif text-5xl text-stone-900 mb-6 text-center">Artwork Studio</h1>

          {!uploadedButNotStarted ? (
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full max-w-xl mx-auto aspect-[3/2] border-2 border-dashed border-stone-200 rounded-lg bg-white hover:border-terracotta/40 hover:bg-stone-50 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group shadow-sm hover:shadow-md"
              >
                <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="text-stone-400 group-hover:text-terracotta transition-colors" />
                </div>
                <div className="text-center">
                  <span className="font-serif text-xl text-stone-800">Start with a drawing</span>
                  <p className="text-xs text-stone-400 uppercase tracking-widest mt-2">Capture their art • Snap a photo in natural light</p>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              </div>

              <div className="mt-20">
                <h2 className="font-serif text-2xl text-stone-900 mb-3 text-center">Get Inspired</h2>
                <p className="text-sm text-stone-500 text-center mb-8">See how children's artwork comes to life on beautiful products</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {inspirationImages.map((img, idx) => (
                    <div key={idx} className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      <div className="aspect-square bg-stone-100">
                        <img src={img.src} alt={img.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-stone-600 text-center font-medium">{img.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="w-full max-w-xl mx-auto space-y-6">
              <div className="aspect-[3/2] border-2 border-stone-200 rounded-lg bg-white shadow-lg overflow-hidden">
                <img
                  src={rawOriginalUrl}
                  alt="Uploaded artwork"
                  className="w-full h-full object-contain"
                />
              </div>
              {sharpness?.verdict === 'blurry' && !useBlurryAnyway ? (
                <>
                  <div
                    role="alert"
                    data-testid="blur-warning"
                    className="border-2 border-terracotta/30 bg-white rounded-lg p-5 text-stone-700"
                  >
                    <p className="font-serif text-xl text-stone-900">This photo looks blurry</p>
                    <p className="text-sm mt-2">
                      Blur shows far more on a framed print than on a phone screen. Lay the drawing flat in good
                      light, hold the phone still directly above it, and take the photo again.
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={retakePhoto}
                      className="flex-1 px-6 py-4 bg-terracotta hover:bg-terracotta/90 text-white text-base font-medium rounded-lg transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg"
                    >
                      <Upload size={20} />
                      Retake Photo
                    </button>
                    <button
                      onClick={() => setUseBlurryAnyway(true)}
                      className="px-6 py-4 border-2 border-stone-200 hover:border-stone-300 bg-white text-stone-700 text-base font-medium rounded-lg transition-all"
                    >
                      Use It Anyway
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleStartTransformation}
                    disabled={checkingSharpness}
                    className="flex-1 px-6 py-4 bg-terracotta hover:bg-terracotta/90 text-white text-base font-medium rounded-lg transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg group disabled:opacity-60 disabled:cursor-wait"
                  >
                    {checkingSharpness ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Checking Photo
                      </>
                    ) : (
                      <>
                        <Sparkles className="group-hover:rotate-12 transition-transform" size={20} />
                        Start Transformation
                        <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                      </>
                    )}
                  </button>
                  <button
                    onClick={retakePhoto}
                    className="px-6 py-4 border-2 border-stone-200 hover:border-stone-300 bg-white text-stone-700 text-base font-medium rounded-lg transition-all"
                  >
                    Change Photo
                  </button>
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === ProcessingStatus.ANALYZING || status === ProcessingStatus.PROCESSING) {
    const steps = [
      { label: 'Removing background', key: 'background' },
      { label: 'Upscaling image', key: 'upscale' },
      { label: 'Cleaning artwork', key: 'clean' },
      { label: 'Optimizing for print', key: 'optimize' },
    ];

    const getStepStatus = (stepKey: string) => {
      const stepLower = processingStep.toLowerCase();
      if (stepLower.includes(stepKey)) return 'active';
      const stepIndex = steps.findIndex(s => s.key === stepKey);
      const currentStepIndex = steps.findIndex(s => stepLower.includes(s.key));
      if (currentStepIndex > stepIndex) return 'complete';
      return 'pending';
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-12">
            <Loader2 className="w-12 h-12 text-terracotta animate-spin mb-6 mx-auto" />
            <h2 className="font-serif text-2xl text-stone-900 mb-2">Creating Your Masterpiece</h2>
            <p className="text-sm text-stone-500 font-light">We're preparing your artwork for printing</p>
          </div>

          <div className="space-y-4">
            {steps.map((step, idx) => {
              const stepStatus = getStepStatus(step.key);
              return (
                <div key={step.key} className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    stepStatus === 'complete'
                      ? 'bg-green-500 text-white'
                      : stepStatus === 'active'
                      ? 'bg-terracotta text-white'
                      : 'bg-stone-200 text-stone-400'
                  }`}>
                    {stepStatus === 'complete' ? (
                      <Check size={16} />
                    ) : stepStatus === 'active' ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <span className="text-xs font-medium">{idx + 1}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium transition-colors ${
                      stepStatus === 'complete' || stepStatus === 'active'
                        ? 'text-stone-900'
                        : 'text-stone-400'
                    }`}>
                      {step.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 p-4 bg-stone-100 rounded-lg">
            <p className="text-xs text-stone-600 text-center">
              {processingStep || 'Processing...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-stone-50 flex flex-col lg:flex-row">
        <div className="lg:w-2/3 h-[50vh] lg:h-screen sticky top-0 bg-stone-200/50 p-6 md:p-12 flex flex-col items-center justify-center">
          <div className="relative w-full max-w-3xl aspect-square rounded-xl shadow-2xl overflow-hidden transition-all duration-500">
            {renderCanvasContent()}
          </div>
        </div>

        <div className="lg:w-1/3 bg-white h-auto lg:h-screen overflow-y-auto">
          <div className="p-6 space-y-6">
            <div className="pb-4">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-800 mb-1">Style Editor</h2>
              <p className="text-[11px] text-stone-500 leading-relaxed">Customize your masterpiece</p>
            </div>

            {showSaveSuccess && (
              <div className="bg-green-50 border border-green-200 rounded p-3 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <Check className="text-green-600" size={16} />
                  <p className="text-[11px] text-green-800">Saved successfully</p>
                </div>
              </div>
            )}

            {/* V1: No style options - just Enhanced Original */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-stone-800 mb-2">
                V1 Enhanced Original
              </label>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                AI-assisted cleanup that preserves your child's artwork exactly as drawn.
              </p>
            </div>

            {/* V1: Position & Scale Controls */}
            <div className="space-y-4 pt-6 border-t border-stone-100">
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-stone-800 mb-2">
                Position & Scale
              </label>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-stone-600 mb-1 block">Scale</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.05"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">{Math.round(scale * 100)}%</p>
                </div>

                <div>
                  <label className="text-[11px] text-stone-600 mb-1 block">Horizontal Position</label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    step="5"
                    value={offsetX}
                    onChange={(e) => setOffsetX(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">{offsetX}px</p>
                </div>

                <div>
                  <label className="text-[11px] text-stone-600 mb-1 block">Vertical Position</label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    step="5"
                    value={offsetY}
                    onChange={(e) => setOffsetY(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">{offsetY}px</p>
                </div>

                <button
                  onClick={() => {
                    setScale(1);
                    setOffsetX(0);
                    setOffsetY(0);
                  }}
                  className="text-[11px] text-stone-600 hover:text-stone-900 underline"
                >
                  Reset Position
                </button>
              </div>
            </div>


            <div className="space-y-2 border-t border-stone-100 pt-6">
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-stone-800 mb-2">
                Artist Signature
              </label>
              <p className="text-[11px] text-stone-500 leading-relaxed mb-4">
                Add a pencil-style signature for a gallery print feel.
              </p>
              <input
                type="text"
                value={sigName}
                onChange={e => setSigName(e.target.value)}
                placeholder="wGR"
                className="w-full px-3 py-2.5 border border-stone-200 rounded text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:border-stone-900 transition-colors font-hand"
              />
              <input
                type="text"
                value={sigAge}
                onChange={e => setSigAge(e.target.value)}
                placeholder="sq"
                className="w-full px-3 py-2.5 border border-stone-200 rounded text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:border-stone-900 transition-colors"
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setSigPosition('bottom-left')}
                  className={`flex-1 px-3 py-2 text-[11px] rounded border transition-all ${
                    sigPosition === 'bottom-left'
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-200 text-stone-700 hover:border-stone-400 bg-white'
                  }`}
                >
                  Bottom Left
                </button>
                <button
                  onClick={() => setSigPosition('bottom-right')}
                  className={`flex-1 px-3 py-2 text-[11px] rounded border transition-all ${
                    sigPosition === 'bottom-right'
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-200 text-stone-700 hover:border-stone-400 bg-white'
                  }`}
                >
                  Bottom Right
                </button>
              </div>
            </div>


            <div className="border-t border-stone-100 pt-6 space-y-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full px-4 py-3 bg-stone-900 hover:bg-stone-800 text-white text-[13px] font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Saving...
                  </>
                ) : (
                  <>
                    {savedArtworkId ? 'Update Artwork' : 'Save to Gallery'}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>

            {savedArtworkId && onContinueToProducts && (
              <div className="space-y-2">
                {isUploadingToCloudinary && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 animate-pulse">
                    <div className="flex items-center gap-2">
                      <Loader2 className="text-amber-600 animate-spin" size={16} />
                      <p className="text-[11px] text-amber-800">
                        Preparing your artwork for products...
                      </p>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleContinueToProducts}
                  disabled={isUploadingToCloudinary}
                  className="w-full px-4 py-3 bg-terracotta hover:bg-terracotta/90 text-white text-[13px] font-medium rounded transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploadingToCloudinary ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Getting Ready...
                    </>
                  ) : (
                    <>
                      Print This Art
                      <ShoppingBag size={16} />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </>
  );
};
