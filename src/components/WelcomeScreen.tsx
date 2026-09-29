import React, { useState } from 'react';
import { Video, Sliders, Sparkles, Clock, Mic, Heart, RotateCcw } from 'lucide-react';
import { KioskSettings, getTextMonogramStyle } from '../types';
import { playVintageClick } from '../services/audio';

interface WelcomeScreenProps {
  settings: KioskSettings;
  onStartSession: () => void;
  onOpenSettings: () => void;
  isLandscape?: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  settings,
  onStartSession,
  onOpenSettings,
  isLandscape = false,
}) => {
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [bannerLoadFailed, setBannerLoadFailed] = useState(false);

  const textStyle = getTextMonogramStyle(settings);

  const handleStart = () => {
    playVintageClick();
    onStartSession();
  };

  return (
    <div className="relative w-full h-full bg-black text-white flex flex-col justify-between overflow-hidden select-none pb-safe">
      {/* Ambient Lighting Background with Apple Cinematic Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-[#D4AF37]/15 blur-[120px]" />
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full bg-[#0071E3]/15 blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 rounded-full bg-amber-600/10 blur-[130px]" />
        {/* Subtle grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }}
        />
      </div>

      {/* TOP BAR: Business Logo & Operator Button */}
      <header className={`relative z-20 w-full flex items-center justify-between ${
        isLandscape ? 'pt-5 px-8' : 'pt-6 px-6'
      }`}>
        {/* Business Logo (Apple Squircle Glass) */}
        <div 
          onClick={onOpenSettings}
          className="cursor-pointer group flex items-center justify-center bg-white/95 hover:bg-white backdrop-blur-2xl border border-white/80 shadow-[0_8px_28px_rgba(0,0,0,0.22)] rounded-2xl px-4 py-2 transition-all duration-200 active:scale-95"
          title="Pengaturan Memore (Perlu PIN)"
        >
          {!logoLoadFailed && settings.businessLogoUrl ? (
            <img
              src={settings.businessLogoUrl}
              alt="Logo Usaha"
              onError={() => setLogoLoadFailed(true)}
              className="max-h-9 sm:max-h-11 max-w-[130px] sm:max-w-[150px] w-auto h-auto object-contain filter drop-shadow-sm"
            />
          ) : (
            <div className="flex items-center gap-2 py-0.5">
              <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
              <span className="text-[11px] font-sans font-semibold tracking-wider text-[#1D1D1F] uppercase">
                LOGO USAHA
              </span>
            </div>
          )}
        </div>

        {/* Top-Right: Quick Refresh & Operator Settings Lock Buttons */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            onClick={() => window.location.reload()}
            className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-2xl border border-white/20 text-white flex items-center justify-center transition-all duration-200 active:scale-90 shadow-md cursor-pointer"
            title="Refresh / Muat Ulang Halaman"
          >
            <RotateCcw className="w-4 h-4 text-white/90" />
          </button>
          <button
            onClick={onOpenSettings}
            className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-2xl border border-white/20 text-white flex items-center justify-center transition-all duration-200 active:scale-90 shadow-md cursor-pointer"
            title="Pengaturan Memore (Terkunci PIN)"
          >
            <Sliders className="w-4 h-4 text-white/90" />
          </button>
        </div>
      </header>

      {/* CENTER: Event Monogram, Invitation & Big Start Button */}
      <main className={`relative z-20 flex-1 flex flex-col items-center justify-center text-center px-4 ${
        isLandscape ? 'py-4 max-w-4xl mx-auto' : 'py-8 max-w-lg mx-auto'
      }`}>
        {/* Event Banner / Monogram */}
        <div 
          onClick={onOpenSettings}
          className="cursor-pointer group mb-4 sm:mb-6 transition-transform duration-300 hover:scale-[1.02] flex flex-col items-center justify-center select-none"
          title="Ketuk untuk mengubah nama acara di pengaturan"
        >
          {settings.headerType === 'text' ? (
            <div className="flex flex-col items-center justify-center text-center font-[Times_New_Roman,serif] italic leading-tight">
              <span 
                className="text-2xl sm:text-4xl md:text-5xl font-serif italic font-bold tracking-wide"
                style={textStyle}
              >
                {settings.groomName || 'DAVID'}
              </span>
              <span 
                className="text-base sm:text-2xl font-serif italic my-1"
                style={textStyle}
              >
                &amp;
              </span>
              <span 
                className="text-2xl sm:text-4xl md:text-5xl font-serif italic font-bold tracking-wide"
                style={textStyle}
              >
                {settings.brideName || 'SARAH'}
              </span>
              {(settings.eventSubtext || settings.eventDate) && (
                <span 
                  className="text-xs sm:text-sm font-sans not-italic font-semibold tracking-[0.25em] uppercase mt-2 opacity-90"
                  style={textStyle}
                >
                  {settings.eventSubtext || settings.eventDate}
                </span>
              )}
            </div>
          ) : !bannerLoadFailed && settings.eventBannerUrl ? (
            <img
              src={settings.eventBannerUrl}
              alt="Nama Acara"
              onError={() => setBannerLoadFailed(true)}
              className="w-auto max-w-[340px] sm:max-w-[480px] max-h-28 sm:max-h-36 object-contain"
            />
          ) : (
            <div className="px-8 py-3 rounded-2xl bg-black/40 backdrop-blur-2xl border border-white/15 shadow-xl">
              <h1 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-wide">
                {settings.eventName || 'THE WEDDING CELEBRATION'}
              </h1>
              {settings.eventDate && (
                <p className="text-xs font-sans font-medium tracking-[0.2em] text-[#E5D7C5] uppercase mt-1">
                  {settings.eventDate}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Greeting Invitation */}
        <div className="space-y-2 mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#F4E8D3] text-xs font-medium tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Interactive Video Guestbook</span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-white tracking-tight drop-shadow-md">
            Tinggalkan Pesan &amp; Doa Terbaik Anda
          </h2>
          <p className="text-sm sm:text-base text-stone-300 max-w-md mx-auto leading-relaxed">
            Abadikan momen ucapan video spesial Anda yang akan dikenang selamanya oleh kedua mempelai.
          </p>
        </div>

        {/* Feature Badges (3 Quick Steps) */}
        <div className={`grid ${isLandscape ? 'grid-cols-3' : 'grid-cols-3'} gap-3 w-full max-w-md mb-8`}>
          <div className="p-3 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 flex flex-col items-center text-center">
            <Mic className="w-4 h-4 text-[#D4AF37] mb-1" />
            <span className="text-[11px] font-semibold text-white">Bicara Santai</span>
            <span className="text-[9px] text-stone-400">Audio Jernih</span>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 flex flex-col items-center text-center">
            <Clock className="w-4 h-4 text-[#0071E3] mb-1" />
            <span className="text-[11px] font-semibold text-white">
              {(() => {
                const sec = settings.maxDurationSec || 180;
                if (sec < 60) return `Maks. ${sec} Detik`;
                const mins = Math.floor(sec / 60);
                const remSec = sec % 60;
                if (remSec === 0) return `Maks. ${mins} Menit`;
                return `Maks. ${mins}m ${remSec}s`;
              })()}
            </span>
            <span className="text-[9px] text-stone-400">Cukup Bercerita</span>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 flex flex-col items-center text-center">
            <Heart className="w-4 h-4 text-[#FF3B30] mb-1" />
            <span className="text-[11px] font-semibold text-white">Tersimpan Abadi</span>
            <span className="text-[9px] text-stone-400">Hadiah Manis</span>
          </div>
        </div>

        {/* PRIMARY BIG START BUTTON (Luxury Glowing Apple Action) */}
        <button
          onClick={handleStart}
          className="group relative inline-flex items-center justify-center gap-3.5 py-4 sm:py-5 px-8 sm:px-10 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#F4E8D3] to-[#D4AF37] text-stone-950 font-sans font-bold text-base sm:text-lg tracking-wide shadow-[0_12px_40px_rgba(212,175,55,0.4)] hover:shadow-[0_16px_50px_rgba(212,175,55,0.6)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
        >
          {/* Subtle pulsating outer ring */}
          <span className="absolute -inset-1 rounded-full bg-[#D4AF37]/30 blur-md group-hover:bg-[#D4AF37]/50 transition duration-500 animate-pulse pointer-events-none" />

          <div className="relative w-9 h-9 rounded-full bg-stone-950 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
            <Video className="w-5 h-5 text-[#F4E8D3]" />
          </div>
          <span className="relative">Mulai Rekam Pesan</span>
        </button>

        <p className="text-[11px] text-stone-400 mt-4 tracking-wider uppercase font-medium">
          Ketuk tombol di atas untuk menyalakan kamera
        </p>
      </main>

      {/* FOOTER: Attribution to Zekalian */}
      <footer className="relative z-20 w-full py-4 text-center">
        <a
          href="https://www.instagram.com/zekalian"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-stone-400 hover:text-white transition inline-flex items-center gap-1.5 font-sans group cursor-pointer"
        >
          <span>Designed &amp; Developed by</span>
          <span className="font-semibold text-stone-200 group-hover:text-[#D4AF37] underline decoration-stone-500 underline-offset-4 transition-colors">
            Zekalian
          </span>
        </a>
      </footer>
    </div>
  );
};
