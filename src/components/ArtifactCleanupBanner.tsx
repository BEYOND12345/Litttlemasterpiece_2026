import React from 'react';
import { AlertCircle, Sparkles, Undo2 } from 'lucide-react';
import { ArtifactDetectionResult } from '../services/enhancementService';

interface ArtifactCleanupBannerProps {
  artifacts: ArtifactDetectionResult;
  onCleanBackground: () => void;
  onKeepNatural: () => void;
  onUndo?: () => void;
  isProcessing?: boolean;
  cleanupApplied?: boolean;
}

export const ArtifactCleanupBanner: React.FC<ArtifactCleanupBannerProps> = ({
  artifacts,
  onCleanBackground,
  onKeepNatural,
  onUndo,
  isProcessing = false,
  cleanupApplied = false,
}) => {
  if (!artifacts.hasArtifacts && !cleanupApplied) {
    return null;
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="text-amber-600 flex-shrink-0 mt-1" size={20} />
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900 mb-1">
            {cleanupApplied ? 'Background cleaned' : 'This page still has marks in the background'}
          </h3>
          {!cleanupApplied && (
            <p className="text-sm text-amber-700 mb-3">
              We detected {artifacts.artifactTypes.join(', ').replace(/_/g, ' ')} in the background.
              Would you like us to remove them?
            </p>
          )}
          {cleanupApplied && (
            <p className="text-sm text-amber-700 mb-3">
              We removed background artifacts while protecting your artwork.
            </p>
          )}

          <div className="flex gap-2 flex-wrap">
            {!cleanupApplied && (
              <>
                <button
                  onClick={onCleanBackground}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  <Sparkles size={16} />
                  {isProcessing ? 'Cleaning...' : 'Clean background'}
                </button>
                <button
                  onClick={onKeepNatural}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-white text-amber-900 border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  Keep it natural
                </button>
              </>
            )}
            {cleanupApplied && onUndo && (
              <button
                onClick={onUndo}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-white text-amber-900 border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Undo2 size={16} />
                Restore previous look
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
