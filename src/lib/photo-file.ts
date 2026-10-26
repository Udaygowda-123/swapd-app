import { File } from 'expo-file-system';

// iOS/Android: the global fetch is Expo's WinterCG fetch, which uploads Blob/File parts — not React Native's old
// `{ uri, name, type }` objects (those fail with a network error). expo-file-system's File implements Blob.
// Web uses photo-file.web.ts.
export const photoPart = async (uri: string): Promise<Blob> => new File(uri);
export const photoSize = async (uri: string) => { try { return new File(uri).size ?? 0; } catch { return 0; } };
