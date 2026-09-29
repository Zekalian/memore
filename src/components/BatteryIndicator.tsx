import React from 'react';
import { Zap, AlertTriangle } from 'lucide-react';
import { useBattery } from '../hooks/useBattery';

interface BatteryIndicatorProps {
  className?: string;
  showPercent?: boolean;
  variant?: 'dark' | 'light';
  onClick?: () => void;
}

export const BatteryIndicator: React.FC<BatteryIndicatorProps> = ({
  className = '',
  showPercent = true,
  variant = 'dark',
  onClick,
}) => {
  const { level, isCharging, isLow } = useBattery();

  const isLight = variant === 'light';
  const displayLevel = typeof level === 'number' && !isNaN(level) ? Math.max(0, Math.min(100, Math.round(level))) : 95;

  // Battery fill color
  const getFillColor = () => {
    if (isCharging) return 'bg-[#34C759]'; // Emerald green
    if (displayLevel <= 20) return 'bg-[#FF3B30]'; // Red low battery
    if (displayLevel <= 40) return 'bg-[#FF9500]'; // Amber warning
    return isLight ? 'bg-[#1D1D1F]' : 'bg-white';
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono select-none transition-all ${
        onClick ? 'cursor-pointer active:scale-95' : ''
      } ${
        isLow ? 'bg-red-500/20 border border-red-500/50 animate-pulse text-red-200' :
        isLight 
          ? 'bg-black/5 text-[#1D1D1F] border border-black/10' 
          : 'bg-black/40 backdrop-blur-xl text-white/90 border border-white/15'
      } ${className}`}
      title={
        isCharging 
          ? `Baterai Sedang Mengisi Daya (${displayLevel}%)` 
          : `Baterai ${displayLevel}% ${isLow ? '• Harap Hubungkan Charger!' : ''}`
      }
    >
      {isLow && !isCharging && (
        <AlertTriangle className="w-3 h-3 text-[#FF3B30] animate-bounce" />
      )}

      {/* Battery Percentage */}
      {showPercent && (
        <span className={`text-[11px] font-sans font-semibold tracking-tight ${
          isLow && !isCharging ? 'text-[#FF3B30]' : isLight ? 'text-[#1D1D1F]' : 'text-white'
        }`}>
          {displayLevel}%
        </span>
      )}

      {/* Authentic Apple Battery Chassis */}
      <div className="flex items-center">
        <div className={`relative w-6 h-3 rounded-[4px] border p-[1.5px] flex items-center ${
          isLow && !isCharging 
            ? 'border-[#FF3B30]' 
            : isLight ? 'border-stone-500' : 'border-white/70'
        }`}>
          {/* Inner Fill */}
          <div 
            className={`h-full rounded-[1.5px] transition-all duration-500 ${getFillColor()}`}
            style={{ width: `${Math.max(8, Math.min(100, displayLevel))}%` }}
          />

          {/* Lightning bolt if charging */}
          {isCharging && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Zap className="w-2.5 h-2.5 text-[#34C759] fill-[#34C759] drop-shadow-sm" />
            </div>
          )}
        </div>

        {/* Battery Positive Terminal Nub */}
        <div className={`w-[2px] h-[4px] rounded-r-[1px] ml-[1px] ${
          isLow && !isCharging 
            ? 'bg-[#FF3B30]' 
            : isLight ? 'bg-stone-500' : 'bg-white/70'
        }`} />
      </div>
    </div>
  );
};

