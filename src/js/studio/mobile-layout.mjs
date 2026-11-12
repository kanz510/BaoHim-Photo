export function containScale(width,height,viewportWidth,viewportHeight,padding=12){
 if(![width,height,viewportWidth,viewportHeight].every(n=>Number.isFinite(n)&&n>0))return null;
 return Math.max(.0001,Math.min(Math.max(1,viewportWidth-padding*2)/width,Math.max(1,viewportHeight-padding*2)/height,8));
}
export function sheetStops(height,header=60,dock=80){
 const expanded=Math.max(80,Math.min(560,height-header-dock-108));
 return {closed:0,peek:Math.min(70,expanded),compact:Math.min(224,expanded),expanded};
}
