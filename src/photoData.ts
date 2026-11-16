export const MAX_PHOTOS = 9;
export const MAX_PHOTO_BYTES = 50 * 1024 * 1024;
export const photoRef = (id: string) => `photo:${id}`;
export const photoId = (value: string) => /^photo:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value.slice(6) : null;
export const imageMime = (value: string) => /^image\/(jpeg|png|webp|gif|avif|heic|heif)$/i.test(value);
export const legacyImage = (value: string) => /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length <= 300000;
export const validMemoryImage = (value: unknown) => typeof value === 'string' && (photoId(value) !== null || legacyImage(value));

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let result = '';
  for (let i = 0; i < bytes.length; i += 8190) result += btoa(String.fromCharCode(...bytes.subarray(i, i + 8190)));
  return result;
}
export function base64ToBlob(data: string, type: string): Blob {
  const parts: ArrayBuffer[] = [];
  for (let i = 0; i < data.length; i += 8192) parts.push(Uint8Array.from(atob(data.slice(i, i + 8192)), char => char.charCodeAt(0)).buffer as ArrayBuffer);
  return new Blob(parts, { type });
}
