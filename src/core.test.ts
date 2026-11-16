import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { YunflowDB, createPlace, deleteMemory, deletePlace, saveMemory, updatePlace } from './db';
import { exportBackup, parseBackup, restoreBackup } from './backup';
import { markerMinZoom, memoryCount, searchRecords, sortMemories } from './model';
import { preparePhoto } from './photos';
import { photoId } from './photoData';

let database: YunflowDB;
beforeEach(() => { database = new YunflowDB(`test-${crypto.randomUUID()}`); });
afterEach(async () => { await database.delete(); });
describe('地点与记忆', () => {
  it('无坐标地点和关联记忆可通过备份迁移', async () => {
    const place = await createPlace({ name: '故乡', description: '', lng: null, lat: null }, database);
    const memory = await saveMemory({ placeId: place.id, title: '', body: '雨后的院子', eventDate: '2024-09-01' }, database);
    const backup = JSON.stringify(await exportBackup(database));
    await deletePlace(place.id, database);
    await restoreBackup(backup, database);
    expect(await database.places.get(place.id)).toEqual(place);
    expect(await database.memories.get(memory.id)).toEqual(memory);
    await expect(updatePlace(place.id, { lng: 120 }, database)).rejects.toThrow();
  });
  it('在任意坐标创建地点，并保存三个独立日期的记忆', async () => {
    const p=await createPlace({ name:'鉴湖',description:'湖边',lng:114.365,lat:30.536 },database);
    for(const date of ['2024-01-01','2024-05-01','2025-03-01']) await saveMemory({placeId:p.id,title:'',body:`那天 ${date}`,eventDate:date},database);
    const all=await database.memories.toArray();
    expect(memoryCount(p.id,all)).toBe(3);
    expect(sortMemories(all).map(m=>m.eventDate)).toEqual(['2025-03-01','2024-05-01','2024-01-01']);
    expect(searchRecords('鉴湖',[p],all)).toHaveLength(1);
    expect(searchRecords('2024-05',[p],all)).toHaveLength(1);
    await deleteMemory(all[0].id,database);
    expect(memoryCount(p.id,await database.memories.toArray())).toBe(2);
    await updatePlace(p.id,{name:'新鉴湖'},database);
    expect((await database.places.get(p.id))?.name).toBe('新鉴湖');
  });
  it('删除地点时同时清理关联记忆', async () => {
    const p=await createPlace({name:'树',description:'',lng:114.3,lat:30.5},database);
    await saveMemory({placeId:p.id,title:'',body:'一段回忆',eventDate:'2024-04-02'},database);
    await deletePlace(p.id,database);
    expect(await database.memories.count()).toBe(0);
  });
  it('关闭并重新打开数据库后仍保留地点和记忆', async () => {
    const name=database.name;
    const p=await createPlace({name:'樟树',description:'门前',lng:114.35,lat:30.54},database);
    await saveMemory({placeId:p.id,title:'秋天',body:'树下的风',eventDate:'2024-10-10'},database);
    database.close();
    database=new YunflowDB(name);
    expect((await database.places.get(p.id))?.name).toBe('樟树');
    expect((await database.memories.where('placeId').equals(p.id).toArray())[0]?.body).toBe('树下的风');
  });
  it('导出、恢复并拒绝破坏性无效数据', async () => {
    const p=await createPlace({name:'长椅',description:'南侧',lng:114.3,lat:30.5},database);
    await saveMemory({placeId:p.id,title:'下午',body:'阳光很好',eventDate:'2023-09-02'},database);
    const json=JSON.stringify(await exportBackup(database));
    await database.places.clear();await database.memories.clear();
    await restoreBackup(json,database);
    expect(await database.places.count()).toBe(1);
    expect(await database.memories.count()).toBe(1);
    const broken=JSON.parse(json);broken.memories[0].placeId='missing';
    expect(()=>parseBackup(JSON.stringify(broken))).toThrow();
    await expect(restoreBackup(JSON.stringify(broken),database)).rejects.toThrow();
    expect(await database.places.count()).toBe(1);
    expect(await database.memories.count()).toBe(1);
  });
  it('分别保存地点的标记颜色和可见层级', async () => {
    const p=await createPlace({name:'马克思主义学院',description:'',lng:114.36,lat:30.54,sourcePoiId:'poi-1',symbol:'★',color:'#477ba3',minZoom:16},database);
    expect(markerMinZoom(p)).toBe(16);
    await updatePlace(p.id,{color:'#af667d',minZoom:15},database);
    const updated=(await database.places.get(p.id))!;
    expect(updated.color).toBe('#af667d');
    expect(markerMinZoom(updated)).toBe(15);
    const backup=JSON.stringify(await exportBackup(database));
    expect(parseBackup(backup).places[0].minZoom).toBe(15);
    const broken=JSON.parse(backup);broken.places[0].color='red; background:url(x)';
    expect(()=>parseBackup(JSON.stringify(broken))).toThrow();
  });
  it('图片记忆可保存、备份，并拒绝非法图片数据',async()=>{
    const place=await createPlace({name:'樟树',description:'',lng:114.3,lat:30.5},database);
    const image='data:image/jpeg;base64,'+'A'.repeat(100);
    const memory=await saveMemory({placeId:place.id,title:'照片',body:'',images:[image],eventDate:'2024-09-01'},database);
    expect((await database.memories.get(memory.id))?.images).toEqual([image]);
    const backup=JSON.stringify(await exportBackup(database));
    expect(parseBackup(backup).memories[0].images).toEqual([image]);
    const broken=JSON.parse(backup);broken.memories[0].images=['data:image/svg+xml,<svg/>'];
    expect(()=>parseBackup(JSON.stringify(broken))).toThrow();
  });
  it('九张原图独立保存，备份恢复后字节保持一致',async()=>{
    const place=await createPlace({name:'湖边',description:'',lng:114.3,lat:30.5},database);
    const original=new Uint8Array([0,1,2,255,130]);
    const images:string[]=[];
    for(let i=0;i<9;i++)images.push(await preparePhoto(new File([original],`photo-${i}.png`,{type:'image/png'}),database));
    const memory=await saveMemory({placeId:place.id,title:'原图',body:'',images,eventDate:'2024-09-01'},database);
    expect(memory.images).toHaveLength(9);
    const first=await database.attachments.get(photoId(images[0])!);
    expect(new Uint8Array(await first!.blob.arrayBuffer())).toEqual(original);
    const backup=JSON.stringify(await exportBackup(database));
    expect(parseBackup(backup).version).toBe(2);
    await database.attachments.clear();await database.memories.clear();await database.places.clear();
    await restoreBackup(backup,database);
    const restored=await database.attachments.get(photoId(images[0])!);
    expect(new Uint8Array(await restored!.blob.arrayBuffer())).toEqual(original);
    expect((await database.memories.get(memory.id))?.images).toEqual(images);
    await expect(saveMemory({placeId:place.id,title:'过多',body:'',images:[...images,images[0]],eventDate:'2024-09-01'},database)).rejects.toThrow('最多 9 张');
  });
});
