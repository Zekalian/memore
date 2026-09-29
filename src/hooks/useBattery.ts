import { useState, useEffect } from 'react';

interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  onchargingchange: ((this: BatteryManager, ev: Event) => void) | null;
  onlevelchange: ((this: BatteryManager, ev: Event) => void) | null;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManager>;
}

export interface BatteryState {
  level: number; // 0 - 100
  isCharging: boolean;
  isSupported: boolean;
  isBlockedByOS: boolean;
  source: 'hardware' | 'manual';
  isLow: boolean;
}

export function useBattery(): BatteryState {
  const [hardwareBattery, setHardwareBattery] = useState<{
    level: number;
    isCharging: boolean;
    isSupported: boolean;
  }>({
    level: 95,
    isCharging: true,
    isSupported: false,
  });

  const [isBlockedByOS, setIsBlockedByOS] = useState<boolean>(false);
  const [manualSettings, setManualSettings] = useState<{
    batteryMode: 'auto' | 'manual';
    manualBatteryLevel: number;
    manualIsCharging: boolean;
  }>(() => {
    try {
      const saved = localStorage.getItem('memore_kiosk_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          batteryMode: parsed.batteryMode || 'auto',
          manualBatteryLevel: typeof parsed.manualBatteryLevel === 'number' ? parsed.manualBatteryLevel : 95,
          manualIsCharging: parsed.manualIsCharging !== false,
        };
      }
    } catch {
      // fallback
    }
    return {
      batteryMode: 'auto',
      manualBatteryLevel: 95,
      manualIsCharging: true,
    };
  });

  // Listen to localStorage changes so changing it in OperatorPanel instantly updates all screens
  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem('memore_kiosk_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          setManualSettings({
            batteryMode: parsed.batteryMode || 'auto',
            manualBatteryLevel: typeof parsed.manualBatteryLevel === 'number' ? parsed.manualBatteryLevel : 95,
            manualIsCharging: parsed.manualIsCharging !== false,
          });
        }
      } catch {}
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('memore_settings_updated', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('memore_settings_updated', handleStorage);
    };
  }, []);

  useEffect(() => {
    let battery: BatteryManager | null = null;
    let isCancelled = false;

    const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithBattery) : null;

    if (!nav || typeof nav.getBattery !== 'function') {
      // iOS / iPadOS Safari does not support getBattery() due to Apple privacy restrictions
      setIsBlockedByOS(true);
      return;
    }

    nav.getBattery().then((bm) => {
      if (isCancelled) return;
      battery = bm;

      const updateBattery = () => {
        const pct = Math.round(bm.level * 100);
        setHardwareBattery({
          level: pct,
          isCharging: bm.charging,
          isSupported: true,
        });
      };

      updateBattery();
      bm.addEventListener('levelchange', updateBattery);
      bm.addEventListener('chargingchange', updateBattery);
    }).catch((err) => {
      console.warn('Battery API blocked or not permitted (e.g. iframe policy / Apple iOS):', err);
      setIsBlockedByOS(true);
    });

    return () => {
      isCancelled = true;
      if (battery) {
        battery.removeEventListener('levelchange', () => {});
        battery.removeEventListener('chargingchange', () => {});
      }
    };
  }, []);

  // Determine active source:
  // If hardware is supported AND user hasn't explicitly set to 'manual', use hardware.
  const useHardware = hardwareBattery.isSupported && manualSettings.batteryMode !== 'manual';

  const activeLevel = useHardware ? hardwareBattery.level : manualSettings.manualBatteryLevel;
  const activeCharging = useHardware ? hardwareBattery.isCharging : manualSettings.manualIsCharging;
  const isLow = activeLevel <= 20 && !activeCharging;

  return {
    level: activeLevel,
    isCharging: activeCharging,
    isSupported: hardwareBattery.isSupported,
    isBlockedByOS,
    source: useHardware ? 'hardware' : 'manual',
    isLow,
  };
}
