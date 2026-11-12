import {RasterService} from './raster-service.mjs';
// A transparent makeup source is only a coordinate reference. Re-render its stored
// vector brush paths at export resolution; ordinary photos keep their old renderer.
export class PremiumRaster extends RasterService{
 async render(source,studio={},options={}){
  const width=source.naturalWidth||source.width,height=source.naturalHeight||source.height,edge=options.edge||1600;
  if(!studio.makeup||edge<=Math.max(width,height))return super.render(source,studio,options);
  const factor=Math.min(edge/Math.max(width,height),Math.sqrt(12500000/(width*height))),blank=this.canvas(Math.max(1,Math.round(width*factor)),Math.max(1,Math.round(height*factor)));
  const point=p=>({x:p.x*factor,y:p.y*factor}),scaled={...studio,strokes:(studio.strokes||[]).map(s=>({...s,radius:s.radius*factor,points:(s.points||[]).map(point),...(s.cloneSource?{cloneSource:point(s.cloneSource)}:{})})),warps:(studio.warps||[]).map(s=>({...s,from:point(s.from),to:point(s.to),radius:s.radius*factor})),freezes:(studio.freezes||[]).map(s=>({...s,...(s.radius?{radius:s.radius*factor}:{}),points:(s.points||[]).map(point)}))};
  try{return await super.render(blank,scaled,options);}finally{blank.width=1;}
 }
}
