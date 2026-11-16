export type Place = { id: string; name: string; description: string; lng: number | null; lat: number | null; coordinateSystem: 'GCJ-02'; sourcePoiId?: string; symbol?: string; color?: string; minZoom?: number; createdAt: string; updatedAt: string };
export type Memory = { id: string; placeId: string; title: string; body: string; images?: string[]; eventDate: string; createdAt: string; updatedAt: string };
export type ViewState = { id: 'map'; lng: number; lat: number; zoom: number };
export const WUHAN = { lng: 114.3695, lat: 30.5427, zoom: 15 };
export const isoNow = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();
export function memoryCount(placeId: string, memories: Memory[]) { return memories.filter(m => m.placeId === placeId).length; }
export function markerMinZoom(place: Place) { return place.minZoom ?? (place.sourcePoiId ? 16 : 13); }
export function sortMemories(memories: Memory[]) { return [...memories].sort((a,b) => b.eventDate.localeCompare(a.eventDate) || b.createdAt.localeCompare(a.createdAt)); }
export type SearchResult = { type: 'place'; place: Place; memory: null } | { type: 'memory'; place: Place; memory: Memory };
export function searchRecords(query: string, places: Place[], memories: Memory[]): SearchResult[] { const q = query.trim().toLocaleLowerCase(); if (!q) return []; return places.flatMap(place => { const own = memories.filter(m => m.placeId === place.id && `${m.title} ${m.body}`.toLocaleLowerCase().includes(q)); const found: SearchResult[] = []; if (place.name.toLocaleLowerCase().includes(q)) found.push({type:'place',place,memory:null}); for (const memory of own) found.push({type:'memory',place,memory}); return found; }); }
