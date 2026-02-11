/**
 * Firebase Storage Service
 * Clean, secure, production-ready
 */

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SIZE_LIMITS = {
  IMAGE: 5 * 1024 * 1024,   // 5MB
  VIDEO: 10 * 1024 * 1024,  // 10MB
  AUDIO: 2 * 1024 * 1024,   // 2MB
} as const;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav'];

// ============================================================================
// RATE LIMITING (Client-side UX only)
// ============================================================================

const lastUploadAt = new Map<string, number>();

function rateLimit(key: string, ms = 60_000): void {
  const now = Date.now();
  const last = lastUploadAt.get(key);
  
  if (last && now - last < ms) {
    throw new Error('Please wait a moment before trying again.');
  }
  
  lastUploadAt.set(key, now);
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateFile(
  file: Blob,
  allowedTypes: string[],
  maxSize: number,
  label: string
): void {
  const fileType = (file as File).type || '';
  
  if (!allowedTypes.includes(fileType)) {
    throw new Error(`Invalid ${label} format. Allowed: ${allowedTypes.join(', ')}`);
  }

  if (file.size > maxSize) {
    const maxMB = Math.floor(maxSize / 1024 / 1024);
    throw new Error(`${label} must be under ${maxMB}MB`);
  }
}

// ============================================================================
// PATH HELPER
// ============================================================================

function storagePath(sessionId: string, subPath: string): string {
  return `sessions/${sessionId}/${subPath}`;
}

// ============================================================================
// CORE UPLOAD HELPER
// ============================================================================

async function uploadFile(
  fullPath: string,
  file: Blob,
  metadata?: Record<string, string>
): Promise<string> {
  const fileRef = ref(storage, fullPath);
  const fileType = (file as File).type || 'application/octet-stream';

  try {
    await uploadBytes(fileRef, file, {
      contentType: fileType,
      customMetadata: metadata,
    });

    return await getDownloadURL(fileRef);
    
  } catch (error: any) {
    // Firebase-specific errors with helpful messages
    if (error.code === 'storage/unauthorized') {
      throw new Error('Upload failed: Permission denied. Please check storage rules.');
    }
    if (error.code === 'storage/canceled') {
      throw new Error('Upload was cancelled.');
    }
    if (error.code === 'storage/quota-exceeded') {
      throw new Error('Storage quota exceeded. Please contact support.');
    }
    if (error.code === 'storage/retry-limit-exceeded') {
      throw new Error('Upload failed after multiple retries. Check your connection.');
    }
    
    // Generic fallback
    throw new Error('Upload failed. Please try again.');
  }
}

// ============================================================================
// PUBLIC UPLOAD FUNCTIONS
// ============================================================================

export async function uploadUserImage(
  sessionId: string,
  file: File
): Promise<string> {
  rateLimit(`${sessionId}-image`);
  validateFile(file, IMAGE_TYPES, SIZE_LIMITS.IMAGE, 'Image');

  return uploadFile(
    storagePath(sessionId, 'images/user-photo.jpg'),
    file,
    { uploadedAt: new Date().toISOString() }
  );
}

export async function uploadAIImage(
  sessionId: string,
  blob: Blob
): Promise<string> {
  rateLimit(`${sessionId}-ai-image`);
  validateFile(blob, IMAGE_TYPES, SIZE_LIMITS.IMAGE, 'AI Image');

  return uploadFile(
    storagePath(sessionId, 'images/ai-generated.jpg'),
    blob,
    {
      source: 'ai',
      uploadedAt: new Date().toISOString(),
    }
  );
}

export async function uploadVoiceRecording(
  sessionId: string,
  blob: Blob
): Promise<string> {
  rateLimit(`${sessionId}-audio`);
  validateFile(blob, AUDIO_TYPES, SIZE_LIMITS.AUDIO, 'Audio');

  return uploadFile(
    storagePath(sessionId, 'audio/voice-recording.webm'),
    blob,
    { uploadedAt: new Date().toISOString() }
  );
}

export async function uploadUserVideo(
  sessionId: string,
  file: File
): Promise<string> {
  rateLimit(`${sessionId}-video`);
  validateFile(file, VIDEO_TYPES, SIZE_LIMITS.VIDEO, 'Video');

  const ext = file.name.split('.').pop() || 'mp4';

  return uploadFile(
    storagePath(sessionId, `video/user-video.${ext}`),
    file,
    { uploadedAt: new Date().toISOString() }
  );
}

export async function uploadMemoryPhoto(
  sessionId: string,
  file: File,
  index: number
): Promise<string> {
  if (index < 1 || index > 10) {
    throw new Error('Memory photo index must be between 1 and 10.');
  }

  rateLimit(`${sessionId}-memory-${index}`);
  validateFile(file, IMAGE_TYPES, SIZE_LIMITS.IMAGE, 'Photo');

  const ext = file.name.split('.').pop() || 'jpg';

  return uploadFile(
    storagePath(sessionId, `memory-board/photo-${index}.${ext}`),
    file,
    {
      index: index.toString(),
      uploadedAt: new Date().toISOString(),
    }
  );
}

// ============================================================================
// BATCH UPLOAD
// ============================================================================

export async function uploadMemoryPhotos(
  sessionId: string,
  files: File[]
): Promise<string[]> {
  if (files.length === 0 || files.length > 10) {
    throw new Error('Please select between 1 and 10 photos.');
  }

  const urls: string[] = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const url = await uploadMemoryPhoto(sessionId, files[i], i + 1);
      urls.push(url);
    }
    return urls;
  } catch (error) {
    // Best-effort rollback
    for (let i = 0; i < urls.length; i++) {
      await deleteByPath(
        storagePath(sessionId, `memory-board/photo-${i + 1}.jpg`)
      ).catch(() => {});
    }
    throw error;
  }
}

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================

export async function deleteByPath(fullPath: string): Promise<void> {
  try {
    await deleteObject(ref(storage, fullPath));
  } catch (error: any) {
    if (error.code === 'storage/object-not-found') {
      // Already deleted, that's fine
      return;
    }
    throw new Error('Failed to delete file.');
  }
}

export async function deleteByUrl(url: string): Promise<void> {
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch (error: any) {
    if (error.code === 'storage/object-not-found') {
      return;
    }
    throw new Error('Failed to delete file.');
  }
}

// ============================================================================
// UTILITY
// ============================================================================

export function clearRateLimits(): void {
  if (process.env.NODE_ENV === 'development') {
    lastUploadAt.clear();
  }
}