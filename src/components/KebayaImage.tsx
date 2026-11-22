import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { getFallbackKebayaImage } from '../lib/format';

interface KebayaImageProps {
  src?: string | null;
  alt: string;
  category?: string;
  className?: string;
}

export const KebayaImage: React.FC<KebayaImageProps> = ({
  src,
  alt,
  category,
  className = '',
}) => {
  const [stage, setStage] = useState<'primary' | 'fallback' | 'empty'>(
    src && src.trim().length > 0 ? 'primary' : 'fallback'
  );

  const fallbackSrc = getFallbackKebayaImage(category);
  const activeSrc = stage === 'primary' ? (src as string) : fallbackSrc;

  if (stage === 'empty') {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#F9E4E8] via-[#FDF2F4] to-[#F3DCE0] text-[#6B1D2F] p-4 text-center ${className}`}
      >
        <Sparkles className="w-6 h-6 text-[#D4AF37] mb-2" aria-hidden="true" />
        <span className="font-display text-sm font-semibold leading-tight line-clamp-2">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={activeSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => {
        if (stage === 'primary' && activeSrc !== fallbackSrc) {
          setStage('fallback');
        } else {
          setStage('empty');
        }
      }}
      className={className}
    />
  );
};
