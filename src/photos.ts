import { db, type YunflowDB } from './db';
import { imageMime, MAX_PHOTO_BYTES, photoRef } from './photoData';

export async function preparePhoto(file: File, database: YunflowDB = db): Promise<string> {
  if (!imageMime(file.type)) throw new Error('请选择 JPG、PNG、WebP、GIF、AVIF 或 HEIC 图片');
  if (file.size > MAX_PHOTO_BYTES) throw new Error('单张原图请勿超过 50 MB');
  const id = crypto.randomUUID();
  await database.attachments.put({ id, blob: file, uploaded: false });
  return photoRef(id);
}
