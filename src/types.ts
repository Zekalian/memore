export type KioskState =
  | 'WELCOME' // Opening Welcome / Attract page before camera viewfinder
  | 'IDLE' // Awaiting camera permission
  | 'STANDBY' // Camera active, waiting for manual start button
  | 'ARRIVAL' // Transitioning
  | 'GREETING' // Playing audio greeting & showing welcome message (if enabled)
  | 'COUNTDOWN' // 3.. 2.. 1..
  | 'RECORDING' // Active recording, clean viewfinder, manual stop button
  | 'SAVING' // Compiling video blob & triggering auto-download
  | 'THANK_YOU'; // Appreciation screen before returning to standby

export interface FaceDetectionResult {
  detected: boolean;
  meetsThreshold: boolean;
  faceHeightRatio: number; // e.g. 0.25 (25% of frame height)
  box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface KioskSettings {
  // Opening Screen & Kiosk Security
  useWelcomeScreen: boolean; // default true: ada opening page sebelum kamera
  pinLockEnabled: boolean; // default true: tombol pengaturan dikunci 4 digit PIN
  securityPin: string; // default '1234'

  // Battery Monitoring
  batteryMode?: 'auto' | 'manual'; // default auto
  manualBatteryLevel?: number; // 0 - 100, default 95
  manualIsCharging?: boolean; // default true

  // Manual Control Mode (Start manual & Stop manual)
  manualOnly: boolean; // default true: dipencet baru mulai, dipencet baru stop
  forceManualMode: boolean; // disable face detection auto-stop

  // Orientation Mode: 'auto' (mengikuti iPad), 'portrait', atau 'landscape'
  orientationMode: 'auto' | 'portrait' | 'landscape';

  // Hardware Device Selection (Persisted in LocalStorage)
  selectedVideoDeviceId?: string;
  selectedAudioDeviceId?: string; // Input mic external/internal

  // Visual Assets & Placeholders (Customizable & LocalStorage persisted)
  businessLogoUrl: string; // Placeholder PNG for business logo
  logoBackgroundStyle?: 'light' | 'transparent' | 'dark'; // 'transparent' (Melayang tanpa kotak, default), 'dark', 'light'
  logoBackgroundCustomized?: boolean; // True if operator manually chose background style
  logoRemoveBlackBackground?: boolean; // Hilangkan kotak hitam otomatis (mix-blend-screen)
  headerType?: 'image' | 'text'; // 'image' (PNG 800x400) or 'text' (Times New Roman Italic)
  eventBannerUrl: string; // Placeholder PNG for event name at upper-center (800x400)
  eventName: string; // Text fallback if banner image is not used
  groomName?: string; // Groom name for Text Monogram (e.g. DAVID)
  brideName?: string; // Bride name for Text Monogram (e.g. SARAH)
  eventSubtext?: string; // Event subtext / date (e.g. THE WEDDING CELEBRATION)
  eventDate: string; // Event subtext / date

  // Text Monogram Color & Gradient Customization
  textColorType?: 'solid' | 'gradient'; // 'solid' or 'gradient'
  textColorSolid?: string; // e.g. '#FFFFFF' or '#D4AF37'
  textGradientStart?: string; // e.g. '#D4AF37'
  textGradientEnd?: string; // e.g. '#F4E8D3'
  textGradientAngle?: number; // e.g. 135 (degrees)

  // Camera & Recording Parameters
  faceThreshold: number; // default 0.20 (20%)
  standbyScanInterval: number; // default 200ms
  recordingScanInterval: number; // default 800ms
  autoStopDelayMs: number; // default 1000ms (1s)
  maxDurationSec: number; // default 180s (3 minutes limit)
  countdownSeconds: number; // default 3s
  mirrorView: boolean; // default true
  targetBitrate: number; // default 6,000,000 bps (6 Mbps for 1080p)
  videoQualityPreset?: '1080p' | '720p' | 'eco'; // default '1080p'
  autoDownload: boolean; // default true
  promptSenderName?: boolean; // default true: pop up nama pengirim sebelum rekam
  audioVolume: number; // default 1.0
  customGreetingUrl?: string | null;
}

export interface VideoRecord {
  id: string;
  filename: string;
  timestamp: number;
  durationSec: number;
  sizeBytes: number;
  blob: Blob;
  mimeType: string;
  thumbnailUrl?: string;
  downloaded: boolean;
}

export interface StorageStats {
  usedBytes: number;
  totalBytes: number;
  percentUsed: number;
  isCritical: boolean; // >= 85%
}

export function getTextMonogramStyle(settings: {
  textColorType?: 'solid' | 'gradient';
  textColorSolid?: string;
  textGradientStart?: string;
  textGradientEnd?: string;
  textGradientAngle?: number;
}): React.CSSProperties {
  if (settings.textColorType === 'gradient') {
    const angle = settings.textGradientAngle ?? 135;
    const start = settings.textGradientStart || '#D4AF37';
    const end = settings.textGradientEnd || '#F4E8D3';
    return {
      backgroundImage: `linear-gradient(${angle}deg, ${start}, ${end})`,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      color: 'transparent',
    };
  }
  return {
    backgroundImage: 'none',
    WebkitBackgroundClip: 'border-box',
    backgroundClip: 'border-box',
    WebkitTextFillColor: 'currentColor',
    color: settings.textColorSolid || '#FFFFFF',
  };
}
