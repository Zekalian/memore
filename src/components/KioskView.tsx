import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Download, 
  Play, 
  X,
  ArrowRight
} from 'lucide-react';
import { KioskState, KioskSettings, VideoRecord } from '../types';
import { playCountdownBeep, playVintageClick } from '../services/audio';
import { 
  saveRecording, 
  saveRecoverySession, 
  clearRecoverySession, 
  generateVideoThumbnail, 
  getStorageStats 
} from '../services/db';
import { EventHeader } from './EventHeader';
import { WelcomeScreen } from './WelcomeScreen';

interface KioskViewProps {
  settings: KioskSettings;
  onOpenOperator: () => void;
  selectedDeviceId: string;
  selectedAudioDeviceId?: string;
}

export const KioskView: React.FC<KioskViewProps> = ({
  settings,
  onOpenOperator,
  selectedDeviceId,
  selectedAudioDeviceId,
}) => {
  const [state, setState] = useState<KioskState>(() => {
    return settings.useWelcomeScreen !== false ? 'WELCOME' : 'IDLE';
  });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [countdownNum, setCountdownNum] = useState(3);
  const [showAutoDownloadBanner, setShowAutoDownloadBanner] = useState(false);
  const [lastSavedRecord, setLastSavedRecord] = useState<VideoRecord | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  // Dynamic Orientation Detection (Landscape vs Portrait)
  const [windowOrientation, setWindowOrientation] = useState<'portrait' | 'landscape'>(() => {
    return typeof window !== 'undefined' && window.innerWidth > window.innerHeight
      ? 'landscape'
      : 'portrait';
  });

  useEffect(() => {
    const handleOrientationChange = () => {
      setWindowOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
    };
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);
    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  const effectiveOrientation =
    settings.orientationMode === 'auto'
      ? windowOrientation
      : settings.orientationMode;
  const isLandscape = effectiveOrientation === 'landscape';

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const stateRef = useRef<KioskState>('IDLE');
  stateRef.current = state;

  const recordingTimerRef = useRef<number | null>(null);
  const sessionStartTimeRef = useRef<number>(0);
  const initIdRef = useRef<number>(0);
  const recordCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderLoopRef = useRef<number | null>(null);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const activeVideoDeviceIdRef = useRef<string>('');
  const activeAudioDeviceIdRef = useRef<string>('');
  const isUnmountingRef = useRef<boolean>(false);

  // Initialize Camera (Resilient multi-tier fallback with Apple-standard high fidelity)
  const initCamera = useCallback(async () => {
    const currentInitId = ++initIdRef.current;
    try {
      setCameraError(null);

      // Reuse existing active stream if tracks are live and target device hasn't explicitly changed
      if (streamRef.current) {
        const liveTracks = streamRef.current.getTracks().filter((t) => t.readyState === 'live');
        const sameVideoDevice = !selectedDeviceId || selectedDeviceId === activeVideoDeviceIdRef.current;
        const sameAudioDevice = !selectedAudioDeviceId || selectedAudioDeviceId === activeAudioDeviceIdRef.current;

        if (liveTracks.length > 0 && sameVideoDevice && sameAudioDevice) {
          if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
          if (settingsRef.current.useWelcomeScreen !== false) {
            setState((prev) => (prev === 'IDLE' ? 'WELCOME' : prev));
          } else {
            setState('STANDBY');
          }
          return;
        }
      }

      // Detach previous stream from video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Stop previous stream if we are intentionally switching devices
      if (streamRef.current) {
        const oldStream = streamRef.current;
        streamRef.current = null;
        oldStream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        await new Promise((r) => setTimeout(r, 100));
      }

      let stream: MediaStream | null = null;

      // Robust single-pass constraint capture optimized for iPadOS / Safari at stable 30fps
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: selectedDeviceId ? { ideal: selectedDeviceId } : undefined,
            facingMode: { ideal: 'user' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, min: 25, max: 60 },
          },
          audio: selectedAudioDeviceId
            ? { deviceId: { ideal: selectedAudioDeviceId } }
            : true,
        });
      } catch (err1) {
        console.warn('High-res camera init failed, attempting basic stream capture:', err1);
        const e1 = err1 as { name?: string };
        if (e1?.name === 'NotAllowedError' || e1?.name === 'PermissionDeniedError') {
          throw err1;
        }

        // Basic unconstrained fallback
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      }

      if (currentInitId !== initIdRef.current || isUnmountingRef.current) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      activeVideoDeviceIdRef.current = selectedDeviceId || '';
      activeAudioDeviceIdRef.current = selectedAudioDeviceId || '';

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        try {
          await videoRef.current.play();
        } catch {
          // Autoplay handled
        }
      }

      if (settingsRef.current.useWelcomeScreen !== false) {
        setState((prev) => (prev === 'IDLE' ? 'WELCOME' : prev));
      } else {
        setState('STANDBY');
      }
    } catch (err: unknown) {
      console.error('Camera initialization error:', err);
      const e = err as { name?: string; message?: string };
      let message = 'Izin kamera atau mikrofon ditolak.';

      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        message = 'Akses kamera ditolak. Silakan izinkan kamera di ikon gembok pada address bar browser Anda.';
      } else if (
        e?.name === 'NotReadableError' ||
        e?.name === 'TrackStartError' ||
        e?.message?.toLowerCase().includes('could not start video source')
      ) {
        message = 'Kamera tidak dapat dimulai karena sedang digunakan oleh aplikasi lain. Tutup aplikasi tersebut lalu klik Coba Lagi.';
      } else if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
        message = 'Kamera tidak ditemukan. Pastikan kamera internal atau webcam telah tersambung.';
      } else if (e?.message) {
        message = e.message;
      }

      setCameraError(message);
      setState('IDLE');
    }
  }, [selectedDeviceId, selectedAudioDeviceId]);

  useEffect(() => {
    isUnmountingRef.current = false;
    initCamera();
    return () => {
      // Do NOT stop streamRef.current on effect re-runs to avoid Safari permission re-prompting.
      // Stream is preserved across renders and state changes.
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current);
    };
  }, [initCamera]);

  // Clean up media stream only on true unmount of KioskView component
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Disaster Recovery
  useEffect(() => {
    const handleEmergencySave = () => {
      if (stateRef.current === 'RECORDING' && recordedChunksRef.current.length > 0) {
        saveRecoverySession({
          id: `recovery_${Date.now()}`,
          chunks: recordedChunksRef.current,
          startedAt: sessionStartTimeRef.current,
        });
      }
    };
    window.addEventListener('beforeunload', handleEmergencySave);
    window.addEventListener('pagehide', handleEmergencySave);
    return () => {
      window.removeEventListener('beforeunload', handleEmergencySave);
      window.removeEventListener('pagehide', handleEmergencySave);
    };
  }, []);

  // MANUAL START (Dipencet Baru Mulai)
  const handleStartManual = () => {
    if (state !== 'STANDBY') return;
    playVintageClick();

    sessionStartTimeRef.current = Date.now();
    recordedChunksRef.current = [];

    startMediaRecorder();
    startCountdown();
  };

  const startCountdown = () => {
    setState('COUNTDOWN');
    setCountdownNum(settingsRef.current.countdownSeconds || 3);
    playCountdownBeep(false);

    let count = settingsRef.current.countdownSeconds || 3;
    const interval = window.setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdownNum(count);
        playCountdownBeep(false);
      } else {
        clearInterval(interval);
        playCountdownBeep(true);
        setState('RECORDING');
        startRecordingTimer();
      }
    }, 1000);
  };

  const startMediaRecorder = () => {
    if (!streamRef.current) return;
    recordedChunksRef.current = [];

    let mimeType = 'video/mp4;codecs=avc1';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/mp4';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm;codecs=vp8';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
          }
        }
      }
    }

    // Studio-grade Bitrate:
    // 1080p: 6.0 Mbps (6,000,000 bps)
    // 720p: 3.5 Mbps (3,500,000 bps)
    // Audio: 192 kbps (192,000 bps)
    const effectiveBitrate =
      settingsRef.current.targetBitrate ||
      (settingsRef.current.videoQualityPreset === '720p' ? 3500000 : 6000000);

    // Exact Story Dimensions: 9:16 Portrait (1080x1920 or 720x1280) / 16:9 Landscape (1920x1080 or 1280x720)
    const isPortrait = !isLandscape;
    const is1080p = (settingsRef.current.videoQualityPreset || '1080p') === '1080p';
    const targetW = isPortrait ? (is1080p ? 1080 : 720) : (is1080p ? 1920 : 1280);
    const targetH = isPortrait ? (is1080p ? 1920 : 1280) : (is1080p ? 1080 : 720);

    let canvas = recordCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      recordCanvasRef.current = canvas;
    }
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { alpha: false });

    if (renderLoopRef.current) {
      cancelAnimationFrame(renderLoopRef.current);
      renderLoopRef.current = null;
    }

    const video = videoRef.current;
    const drawCanvasFrame = () => {
      if (video && ctx && video.videoWidth > 0 && video.videoHeight > 0) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const targetAspect = targetW / targetH;
        const sourceAspect = vw / vh;

        let sx = 0, sy = 0, sw = vw, sh = vh;
        if (sourceAspect > targetAspect) {
          // Source is wider than 9:16 -> center-crop left & right
          sw = vh * targetAspect;
          sx = (vw - sw) / 2;
        } else {
          // Source is taller than 9:16 -> center-crop top & bottom
          sh = vw / targetAspect;
          sy = (vh - sh) / 2;
        }

        if (settingsRef.current.mirrorView) {
          ctx.save();
          ctx.translate(targetW, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetW, targetH);
          ctx.restore();
        } else {
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetW, targetH);
        }
      }
      renderLoopRef.current = requestAnimationFrame(drawCanvasFrame);
    };

    // Draw initial frame immediately
    drawCanvasFrame();

    let streamToRecord: MediaStream = streamRef.current;
    if (typeof canvas.captureStream === 'function') {
      try {
        const canvasStream = canvas.captureStream(60);
        const canvasVideoTrack = canvasStream.getVideoTracks()[0];
        if (canvasVideoTrack) {
          const combinedTracks: MediaStreamTrack[] = [canvasVideoTrack];
          if (streamRef.current) {
            const audioTracks = streamRef.current.getAudioTracks();
            if (audioTracks.length > 0) {
              combinedTracks.push(audioTracks[0]);
            }
          }
          streamToRecord = new MediaStream(combinedTracks);
        }
      } catch (streamErr) {
        console.warn('Canvas stream composition failed, fallback to camera stream:', streamErr);
      }
    }

    try {
      const recorder = new MediaRecorder(streamToRecord, {
        mimeType,
        videoBitsPerSecond: effectiveBitrate,
        audioBitsPerSecond: 192000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
          saveRecoverySession({
            id: `current_${sessionStartTimeRef.current}`,
            chunks: recordedChunksRef.current,
            startedAt: sessionStartTimeRef.current,
          });
        }
      };

      recorder.onstop = () => {
        if (renderLoopRef.current) {
          cancelAnimationFrame(renderLoopRef.current);
          renderLoopRef.current = null;
        }
        processAndSaveVideo(mimeType);
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.error('MediaRecorder initialization failed:', err);
    }
  };

  const startRecordingTimer = () => {
    setRecordingSeconds(0);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingSeconds((prev) => {
        const next = prev + 1;
        if (next >= settingsRef.current.maxDurationSec) {
          finishRecording();
        }
        return next;
      });
    }, 1000);
  };

  // MANUAL STOP (Dipencet Baru Berhenti)
  const finishRecording = () => {
    playVintageClick();

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (renderLoopRef.current) {
      cancelAnimationFrame(renderLoopRef.current);
      renderLoopRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      setState('SAVING');
      try {
        mediaRecorderRef.current.requestData();
      } catch {
        // ignore
      }
      try {
        mediaRecorderRef.current.stop();
      } catch {
        processAndSaveVideo('video/mp4');
      }

      window.setTimeout(() => {
        if (stateRef.current === 'SAVING') {
          processAndSaveVideo('video/mp4');
        }
      }, 1500);
    } else {
      setState('STANDBY');
    }
  };

  const processAndSaveVideo = async (mimeType: string) => {
    if (stateRef.current !== 'SAVING') return;
    try {
      const chunks = [...recordedChunksRef.current];
      const duration = recordingSeconds || Math.max(1, Math.round((Date.now() - sessionStartTimeRef.current) / 1000));

      if (chunks.length === 0 || duration < 1.5) {
        clearRecoverySession();
        setState('STANDBY');
        return;
      }

      const activeMime = mimeType || 'video/mp4';
      const blob = new Blob(chunks, { type: activeMime });
      const isMp4 = activeMime.includes('mp4');
      const ext = isMp4 ? 'mp4' : 'webm';
      const now = new Date();
      const timestampStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const filename = `Memore_${timestampStr}.${ext}`;

      if (settingsRef.current.autoDownload) {
        triggerDownload(blob, filename);
        setShowAutoDownloadBanner(true);
      }

      const initialRecord: VideoRecord = {
        id: `memore_${Date.now()}`,
        filename,
        timestamp: Date.now(),
        durationSec: duration,
        sizeBytes: blob.size,
        blob,
        mimeType: activeMime,
        thumbnailUrl: '',
        downloaded: true,
      };
      setLastSavedRecord(initialRecord);

      setState('THANK_YOU');

      (async () => {
        try {
          const thumbnailUrl = await generateVideoThumbnail(blob);
          const fullRecord = { ...initialRecord, thumbnailUrl };
          setLastSavedRecord(fullRecord);
          await saveRecording(fullRecord);
          await clearRecoverySession();
          await getStorageStats();
        } catch (dbErr) {
          console.warn('[Memore DB] Background record save error:', dbErr);
        }
      })();

      window.setTimeout(() => {
        setShowAutoDownloadBanner(false);
        if (stateRef.current === 'THANK_YOU') {
          handleReturnToStandby();
        }
      }, 5000);
    } catch (err) {
      console.error('[Memore] Video process error:', err);
      setState('STANDBY');
    }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (e) {
      console.warn('Auto-download trigger failed:', e);
    }
  };

  const handleReturnToStandby = () => {
    try {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        streamRef.current = null;
      }
    } catch (e) {
      console.warn('Error releasing stream before reload:', e);
    }
    setTimeout(() => {
      window.location.reload();
    }, 150);
  };

  // Auto-return to Welcome screen if idle on STANDBY for 60 seconds
  useEffect(() => {
    if (state === 'STANDBY' && settings.useWelcomeScreen !== false) {
      const timer = setTimeout(() => {
        setState('WELCOME');
      }, 60000);
      return () => clearTimeout(timer);
    }
  }, [state, settings.useWelcomeScreen]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-black text-white overflow-hidden flex flex-col font-sans select-none">
      {/* 
        OFFSCREEN CANVAS FOR EXACT 9:16 STORY COMPOSITOR:
        Must be attached in the DOM so WebKit on iOS/iPadOS renders active 30fps frames for captureStream
      */}
      <canvas
        ref={recordCanvasRef}
        className="fixed -top-[9999px] -left-[9999px] pointer-events-none opacity-0 -z-50"
      />

      {/* 
        RESPONSIVE APPLE KIOSK FRAME:
        - Fills 100% of iPad / Tablet screen seamlessly edge-to-edge in both Portrait & Landscape
      */}
      <div className="relative w-full h-full flex-1 bg-black overflow-hidden flex flex-col justify-between">
        {/* OPENING / WELCOME SCREEN (ATTRACT PAGE) */}
        {state === 'WELCOME' && (
          <div className="fixed inset-0 z-50 bg-black animate-fade-in flex flex-col">
            <WelcomeScreen
              settings={settings}
              onStartSession={() => {
                setState('STANDBY');
              }}
              onOpenSettings={onOpenOperator}
              isLandscape={isLandscape}
            />
          </div>
        )}

        {/* Live Camera Viewfinder (Mirrored horizontally, pinned 100% edge-to-edge) */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`fixed inset-0 w-full h-full object-cover z-0 pointer-events-none transition-opacity duration-300 ${
            state === 'WELCOME' ? 'opacity-0 invisible' : 'opacity-100 visible'
          } ${
            settings.mirrorView ? 'scale-x-[-1]' : ''
          }`}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />

        {/* 
          APPLE TOP GRADIENT & EVENT HEADER
        */}
        <EventHeader
          businessLogoUrl={settings.businessLogoUrl}
          logoBackgroundStyle={settings.logoBackgroundStyle || 'light'}
          headerType={settings.headerType}
          eventBannerUrl={settings.eventBannerUrl}
          eventName={settings.eventName}
          groomName={settings.groomName}
          brideName={settings.brideName}
          eventSubtext={settings.eventSubtext || settings.eventDate}
          eventDate={settings.eventDate}
          onOpenSettings={onOpenOperator}
          isRecording={state === 'RECORDING'}
          recordingSeconds={recordingSeconds}
          formatTimer={formatTimer}
          isLandscape={isLandscape}
        />

        {/* 
          CENTER VIEWPORT DISPLAY AREA
          NOTE: Absolutely NO red dots in the middle! Viewfinder is kept 100% clean during recording.
        */}
        <main className="relative z-20 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none pointer-events-none">
          {/* STANDBY GENTLE PROMPT */}
          {state === 'STANDBY' && (
            <div className="flex flex-col items-center gap-3 pointer-events-auto animate-fade-in">
              <div className="px-5 py-2 rounded-full bg-black/40 backdrop-blur-2xl border border-white/20 text-white text-xs font-sans font-medium tracking-wide shadow-xl">
                Silakan berdiri di depan kamera &amp; siap merekam
              </div>
              {settings.useWelcomeScreen !== false && (
                <button
                  onClick={() => setState('WELCOME')}
                  className="px-4 py-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-xl border border-white/20 text-[11px] font-sans font-medium text-white/90 transition active:scale-95 cursor-pointer shadow-md"
                >
                  ← Kembali ke Halaman Pembuka
                </button>
              )}
            </div>
          )}

          {/* COUNTDOWN OVERLAY (Apple SF Clean Typography) */}
          {state === 'COUNTDOWN' && (
            <div className="flex flex-col items-center justify-center animate-scale-up select-none pointer-events-none">
              <span className="text-9xl sm:text-[10rem] font-sans font-semibold text-white drop-shadow-[0_8px_30px_rgba(0,0,0,0.8)] leading-none tracking-tight">
                {countdownNum}
              </span>
              <p className="mt-4 text-xs font-sans font-medium tracking-widest text-white/90 uppercase drop-shadow-md">
                Tersenyumlah ke arah kamera
              </p>
            </div>
          )}

          {/* ACTIVE RECORDING:
              100% CLEAN CAMERA FEED.
              The dot timer in the middle has been completely removed!
              Recording status is displayed in the Apple Dynamic Island at top right, and the shutter stop button at bottom.
          */}
          {state === 'RECORDING' && null}

          {/* SAVING OVERLAY (Apple Frosted Glass Card) */}
          {state === 'SAVING' && (
            <div className="p-8 rounded-[28px] bg-white/85 dark:bg-[#1C1C1E]/85 border border-white/40 backdrop-blur-3xl flex flex-col items-center space-y-3.5 shadow-2xl text-[#1D1D1F]">
              <RefreshCw className="w-9 h-9 text-[#8E8E93] animate-spin" />
              <div className="space-y-1 text-center">
                <p className="text-sm font-sans font-semibold text-[#1D1D1F]">
                  Menyimpan Rekaman...
                </p>
                <p className="text-xs text-[#8E8E93]">
                  Video sedang diunduh ke perangkat
                </p>
              </div>
            </div>
          )}

          {/* THANK YOU OVERLAY (Apple Modal Card) */}
          {state === 'THANK_YOU' && (
            <div className="w-full max-w-xs sm:max-w-sm p-7 rounded-[32px] bg-white/95 border border-white/60 backdrop-blur-3xl shadow-2xl flex flex-col items-center space-y-4 animate-scale-up text-[#1D1D1F] pointer-events-auto">
              <div className="w-14 h-14 rounded-full bg-[#34C759]/15 border border-[#34C759]/30 flex items-center justify-center text-[#34C759] shadow-sm">
                <Check className="w-7 h-7 stroke-[2.5]" />
              </div>
              <div className="space-y-1 text-center">
                <h3 className="text-xl font-sans font-bold text-[#1D1D1F] tracking-tight">
                  Terima Kasih
                </h3>
                <p className="text-xs text-[#8E8E93] leading-relaxed">
                  Pesan video Anda telah berhasil disimpan dengan indah.
                </p>
              </div>

              <div className="w-full flex flex-col gap-2.5 pt-1">
                <button
                  onClick={handleReturnToStandby}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#0071E3] hover:bg-[#0077ED] active:scale-95 text-white text-xs font-sans font-bold shadow-lg shadow-[#0071E3]/25 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <span>Lanjutkan ke Tamu Berikutnya</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {lastSavedRecord && (
                  <button
                    onClick={() => setPreviewVideoUrl(URL.createObjectURL(lastSavedRecord.blob))}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA] active:scale-95 text-[#1D1D1F] text-xs font-sans font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-[#1D1D1F] text-[#1D1D1F]" />
                    Lihat Hasil Rekaman
                  </button>
                )}

                <p className="text-[10px] text-center text-[#8E8E93] pt-1">
                  Layar akan kembali otomatis ke tampilan awal...
                </p>
              </div>
            </div>
          )}

          {/* Camera Error Fallback */}
          {cameraError && (
            <div className="p-6 sm:p-7 rounded-[28px] bg-white/95 backdrop-blur-2xl text-[#1D1D1F] border border-red-200/80 shadow-2xl max-w-sm space-y-4 pointer-events-auto animate-scale-up">
              <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto text-[#FF3B30]">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 text-center">
                <h4 className="text-sm font-sans font-bold text-[#1D1D1F]">
                  Kendala Membuka Kamera
                </h4>
                <p className="text-xs text-[#8E8E93] leading-relaxed">
                  {cameraError}
                </p>
              </div>
              <div className="space-y-2 pt-1">
                <button
                  onClick={initCamera}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-sans font-semibold shadow transition active:scale-95 cursor-pointer"
                >
                  🔄 Coba Buka Kamera Lagi
                </button>
                <button
                  onClick={onOpenOperator}
                  className="w-full py-2 px-4 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] text-xs font-sans font-semibold transition active:scale-95 cursor-pointer"
                >
                  ⚙️ Buka Pengaturan Perangkat
                </button>
              </div>
            </div>
          )}
        </main>

        {/* 
          APPLE CAMERA SHUTTER & CONTROLS FOOTER
          Iconic Apple Camera shutter button (white outer ring + morphing inner circle/square)
          Rendered cleanly and directly over the live camera viewfinder without any dark bars or overlays
        */}
        <footer className={`relative z-20 w-full select-none flex flex-col items-center pb-safe ${
          isLandscape ? 'pt-2 px-8' : 'pt-2 px-6'
        }`}>
          {/* Auto-Download Confirmation Banner (Apple Notification Pill) */}
          {showAutoDownloadBanner && (
            <div className="mb-3 px-4 py-1.5 rounded-full bg-white/85 backdrop-blur-2xl border border-white/40 text-[#1D1D1F] text-xs font-medium flex items-center gap-2 shadow-xl animate-fade-in">
              <Check className="w-3.5 h-3.5 text-[#34C759]" />
              <span>Video otomatis tersimpan ke folder Files iPad</span>
            </div>
          )}

          {/* ICONIC APPLE CAMERA SHUTTER BUTTON */}
          <div className="w-full flex flex-col items-center gap-3">
            {state === 'STANDBY' && (
              <div className="flex flex-col items-center gap-2">
                {/* Apple Shutter Ring Button */}
                <button
                  onClick={handleStartManual}
                  className="w-20 h-20 rounded-full border-[3.5px] border-white/95 flex items-center justify-center p-1 backdrop-blur-md bg-black/20 shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer group"
                  title="Mulai Rekam Pesan"
                >
                  <span className="w-14 h-14 rounded-full bg-white transition-all duration-200 group-hover:scale-95 shadow-md flex items-center justify-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF3B30]" />
                  </span>
                </button>
                <span className="text-xs font-sans font-semibold tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                  Mulai Rekam Pesan
                </span>
              </div>
            )}

            {state === 'RECORDING' && (
              <div className="flex flex-col items-center gap-2">
                {/* Apple Stop Recording Shutter Button (Outer ring + inner red square) */}
                <button
                  onClick={finishRecording}
                  className="w-20 h-20 rounded-full border-[3.5px] border-white flex items-center justify-center p-1 backdrop-blur-md bg-black/30 shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer group animate-pulse"
                  title="Selesai Merekam"
                >
                  <span className="w-7 h-7 rounded-[8px] bg-[#FF3B30] transition-all duration-200 group-hover:scale-95 shadow-md" />
                </button>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-xl border border-white/15">
                  <span className="text-xs font-sans font-medium text-white/90">
                    Selesai Merekam
                  </span>
                  <span className="text-xs font-mono font-semibold text-[#FF3B30]">
                    ({formatTimer(recordingSeconds)})
                  </span>
                </div>
              </div>
            )}

            <a
              href="https://www.instagram.com/zekalian"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-sans font-medium tracking-wider text-white/80 hover:text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)] transition-colors cursor-pointer pointer-events-auto flex items-center justify-center gap-1 group"
            >
              <span>Designed &amp; Developed by</span>
              <span className="font-semibold text-white group-hover:text-[#D4AF37] underline decoration-white/40 underline-offset-2 transition-colors">
                Zekalian
              </span>
            </a>
          </div>
        </footer>
      </div>

      {/* Video Preview Modal (Apple iPadOS Sheet Style) */}
      {previewVideoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xl p-4 animate-fade-in">
          <div className="relative max-w-lg w-full max-h-[90vh] bg-white rounded-[32px] overflow-hidden border border-black/[0.08] shadow-2xl flex flex-col items-center text-[#1D1D1F]">
            <div className="w-full flex items-center justify-between p-4 border-b border-[#E5E5EA] bg-[#F5F5F7]">
              <span className="text-xs font-sans font-semibold text-[#1D1D1F]">
                Pratinjau Rekaman
              </span>
              <button
                onClick={() => setPreviewVideoUrl(null)}
                className="w-7 h-7 rounded-full bg-[#E5E5EA] hover:bg-[#D1D1D6] flex items-center justify-center text-[#8E8E93] hover:text-[#1D1D1F] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="w-full bg-black flex items-center justify-center p-2">
              <video
                src={previewVideoUrl}
                controls
                autoPlay
                playsInline
                className="max-h-[58vh] w-auto max-w-full object-contain"
              />
            </div>
            <div className="w-full p-4 bg-white flex items-center gap-2">
              <button
                onClick={() => {
                  if (lastSavedRecord) {
                    triggerDownload(lastSavedRecord.blob, lastSavedRecord.filename);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-sans font-semibold flex items-center justify-center gap-2 shadow-sm cursor-pointer transition active:scale-95"
              >
                <Download className="w-4 h-4" />
                Unduh Video Lagi
              </button>
              <button
                onClick={() => {
                  setPreviewVideoUrl(null);
                  handleReturnToStandby();
                }}
                className="py-2.5 px-4 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] text-xs font-sans font-medium cursor-pointer transition active:scale-95"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
