import React, { useState } from 'react';
import { Share, PlusSquare, X, Smartphone, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallGuide: React.FC = () => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  return (
    <>
      <div className="fixed top-4 right-4 z-40">
        {isInstallable ? (
          <button
            onClick={install}
            className="flex items-center gap-2 rounded-full bg-[#FAF8F5] hover:bg-[#F5F2EB] text-[#2C2623] px-4 py-2 text-xs font-serif font-bold shadow-lg border border-[#E5DFD5] backdrop-blur transition active:scale-95 cursor-pointer"
          >
            <Smartphone className="w-4 h-4 text-[#8A6D3B]" />
            Install Kiosk PWA
          </button>
        ) : (
          <button
            onClick={() => setShowIOSModal(true)}
            className="flex items-center gap-2 rounded-full bg-[#FAF8F5]/90 hover:bg-[#FAF8F5] border border-[#E5DFD5] text-[#2C2623] px-3.5 py-1.5 text-xs font-serif font-semibold shadow-md backdrop-blur transition active:scale-95 cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#8A6D3B]" />
            SOP Kiosk iPad
          </button>
        )}
      </div>

      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in font-sans">
          <div className="w-full max-w-sm rounded-3xl bg-[#FAF8F5] border border-[#E5DFD5] p-6 shadow-2xl text-[#2C2623] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#EDE7DC] border border-[#DBD3C5] flex items-center justify-center text-[#8A6D3B]">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-serif font-bold tracking-wide text-[#2C2623]">
                  Instalasi Kiosk iPad (PWA)
                </h3>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="p-1.5 rounded-xl text-[#7A726A] hover:text-[#2C2623] hover:bg-[#EAE4D7] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#5C554D] leading-relaxed">
              Jalankan dalam mode Standalone PWA agar mendapatkan kuota penyimpanan maksimal dan layar penuh tanpa toolbar Safari:
            </p>

            <div className="space-y-3 text-xs bg-[#F5F2EB] p-4 rounded-2xl border border-[#EAE4D9]">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-[#2C2623] text-white flex items-center justify-center shrink-0 font-bold text-[11px] shadow-sm">
                  1
                </div>
                <div>
                  <p className="font-semibold text-[#2C2623] flex items-center gap-1.5">
                    Tap tombol Share di Safari <Share className="w-3.5 h-3.5 text-[#8A6D3B]" />
                  </p>
                  <p className="text-[11px] text-[#7A726A]">Terletak di toolbar atas iPad Safari</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-[#2C2623] text-white flex items-center justify-center shrink-0 font-bold text-[11px] shadow-sm">
                  2
                </div>
                <div>
                  <p className="font-semibold text-[#2C2623] flex items-center gap-1.5">
                    Pilih "Add to Home Screen" <PlusSquare className="w-3.5 h-3.5 text-[#8A6D3B]" />
                  </p>
                  <p className="text-[11px] text-[#7A726A]">Gulir menu ke bawah lalu tap Tambahkan</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-[#2C2623] text-white flex items-center justify-center shrink-0 font-bold text-[11px] shadow-sm">
                  3
                </div>
                <div>
                  <p className="font-semibold text-[#2C2623] flex items-center gap-1.5">
                    Buka Aplikasi dari Home Screen <Check className="w-3.5 h-3.5 text-emerald-600" />
                  </p>
                  <p className="text-[11px] text-[#7A726A]">Layar penuh vertikal 9:16 aktif tanpa address bar</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#2C2623] hover:bg-[#443E3B] text-white text-xs font-serif font-bold shadow-md transition active:scale-98 cursor-pointer"
            >
              Mengerti & Lanjutkan
            </button>
          </div>
        </div>
      )}
    </>
  );
};
