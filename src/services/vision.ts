import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import * as blazeface from '@tensorflow-models/blazeface';
import { FaceDetectionResult } from '../types';

let model: blazeface.BlazeFaceModel | null = null;
let modelLoading = false;
let tfReady = false;

async function initModel(): Promise<blazeface.BlazeFaceModel | null> {
  if (model) return model;
  if (modelLoading) return null;

  modelLoading = true;
  try {
    if (!tfReady) {
      await tf.ready();
      tfReady = true;
    }
    model = await blazeface.load({ maxFaces: 3 });
    console.log('[Memore Vision] BlazeFace model loaded successfully');
    return model;
  } catch (err) {
    console.warn('[Memore Vision] BlazeFace load failed, fallback will be used:', err);
    return null;
  } finally {
    modelLoading = false;
  }
}

// Kick off loading in background
initModel();

// Fallback FaceDetector definition for TypeScript
declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
      detect(image: ImageBitmapSource): Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
    };
  }
}

let nativeFaceDetector: InstanceType<NonNullable<typeof window.FaceDetector>> | null = null;
if (typeof window !== 'undefined' && 'FaceDetector' in window && window.FaceDetector) {
  try {
    nativeFaceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
  } catch {
    nativeFaceDetector = null;
  }
}

// Fallback canvas for pixel-based skin/contrast presence detection if ML models fail
let fallbackCanvas: HTMLCanvasElement | null = null;
let fallbackCtx: CanvasRenderingContext2D | null = null;

function detectFallbackFace(video: HTMLVideoElement, threshold: number): FaceDetectionResult {
  if (!fallbackCanvas) {
    fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = 160;
    fallbackCanvas.height = 284;
    fallbackCtx = fallbackCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (!fallbackCtx) {
    return { detected: false, meetsThreshold: false, faceHeightRatio: 0 };
  }

  const w = fallbackCanvas.width;
  const h = fallbackCanvas.height;
  fallbackCtx.drawImage(video, 0, 0, w, h);
  const frame = fallbackCtx.getImageData(0, 0, w, h);
  const data = frame.data;

  // Scan center quadrant for human skin tones (YCbCr / HSV approx in RGB)
  let skinPixels = 0;
  let minY = h, maxY = 0;
  let minX = w, maxX = 0;

  for (let y = Math.floor(h * 0.15); y < Math.floor(h * 0.85); y += 4) {
    for (let x = Math.floor(w * 0.15); x < Math.floor(w * 0.85); x += 4) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Universal skin-tone heuristic
      if (r > 60 && g > 40 && b > 20 && r > b && (r - g) > 10 && Math.abs(r - g) < 140) {
        skinPixels++;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }

  const totalSampled = ((h * 0.7) / 4) * ((w * 0.7) / 4);
  const skinRatio = skinPixels / totalSampled;

  if (skinRatio > 0.22 && maxY > minY) {
    const faceHeight = maxY - minY;
    const ratio = faceHeight / h;
    return {
      detected: true,
      meetsThreshold: ratio >= threshold,
      faceHeightRatio: Math.min(1, ratio),
      box: {
        x: (minX / w) * video.videoWidth,
        y: (minY / h) * video.videoHeight,
        width: ((maxX - minX) / w) * video.videoWidth,
        height: (faceHeight / h) * video.videoHeight,
      },
    };
  }

  return { detected: false, meetsThreshold: false, faceHeightRatio: 0 };
}

export async function detectFace(
  video: HTMLVideoElement | null,
  threshold: number = 0.20
): Promise<FaceDetectionResult> {
  if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return { detected: false, meetsThreshold: false, faceHeightRatio: 0 };
  }

  const videoH = video.videoHeight;

  // 1. Try BlazeFace model
  try {
    const activeModel = model || (await initModel());
    if (activeModel) {
      const returnTensors = false;
      const predictions = await activeModel.estimateFaces(video, returnTensors);

      if (predictions && predictions.length > 0) {
        // Find largest face
        let maxFaceHeightRatio = 0;
        let bestBox: { x: number; y: number; width: number; height: number } | undefined;

        for (const pred of predictions) {
          const start = pred.topLeft as [number, number];
          const end = pred.bottomRight as [number, number];
          const width = end[0] - start[0];
          const height = end[1] - start[1];
          const ratio = height / videoH;

          if (ratio > maxFaceHeightRatio) {
            maxFaceHeightRatio = ratio;
            bestBox = {
              x: start[0],
              y: start[1],
              width,
              height,
            };
          }
        }

        return {
          detected: true,
          meetsThreshold: maxFaceHeightRatio >= threshold,
          faceHeightRatio: maxFaceHeightRatio,
          box: bestBox,
        };
      } else {
        return { detected: false, meetsThreshold: false, faceHeightRatio: 0 };
      }
    }
  } catch (err) {
    console.debug('[Memore Vision] BlazeFace inference fallback:', err);
  }

  // 2. Try Native FaceDetector API if available
  if (nativeFaceDetector) {
    try {
      const faces = await nativeFaceDetector.detect(video);
      if (faces && faces.length > 0) {
        let maxRatio = 0;
        let bestBox: { x: number; y: number; width: number; height: number } | undefined;

        for (const f of faces) {
          const box = f.boundingBox;
          const ratio = box.height / videoH;
          if (ratio > maxRatio) {
            maxRatio = ratio;
            bestBox = {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
            };
          }
        }

        return {
          detected: true,
          meetsThreshold: maxRatio >= threshold,
          faceHeightRatio: maxRatio,
          box: bestBox,
        };
      }
      return { detected: false, meetsThreshold: false, faceHeightRatio: 0 };
    } catch {
      // ignore and continue to heuristic
    }
  }

  // 3. Robust skin-tone pixel centroid fallback
  return detectFallbackFace(video, threshold);
}
