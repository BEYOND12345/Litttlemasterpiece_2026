import React from 'react';
import { MockupConfig } from '../constants/mockups';

type ArtworkMockupViewerProps = {
  artworkUrl: string;
  mockup: MockupConfig;
  alt?: string;
  className?: string;
};

export const ArtworkMockupViewer: React.FC<ArtworkMockupViewerProps> = ({
  artworkUrl,
  mockup,
  alt = 'Product mockup',
  className = '',
}) => {
  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <img
        src={mockup.templateImageUrl}
        alt={alt}
        className="w-full h-full object-cover"
      />

      <div
        className="absolute"
        style={{
          left: `${mockup.artworkArea.xPercent}%`,
          top: `${mockup.artworkArea.yPercent}%`,
          width: `${mockup.artworkArea.widthPercent}%`,
          height: `${mockup.artworkArea.heightPercent}%`,
          transform: `rotate(${mockup.artworkArea.rotationDeg ?? 0}deg)`,
          transformOrigin: 'center center',
        }}
      >
        <img
          src={artworkUrl}
          alt="Artwork"
          className="w-full h-full object-cover"
          style={{ mixBlendMode: mockup.blendMode }}
        />
      </div>

      {mockup.overlayImageUrl && (
        <img
          src={mockup.overlayImageUrl}
          alt=""
          className="pointer-events-none absolute inset-0 w-full h-full object-cover"
        />
      )}
    </div>
  );
};
