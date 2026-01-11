import React, { useState } from 'react';
import { X, Download, Image, FileText } from 'lucide-react';
import { Button } from './Button';
import { StyleVariant } from '../services/styleVariantsService';

interface DownloadModalProps {
  variant: StyleVariant;
  onClose: () => void;
}

type DownloadFormat = 'png' | 'jpg' | 'pdf';
type DownloadResolution = 'web' | 'print' | 'ultra';

const RESOLUTIONS = {
  web: { name: 'Web', pixels: 1500, description: 'Perfect for social media and web use' },
  print: { name: 'Print', pixels: 4000, description: 'High quality for most prints' },
  ultra: { name: 'Ultra', pixels: 8000, description: 'Maximum quality for large prints' },
};

export const DownloadModal: React.FC<DownloadModalProps> = ({ variant, onClose }) => {
  const [format, setFormat] = useState<DownloadFormat>('png');
  const [resolution, setResolution] = useState<DownloadResolution>('print');
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!variant.fileUrl) {
      alert('File not available for download');
      return;
    }

    setDownloading(true);

    try {
      const response = await fetch(variant.fileUrl);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `artwork-${variant.styleType}-${resolution}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onClose();
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download file. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-stone-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl text-stone-900">Download Artwork</h2>
            <p className="text-sm text-stone-500 mt-1 capitalize">{variant.styleType} Style</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X size={20} className="text-stone-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-bold uppercase tracking-widest text-stone-900">
              Format
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setFormat('png')}
                className={`p-4 border rounded-lg text-center transition-all ${
                  format === 'png'
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <Image size={20} className="mx-auto mb-2" />
                <div className="text-sm font-semibold">PNG</div>
                <div className="text-xs opacity-70">Transparent</div>
              </button>
              <button
                onClick={() => setFormat('jpg')}
                className={`p-4 border rounded-lg text-center transition-all ${
                  format === 'jpg'
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <Image size={20} className="mx-auto mb-2" />
                <div className="text-sm font-semibold">JPG</div>
                <div className="text-xs opacity-70">White BG</div>
              </button>
              <button
                onClick={() => setFormat('pdf')}
                className={`p-4 border rounded-lg text-center transition-all ${
                  format === 'pdf'
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <FileText size={20} className="mx-auto mb-2" />
                <div className="text-sm font-semibold">PDF</div>
                <div className="text-xs opacity-70">Vector</div>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold uppercase tracking-widest text-stone-900">
              Resolution
            </label>
            <div className="space-y-2">
              {Object.entries(RESOLUTIONS).map(([key, res]) => (
                <button
                  key={key}
                  onClick={() => setResolution(key as DownloadResolution)}
                  className={`w-full p-4 border rounded-lg text-left transition-all ${
                    resolution === key
                      ? 'border-stone-900 bg-stone-50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-stone-900">{res.name}</span>
                    <span className="text-sm text-stone-500">{res.pixels}×{res.pixels}px</span>
                  </div>
                  <div className="text-xs text-stone-600">{res.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-stone-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-600">Current Size:</span>
              <span className="font-semibold text-stone-900">
                {variant.width} × {variant.height}px
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-600">File Format:</span>
              <span className="font-semibold text-stone-900 uppercase">{format}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-600">Target Resolution:</span>
              <span className="font-semibold text-stone-900">
                {RESOLUTIONS[resolution].pixels}×{RESOLUTIONS[resolution].pixels}px
              </span>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-stone-200 p-6 flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            isLoading={downloading}
            className="flex-1 gap-2"
          >
            <Download size={18} />
            {downloading ? 'Downloading...' : 'Download'}
          </Button>
        </div>
      </div>
    </div>
  );
};
