import Dexie, { type Table } from 'dexie';
import { isoNow, newId, type Memory, type Place, type ViewState, WUHAN } from './model';
import { MAX_PHOTOS, photoId, validMemoryImage } from './photoData';
export type Tombstone = { id: string; kind: 'place'|'memory'; targetId: string; updatedAt: string };
export type OfflineDraft = { id: string; placeName: string; title: string; body: string; eventDate: string; createdAt: string };
export type PhotoAttachment = { id: string; blob: Blob; uploaded?: boolean };

export class YunflowDB extends Dexie {
  places!: Table<Place, string>;
  memories!: Table<Memory, string>;
  settings!: Table<ViewState, string>;
  tombstones!: Table<Tombstone, string>;
  drafts!: Table<OfflineDraft, string>;
  attachments!: Table<PhotoAttachment, string>;
  constructor(name = 'yunflow') {
    super(name);
    this.version(1).stores({ places: 'id, name, updatedAt', memories: 'id, placeId, eventDate', settings: 'id' });
    this.version(2).stores({ places: 'id, name, updatedAt', memories: 'id, placeId, eventDate', settings: 'id', tombstones: 'id, kind, targetId, updatedAt' });
    this.version(3).stores({ places: 'id, name, updatedAt', memories: 'id, placeId, eventDate', settings: 'id', tombstones: 'id, kind, targetId, updatedAt', drafts: 'id, createdAt' });
    this.version(4).stores({ places: 'id, name, updatedAt', memories: 'id, placeId, eventDate', settings: 'id', tombstones: 'id, kind, targetId, updatedAt', drafts: 'id, createdAt', attachments: 'id, uploaded' });
  }
}
export let db = new YunflowDB();
export function selectDatabase(userId: string | null) { db.close(); db = new YunflowDB(userId ? `yunflow-user-${userId}` : 'yunflow'); return db; }
export async function createPlace(input: Pick<Place, 'name'|'description'|'lng'|'lat'> & {sourcePoiId?: string;symbol?:string;color?:string;minZoom?:number}, database = db) {
  const now = isoNow(); const place: Place = { ...input, name: input.name.trim(), description: input.description.trim(), id: newId(), coordinateSystem: 'GCJ-02', createdAt: now, updatedAt: now };
  if (!place.name) throw new Error('请填写地点名称');
  if (!validPlaceCoordinates(place.lng, place.lat)) throw new Error('地点坐标无效');
  if (place.minZoom!==undefined&&!validMarkerZoom(place.minZoom)) throw new Error('标记显示层级无效');
  if (place.color!==undefined&&!validMarkerColor(place.color)) throw new Error('标记颜色无效');
  await database.places.add(place); return place;
}
export async function updatePlace(id: string, changes: Partial<Pick<Place,'name'|'description'|'lng'|'lat'|'symbol'|'color'|'minZoom'>>, database = db) {
  const prior = await database.places.get(id); if (!prior) throw new Error('地点不存在');
  const next = { ...prior, ...changes, name: (changes.name ?? prior.name).trim(), updatedAt: isoNow() };
  if (!next.name || !validPlaceCoordinates(next.lng,next.lat)) throw new Error('地点名称或坐标无效');
  if (next.minZoom!==undefined&&!validMarkerZoom(next.minZoom)) throw new Error('标记显示层级无效');
  if (next.color!==undefined&&!validMarkerColor(next.color)) throw new Error('标记颜色无效');
  await database.places.put(next); return next;
}
export async function deletePlace(id: string, database = db) { await database.transaction('rw', database.places, database.memories, database.tombstones, async () => { const now=isoNow(); const related=await database.memories.where('placeId').equals(id).toArray(); for(const memory of related) await database.tombstones.put({id:`memory:${memory.id}`,kind:'memory',targetId:memory.id,updatedAt:now}); await database.tombstones.put({id:`place:${id}`,kind:'place',targetId:id,updatedAt:now}); await database.memories.where('placeId').equals(id).delete(); await database.places.delete(id); }); await cleanupUnusedPhotos(database); }
export async function saveMemory(input: Pick<Memory,'placeId'|'title'|'body'|'eventDate'> & { id?: string; images?: string[] }, database = db) {
  if (!(await database.places.get(input.placeId))) throw new Error('所属地点不存在');
  if (!input.body.trim() && !input.images?.length) throw new Error('请填写记忆正文或添加图片');
  if(input.images && (input.images.length>MAX_PHOTOS || input.images.some(image=>!validMemoryImage(image))))throw new Error(`每条记忆最多 ${MAX_PHOTOS} 张图片`);
  if(input.images){for(const image of input.images){if(image.startsWith('photo:')&&!await database.attachments.get(image.slice(6)))throw new Error('图片附件未保存在本机');}}
  if (!validDate(input.eventDate)) throw new Error('事件日期无效');
  const prior = input.id ? await database.memories.get(input.id) : undefined;
  if (input.id && (!prior || prior.placeId !== input.placeId)) throw new Error('记忆不存在');
  const now = isoNow(); const memory: Memory = { id: prior?.id ?? newId(), placeId: input.placeId, title: input.title.trim(), body: input.body.trim(), images: input.images??prior?.images??[], eventDate: input.eventDate, createdAt: prior?.createdAt ?? now, updatedAt: now };
  await database.memories.put(memory); await cleanupUnusedPhotos(database); return memory;
}
export async function deleteMemory(id: string, database = db) { await database.transaction('rw',database.memories,database.tombstones,async()=>{await database.memories.delete(id);await database.tombstones.put({id:`memory:${id}`,kind:'memory',targetId:id,updatedAt:isoNow()});}); await cleanupUnusedPhotos(database); }
export async function cleanupUnusedPhotos(database = db){
  const memories=await database.memories.toArray();
  const used=new Set(memories.flatMap(m=>(m.images??[]).map(photoId).filter((id):id is string=>id!==null)));
  const ids=await database.attachments.toCollection().primaryKeys();
  const unused=ids.filter(id=>!used.has(id));
  if(unused.length)await database.attachments.bulkDelete(unused);
}
export function validPlaceCoordinates(lng: number | null, lat: number | null) {
  return (lng === null && lat === null) || (lng !== null && lat !== null && validCoordinates(lng, lat));
}
export function validCoordinates(lng: number, lat: number) { return Number.isFinite(lng) && Number.isFinite(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90; }
export function validMarkerZoom(zoom:number){return Number.isInteger(zoom)&&zoom>=11&&zoom<=19;}
export function validMarkerColor(color:string){return /^#[0-9a-fA-F]{6}$/.test(color);}
export function validDate(s: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(`${s}T00:00:00Z`); return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0,10) === s; }
export async function getView(database = db) { return await database.settings.get('map') ?? { id: 'map' as const, ...WUHAN }; }
export async function saveView(view: Omit<ViewState,'id'>, database = db) { await database.settings.put({ id: 'map', ...view }); }
