export type MapPoi={id:string;name:string;lng:number;lat:number;zoom:number};
export function parsePlaceSearchResponse(status:number,data:unknown):MapPoi[]{
  const result=data as {error?:unknown;places?:unknown};
  if(status<200||status>=300)throw new Error(typeof result?.error==='string'?result.error:`高德地点搜索失败（${status}）`);
  if(!Array.isArray(result?.places))throw new Error('高德地点搜索返回了无效数据');
  return result.places.filter((place):place is MapPoi=>Boolean(place&&typeof place==='object'&&typeof place.id==='string'&&typeof place.name==='string'&&Number.isFinite(place.lng)&&Number.isFinite(place.lat))).map(place=>({id:place.id,name:place.name,lng:place.lng,lat:place.lat,zoom:16}));
}
const native=()=>Boolean((window as any).Capacitor?.isNativePlatform?.());
export async function searchMapPlaces(keyword:string):Promise<MapPoi[]>{
  const query=keyword.trim();
  if(!query)return [];
  const path=`/api/place-search?keywords=${encodeURIComponent(query)}`;
  const url=native()?`https://yunflow-memory-map.thinmerit.chatgpt.site${path}`:path;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    let status:number,data:unknown;
    try{
      const response=await fetch(url,{signal:controller.signal});
      status=response.status;data=await response.json();
    }catch(error){
      if(!native())throw error;
      const {CapacitorHttp}=await import('@capacitor/core');
      const response=await CapacitorHttp.get({url,connectTimeout:10000,readTimeout:12000,responseType:'json'});
      status=response.status;data=typeof response.data==='string'?JSON.parse(response.data):response.data;
    }
    return parsePlaceSearchResponse(status,data);
  }catch(error){
    if(error instanceof Error&&error.name==='AbortError')throw new Error('高德地点搜索超时，请检查网络后重试');
    throw error;
  }finally{clearTimeout(timer);}
}
