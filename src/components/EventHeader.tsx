import React, { useState } from 'react';
import { Sliders, RotateCcw } from 'lucide-react';
import { getTextMonogramStyle } from '../types';

interface EventHeaderProps {
  businessLogoUrl?: string;
  logoBackgroundStyle?: 'light' | 'transparent' | 'dark';
  headerType?: 'image' | 'text';
  eventBannerUrl?: string;
  eventName?: string;
  groomName?: string;
  brideName?: string;
  eventSubtext?: string;
  eventDate?: string;
  textColorType?: 'solid' | 'gradient';
  textColorSolid?: string;
  textGradientStart?: string;
  textGradientEnd?: string;
  textGradientAngle?: number;
  onOpenSettings: () => void;
  isRecording?: boolean;
  recordingSeconds?: number;
  formatTimer?: (seconds: number) => string;
  isLandscape?: boolean;
}

export const EventHeader: React.FC<EventHeaderProps> = ({
  businessLogoUrl = '/business-logo-placeholder.png',
  logoBackgroundStyle = 'light',
  headerType = 'image',
  eventBannerUrl = '/event-title-placeholder.png',
  eventName = 'The Wedding Celebration',
  groomName = 'DAVID',
  brideName = 'SARAH',
  eventSubtext = 'THE WEDDING CELEBRATION',
  eventDate = '',
  textColorType = 'solid',
  textColorSolid = '#FFFFFF',
  textGradientStart = '#D4AF37',
  textGradientEnd = '#F4E8D3',
  textGradientAngle = 135,
  onOpenSettings,
  isRecording = false,
  recordingSeconds = 0,
  formatTimer = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
  isLandscape = false,
}) => {
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [bannerLoadFailed, setBannerLoadFailed] = useState(false);

  const getTextStyle = (): React.CSSProperties => {
    return getTextMonogramStyle({
      textColorType,
      textColorSolid,
      textGradientStart,
      textGradientEnd,
      textGradientAngle,
    });
  };

  // Apple-grade Logo Container (No squished oval egg! Uses squircle rounded-2xl)
  const getLogoContainerClass = () => {
    switch (logoBackgroundStyle) {
      case 'transparent':
        return 'cursor-pointer group flex items-center justify-center bg-transparent hover:bg-white/10 rounded-2xl px-2.5 py-1.5 transition-all duration-200 active:scale-95';
      case 'dark':
        return 'cursor-pointer group flex items-center justify-center bg-black/65 hover:bg-black/80 backdrop-blur-2xl border border-white/20 shadow-xl rounded-2xl px-3.5 py-1.5 sm:px-4 sm:py-2 transition-all duration-200 active:scale-95';
      case 'light':
      default:
        // Luminous Warm-White Glass: makes colored (blue/black) logos ultra-vibrant, sharp & luxurious
        return 'cursor-pointer group flex items-center justify-center bg-white/95 hover:bg-white backdrop-blur-2xl border border-white/80 shadow-[0_8px_28px_rgba(0,0,0,0.18)] rounded-2xl px-3.5 py-1.5 sm:px-4 sm:py-2 transition-all duration-200 active:scale-95';
    }
  };

  const getLogoImageClass = (isLand: boolean) => {
    const size = isLand
      ? 'max-h-9 sm:max-h-11 max-w-[125px] sm:max-w-[150px]'
      : 'max-h-8 sm:max-h-10 max-w-[110px] sm:max-w-[130px]';
    return `${size} w-auto h-auto object-contain transition-transform duration-200 ${
      logoBackgroundStyle === 'light'
        ? 'filter drop-shadow-sm'
        : 'filter drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] brightness-105'
    }`;
  };

  return (
    <>
      {/* 
        APPLE ULTRA-SMOOTH GRADIENT
        Subtle, minimal vignette to ensure logo contrast without dimming the camera viewfinder
      */}
      <div 
        className={`absolute inset-x-0 top-0 pointer-events-none z-10 bg-gradient-to-b from-black/30 via-black/10 to-transparent transition-all duration-700 ${
          isLandscape ? 'h-24 sm:h-28' : 'h-28 sm:h-32'
        }`} 
      />

      {/* APPLE HEADER CONTAINER */}
      <header className={`relative z-20 w-full select-none ${
        isLandscape 
          ? 'pt-3.5 sm:pt-4 px-6 sm:px-8' 
          : 'pt-4 sm:pt-6 px-4 sm:px-6'
      }`}>
        {isLandscape ? (
          /* ====================================================
             APPLE LANDSCAPE LAYOUT (Horizontal iPad)
             Left: Business Logo Capsule | Center: Event Banner (+15% Large) | Right: Dynamic Island REC / Settings
             ==================================================== */
          <div className="w-full flex items-center justify-between gap-4">
            {/* Left: Business Logo Card (Apple Squircle, High Contrast) */}
            <div className="w-48 sm:w-56 shrink-0 flex items-center justify-start">
              <div 
                onClick={onOpenSettings}
                className={getLogoContainerClass()}
                title="Pengaturan Kiosk / Ganti Logo"
              >
                {!logoLoadFailed && businessLogoUrl ? (
                  <img
                    src={businessLogoUrl}
                    alt="Logo Usaha"
                    onError={() => setLogoLoadFailed(true)}
                    className={getLogoImageClass(true)}
                  />
                ) : (
                  <div className="flex items-center gap-2 py-0.5 px-1">
                    <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                    <span className={`text-[11px] font-sans font-semibold tracking-wider uppercase ${
                      logoBackgroundStyle === 'light' ? 'text-[#1D1D1F]' : 'text-white'
                    }`}>
                      LOGO USAHA
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Center: Event Title / Monogram (Image 800x400 or Text Monogram) */}
            <div 
              onClick={onOpenSettings}
              className="flex-1 max-w-[530px] px-2 py-1 transition-all cursor-pointer group flex flex-col items-center justify-center select-none"
              title="Ketuk untuk mengubah Gambar / Nama Acara di Pengaturan"
            >
              {headerType === 'text' ? (
                <div className="flex flex-col items-center justify-center text-center font-[Times_New_Roman,serif] italic leading-tight">
                  <span 
                    className="text-xl sm:text-2xl md:text-[26px] font-serif italic font-bold tracking-wide"
                    style={getTextStyle()}
                  >
                    {groomName || 'DAVID'}
                  </span>
                  <span 
                    className="text-xs sm:text-sm font-serif italic my-0.5"
                    style={getTextStyle()}
                  >
                    &amp;
                  </span>
                  <span 
                    className="text-xl sm:text-2xl md:text-[26px] font-serif italic font-bold tracking-wide"
                    style={getTextStyle()}
                  >
                    {brideName || 'SARAH'}
                  </span>
                  {(eventSubtext || eventDate) && (
                    <span 
                      className="text-[10px] sm:text-xs font-sans not-italic font-semibold tracking-[0.2em] uppercase mt-1 opacity-90"
                      style={getTextStyle()}
                    >
                      {eventSubtext || eventDate}
                    </span>
                  )}
                </div>
              ) : !bannerLoadFailed && eventBannerUrl ? (
                <div className="relative w-full flex items-center justify-center">
                  <img
                    src={eventBannerUrl}
                    alt="Nama Acara"
                    onError={() => setBannerLoadFailed(true)}
                    className="w-auto max-w-[390px] sm:max-w-[510px] max-h-[85px] sm:max-h-[110px] object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center text-center px-7 py-2.5 rounded-2xl bg-black/40 backdrop-blur-2xl border border-white/15 shadow-xl">
                  <h2 className="text-lg sm:text-xl md:text-[22px] font-serif font-bold text-white tracking-wide">
                    {eventName || 'THE WEDDING CELEBRATION'}
                  </h2>
                  {eventDate && (
                    <p className="text-[11px] font-sans font-medium tracking-[0.2em] text-[#E5D7C5] uppercase mt-0.5">
                      {eventDate}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right: Refresh & Apple Dynamic Island Recording Capsule & Settings */}
            <div className="w-48 sm:w-56 shrink-0 flex items-center justify-end gap-2 sm:gap-2.5">
              <button
                onClick={() => window.location.reload()}
                className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-2xl border border-white/20 text-white flex items-center justify-center transition-all duration-200 active:scale-90 shadow-sm cursor-pointer"
                title="Refresh / Muat Ulang Halaman"
              >
                <RotateCcw className="w-3.5 h-3.5 text-white/90" />
              </button>
              {isRecording ? (
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-2xl border border-white/20 text-white shadow-xl animate-fade-in">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF3B30] animate-pulse" />
                  <span className="text-xs font-mono font-semibold tracking-wider text-white">
                    {formatTimer(recordingSeconds)}
                  </span>
                </div>
              ) : (
                <button
                  onClick={onOpenSettings}
                  className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-2xl border border-white/20 text-white flex items-center justify-center transition-all duration-200 active:scale-95 shadow-sm cursor-pointer"
                  title="Pengaturan"
                >
                  <Sliders className="w-4 h-4 text-white/90" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ====================================================
             APPLE PORTRAIT LAYOUT (Vertical iPad)
             Row 1: Logo & Controls | Row 2: Event Banner Centered (+15% Large)
             ==================================================== */
          <div className="w-full flex flex-col items-center">
            {/* Top Bar */}
            <div className="w-full flex items-center justify-between">
              {/* Business Logo Card (Apple Squircle, High Contrast) */}
              <div 
                onClick={onOpenSettings}
                className={getLogoContainerClass()}
                title="Pengaturan Kiosk / Ganti Logo"
              >
                {!logoLoadFailed && businessLogoUrl ? (
                  <img
                    src={businessLogoUrl}
                    alt="Logo Usaha"
                    onError={() => setLogoLoadFailed(true)}
                    className={getLogoImageClass(false)}
                  />
                ) : (
                  <div className="flex items-center gap-1.5 py-0.5 px-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                    <span className={`text-[10px] font-sans font-semibold tracking-wider uppercase ${
                      logoBackgroundStyle === 'light' ? 'text-[#1D1D1F]' : 'text-white'
                    }`}>
                      LOGO USAHA
                    </span>
                  </div>
                )}
              </div>

              {/* Status / Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-2xl border border-white/20 text-white flex items-center justify-center transition-all duration-200 active:scale-90 shadow-sm cursor-pointer"
                  title="Refresh / Muat Ulang Halaman"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-white/90" />
                </button>
                {isRecording ? (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-2xl border border-white/20 text-white shadow-xl animate-fade-in">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF3B30] animate-pulse" />
                    <span className="text-xs font-mono font-semibold tracking-wider text-white">
                      {formatTimer(recordingSeconds)}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={onOpenSettings}
                    className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-2xl border border-white/20 text-white flex items-center justify-center transition-all duration-200 active:scale-90 shadow-sm cursor-pointer"
                    title="Pengaturan"
                  >
                    <Sliders className="w-3.5 h-3.5 text-white/90" />
                  </button>
                )}
              </div>
            </div>

            {/* Upper-Center Event Title / Monogram */}
            <div 
              onClick={onOpenSettings}
              className="mt-2.5 sm:mt-3 w-full max-w-[400px] px-2 py-1 transition-all cursor-pointer group flex flex-col items-center justify-center select-none"
              title="Ketuk untuk mengubah Gambar / Nama Acara di Pengaturan"
            >
              {headerType === 'text' ? (
                <div className="flex flex-col items-center justify-center text-center font-[Times_New_Roman,serif] italic leading-tight">
                  <span 
                    className="text-xl sm:text-2xl font-serif italic font-bold tracking-wide"
                    style={getTextStyle()}
                  >
                    {groomName || 'DAVID'}
                  </span>
                  <span 
                    className="text-xs sm:text-sm font-serif italic my-0.5"
                    style={getTextStyle()}
                  >
                    &amp;
                  </span>
                  <span 
                    className="text-xl sm:text-2xl font-serif italic font-bold tracking-wide"
                    style={getTextStyle()}
                  >
                    {brideName || 'SARAH'}
                  </span>
                  {(eventSubtext || eventDate) && (
                    <span 
                      className="text-[10px] sm:text-xs font-sans not-italic font-semibold tracking-[0.2em] uppercase mt-1 opacity-90"
                      style={getTextStyle()}
                    >
                      {eventSubtext || eventDate}
                    </span>
                  )}
                </div>
              ) : !bannerLoadFailed && eventBannerUrl ? (
                <div className="relative w-full flex items-center justify-center">
                  <img
                    src={eventBannerUrl}
                    alt="Nama Acara"
                    onError={() => setBannerLoadFailed(true)}
                    className="w-auto max-w-[325px] sm:max-w-[370px] max-h-[85px] sm:max-h-[105px] object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center text-center px-6 py-2.5 rounded-2xl bg-black/40 backdrop-blur-2xl border border-white/15 shadow-xl">
                  <h2 className="text-lg sm:text-xl md:text-[22px] font-serif font-bold text-white tracking-wide">
                    {eventName || 'THE WEDDING CELEBRATION'}
                  </h2>
                  {eventDate && (
                    <p className="text-[11px] font-sans font-medium tracking-[0.2em] text-[#E5D7C5] uppercase mt-0.5">
                      {eventDate}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
};
