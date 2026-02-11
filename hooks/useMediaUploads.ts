import { useState } from 'react';
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
  MEMORY_MIN: 5,
  MEMORY_MAX: 10,
} as const;

const MB = 1024 * 1024;

interface UseMediaUploadsParams {
  sessionId: string | null | undefined;
  updateData: (
    patch:
      | Partial<CoupleData>
      | ((prev: CoupleData) => Partial<CoupleData>)
  ) => void;
  onError: (message: string) => void;
}

export function useMediaUploads({
  sessionId,
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

      const url = await uploadUserImage(sid, file);
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
   * Memory board uploads are ATOMIC by design.
   * If any file fails, the entire upload fails.
   * This is intentional for UX consistency.
   */
  const uploadMemoryBoard = async (files: File[]) => {
    console.log('[DEBUG] uploadMemoryBoard called');
    console.log(`[DEBUG] sessionId: ${sessionId}`);
    console.log(`[DEBUG] files.length: ${files.length}`);
    console.log(`[DEBUG] MEMORY_MIN: ${LIMITS.MEMORY_MIN} | MEMORY_MAX: ${LIMITS.MEMORY_MAX}`);

    if (files.length < LIMITS.MEMORY_MIN) {
      console.warn(`[DEBUG] REJECTED: ${files.length} files < MEMORY_MIN (${LIMITS.MEMORY_MIN})`);
      onError(`Please upload at least ${LIMITS.MEMORY_MIN} photos`);
      return;
    }

    if (files.length > LIMITS.MEMORY_MAX) {
      console.warn(`[DEBUG] REJECTED: ${files.length} files > MEMORY_MAX (${LIMITS.MEMORY_MAX})`);
      onError(`Maximum ${LIMITS.MEMORY_MAX} photos allowed`);
      return;
    }

    setIsUploadingMemories(true);

    try {
      const sid = ensureSession();
      console.log(`[DEBUG] Session confirmed: ${sid}`);

      files.forEach((file, i) => {
        console.log(`[DEBUG] Validating file ${i + 1}: ${file.name} | ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        validateFileSize(file, LIMITS.IMAGE_MB, 'Photo');
      });

      console.log('[DEBUG] All files validated. Starting Firebase upload...');
      const urls = await uploadMemoryPhotos(sid, files);
      console.log(`[DEBUG] Upload complete. ${urls.length} URLs returned.`);
      urls.forEach((url, i) => console.log(`[DEBUG]   URL ${i + 1}: ${url.substring(0, 60)}...`));

      const memoryBoard: MemoryPhoto[] = urls.map(url => ({
        url,
        caption: '',
        angle: Math.random() * 60 - 30,
        xOffset: Math.random() * 200 - 100,
        yOffset: Math.random() * 200 - 100,
      }));

      updateData({ memoryBoard });
      console.log('[DEBUG] memoryBoard state updated');
    } catch (err: any) {
      console.error('[DEBUG] uploadMemoryBoard FAILED:', err);
      console.error('[DEBUG] Error stack:', err.stack);
      onError(err.message || 'Memory board upload failed');
    } finally {
      setIsUploadingMemories(false);
      console.log('[DEBUG] uploadMemoryBoard finished');
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