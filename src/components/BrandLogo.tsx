import React, { useEffect, useState } from 'react';

interface BrandLogoProps {
  logoUrl?: string | null;
  brandName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  logoUrl,
  brandName = 'Tiyara Attire',
  size = 'md',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const trimmedUrl = (logoUrl || '').trim();

  useEffect(() => {
    setImgError(false);
  }, [trimmedUrl]);

  const sizeClasses = {
    sm: 'h-7 max-w-[120px] sm:max-w-[140px]',
    md: 'h-8 sm:h-9 max-w-[150px] sm:max-w-[200px]',
    lg: 'h-11 sm:h-12 max-w-[200px] sm:max-w-[240px]',
  }[size];

  const textSizeClasses = {
    sm: 'text-base sm:text-lg',
    md: 'text-lg sm:text-xl',
    lg: 'text-2xl sm:text-3xl',
  }[size];

  const svgSize = size === 'sm' ? 20 : size === 'lg' ? 28 : 24;

  if (trimmedUrl && !imgError) {
    return (
      <span className={`inline-flex items-center shrink-0 ${className}`}>
        <img
          src={trimmedUrl}
          alt={brandName}
          onError={() => setImgError(true)}
          className={`${sizeClasses} w-auto object-contain select-none`}
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${className}`}
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle cx="12" cy="12" r="11" fill="#6B1D2F" />
        <path
          d="M7.5 14.5L9.5 8.5L12 11.5L14.5 8.5L16.5 14.5H7.5Z"
          fill="#D4AF37"
        />
        <rect
          x="7.5"
          y="15.5"
          width="9"
          height="1.5"
          rx="0.75"
          fill="#F9E4E8"
        />
      </svg>
      <span
        className={`font-display ${textSizeClasses} font-bold text-[#6B1D2F] tracking-tight whitespace-nowrap shrink-0`}
      >
        {brandName}
      </span>
    </span>
  );
};
