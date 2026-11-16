import { useEffect, useRef, useState } from 'react';
import { loadAMap, type AMapApi } from './amap';
import { getView, saveView } from './db';
import { markerMinZoom, memoryCount, type Memory, type Place } from './model';

type Props = { places: Place[]; memories: Memory[]; selectedId: string | null; picking: boolean; focus: { lng: number; lat: number; zoom?:number; nonce: number } | null; locateNonce:number; onLocation:(message:string)=>void; onSelect: (id: string) => void; onPick: (lng: number, lat: number, zoom:number) => void; onPoi: (poi: {id:string;name:string;lng:number;lat:number;zoom:number}) => void; onStatus: (status: 'loading'|'ready'|'error', message?: string) => void };
export default function MapCanvas({ places, memories, selectedId, picking, focus, locateNonce, onLocation, onSelect, onPick, onPoi, onStatus }: Props) {
  const host = useRef<HTMLDivElement>(null), map = useRef<any>(null), api = useRef<AMapApi>(null), markers = useRef<any[]>([]);
  const locateRef=useRef<(manual:boolean)=>void>(()=>{}), blueDot=useRef<any>(null), onLocationRef=useRef(onLocation);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect), onPickRef = useRef(onPick), onPoiRef = useRef(onPoi), pickingRef = useRef(picking);
  onSelectRef.current = onSelect; onPickRef.current = onPick; onPoiRef.current=onPoi; pickingRef.current = picking;onLocationRef.current=onLocation;
  useEffect(() => {
    let cancelled = false, timer: ReturnType<typeof setTimeout>;
    onStatus('loading');
    if (!navigator.onLine) { onStatus('error','当前离线。仍可在本机写下记忆，联网后再打开地图。'); return; }
    Promise.all([loadAMap(), getView()]).then(([AMap, view]) => {
      if (cancelled || !host.current) return;
      api.current = AMap;
      const instance = new AMap.Map(host.current, { viewMode: '2D', zoom: view.zoom, center: [view.lng,view.lat], mapStyle: 'amap://styles/normal', resizeEnable: true, isHotspot: true });
      map.current = instance;
      setReady(true);
      const loadTimer = setTimeout(() => { if (!cancelled) onStatus('error','地图加载超时，请检查网络、Key、密钥及域名配置'); }, 20000);
      instance.on('complete', () => { clearTimeout(loadTimer); if (!cancelled) {onStatus('ready');locateRef.current(false);} });
      const geolocation=new AMap.Geolocation({enableHighAccuracy:true,timeout:12000,needAddress:false});
      locateRef.current=(manual:boolean)=>geolocation.getCurrentPosition((status:string,result:any)=>{
        if(cancelled)return;
        if(status!=='complete'||!result?.position){if(manual)onLocationRef.current('无法获取位置，请检查定位权限后重试');return;}
        const point=result.position;
        if(!blueDot.current){const dot=document.createElement('div');dot.className='current-location-dot';blueDot.current=new AMap.Marker({position:point,content:dot,anchor:'center',map:instance,zIndex:200});}
        else blueDot.current.setPosition(point);
        instance.setZoomAndCenter(Math.max(instance.getZoom(),15),point,false);
        if(manual)onLocationRef.current('已定位到当前位置');
      });
      let lastTouchAt = 0;
      instance.on('contextmenu', (event: any) => { if (Date.now()-lastTouchAt<2000) return; onPickRef.current(event.lnglat.getLng(), event.lnglat.getLat(),instance.getZoom()); });
      instance.on('click', (event: any) => { if (pickingRef.current) onPickRef.current(event.lnglat.getLng(), event.lnglat.getLat(),instance.getZoom()); });
      instance.on('hotspotclick', (event: any) => { if (event?.lnglat && event?.name) onPoiRef.current({id:String(event.id ?? ''),name:String(event.name),lng:event.lnglat.getLng(),lat:event.lnglat.getLat(),zoom:instance.getZoom()}); });
      instance.on('moveend', persist); instance.on('zoomend', persist);
      function persist() { clearTimeout(timer); timer = setTimeout(() => { const center = instance.getCenter(); void saveView({ lng: center.getLng(), lat: center.getLat(), zoom: instance.getZoom() }); }, 450); }
      // A mobile long press is converted from screen pixels to official AMap GCJ-02 coordinates.
      let longPress: ReturnType<typeof setTimeout> | undefined, startX = 0, startY = 0;
      const down = (e: PointerEvent) => { if (e.pointerType !== 'touch') return; lastTouchAt=Date.now(); if (!pickingRef.current) return; startX=e.clientX; startY=e.clientY; longPress=setTimeout(() => { if (!pickingRef.current || !host.current) return; const box=host.current.getBoundingClientRect(); const point=instance.containerToLngLat(new AMap.Pixel(startX-box.left,startY-box.top)); onPickRef.current(point.getLng(),point.getLat(),instance.getZoom()); }, 650); };
      const move = (e: PointerEvent) => { if (Math.abs(e.clientX-startX)+Math.abs(e.clientY-startY)>16) clearTimeout(longPress); };
      const up = () => clearTimeout(longPress);
      host.current.addEventListener('pointerdown',down); host.current.addEventListener('pointermove',move); host.current.addEventListener('pointerup',up); host.current.addEventListener('pointercancel',up);
      (instance as any).__cleanup = () => { clearTimeout(loadTimer); host.current?.removeEventListener('pointerdown',down); host.current?.removeEventListener('pointermove',move); host.current?.removeEventListener('pointerup',up); host.current?.removeEventListener('pointercancel',up); };
    }).catch(error => { if (!cancelled) onStatus('error', error instanceof Error ? error.message : String(error)); });
    return () => { cancelled=true; clearTimeout(timer); locateRef.current=()=>{};blueDot.current?.setMap(null);blueDot.current=null;(map.current as any)?.__cleanup?.(); markers.current.forEach(m => m.setMap(null)); markers.current=[]; map.current?.destroy(); map.current=null; };
  }, []);
  useEffect(() => {
    if (!map.current || !api.current) return;
    markers.current.forEach(m => m.setMap(null));
    markers.current = places.flatMap(place => {
      if (place.lng === null || place.lat === null) return [];
      const count=memoryCount(place.id,memories);
      const el=document.createElement('button'); el.type='button'; el.className=`map-marker ${selectedId===place.id?'active':''}`; el.setAttribute('aria-label',`${place.name}，${count} 条记忆`);
      el.style.setProperty('--marker-color',place.color&&/^#[0-9a-fA-F]{6}$/.test(place.color)?place.color:'#2d6b5a');
      el.innerHTML=`<span class="marker-symbol"></span>${count?`<span class="marker-total">${count}</span>`:''}<span class="marker-name"></span>`;
      el.querySelector('.marker-symbol')!.textContent=place.symbol||'★';
      el.querySelector('.marker-name')!.textContent=place.name;
      const marker = new api.current.Marker({ position: [place.lng,place.lat], content: el, anchor:'center', zooms:[markerMinZoom(place),20], map: map.current });
      marker.on('click', () => onSelectRef.current(place.id));
      return marker;
    });
  }, [places,memories,selectedId,ready]);
  useEffect(() => { if (focus && map.current) { map.current.setZoomAndCenter(Math.max(map.current.getZoom(),focus.zoom??16,16),[focus.lng,focus.lat],false); } }, [focus]);
  useEffect(()=>{if(locateNonce>0&&ready)locateRef.current(true);},[locateNonce,ready]);
  return <div ref={host} className={`map-canvas ${picking?'picking':''}`} aria-label="高德地图" />;
}
