import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { api } from './api';
import type { ImageDto } from './types';

/**
 * Resize (max 1600px wide) and re-encode as JPEG before upload: keeps uploads small on mobile data and turns
 * iPhone HEIC photos into a format every server path accepts.
 */
export async function uploadPhoto(uri: string, width?: number | null): Promise<ImageDto> {
  const ctx = ImageManipulator.manipulate(uri);
  if (width && width > 1600) ctx.resize({ width: 1600, height: null });
  const out = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });

  const fd = new FormData();
  if (Platform.OS === 'web') fd.append('file', await (await fetch(out.uri)).blob(), 'photo.jpg');
  else fd.append('file', { uri: out.uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob); // React Native file part
  return api<ImageDto>('/media/images', { method: 'POST', body: fd });
}
