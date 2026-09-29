import React, { useState } from 'react';
import { User, ArrowRight, X } from 'lucide-react';

interface SenderNameModalProps {
  isOpen: boolean;
  initialName?: string;
  onConfirm: (name: string) => void;
  onSkip: () => void;
}

export const SenderNameModal: React.FC<SenderNameModalProps> = ({
  isOpen,
  initialName = '',
  onConfirm,
  onSkip,
}) => {
  const [nameInput, setNameInput] = useState(initialName);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(nameInput.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-2xl animate-fade-in select-none pointer-events-auto font-sans">
      <div className="relative w-full max-w-sm bg-white/95 border border-white/60 backdrop-blur-3xl rounded-[32px] p-6 shadow-2xl flex flex-col items-center text-[#1D1D1F] space-y-4 animate-scale-up">
        {/* Skip X button top right */}
        <button
          type="button"
          onClick={onSkip}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-[#8E8E93] hover:text-[#1D1D1F] transition active:scale-90 cursor-pointer"
          title="Bisa Dilewati"
        >
          <X className="w-4 h-4" />
        </button>

        {/* User Icon Capsule */}
        <div className="w-14 h-14 rounded-2xl bg-[#0071E3]/10 border border-[#0071E3]/20 flex items-center justify-center text-[#0071E3] shadow-sm">
          <User className="w-7 h-7" />
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-1 text-center">
          <h3 className="text-lg font-sans font-bold text-[#1D1D1F] tracking-tight">
            Siapa Nama Anda?
          </h3>
          <p className="text-xs text-[#8E8E93] leading-relaxed">
            Nama Anda akan digunakan untuk penamaan file video agar mudah dicari &amp; rapi.
          </p>
        </div>

        {/* Name Input Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-3 pt-1">
          <div className="relative w-full">
            <input
              type="text"
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Ketik nama Anda di sini..."
              className="w-full bg-[#F2F2F7] border border-[#E5E5EA] focus:border-[#0071E3] focus:bg-white text-sm font-sans font-semibold text-[#1D1D1F] placeholder-[#8E8E93] rounded-2xl px-4 py-3 outline-none transition text-center shadow-inner"
            />
            {nameInput && (
              <button
                type="button"
                onClick={() => setNameInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#E5E5EA] hover:bg-[#D1D1D6] flex items-center justify-center text-[#8E8E93] text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-2xl bg-[#0071E3] hover:bg-[#0077ED] active:scale-95 text-white text-xs font-sans font-bold shadow-lg shadow-[#0071E3]/25 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <span>Lanjutkan ke Kamera</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onSkip}
              className="w-full py-2 px-4 rounded-xl text-[#8E8E93] hover:text-[#1D1D1F] text-xs font-sans font-medium transition cursor-pointer text-center"
            >
              Lanjut Tanpa Nama
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
