import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  HardDrive, 
  Trash2, 
  Download, 
  Play, 
  Sliders, 
  AlertTriangle, 
  Camera, 
  FileVideo, 
  Upload, 
  Image as ImageIcon, 
  RotateCcw,
  Mic,
  Volume2,
  Lock,
  Wifi,
  WifiOff,
  CheckCircle2,
  Smartphone
} from 'lucide-react';
import { KioskSettings, VideoRecord, StorageStats, getTextMonogramStyle } from '../types';
import { clearAllRecordings, deleteRecording, getStorageStats } from '../services/db';

interface OperatorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: KioskSettings;
  onUpdateSettings: (newSettings: Partial<KioskSettings>) => void;
  recordings: VideoRecord[];
  onRefreshRecordings: () => void;
  isStandalonePWA?: boolean;
  videoDevices: MediaDeviceInfo[];
  selectedDeviceId: string;
  onSelectDevice: (deviceId: string) => void;
  audioDevices?: MediaDeviceInfo[];
  selectedAudioDeviceId?: string;
  onSelectAudioDevice?: (deviceId: string) => void;
  currentFaceRatio?: number;
}

export const OperatorPanel: React.FC<OperatorPanelProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  recordings,
  onRefreshRecordings,
  videoDevices,
  selectedDeviceId,
  onSelectDevice,
  audioDevices = [],
  selectedAudioDeviceId = '',
  onSelectAudioDevice = (_deviceId: string) => {},
}) => {
  // Tabs: Removed SOP Kiosk as requested
  const [activeTab, setActiveTab] = useState<'branding' | 'controls' | 'storage'>('branding');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats>({
    usedBytes: 0,
    totalBytes: 32 * 1024 * 1024 * 1024,
    percentUsed: 0,
    isCritical: false,
  });
  const [previewRecord, setPreviewRecord] = useState<VideoRecord | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [pinSavedToast, setPinSavedToast] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSavePin = () => {
    if (newPinInput.length === 4) {
      onUpdateSettings({ securityPin: newPinInput });
      setNewPinInput('');
      setPinSavedToast(true);
      setTimeout(() => setPinSavedToast(false), 3000);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStorage();
      onRefreshRecordings();
    }
  }, [isOpen]);

  // Live Audio VU Meter for Testing Selected Microphone
  useEffect(() => {
    let isCancelled = false;

    async function startAudioMeter() {
      if (!isOpen || activeTab !== 'controls') return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedAudioDeviceId ? { deviceId: { ideal: selectedAudioDeviceId } } : true,
          video: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        audioStreamRef.current = stream;
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (isCancelled) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          // Normalize to 0..1 with non-linear boost for speech
          const level = Math.min(1, Math.pow(avg / 128, 1.2));
          setAudioLevel((prev) => Math.max(level, prev * 0.85)); // Smooth decay
          animationFrameRef.current = requestAnimationFrame(tick);
        };

        tick();
      } catch (err) {
        console.warn('Audio meter initialization skipped/not available:', err);
      }
    }

    startAudioMeter();

    return () => {
      isCancelled = true;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      setAudioLevel(0);
    };
  }, [isOpen, activeTab, selectedAudioDeviceId]);

  const loadStorage = async () => {
    try {
      const stats = await getStorageStats();
      setStorageStats(stats);
    } catch {
      // ignore
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = (record: VideoRecord) => {
    const url = URL.createObjectURL(record.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = record.filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  };

  const handleDelete = async (id: string) => {
    await deleteRecording(id);
    await onRefreshRecordings();
    await loadStorage();
  };

  const handleClearAll = async () => {
    await clearAllRecordings();
    setShowClearConfirm(false);
    await onRefreshRecordings();
    await loadStorage();
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        onUpdateSettings({ businessLogoUrl: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        onUpdateSettings({ eventBannerUrl: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl p-4 sm:p-6 animate-fade-in text-[#1D1D1F] font-sans">
      {/* Apple iPadOS Modal Sheet */}
      <div className="relative w-full max-w-2xl bg-[#F5F5F7] border border-black/[0.08] rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5EA] bg-white/75 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E5E5EA] flex items-center justify-center text-[#1D1D1F]">
              <Sliders className="w-5 h-5 text-[#1D1D1F]" />
            </div>
            <div>
              <h2 className="text-base font-sans font-semibold text-[#1D1D1F] tracking-tight">
                Pengaturan Memore
              </h2>
              <p className="text-xs text-[#8E8E93]">
                Branding • Kamera &amp; Kontrol • Penyimpanan
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="py-1.5 px-3 rounded-xl bg-[#E5E5EA] hover:bg-[#D1D1D6] flex items-center gap-1.5 text-xs font-sans font-semibold text-[#1D1D1F] transition cursor-pointer active:scale-95"
              title="Refresh / Muat Ulang Halaman"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#1D1D1F]" />
              <span>Refresh App</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#E5E5EA] hover:bg-[#D1D1D6] flex items-center justify-center text-[#8E8E93] hover:text-[#1D1D1F] transition cursor-pointer active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Apple iOS Segmented Control Bar */}
        <div className="px-6 pt-4 pb-2 bg-[#F5F5F7]">
          <div className="bg-[#E5E5EA] p-1 rounded-2xl flex gap-1">
            <button
              onClick={() => setActiveTab('branding')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-sans font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'branding'
                  ? 'bg-white text-[#1D1D1F] shadow-sm'
                  : 'text-[#8E8E93] hover:text-[#1D1D1F]'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Branding (PNG)</span>
            </button>
            <button
              onClick={() => setActiveTab('controls')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-sans font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'controls'
                  ? 'bg-white text-[#1D1D1F] shadow-sm'
                  : 'text-[#8E8E93] hover:text-[#1D1D1F]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Kamera & Audio</span>
            </button>
            <button
              onClick={() => setActiveTab('storage')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-sans font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'storage'
                  ? 'bg-white text-[#1D1D1F] shadow-sm'
                  : 'text-[#8E8E93] hover:text-[#1D1D1F]'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Rekaman ({recordings.length})</span>
            </button>
          </div>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#F5F5F7]">
          {/* TAB 1: BRANDING & ACARA (PNG PLACEHOLDERS & LOCALSTORAGE) */}
          {activeTab === 'branding' && (
            <div className="space-y-4">
              {/* 1. LOGO USAHA (PLACEHOLDER PNG 320x100) */}
              <div className="p-5 rounded-2xl bg-white border border-[#E5E5EA] space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-sans font-semibold text-[#1D1D1F]">
                        Logo Usaha (Kiri Atas)
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#EBF4FF] text-[#0071E3] border border-[#0071E3]/20">
                        320 × 100 px
                      </span>
                    </div>
                    <p className="text-xs text-[#8E8E93] mt-1 leading-relaxed">
                      Unggah logo bisnis Anda dalam format <strong>PNG transparan</strong>. Ukuran rekomendasi presisi: <strong className="text-[#1D1D1F]">320 × 100 pixel</strong> (rasio ~3:1 sampai 4:1).
                    </p>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ businessLogoUrl: '/business-logo-placeholder.png' })}
                    className="text-xs text-[#0071E3] hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-2"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                </div>

                {/* Gaya Latar Kaca Logo (Apple Glass Styles) */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block">
                    Gaya Latar Logo di Layar:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ logoBackgroundStyle: 'light' })}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-sans font-semibold flex flex-col items-center justify-center gap-0.5 transition cursor-pointer active:scale-95 ${
                        (settings.logoBackgroundStyle || 'light') === 'light'
                          ? 'bg-[#0071E3] border-[#0071E3] text-white shadow-sm'
                          : 'bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]'
                      }`}
                    >
                      <span>⚪ Kaca Putih</span>
                      <span className="text-[9px] opacity-80 font-normal">Kontras Tinggi (Biru/Gelap)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ logoBackgroundStyle: 'transparent' })}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-sans font-semibold flex flex-col items-center justify-center gap-0.5 transition cursor-pointer active:scale-95 ${
                        settings.logoBackgroundStyle === 'transparent'
                          ? 'bg-[#0071E3] border-[#0071E3] text-white shadow-sm'
                          : 'bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]'
                      }`}
                    >
                      <span>🔲 Transparan</span>
                      <span className="text-[9px] opacity-80 font-normal">Melayang (Tanpa Kotak)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ logoBackgroundStyle: 'dark' })}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-sans font-semibold flex flex-col items-center justify-center gap-0.5 transition cursor-pointer active:scale-95 ${
                        settings.logoBackgroundStyle === 'dark'
                          ? 'bg-[#0071E3] border-[#0071E3] text-white shadow-sm'
                          : 'bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]'
                      }`}
                    >
                      <span>⚫ Kaca Obsidian</span>
                      <span className="text-[9px] opacity-80 font-normal">Gelap (Khusus Logo Putih)</span>
                    </button>
                  </div>
                </div>

                {/* Preview Box with Pixel Dimensions Badge & Live Style Demonstration */}
                <div className="relative p-5 rounded-2xl bg-[#141416] flex flex-col items-center justify-center border border-black/10 overflow-hidden">
                  <div className="absolute top-2 right-2 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-black/60 text-[#F4E8D3] border border-white/10 backdrop-blur-sm z-10">
                    Preview (320 × 100 px)
                  </div>
                  <div className="text-[10px] text-white/50 mb-2 font-mono">Tampilan Di Layar:</div>
                  <div className={`p-2.5 rounded-2xl flex items-center justify-center transition-all ${
                    (settings.logoBackgroundStyle || 'light') === 'light'
                      ? 'bg-white/95 border border-white shadow-lg'
                      : settings.logoBackgroundStyle === 'dark'
                      ? 'bg-black/70 border border-white/20 shadow-lg'
                      : 'bg-transparent border border-white/10'
                  }`}>
                    {settings.businessLogoUrl ? (
                      <img
                        src={settings.businessLogoUrl}
                        alt="Logo Preview"
                        className="max-h-12 max-w-[200px] object-contain drop-shadow"
                      />
                    ) : (
                      <span className="text-xs text-stone-400">Tidak ada logo</span>
                    )}
                  </div>
                </div>

                {/* Upload Action */}
                <label className="py-2.5 px-4 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA] border border-[#E5E5EA] text-xs font-sans font-semibold text-[#1D1D1F] flex items-center justify-center gap-2 cursor-pointer transition active:scale-98">
                  <Upload className="w-4 h-4 text-[#8E8E93]" />
                  <span>Unggah File PNG Logo Anda Sendiri</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* 2. NAMA ACARA / MONOGRAM (PNG 800x400 ATAU TEKS) */}
              <div className="p-5 rounded-2xl bg-white border border-[#E5E5EA] space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-sans font-semibold text-[#1D1D1F]">
                        Nama Acara / Monogram (Tengah Atas)
                      </h3>
                      {(settings.headerType || 'image') === 'image' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#EBF4FF] text-[#0071E3] border border-[#0071E3]/20">
                          800 × 400 px
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8E8E93] mt-1 leading-relaxed">
                      Pilih format tampilan Nama Acara: Gambar PNG Monogram atau Teks Nama Pengantin.
                    </p>
                  </div>
                </div>

                {/* Header Type Selector (Segmented Toggle) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block">
                    Mode Tampilan Nama Acara:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ headerType: 'image' })}
                      className={`py-2 px-3 rounded-xl border text-xs font-sans font-semibold flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 ${
                        (settings.headerType || 'image') === 'image'
                          ? 'bg-[#0071E3] border-[#0071E3] text-white shadow-sm'
                          : 'bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]'
                      }`}
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span>Gambar PNG Monogram</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ headerType: 'text' })}
                      className={`py-2 px-3 rounded-xl border text-xs font-sans font-semibold flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 ${
                        settings.headerType === 'text'
                          ? 'bg-[#0071E3] border-[#0071E3] text-white shadow-sm'
                          : 'bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]'
                      }`}
                    >
                      <span className="font-serif italic font-bold text-sm">T</span>
                      <span>Teks (Times New Roman)</span>
                    </button>
                  </div>
                </div>

                {/* MODE 1: GAMBAR PNG MONOGRAM (800x400) */}
                {(settings.headerType || 'image') === 'image' && (
                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-[#8E8E93]">
                      Unggah file gambar logo monogram atau kaligrafi pengantin (<strong className="text-[#1D1D1F]">800 × 400 pixel, PNG Transparan</strong>, tanpa drop shadow).
                    </p>

                    {/* Preview Box without Drop Shadow */}
                    <div className="relative p-4 rounded-xl bg-[#1C1C1E] flex flex-col items-center justify-center border border-black/10 overflow-hidden">
                      <div className="absolute top-2 right-2 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-black/60 text-[#F4E8D3] border border-white/10 backdrop-blur-sm">
                        800 × 400 px
                      </div>
                      {settings.eventBannerUrl ? (
                        <img
                          src={settings.eventBannerUrl}
                          alt="Banner Preview"
                          className="max-h-28 max-w-[380px] object-contain"
                        />
                      ) : (
                        <div className="text-center py-2">
                          <span className="text-base font-sans font-semibold text-white">
                            {settings.eventName || 'NAMA ACARA ANDA'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <label className="flex-1 py-2.5 px-4 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA] border border-[#E5E5EA] text-xs font-sans font-semibold text-[#1D1D1F] flex items-center justify-center gap-2 cursor-pointer transition active:scale-98">
                        <Upload className="w-4 h-4 text-[#8E8E93]" />
                        <span>Unggah Gambar PNG (800 × 400 px)</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={handleBannerUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ eventBannerUrl: '/event-title-placeholder.png' })}
                        className="py-2.5 px-3 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA] border border-[#E5E5EA] text-xs font-sans font-semibold text-[#0071E3] flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98"
                        title="Reset Placeholder"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* MODE 2: TEKS NAMA PENGANTIN (TIMES NEW ROMAN ITALIC) */}
                {settings.headerType === 'text' && (
                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-[#8E8E93]">
                      Atur nama kedua mempelai. Ditampilkan otomatis menggunakan font <strong className="text-[#1D1D1F]">Times New Roman Miring (Italic)</strong>.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                          Nama Mempelai Pria (Atas)
                        </label>
                        <input
                          type="text"
                          value={settings.groomName || ''}
                          onChange={(e) => onUpdateSettings({ groomName: e.target.value })}
                          placeholder="DAVID"
                          className="w-full bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] font-serif italic"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                          Nama Mempelai Wanita (Bawah)
                        </label>
                        <input
                          type="text"
                          value={settings.brideName || ''}
                          onChange={(e) => onUpdateSettings({ brideName: e.target.value })}
                          placeholder="SARAH"
                          className="w-full bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] font-serif italic"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                        Sub-Teks / Judul Acara / Tanggal
                      </label>
                      <input
                        type="text"
                        value={settings.eventSubtext || ''}
                        onChange={(e) => onUpdateSettings({ eventSubtext: e.target.value, eventDate: e.target.value })}
                        placeholder="THE WEDDING CELEBRATION"
                        className="w-full bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                      />
                    </div>

                    {/* CUSTOM COLOR & GRADIENT CONTROLS */}
                    <div className="p-4 rounded-xl bg-[#F2F2F7] border border-[#E5E5EA] space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-[#1D1D1F] block">
                          Warna &amp; Efek Gradient Teks:
                        </label>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => onUpdateSettings({ textColorType: 'solid' })}
                            className={`py-1 px-2.5 rounded-lg text-[10px] font-sans font-semibold transition cursor-pointer ${
                              (settings.textColorType || 'solid') === 'solid'
                                ? 'bg-[#0071E3] text-white shadow-sm'
                                : 'bg-[#E5E5EA] text-[#1D1D1F] hover:bg-[#D1D1D6]'
                            }`}
                          >
                            🎨 Warna Solid
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateSettings({ textColorType: 'gradient' })}
                            className={`py-1 px-2.5 rounded-lg text-[10px] font-sans font-semibold transition cursor-pointer ${
                              settings.textColorType === 'gradient'
                                ? 'bg-[#0071E3] text-white shadow-sm'
                                : 'bg-[#E5E5EA] text-[#1D1D1F] hover:bg-[#D1D1D6]'
                            }`}
                          >
                            🌈 Gradient
                          </button>
                        </div>
                      </div>

                      {/* SOLID COLOR SELECTOR */}
                      {(settings.textColorType || 'solid') === 'solid' && (
                        <div className="space-y-2.5 pt-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={settings.textColorSolid || '#FFFFFF'}
                              onChange={(e) => onUpdateSettings({ textColorSolid: e.target.value })}
                              className="w-8 h-8 rounded-lg border border-[#E5E5EA] cursor-pointer bg-white p-0.5"
                            />
                            <input
                              type="text"
                              value={settings.textColorSolid || '#FFFFFF'}
                              onChange={(e) => onUpdateSettings({ textColorSolid: e.target.value })}
                              placeholder="#FFFFFF"
                              className="w-28 bg-white border border-[#E5E5EA] rounded-xl px-3 py-1.5 text-xs text-[#1D1D1F] font-mono focus:outline-none focus:border-[#0071E3]"
                            />
                            <span className="text-[11px] text-[#8E8E93]">Pilih warna solid</span>
                          </div>

                          {/* Quick Solid Color Presets */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-medium text-[#8E8E93] block">Preset Warna Favorit:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                { name: '⚪ Putih', color: '#FFFFFF' },
                                { name: '⭐ Emas Luxe', color: '#D4AF37' },
                                { name: '🌸 Rose Gold', color: '#E0A96D' },
                                { name: '🍾 Champagne', color: '#F4E8D3' },
                                { name: '💎 Soft Cyan', color: '#60A5FA' },
                                { name: '🖤 Hitam Slate', color: '#1D1D1F' },
                              ].map((p) => (
                                <button
                                  key={p.color}
                                  type="button"
                                  onClick={() => onUpdateSettings({ textColorSolid: p.color })}
                                  className="py-1 px-2 rounded-lg text-[10px] bg-white border border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA] flex items-center gap-1 transition cursor-pointer"
                                >
                                  <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: p.color }} />
                                  <span>{p.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* GRADIENT SELECTOR */}
                      {settings.textColorType === 'gradient' && (
                        <div className="space-y-3 pt-1">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {/* Start Color */}
                            <div>
                              <label className="text-[10px] font-semibold text-[#1D1D1F] block mb-1">Warna Awal (Start):</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={settings.textGradientStart || '#D4AF37'}
                                  onChange={(e) => onUpdateSettings({ textGradientStart: e.target.value })}
                                  className="w-8 h-8 rounded-lg border border-[#E5E5EA] cursor-pointer bg-white p-0.5"
                                />
                                <input
                                  type="text"
                                  value={settings.textGradientStart || '#D4AF37'}
                                  onChange={(e) => onUpdateSettings({ textGradientStart: e.target.value })}
                                  className="w-full bg-white border border-[#E5E5EA] rounded-xl px-2.5 py-1 text-xs text-[#1D1D1F] font-mono focus:outline-none focus:border-[#0071E3]"
                                />
                              </div>
                            </div>

                            {/* End Color */}
                            <div>
                              <label className="text-[10px] font-semibold text-[#1D1D1F] block mb-1">Warna Akhir (End):</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={settings.textGradientEnd || '#F4E8D3'}
                                  onChange={(e) => onUpdateSettings({ textGradientEnd: e.target.value })}
                                  className="w-8 h-8 rounded-lg border border-[#E5E5EA] cursor-pointer bg-white p-0.5"
                                />
                                <input
                                  type="text"
                                  value={settings.textGradientEnd || '#F4E8D3'}
                                  onChange={(e) => onUpdateSettings({ textGradientEnd: e.target.value })}
                                  className="w-full bg-white border border-[#E5E5EA] rounded-xl px-2.5 py-1 text-xs text-[#1D1D1F] font-mono focus:outline-none focus:border-[#0071E3]"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Gradient Angle Slider */}
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-[10px] font-semibold text-[#1D1D1F]">
                                Sudut Arah Gradient (Angle):
                              </label>
                              <span className="text-[11px] font-mono font-bold text-[#0071E3]">
                                {settings.textGradientAngle ?? 135}°
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="360"
                              step="15"
                              value={settings.textGradientAngle ?? 135}
                              onChange={(e) => onUpdateSettings({ textGradientAngle: parseInt(e.target.value, 10) })}
                              className="w-full accent-[#0071E3] cursor-pointer"
                            />
                            <div className="flex justify-between text-[9px] text-[#8E8E93] mt-0.5">
                              <span>0° (Kanan)</span>
                              <span>90° (Atas)</span>
                              <span>135° (Diagonal)</span>
                              <span>180° (Kiri)</span>
                            </div>
                          </div>

                          {/* Preset Gradients */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-medium text-[#8E8E93] block">Preset Kombinasi Gradient Cepat:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                { name: '⭐ Luxe Gold', start: '#D4AF37', end: '#F4E8D3', angle: 135 },
                                { name: '🌸 Rose Gold', start: '#E0A96D', end: '#F7D6C8', angle: 135 },
                                { name: '🥈 Platinum Silver', start: '#9CA3AF', end: '#FFFFFF', angle: 135 },
                                { name: '🔥 Sunset Amber', start: '#F59E0B', end: '#EF4444', angle: 135 },
                                { name: '💎 Royal Blue', start: '#3B82F6', end: '#93C5FD', angle: 135 },
                              ].map((g) => (
                                <button
                                  key={g.name}
                                  type="button"
                                  onClick={() =>
                                    onUpdateSettings({
                                      textGradientStart: g.start,
                                      textGradientEnd: g.end,
                                      textGradientAngle: g.angle,
                                    })
                                  }
                                  className="py-1 px-2.5 rounded-lg text-[10px] bg-white border border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA] flex items-center gap-1.5 transition cursor-pointer"
                                >
                                  <span
                                    className="w-3 h-3 rounded-full border border-black/10"
                                    style={{ background: `linear-gradient(${g.angle}deg, ${g.start}, ${g.end})` }}
                                  />
                                  <span>{g.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Live Preview Box for Text Monogram */}
                    <div className="relative p-5 rounded-xl bg-[#1C1C1E] flex flex-col items-center justify-center border border-black/10 overflow-hidden text-center">
                      <div className="absolute top-2 right-2 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-black/60 text-[#F4E8D3] border border-white/10 backdrop-blur-sm">
                        Preview Teks
                      </div>
                      <div className="py-2 flex flex-col items-center justify-center font-[Times_New_Roman,serif] italic">
                        <span 
                          className="text-xl font-serif italic font-bold tracking-wide"
                          style={getTextMonogramStyle(settings)}
                        >
                          {settings.groomName || 'DAVID'}
                        </span>
                        <span 
                          className="text-sm font-serif italic my-0.5"
                          style={getTextMonogramStyle(settings)}
                        >
                          &amp;
                        </span>
                        <span 
                          className="text-xl font-serif italic font-bold tracking-wide"
                          style={getTextMonogramStyle(settings)}
                        >
                          {settings.brideName || 'SARAH'}
                        </span>
                        {(settings.eventSubtext || settings.eventDate) && (
                          <span 
                            className="text-[10px] font-sans not-italic font-semibold tracking-[0.2em] uppercase mt-2 opacity-90"
                            style={getTextMonogramStyle(settings)}
                          >
                            {settings.eventSubtext || settings.eventDate}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: KAMERA & KONTROL MANUAL */}
          {activeTab === 'controls' && (
            <div className="space-y-4">
              {/* Orientation Setting: Auto, Landscape, Portrait */}
              <div className="p-5 rounded-2xl bg-white border border-[#E5E5EA] space-y-3 shadow-sm">
                <div>
                  <h3 className="text-sm font-sans font-semibold text-[#1D1D1F]">
                    Orientasi Layar iPad
                  </h3>
                  <p className="text-xs text-[#8E8E93] mt-0.5">
                    Pilih bagaimana tampilan menyesuaikan dengan posisi iPad.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => onUpdateSettings({ orientationMode: 'auto' })}
                    className={`py-3 px-2 rounded-xl border text-xs font-sans font-semibold flex flex-col items-center justify-center gap-1 transition cursor-pointer active:scale-95 ${
                      settings.orientationMode === 'auto'
                        ? 'bg-[#0071E3] border-[#0071E3] text-white shadow-sm'
                        : 'bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]'
                    }`}
                  >
                    <span>🔄 Otomatis</span>
                    <span className="text-[10px] opacity-80">Ikuti Putaran</span>
                  </button>
                  <button
                    onClick={() => onUpdateSettings({ orientationMode: 'landscape' })}
                    className={`py-3 px-2 rounded-xl border text-xs font-sans font-semibold flex flex-col items-center justify-center gap-1 transition cursor-pointer active:scale-95 ${
                      settings.orientationMode === 'landscape'
                        ? 'bg-[#0071E3] border-[#0071E3] text-white shadow-sm'
                        : 'bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]'
                    }`}
                  >
                    <span>🖥️ Landscape</span>
                    <span className="text-[10px] opacity-80">Mendatar</span>
                  </button>
                  <button
                    onClick={() => onUpdateSettings({ orientationMode: 'portrait' })}
                    className={`py-3 px-2 rounded-xl border text-xs font-sans font-semibold flex flex-col items-center justify-center gap-1 transition cursor-pointer active:scale-95 ${
                      settings.orientationMode === 'portrait'
                        ? 'bg-[#0071E3] border-[#0071E3] text-white shadow-sm'
                        : 'bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]'
                    }`}
                  >
                    <span>📱 Portrait</span>
                    <span className="text-[10px] opacity-80">Tegak</span>
                  </button>
                </div>
              </div>

              {/* Grouped Apple Settings List */}
              <div className="rounded-2xl bg-white border border-[#E5E5EA] divide-y divide-[#E5E5EA] shadow-sm overflow-hidden">
                {/* Welcome Screen Toggle */}
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#1D1D1F] block">
                      Halaman Pembuka (Welcome Screen)
                    </span>
                    <span className="text-[11px] text-[#8E8E93]">
                      Tampilkan layar sambutan sebelum tamu masuk ke kamera
                    </span>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ useWelcomeScreen: settings.useWelcomeScreen === false ? true : false })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition cursor-pointer ${
                      settings.useWelcomeScreen !== false ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        settings.useWelcomeScreen !== false ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Mirror View Toggle */}
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#1D1D1F] block">
                      Cermin Kamera (Mirror View)
                    </span>
                    <span className="text-[11px] text-[#8E8E93]">
                      Membalik video seperti cermin rias
                    </span>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ mirrorView: !settings.mirrorView })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition cursor-pointer ${
                      settings.mirrorView ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        settings.mirrorView ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Video Quality Preset Selector */}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-[#1D1D1F] block">
                        Kualitas Video &amp; Bitrate
                      </span>
                      <span className="text-[11px] text-[#8E8E93]">
                        Format rekaman vertikal jernih untuk iPad Kiosk
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#0071E3] border border-blue-200">
                      {(settings.videoQualityPreset || '1080p') === '1080p'
                        ? '1080p (6.0 Mbps)'
                        : (settings.videoQualityPreset === '720p' ? '720p (3.5 Mbps)' : 'Eco (1.8 Mbps)')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ videoQualityPreset: '1080p', targetBitrate: 6000000 })}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer active:scale-95 ${
                        (settings.videoQualityPreset || '1080p') === '1080p'
                          ? 'bg-[#0071E3] border-[#0071E3] text-white shadow-sm'
                          : 'bg-white border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#F2F2F7]'
                      }`}
                    >
                      <div className="text-xs font-bold">1080p Full HD</div>
                      <div className={`text-[10px] ${
                        (settings.videoQualityPreset || '1080p') === '1080p' ? 'text-blue-100' : 'text-[#8E8E93]'
                      }`}>
                        1080x1920 • 6 Mbps
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ videoQualityPreset: '720p', targetBitrate: 3500000 })}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer active:scale-95 ${
                        settings.videoQualityPreset === '720p'
                          ? 'bg-[#0071E3] border-[#0071E3] text-white shadow-sm'
                          : 'bg-white border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#F2F2F7]'
                      }`}
                    >
                      <div className="text-xs font-bold">720p HD</div>
                      <div className={`text-[10px] ${
                        settings.videoQualityPreset === '720p' ? 'text-blue-100' : 'text-[#8E8E93]'
                      }`}>
                        720x1280 • 3.5 Mbps
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ videoQualityPreset: 'eco', targetBitrate: 1800000 })}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer active:scale-95 ${
                        settings.videoQualityPreset === 'eco'
                          ? 'bg-[#0071E3] border-[#0071E3] text-white shadow-sm'
                          : 'bg-white border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#F2F2F7]'
                      }`}
                    >
                      <div className="text-xs font-bold">Standar Eco</div>
                      <div className={`text-[10px] ${
                        settings.videoQualityPreset === 'eco' ? 'text-blue-100' : 'text-[#8E8E93]'
                      }`}>
                        Ringan • 1.8 Mbps
                      </div>
                    </button>
                  </div>
                </div>

                {/* Auto Download Toggle */}
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#1D1D1F] block">
                      Auto-Download ke Files iPad
                    </span>
                    <span className="text-[11px] text-[#8E8E93]">
                      Otomatis simpan video setiap sesi selesai
                    </span>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ autoDownload: !settings.autoDownload })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition cursor-pointer ${
                      settings.autoDownload ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        settings.autoDownload ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Countdown Slider */}
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#1D1D1F]">
                      Durasi Hitung Mundur (Countdown)
                    </label>
                    <span className="text-xs font-mono font-semibold text-[#0071E3]">
                      {settings.countdownSeconds || 3} detik
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={settings.countdownSeconds || 3}
                    onChange={(e) => onUpdateSettings({ countdownSeconds: parseInt(e.target.value) })}
                    className="w-full accent-[#0071E3] h-2 bg-[#E5E5EA] rounded-lg cursor-pointer"
                  />
                </div>

                {/* Max Duration Slider */}
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#1D1D1F]">
                      Batas Maksimal Rekaman (Safety Limit)
                    </label>
                    <span className="text-xs font-mono font-semibold text-[#0071E3]">
                      {(() => {
                        const sec = settings.maxDurationSec || 180;
                        if (sec < 60) return `${sec} detik`;
                        const mins = Math.floor(sec / 60);
                        const remSec = sec % 60;
                        if (remSec === 0) return `${sec} detik (${mins} menit)`;
                        return `${sec} detik (${mins} menit ${remSec} detik)`;
                      })()}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={300}
                    step={15}
                    value={settings.maxDurationSec}
                    onChange={(e) => onUpdateSettings({ maxDurationSec: parseInt(e.target.value) })}
                    className="w-full accent-[#0071E3] h-2 bg-[#E5E5EA] rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Microphone Input Switcher & Live VU Test Meter */}
              <div className="p-5 rounded-2xl bg-white border border-[#E5E5EA] space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#EBF4FF] flex items-center justify-center text-[#0071E3]">
                      <Mic className="w-4 h-4 text-[#0071E3]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-sans font-semibold text-[#1D1D1F]">
                        Input Mikrofon (Mic External / Internal)
                      </h4>
                      <p className="text-[11px] text-[#8E8E93]">
                        Gunakan mic internal iPad atau mic eksternal (wireless lavalier / USB-C).
                      </p>
                    </div>
                  </div>
                  {audioDevices.length > 0 && (
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                      {audioDevices.length} Mic Terdeteksi
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 pt-1">
                  <select
                    value={selectedAudioDeviceId}
                    onChange={(e) => onSelectAudioDevice(e.target.value)}
                    className="w-full bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-3 py-2.5 text-xs text-[#1D1D1F] font-medium focus:outline-none focus:border-[#0071E3]"
                  >
                    {audioDevices.length === 0 ? (
                      <option value="">Mikrofon Default Sistem</option>
                    ) : (
                      audioDevices.map((dev, idx) => {
                        const isExternal = /(usb|external|headset|wireless|bluetooth|lightning|airpods|type-c)/i.test(dev.label);
                        return (
                          <option key={dev.deviceId || idx} value={dev.deviceId}>
                            {dev.label || `Mikrofon ${idx + 1}`} {isExternal ? '★ (Mic Eksternal)' : ''}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>

                {/* Real-time Audio Level VU Meter */}
                <div className="p-3 rounded-xl bg-[#F8F8FA] border border-[#E5E5EA] space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-[#0071E3]" />
                      Tes Sinyal Suara (Live Meter)
                    </span>
                    <span className="text-[10px] font-mono text-[#8E8E93]">
                      {audioLevel > 0.05 ? 'Sinyal Aktif' : 'Menunggu Suara...'}
                    </span>
                  </div>
                  
                  <div className="w-full h-3 bg-[#E5E5EA] rounded-full overflow-hidden flex items-center p-0.5">
                    <div
                      className="h-full rounded-full transition-all duration-75"
                      style={{
                        width: `${Math.min(100, Math.max(2, audioLevel * 100))}%`,
                        backgroundColor: audioLevel > 0.75 ? '#FF3B30' : audioLevel > 0.35 ? '#FF9500' : '#34C759',
                      }}
                    />
                  </div>

                  <p className="text-[10px] text-[#8E8E93] leading-relaxed">
                    Bicara di dekat mic untuk memastikan audio masuk dengan jernih sebelum memulai sesi tamu.
                  </p>
                </div>
              </div>

              {/* Camera Switcher */}
              {videoDevices.length > 1 && (
                <div className="p-4 rounded-2xl bg-white border border-[#E5E5EA] space-y-2 shadow-sm">
                  <label className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-2">
                    <Camera className="w-4 h-4 text-[#8E8E93]" />
                    Pilih Input Kamera
                  </label>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => onSelectDevice(e.target.value)}
                    className="w-full bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                  >
                    {videoDevices.map((dev, idx) => (
                      <option key={dev.deviceId || idx} value={dev.deviceId}>
                        {dev.label || `Kamera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Security & Operator PIN Lock Section */}
              <div className="p-5 rounded-2xl bg-white border border-[#E5E5EA] space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-sans font-semibold text-[#1D1D1F]">
                        Kunci PIN Operator Kiosk
                      </h4>
                      <p className="text-[11px] text-[#8E8E93]">
                        Mencegah tamu/anak membuka pengaturan saat iPad ditinggal
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ pinLockEnabled: !settings.pinLockEnabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition cursor-pointer ${
                      settings.pinLockEnabled !== false ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        settings.pinLockEnabled !== false ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {settings.pinLockEnabled !== false && (
                  <div className="space-y-3 pt-2 border-t border-[#E5E5EA]">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-[#1D1D1F]">
                        Ubah 4 Digit PIN Keamanan:
                      </label>
                      <span className="text-[11px] font-mono text-[#8E8E93]">
                        PIN Aktif: <strong className="text-[#1D1D1F] font-mono tracking-widest">{settings.securityPin || '1234'}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="Ketik 4 digit PIN baru"
                        value={newPinInput}
                        onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="flex-1 bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-3 py-2 text-xs font-mono text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] tracking-widest"
                      />
                      <button
                        type="button"
                        onClick={handleSavePin}
                        disabled={newPinInput.length !== 4}
                        className="px-3.5 py-2 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] disabled:bg-[#E5E5EA] disabled:text-[#8E8E93] text-white text-xs font-semibold transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                      >
                        Simpan PIN
                      </button>
                    </div>

                    {pinSavedToast && (
                      <p className="text-[11px] text-[#34C759] font-medium animate-fade-in flex items-center gap-1">
                        ✓ PIN baru berhasil disimpan!
                      </p>
                    )}

                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-[10px] text-[#8E8E93]">
                        Gunakan tombol di samping untuk segera mengunci.
                      </span>
                      <button
                        type="button"
                        onClick={onClose}
                        className="text-xs text-[#0071E3] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                      >
                        <Lock className="w-3 h-3" />
                        Kunci &amp; Keluar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Offline Capability & PWA Standalone Card */}
              <div className="p-5 rounded-2xl bg-white border border-[#E5E5EA] space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-sans font-semibold text-[#1D1D1F]">
                        Mode Offline &amp; Standalone PWA
                      </h4>
                      <p className="text-[11px] text-[#8E8E93]">
                        Dapat bekerja 100% tanpa internet / Wi-Fi saat acara
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border">
                    {isOnline ? (
                      <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50/50">
                        <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Online (Tersambung)</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50/50">
                        <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                        <span>Mode Offline (Siap Rekam)</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#F2F2F7] space-y-2 text-xs text-[#1D1D1F]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed">
                      <strong>Siap Rekam Offline:</strong> Seluruh modul kamera, audio studio, deteksi, dan komposit 9:16 tersimpan di memori iPad.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed">
                      <strong>Cara Pasang Layar Penuh (Kiosk):</strong> Di Safari iPad, ketuk tombol <strong>Share (Bagikan ⎋)</strong> ➔ pilih <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>. Buka dari ikon Home Screen agar bar URL Safari hilang menjadi kiosk murni.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STORAGE & RECORDINGS */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white border border-[#E5E5EA] flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs text-[#8E8E93]">Penyimpanan Lokal</p>
                  <p className="text-sm font-semibold text-[#1D1D1F]">
                    {formatBytes(storageStats.usedBytes)} dari {formatBytes(storageStats.totalBytes)} ({storageStats.percentUsed}%)
                  </p>
                </div>
                {recordings.length > 0 && (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-[#FF3B30] text-xs font-semibold border border-red-100 transition cursor-pointer"
                  >
                    Hapus Semua
                  </button>
                )}
              </div>

              {recordings.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-white border border-[#E5E5EA] space-y-2 shadow-sm">
                  <FileVideo className="w-8 h-8 text-[#C7C7CC] mx-auto" />
                  <p className="text-xs text-[#8E8E93]">Belum ada video rekaman tamu.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {recordings.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3 rounded-xl bg-white border border-[#E5E5EA] flex items-center justify-between gap-3 shadow-sm hover:border-[#D1D1D6] transition"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        {rec.thumbnailUrl ? (
                          <img
                            src={rec.thumbnailUrl}
                            alt=""
                            className="w-10 h-14 object-cover rounded-lg bg-black"
                          />
                        ) : (
                          <div className="w-10 h-14 rounded-lg bg-[#F2F2F7] flex items-center justify-center text-xs">
                            🎬
                          </div>
                        )}
                        <div className="overflow-hidden">
                          <p className="text-xs font-mono font-semibold text-[#1D1D1F] truncate">
                            {rec.filename}
                          </p>
                          <p className="text-[10px] text-[#8E8E93]">
                            {new Date(rec.timestamp).toLocaleTimeString()} • {rec.durationSec}s • {formatBytes(rec.sizeBytes)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setPreviewRecord(rec)}
                          className="p-1.5 rounded-lg bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] cursor-pointer"
                          title="Tonton"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDownload(rec)}
                          className="p-1.5 rounded-lg bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] cursor-pointer"
                          title="Unduh"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(rec.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-[#FF3B30] cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E5E5EA] bg-white/75 backdrop-blur-xl">
          <span className="text-[11px] text-[#8E8E93]">
            Tersimpan otomatis di LocalStorage iPad.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-sans font-semibold shadow-sm transition active:scale-95 cursor-pointer"
          >
            Selesai
          </button>
        </div>
      </div>

      {/* Video Preview Modal */}
      {previewRecord && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative max-w-lg w-full max-h-[90vh] bg-white rounded-[32px] overflow-hidden border border-black/[0.08] shadow-2xl flex flex-col items-center text-[#1D1D1F]">
            <div className="w-full flex items-center justify-between p-3.5 border-b border-[#E5E5EA] bg-[#F5F5F7]">
              <span className="text-xs font-mono font-semibold text-[#1D1D1F]">
                {previewRecord.filename}
              </span>
              <button
                onClick={() => setPreviewRecord(null)}
                className="w-7 h-7 rounded-full bg-[#E5E5EA] hover:bg-[#D1D1D6] flex items-center justify-center text-[#8E8E93] hover:text-[#1D1D1F] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="w-full bg-black flex items-center justify-center p-2">
              <video
                src={URL.createObjectURL(previewRecord.blob)}
                controls
                autoPlay
                playsInline
                className="max-h-[55vh] w-auto max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <div className="max-w-md w-full bg-white border border-red-200 rounded-[28px] p-6 space-y-4 text-center shadow-2xl text-[#1D1D1F]">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto text-[#FF3B30]">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-sans font-semibold text-[#1D1D1F]">
              Hapus Semua Rekaman?
            </h3>
            <p className="text-xs text-[#8E8E93] leading-relaxed">
              Tindakan ini akan mengosongkan seluruh memori video di browser. Pastikan video penting sudah tersimpan di aplikasi Files iPad.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#F2F2F7] text-[#1D1D1F] text-xs font-medium hover:bg-[#E5E5EA] cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleClearAll}
                className="flex-1 py-2.5 rounded-xl bg-[#FF3B30] hover:bg-[#D70015] text-white text-xs font-semibold shadow-sm active:scale-95 cursor-pointer"
              >
                Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
