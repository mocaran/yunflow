import { useEffect, useState } from 'react';
import type { YunflowDB } from './db';
import { photoId } from './photoData';

export default function MemoryPhoto({src,alt,database}:{src:string;alt:string;database:YunflowDB}){
  const [url,setUrl]=useState(src.startsWith('data:')?src:'');
  useEffect(()=>{
    const id=photoId(src);
    if(!id){setUrl(src.startsWith('data:')?src:'');return;}
    let active=true,objectUrl='';
    void database.attachments.get(id).then(attachment=>{
      if(!active)return;
      if(attachment){objectUrl=URL.createObjectURL(attachment.blob);setUrl(objectUrl);}else setUrl('');
    });
    return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[src,database]);
  return url?<img src={url} alt={alt}/>:<span className="photo-missing">图片尚未下载</span>;
}
