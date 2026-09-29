import { VideoRecord, StorageStats } from '../types';

const DB_NAME = 'memore_guestbook_db';
const DB_VERSION = 1;
const STORE_RECORDINGS = 'recordings';
const STORE_RECOVERY = 'crash_recovery';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_RECORDINGS)) {
        const store = db.createObjectStore(STORE_RECORDINGS, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_RECOVERY)) {
        db.createObjectStore(STORE_RECOVERY, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveRecording(record: VideoRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDINGS, 'readwrite');
    const store = tx.objectStore(STORE_RECORDINGS);
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllRecordings(): Promise<VideoRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDINGS, 'readonly');
    const store = tx.objectStore(STORE_RECORDINGS);
    const request = store.getAll();
    request.onsuccess = () => {
      const records = (request.result as VideoRecord[]) || [];
      // Sort newest first
      records.sort((a, b) => b.timestamp - a.timestamp);
      resolve(records);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDINGS, 'readwrite');
    const store = tx.objectStore(STORE_RECORDINGS);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllRecordings(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_RECORDINGS, STORE_RECOVERY], 'readwrite');
    tx.objectStore(STORE_RECORDINGS).clear();
    tx.objectStore(STORE_RECOVERY).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Disaster recovery: Save active chunk live
export async function saveRecoverySession(sessionData: {
  id: string;
  chunks: Blob[];
  startedAt: number;
}): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_RECOVERY, 'readwrite');
    tx.objectStore(STORE_RECOVERY).put(sessionData);
  } catch (err) {
    console.warn('Failed to save recovery session:', err);
  }
}

export async function getRecoverySession(): Promise<{
  id: string;
  chunks: Blob[];
  startedAt: number;
} | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_RECOVERY, 'readonly');
      const request = tx.objectStore(STORE_RECOVERY).getAll();
      request.onsuccess = () => {
        const results = request.result;
        if (results && results.length > 0) {
          resolve(results[0]);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function clearRecoverySession(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_RECOVERY, 'readwrite');
    tx.objectStore(STORE_RECOVERY).clear();
  } catch {
    // ignore
  }
}

// Storage API estimate
export async function getStorageStats(): Promise<StorageStats> {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const total = estimate.quota || 32 * 1024 * 1024 * 1024; // fallback 32GB iPad
      const percent = Math.min(100, Math.round((used / total) * 100));
      return {
        usedBytes: used,
        totalBytes: total,
        percentUsed: percent,
        isCritical: percent >= 85,
      };
    } catch (e) {
      console.warn('Storage estimate error:', e);
    }
  }
  return {
    usedBytes: 0,
    totalBytes: 32 * 1024 * 1024 * 1024,
    percentUsed: 0,
    isCritical: false,
  };
}

// Generate thumbnail from video Blob (resilient and non-blocking)
export function generateVideoThumbnail(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (result: string, urlToRevoke?: string) => {
      if (resolved) return;
      resolved = true;
      if (urlToRevoke) {
        try {
          URL.revokeObjectURL(urlToRevoke);
        } catch {
          // ignore
        }
      }
      resolve(result);
    };

    // Strict safety timeout so saving never hangs
    const timer = setTimeout(() => {
      finish('');
    }, 400);

    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      const url = URL.createObjectURL(blob);
      video.src = url;

      video.onloadeddata = () => {
        try {
          // MediaRecorder output often has NaN or Infinity duration
          const targetTime = Number.isFinite(video.duration) && video.duration > 0
            ? Math.min(1, video.duration / 2)
            : 0.1;
          video.currentTime = targetTime;
        } catch {
          finish('', url);
        }
      };

      video.onseeked = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 180;
          canvas.height = 320;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            finish(dataUrl, url);
            return;
          }
        } catch {
          // ignore
        }
        finish('', url);
      };

      video.onerror = () => {
        clearTimeout(timer);
        finish('', url);
      };
    } catch {
      clearTimeout(timer);
      finish('');
    }
  });
}
