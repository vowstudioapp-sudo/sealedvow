import { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { CoupleData, MemoryPhoto } from '../types';
import {
  uploadUserImage,
  uploadUserVideo,
  uploadMemoryPhotos,
} from '../services/storage';

/**
 * useMediaUploads
 *
 * Handles all Firebase Storage uploads:
 * - Cover image
 * - User video
 * - Memory board photos
 *
 * Rules:
 * - NO base64
 * - NO FileReader
 * - NO UI logic
 * - Atomic uploads (all-or-nothing)
 */

const LIMITS = {
  IMAGE_MB: 5,
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

    try {
      const sid = ensureSession();
      validateFileSize(file, LIMITS.IMAGE_MB, 'Image');

      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        preserveExif: false,
      });

      const url = await uploadUserImage(sid, compressed as File);
      updateData({ userImageUrl: url });
    } catch (err: any) {
      onError(err.message || 'Image upload failed');
    } finally {
      setIsUploadingImage(false);
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

      const url = await uploadUserVideo(sid, file);
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

    try {
      const sid = ensureSession();

      // Compress images: strip EXIF, resize, reduce size
      const compressedFiles: File[] = [];
      for (const file of files) {
        validateFileSize(file, LIMITS.IMAGE_MB, 'Photo');

        const compressed = await imageCompression(file, {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
          preserveExif: false,
        });

        compressedFiles.push(compressed as File);
      }

      const urls = await uploadMemoryPhotos(sid, compressedFiles, existingCount);

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

    // Limits (for UI display only)
    LIMITS,
  };
}