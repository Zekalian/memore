import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Delete, X } from 'lucide-react';
import { playVintageClick } from '../services/audio';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  correctPin?: string;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  correctPin = '1234',
}) => {
  const [pin, setPin] = useState<string>('');
  const [isShaking, setIsShaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMessage(null);
      setIsShaking(false);
    }
  }, [isOpen]);

  const handleDigit = useCallback((digit: string) => {
    if (pin.length >= 4) return;
    playVintageClick();
    const newPin = pin + digit;
    setPin(newPin);
    setErrorMessage(null);

    if (newPin.length === 4) {
      if (newPin === correctPin) {
        // Success
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 150);
      } else {
        // Incorrect
        setTimeout(() => {
          setIsShaking(true);
          setErrorMessage('PIN salah. Silakan coba lagi.');
          setTimeout(() => {
            setPin('');
            setIsShaking(false);
          }, 600);
        }, 100);
      }
    }
  }, [pin, correctPin, onSuccess, onClose]);

  const handleDelete = useCallback(() => {
    if (pin.length > 0) {
      playVintageClick();
      setPin((prev) => prev.slice(0, -1));
      setErrorMessage(null);
    }
  }, [pin]);

  // Physical Keyboard Listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDigit, handleDelete, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xl animate-fade-in select-none">
      <div 
        className={`relative w-full max-w-[320px] bg-white/95 backdrop-blur-2xl rounded-[32px] p-6 shadow-2xl border border-white/60 flex flex-col items-center transition-transform ${
          isShaking ? 'animate-shake' : 'animate-scale-up'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-stone-600 transition active:scale-90 cursor-pointer"
          title="Tutup"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Lock Icon */}
        <div className="w-12 h-12 rounded-2xl bg-[#EBF4FF] text-[#0071E3] flex items-center justify-center shadow-sm mb-3">
          <Lock className="w-6 h-6" />
        </div>

        {/* Title */}
        <h3 className="text-base font-sans font-bold text-[#1D1D1F]">
          Kunci Operator
        </h3>
        <p className="text-xs text-[#8E8E93] mt-0.5 text-center">
          Masukkan 4 digit PIN untuk membuka panel pengaturan
        </p>

        {/* 4 PIN Dots */}
        <div className="flex items-center gap-4 my-5">
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                  isFilled
                    ? 'bg-[#1D1D1F] scale-110 shadow-sm'
                    : 'bg-transparent border-2 border-stone-300'
                }`}
              />
            );
          })}
        </div>

        {/* Error message / Hint */}
        <div className="h-5 mb-2 flex items-center justify-center">
          {errorMessage ? (
            <span className="text-[11px] font-sans font-semibold text-[#FF3B30] animate-fade-in">
              {errorMessage}
            </span>
          ) : (
            <span className="text-[10px] text-[#8E8E93] font-mono">
              Default PIN: 1234
            </span>
          )}
        </div>

        {/* Numeric Keypad (Apple Numpad Style) */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-14 rounded-2xl bg-[#F2F2F7] hover:bg-[#E5E5EA] active:bg-[#D1D1D6] text-xl font-sans font-medium text-[#1D1D1F] flex items-center justify-center transition active:scale-95 shadow-sm cursor-pointer"
            >
              {digit}
            </button>
          ))}

          {/* Bottom row: Cancel / 0 / Backspace */}
          <button
            type="button"
            onClick={onClose}
            className="h-14 rounded-2xl text-xs font-sans font-semibold text-[#8E8E93] hover:text-[#1D1D1F] flex items-center justify-center transition active:scale-95 cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-[#F2F2F7] hover:bg-[#E5E5EA] active:bg-[#D1D1D6] text-xl font-sans font-medium text-[#1D1D1F] flex items-center justify-center transition active:scale-95 shadow-sm cursor-pointer"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="h-14 rounded-2xl bg-[#F2F2F7] hover:bg-[#E5E5EA] active:bg-[#D1D1D6] text-stone-700 flex items-center justify-center transition active:scale-95 shadow-sm cursor-pointer"
            title="Hapus"
          >
            <Delete className="w-5 h-5 text-[#1D1D1F]" />
          </button>
        </div>
      </div>
    </div>
  );
};
