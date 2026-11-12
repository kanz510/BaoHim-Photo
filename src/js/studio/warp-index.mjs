import {brushCoverage} from './math.mjs';

// Circles are only a broad phase. The original pixel equations still decide every
// contribution, in exactly the original order, after each change of coordinates.
function circleGrid(items,{cellSize=64,maxEntries=200000,maxCells=4096}={}){
 if(!items.length)return null;
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const item of items){const r=Math.max(1,item.radius);minX=Math.min(minX,item.x-r);minY=Math.min(minY,item.y-r);maxX=Math.max(maxX,item.x+r);maxY=Math.max(maxY,item.y+r);}
 if(![minX,minY,maxX,maxY].every(Number.isFinite))return null;
 const cell=Math.max(cellSize,Math.max(maxX-minX,maxY-minY)/63),cols=Math.max(1,Math.ceil((maxX-minX)/cell)),rows=Math.max(1,Math.ceil((maxY-minY)/cell));
 if(cols*rows>maxCells)return null;const cells=Array.from({length:cols*rows},()=>[]);let entries=0;
 for(let id=0;id<items.length;id++){
  const item=items[id],r=Math.max(1,item.radius),left=Math.max(0,Math.floor((item.x-r-minX)/cell)),right=Math.min(cols-1,Math.floor((item.x+r-minX)/cell)),top=Math.max(0,Math.floor((item.y-r-minY)/cell)),bottom=Math.min(rows-1,Math.floor((item.y+r-minY)/cell));
  entries+=(right-left+1)*(bottom-top+1);if(entries>maxEntries)return null;
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)cells[y*cols+x].push(id);
 }
 const empty=[];return {density:entries/(cells.length*items.length),query(x,y){const col=Math.floor((x-minX)/cell),row=Math.floor((y-minY)/cell);return col<0||row<0||col>=cols||row>=rows?empty:cells[row*cols+col];}};
}
export function buildWarpIndex(strokes,options){
 if(strokes.length<8)return null;const grid=circleGrid(strokes.map(s=>({x:s.from.x,y:s.from.y,radius:s.radius})),options);if(!grid||grid.density>.85)return null;
 return {previous(x,y,limit){const ids=grid.query(x,y);let lo=0,hi=ids.length;while(lo<hi){const mid=(lo+hi)>>>1;if(ids[mid]<=limit)lo=mid+1;else hi=mid;}return lo?ids[lo-1]:-1;}};
}
export function buildFreezeIndex(strokes,options){
 const points=[],lastClear=[-1];for(let i=0;i<strokes.length;i++){const s=strokes[i];lastClear.push(s.clear?i:lastClear[i]);if(!s.clear)for(const p of s.points||[])points.push({...p,radius:s.radius,stroke:i});}
 if(points.length<24)return null;const grid=circleGrid(points,options);if(!grid)return null;
 return (point,count=strokes.length)=>{
  const end=Math.max(0,Math.min(count,strokes.length)),start=lastClear[end]??-1;let alpha=0;
  for(const id of grid.query(point.x,point.y)){const p=points[id];if(p.stroke>=end)break;if(p.stroke<=start)continue;const s=strokes[p.stroke],a=brushCoverage(Math.hypot(point.x-p.x,point.y-p.y),s.radius,s.hardness);alpha=s.erase?alpha*(1-a):Math.max(alpha,a);}
  return alpha;
 };
}
