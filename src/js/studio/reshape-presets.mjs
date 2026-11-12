// Brush geometry & manual mesh control presets. The person chooses every center/anchor; no AI detection.
export const RESHAPE_PRESETS={
 face:{label:'Gọn mặt',mode:'pinch',size:130,strength:30,hint:'Chạm hai bên má hoặc kéo nhẹ để thu gọn khuôn mặt'},
 chin:{label:'Cằm',mode:'push',size:72,strength:30,axis:'y',hint:'Đặt điểm từ dưới môi tới đỉnh cằm để chỉnh độ thon cằm'},
 jawline:{label:'Đường hàm',mode:'pinch',size:96,strength:28,hint:'Đặt hai điểm góc hàm trái/phải để siết gọn đường hàm V-line'},
 cheekbone:{label:'Gò má',mode:'pinch',size:84,strength:26,hint:'Đặt hai điểm gò má để thu gọn hoặc nâng gò má'},
 eyes:{label:'Mắt',mode:'bulge',size:45,strength:25,hint:'Đặt tâm hai mắt để phóng to và cân chỉnh đôi mắt'},
 nose:{label:'Mũi',mode:'pinch',size:36,strength:22,hint:'Đặt từ sống mũi tới đầu mũi để thu gọn cánh mũi và nâng sống mũi'},
 lips:{label:'Môi',mode:'bulge',size:42,strength:20,hint:'Đặt hai khóe môi hoặc tâm môi để làm đầy môi và nâng khóe cười'},
 forehead:{label:'Trán',mode:'push',size:90,strength:24,axis:'y',hint:'Đặt từ chân mày tới đường chân tóc để cân chỉnh độ cao trán'},
 ratio:{label:'Tỷ lệ mặt',mode:'push',size:140,strength:25,axis:'y',hint:'Đặt trục dọc khuôn mặt để cân chỉnh tỷ lệ trung đình / hạ đình'}
};
export function manualReshapePreset(id){const preset=RESHAPE_PRESETS[id];if(!preset)throw new Error('Công cụ đường nét không hợp lệ.');return {...preset};}
