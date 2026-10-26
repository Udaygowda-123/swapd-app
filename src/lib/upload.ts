import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { api, ApiError } from './api';
import { photoPart, photoSize } from './photo-file';
import type { ImageDto } from './types';

const MAX_SIDE = 1600;             // long edge in px — plenty for listings, small enough for mobile data
const MAX_BYTES = 3.5 * 1024 * 1024; // the API accepts up to 4 MB per image

/**
 * Downscale while decoding (memory-safe for 12 MP+ camera photos) and re-encode as JPEG before upload. This always
 * caps the size, whatever the picker reports, and turns iPhone HEIC photos into a format the server accepts.
 */
async function prepare(uri: string) {
  let quality = 0.8; let last: { uri: string; size: number } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await ImageManipulator.manipulate(uri, { maxWidth: MAX_SIDE, maxHeight: MAX_SIDE }).renderAsync();
    const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: quality });
    const size = await photoSize(out.uri);
    last = { uri: out.uri, size };
    if (size === 0 || size <= MAX_BYTES) break; // size unknown → let the server decide
    quality -= 0.2;
  }
  return last!;
}

export async function uploadPhoto(uri: string): Promise<ImageDto> {
  try {
    const out = await prepare(uri);
    const fd = new FormData();
    fd.append('file', await photoPart(out.uri), 'photo.jpg');
    return await api<ImageDto>('/media/images', { method: 'POST', body: fd });
  } catch (e) {
    // Shows up in the Expo dev server output, so upload problems on a phone can be diagnosed.
    console.warn('[upload] failed:', e instanceof ApiError ? `${e.status} ${e.code} ${e.message}` : String(e));
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, 'UPLOAD_FAILED', "Couldn't prepare that photo. Try a different one, or check your connection.");
  }
}

/** Best-effort delete of photos uploaded but never attached to a listing (the API caps unattached photos per user). */
export function discardPhotos(ids: string[]) {
  for (const id of ids) api(`/media/images/${id}`, { method: 'DELETE' }).catch(() => undefined);
}
