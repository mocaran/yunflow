import { db, validPlaceCoordinates, validDate, validMarkerColor, validMarkerZoom, type YunflowDB } from './db';
import type { Memory, Place } from './model';
import { base64ToBlob, blobToBase64, imageMime, MAX_PHOTO_BYTES, MAX_PHOTOS, photoId, validMemoryImage } from './photoData';

export type BackupPhoto = { id:string; type:string; data:string };
export type Backup = { format: 'yunflow-backup'; version: 1|2; exportedAt: string; places: Place[]; memories: Memory[]; attachments?: BackupPhoto[] };
const record = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (x: unknown): x is string => typeof x === 'string';
const timestamp = (x: unknown) => str(x) && !Number.isNaN(Date.parse(x));
function placeOk(x: unknown): x is Place { return record(x) && str(x.id) && !!x.id && str(x.name) && !!x.name.trim() && str(x.description) && (typeof x.lng === 'number' || x.lng === null) && (typeof x.lat === 'number' || x.lat === null) && validPlaceCoordinates(x.lng,x.lat) && x.coordinateSystem === 'GCJ-02' && (x.color===undefined||(str(x.color)&&validMarkerColor(x.color))) && (x.minZoom===undefined||(typeof x.minZoom==='number'&&validMarkerZoom(x.minZoom))) && timestamp(x.createdAt) && timestamp(x.updatedAt); }
function memoryOk(x: unknown): x is Memory { return record(x) && str(x.id) && !!x.id && str(x.placeId) && !!x.placeId && str(x.title) && str(x.body) && (!!x.body.trim()||(Array.isArray(x.images)&&x.images.length>0)) && (x.images===undefined||(Array.isArray(x.images)&&x.images.length<=MAX_PHOTOS&&x.images.every(validMemoryImage))) && str(x.eventDate) && validDate(x.eventDate) && timestamp(x.createdAt) && timestamp(x.updatedAt); }
function photoOk(x:unknown):x is BackupPhoto{return record(x)&&str(x.id)&&photoId(`photo:${x.id}`)!==null&&str(x.type)&&imageMime(x.type)&&str(x.data)&&x.data.length<=Math.ceil(MAX_PHOTO_BYTES/3)*4+4&&/^[A-Za-z0-9+/]*={0,2}$/.test(x.data);}
export function parseBackup(raw: string): Backup {
  let input: unknown; try { input = JSON.parse(raw); } catch { throw new Error('JSON 格式无效'); }
  if (!record(input) || input.format !== 'yunflow-backup' || ![1,2].includes(Number(input.version)) || !timestamp(input.exportedAt) || !Array.isArray(input.places) || !Array.isArray(input.memories)) throw new Error('不是受支持的云流备份文件');
  if (!input.places.every(placeOk) || !input.memories.every(memoryOk)) throw new Error('备份中的地点或记忆数据无效');
  const places = input.places as Place[], memories = input.memories as Memory[];
  const pids = new Set(places.map(p => p.id)), mids = new Set(memories.map(m => m.id));
  if (pids.size !== places.length || mids.size !== memories.length || memories.some(m => !pids.has(m.placeId))) throw new Error('备份中存在重复 ID 或孤立记忆');
  const attachments=input.attachments;
  if(input.version===2){
    if(!Array.isArray(attachments)||!attachments.every(photoOk))throw new Error('备份中的图片附件无效');
    const ids=new Set(attachments.map(p=>p.id));
    if(ids.size!==attachments.length||memories.some(m=>m.images?.some(src=>{const id=photoId(src);return id!==null&&!ids.has(id);})))throw new Error('备份中缺少图片附件');
  }else if(memories.some(m=>m.images?.some(src=>photoId(src)!==null)))throw new Error('旧版备份不支持图片附件引用');
  return input as Backup;
}
export async function exportBackup(database: YunflowDB = db): Promise<Backup> {
  const [places,memories]=await Promise.all([database.places.toArray(),database.memories.toArray()]);
  const ids=new Set(memories.flatMap(m=>(m.images??[]).map(photoId).filter((id):id is string=>id!==null)));
  const attachments:BackupPhoto[]=[];
  for(const id of ids){const attachment=await database.attachments.get(id);if(!attachment)throw new Error('有图片附件未保存在本机，无法完整导出');attachments.push({id,type:attachment.blob.type,data:await blobToBase64(attachment.blob)});}
  return {format:'yunflow-backup',version:2,exportedAt:new Date().toISOString(),places,memories,attachments};
}
export async function restoreBackup(raw: string, database: YunflowDB = db) {
  const backup = parseBackup(raw);
  const attachments=(backup.attachments??[]).map(photo=>({id:photo.id,blob:base64ToBlob(photo.data,photo.type),uploaded:false}));
  await database.transaction('rw', database.places, database.memories, database.tombstones, database.attachments, async () => {
    await database.memories.clear(); await database.places.clear(); await database.tombstones.clear();await database.attachments.clear();
    await database.places.bulkAdd(backup.places); await database.memories.bulkAdd(backup.memories);
    if(attachments.length)await database.attachments.bulkAdd(attachments);
  });
  if (database.name.startsWith('yunflow-user-')&&!database.name.startsWith('yunflow-user-local-')) localStorage.setItem(`yunflow-pending-restore-${database.name}`, '1');
  return { places: backup.places.length, memories: backup.memories.length };
}
