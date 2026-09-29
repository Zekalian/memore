import { useState, useEffect, useCallback } from 'react';
import { KioskView } from './components/KioskView';
import { OperatorPanel } from './components/OperatorPanel';
import { PinModal } from './components/PinModal';
import { KioskSettings, VideoRecord } from './types';
import { 
  getAllRecordings, 
  getRecoverySession, 
  clearRecoverySession,
  clearAllRecordings
} from './services/db';

const DEFAULT_SETTINGS: KioskSettings = {
  // Opening Screen & Kiosk Security
  useWelcomeScreen: true,
  pinLockEnabled: true,
  securityPin: '1234',

  // Manual Controls (Default: Start manual & Stop manual)
  manualOnly: true,
  forceManualMode: true,

  // Responsive Orientation (Auto-detects iPad orientation: landscape or portrait)
  orientationMode: 'auto',

  // Visual Assets & Custom PNG Placeholders
  businessLogoUrl: '/business-logo-placeholder.png',
  logoBackgroundStyle: 'light',
  headerType: 'image',
  eventBannerUrl: '/event-title-placeholder.png',
  eventName: 'The Wedding Celebration',
  groomName: 'DAVID',
  brideName: 'SARAH',
  eventSubtext: 'THE WEDDING CELEBRATION',
  eventDate: '27 SEPTEMBER 2026',
  textColorType: 'solid',
  textColorSolid: '#FFFFFF',
  textGradientStart: '#D4AF37',
  textGradientEnd: '#F4E8D3',
  textGradientAngle: 135,
  countdownSeconds: 3,

  // Camera & Recording Specifications
  faceThreshold: 0.20,
  standbyScanInterval: 200,
  recordingScanInterval: 800,
  autoStopDelayMs: 1000,
  maxDurationSec: 180, // 3 minutes safety limit
  mirrorView: true,
  targetBitrate: 6000000, // 6.0 Mbps for studio-crisp 1080p/720p HD
  videoQualityPreset: '1080p',
  autoDownload: true,
  promptSenderName: true,
  audioVolume: 1.0,
  customGreetingUrl: null,
};

export default function App() {
  const [settings, setSettings] = useState<KioskSettings>(() => {
    try {
      const saved = localStorage.getItem('memore_kiosk_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [isOperatorOpen, setIsOperatorOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [recordings, setRecordings] = useState<VideoRecord[]>([]);

  const handleRequestOpenOperator = useCallback(() => {
    if (settings.pinLockEnabled) {
      setIsPinModalOpen(true);
    } else {
      setIsOperatorOpen(true);
    }
  }, [settings.pinLockEnabled]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState(settings.selectedAudioDeviceId || '');

  // Load video & audio input devices (supports external microphones)
  useEffect(() => {
    async function loadDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const vDevices = devices.filter((d) => d.kind === 'videoinput');
        const aDevices = devices.filter((d) => d.kind === 'audioinput');
        setVideoDevices(vDevices);
        setAudioDevices(aDevices);
        
        // Set available video and audio devices for the operator panel selection
        setVideoDevices(vDevices);
        setAudioDevices(aDevices);
      } catch (err) {
        console.warn('Could not enumerate media devices:', err);
      }
    }

    loadDevices();

    // Listen for device plug/unplug (external mic or USB camera)
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
    };
  }, [selectedDeviceId, selectedAudioDeviceId, settings.selectedAudioDeviceId]);

  // Silently check and clear disaster recovery session & old IndexedDB recordings on startup to keep storage clean
  useEffect(() => {
    async function checkRecoveryAndCleanStorage() {
      try {
        await clearAllRecordings();
        const session = await getRecoverySession();
        if (session) {
          await clearRecoverySession();
        }
      } catch {}
    }
    checkRecoveryAndCleanStorage();
  }, []);

  const loadAllRecordings = useCallback(async () => {
    const list = await getAllRecordings();
    setRecordings(list);
  }, []);

  const handleUpdateSettings = (newSettings: Partial<KioskSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('memore_kiosk_settings', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-black text-white font-sans antialiased overflow-hidden">
      {/* Main Responsive Kiosk View (Adapts cleanly to Portrait & Landscape iPad) */}
      <KioskView
        settings={settings}
        onOpenOperator={handleRequestOpenOperator}
        selectedDeviceId={selectedDeviceId}
        selectedAudioDeviceId={selectedAudioDeviceId}
      />

      {/* Operator Control Panel & Settings (Apple iPadOS Sheet Style) */}
      <OperatorPanel
        isOpen={isOperatorOpen}
        onClose={() => setIsOperatorOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        recordings={recordings}
        onRefreshRecordings={loadAllRecordings}
        videoDevices={videoDevices}
        selectedDeviceId={selectedDeviceId}
        onSelectDevice={setSelectedDeviceId}
        audioDevices={audioDevices}
        selectedAudioDeviceId={selectedAudioDeviceId}
        onSelectAudioDevice={(audioId) => {
          setSelectedAudioDeviceId(audioId);
          handleUpdateSettings({ selectedAudioDeviceId: audioId });
        }}
      />

      {/* Operator PIN Security Keypad Modal */}
      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={() => setIsOperatorOpen(true)}
        correctPin={settings.securityPin || '1234'}
      />
    </div>
  );
}
