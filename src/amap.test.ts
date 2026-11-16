import { describe, expect, it } from 'vitest';
import { parsePlaceSearchResponse } from './placeSearch';

describe('高德地点搜索响应',()=>{
  it('读取服务端返回的地点和 GCJ-02 坐标',()=>{
    expect(parsePlaceSearchResponse(200,{places:[{id:'a',name:'武汉大学',lng:114.36,lat:30.54,zoom:16}]})).toEqual([{id:'a',name:'武汉大学',lng:114.36,lat:30.54,zoom:16}]);
  });
  it('把 Key 配置问题显示给用户',()=>{
    expect(()=>parsePlaceSearchResponse(503,{error:'高德地点搜索尚未配置 Web 服务 Key'})).toThrow('Web 服务 Key');
    expect(()=>parsePlaceSearchResponse(502,{error:'高德 Key 类型不匹配'})).toThrow('类型不匹配');
  });
});
