export function containScale(width,height,viewportWidth,viewportHeight,padding=6){
 if(![width,height,viewportWidth,viewportHeight].every(n=>Number.isFinite(n)&&n>0))return null;
 return Math.max(.0001,Math.min(Math.max(1,viewportWidth-padding*2)/width,Math.max(1,viewportHeight-padding*2)/height,8));
}
export function sheetStops(height,header=46,dock=58){
 const expanded=Math.max(80,Math.min(480,height-header-dock-108));
 return {closed:0,peek:Math.min(54,expanded),compact:Math.min(208,expanded),expanded};
}
