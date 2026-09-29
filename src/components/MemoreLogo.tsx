import React from 'react';

interface MemoreLogoProps {
  className?: string;
  color?: string;
  variant?: 'white' | 'blue' | 'icon';
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const MemoreLogo: React.FC<MemoreLogoProps> = ({
  className = '',
  color = '#ffffff',
  variant,
  showText = true,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'h-8 max-w-[120px]',
    md: 'h-14 max-w-[180px]',
    lg: 'h-20 max-w-[240px]',
    xl: 'h-28 max-w-[320px]',
  }[size];

  const iconSizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
    xl: 'h-20 w-20',
  }[size];

  const isBlue = variant === 'blue' || color === 'blue' || color === '#0a00a8' || color === '#0000ff';

  // Render the exact icon asset if showText is explicitly false or variant is 'icon'
  if (!showText || variant === 'icon') {
    return (
      <img
        src="/icon.png"
        alt="MEMORÉ Icon"
        className={`${iconSizeClasses} object-contain transition-transform duration-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)] ${className}`}
      />
    );
  }

  // Render the official PNG logo without any modifications
  const logoSrc = isBlue ? '/logo-blue.png' : '/logo-white.png';

  return (
    <img
      src={logoSrc}
      alt="MEMORÉ"
      className={`${sizeClasses} w-auto object-contain transition-transform duration-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)] ${className}`}
    />
  );
};
