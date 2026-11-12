// Brush geometry presets. The person chooses every center/anchor; no detection.
export const RESHAPE_PRESETS={face:{label:'Gọn mặt',mode:'pinch',size:130,strength:30},eyes:{label:'Mắt',mode:'bulge',size:45,strength:25},nose:{label:'Mũi',mode:'pinch',size:36,strength:22},lips:{label:'Môi',mode:'bulge',size:42,strength:20},chin:{label:'Cằm',mode:'push',size:72,strength:30,axis:'y'}};
export function manualReshapePreset(id){const preset=RESHAPE_PRESETS[id];if(!preset)throw new Error('Công cụ đường nét không hợp lệ.');return {...preset};}
