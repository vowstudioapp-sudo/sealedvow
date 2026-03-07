import { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { CoupleData, MemoryPhoto } from '../types';

// ── API Upload Helper ──
// Converts File to base64 data URI and POSTs to /api/upload-media.
// Returns the public URL of the uploaded file.

async function fileToDataUri(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function uploadToApi(
  sessionId: string,
  file: File | Blob,
  type: 'cover' | 'memory' | 'video' | 'audio',
  index?: number
): Promise<string> {
  const dataUri = await fileToDataUri(file);

  const response = await fetch('/api/upload-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      file: dataUri,
      type,
      ...(index !== undefined && { index }),
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Upload failed');
  }

  const result = await response.json();
  return result.url;
}

/**
 * useMediaUploads
 *
 * Handles all media uploads via /api/upload-media:
 * - Cover image
 * - User video
 * - Memory board photos
 *
 * Rules:
 * - Uploads go through server-side API (not direct to Firebase)
 * - Client compresses images before upload
 * - Atomic uploads (all-or-nothing for memory board)
 */

const LIMITS = {
  IMAGE_MB: 10,
  MEMORY_IMAGE_MB: 15,
  VIDEO_MB: 10,
  MEMORY_MAX: 10,
} as const;

const MB = 1024 * 1024;

interface UseMediaUploadsParams {
  sessionId: string | null | undefined;
  currentMemoryCount: () => number;
  updateData: (
    patch:
      | Partial<CoupleData>
      | ((prev: CoupleData) => Partial<CoupleData>)
  ) => void;
  onError: (message: string) => void;
}

export function useMediaUploads({
  sessionId,
  currentMemoryCount,
  updateData,
  onError,
}: UseMediaUploadsParams) {
  // ---------------------------------------------------------------------------
  // LOADING STATES
  // ---------------------------------------------------------------------------

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingMemories, setIsUploadingMemories] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  const ensureSession = () => {
    if (!sessionId) {
      throw new Error('Upload session not initialized. Please refresh.');
    }
    return sessionId;
  };

  const validateFileSize = (file: File | Blob, maxMB: number, label: string) => {
    if (file.size > maxMB * MB) {
      throw new Error(`${label} must be under ${maxMB}MB`);
    }
  };

  // ---------------------------------------------------------------------------
  // COVER IMAGE
  // ---------------------------------------------------------------------------

  const uploadCoverImage = async (file: File) => {
    setIsUploadingImage(true);
    setUploadProgress(0);

    try {
      const sid = ensureSession();
      validateFileSize(file, LIMITS.IMAGE_MB, 'Image');

      setUploadProgress(20);
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        preserveExif: false,
      });

      setUploadProgress(60);
      const url = await uploadToApi(sid, compressed, 'cover');
      setUploadProgress(100);
      updateData({ userImageUrl: url });
    } catch (err: any) {
      onError(err.message || 'Image upload failed');
    } finally {
      setIsUploadingImage(false);
      setUploadProgress(0);
    }
  };

  const removeCoverImage = () => {
    updateData({ userImageUrl: undefined });
  };

  // ---------------------------------------------------------------------------
  // VIDEO
  // ---------------------------------------------------------------------------

  const uploadVideo = async (file: File) => {
    setIsUploadingVideo(true);

    try {
      const sid = ensureSession();
      validateFileSize(file, LIMITS.VIDEO_MB, 'Video');

      const url = await uploadToApi(sid, file, 'video');
      updateData({ video: { url, source: 'user' } });
    } catch (err: any) {
      onError(err.message || 'Video upload failed');
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const removeVideo = () => {
    updateData({ video: undefined });
  };

  // ---------------------------------------------------------------------------
  // MEMORY BOARD
  // ---------------------------------------------------------------------------
  /**
   * NOTE:
   * Memory board uploads are ATOMIC per batch.
   * New photos are APPENDED to existing board.
   * Total cap: MEMORY_MAX (10).
   */
  const uploadMemoryBoard = async (files: File[]) => {
    if (files.length === 0) return;

    // Check total cap against existing + new
    const existingCount = currentMemoryCount();
    const total = existingCount + files.length;

    if (total > LIMITS.MEMORY_MAX) {
      const remaining = LIMITS.MEMORY_MAX - existingCount;
      onError(remaining > 0
        ? `You can add ${remaining} more photo${remaining === 1 ? '' : 's'}. You selected ${files.length}.`
        : `Memory board is full (${LIMITS.MEMORY_MAX} photos maximum).`
      );
      return;
    }

    setIsUploadingMemories(true);
    setUploadProgress(0);

    try {
      const sid = ensureSession();

      // Compress images: strip EXIF, resize, reduce size
      const compressedFiles: File[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        validateFileSize(file, LIMITS.MEMORY_IMAGE_MB, 'Photo');

        const compressed = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
          preserveExif: false,
        });

        compressedFiles.push(compressed as File);
        setUploadProgress(Math.round(((i + 1) / files.length) * 50));
      }

      // Upload each compressed file
      const urls: string[] = [];
      for (let i = 0; i < compressedFiles.length; i++) {
        const url = await uploadToApi(sid, compressedFiles[i], 'memory', existingCount + i);
        urls.push(url);
        setUploadProgress(50 + Math.round(((i + 1) / compressedFiles.length) * 50));
      }

      const newPhotos: MemoryPhoto[] = urls.map(url => ({
        url,
        caption: '',
        angle: Math.random() * 20 - 10,
        xOffset: Math.random() * 40 - 20,
        yOffset: Math.random() * 40 - 20,
      }));

      updateData(prev => ({
        memoryBoard: [...(prev.memoryBoard ?? []), ...newPhotos],
      }));
    } catch (err: any) {
      onError(err.message || 'Memory board upload failed');
    } finally {
      setIsUploadingMemories(false);
      setUploadProgress(0);
    }
  };

  const removeMemoryPhoto = (index: number) => {
    updateData(prev => ({
      memoryBoard: prev.memoryBoard?.filter((_, i) => i !== index) || []
    }));
  };

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  return {
    // Image
    uploadCoverImage,
    removeCoverImage,
    isUploadingImage,

    // Video
    uploadVideo,
    removeVideo,
    isUploadingVideo,

    // Memory board
    uploadMemoryBoard,
    removeMemoryPhoto,
    isUploadingMemories,

    // Progress
    uploadProgress,

    // Limits (for UI display only)
    LIMITS,
  };
}
