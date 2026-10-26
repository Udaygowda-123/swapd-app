// Web preview: the browser's fetch/FormData handle Blobs natively. Native builds use photo-file.ts.
export const photoPart = async (uri: string): Promise<Blob> => (await fetch(uri)).blob();
export const photoSize = async (uri: string) => { try { return (await photoPart(uri)).size; } catch { return 0; } };
