import {icon} from './icons.mjs';
import {DEFAULT_ADJUSTMENTS} from './math.mjs';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tabs=(items,active,attr)=>`<div class="v2-tabs">${items.map(([id,label])=>`<button ${attr}="${id}" class="${id===active?'active':''}">${label}</button>`).join('')}</div>`;

export const MAKEUP_ROLES={
 lips:['Môi','makeup','#a8415c','multiply'],
 blush:['Má','heart','#df9296','soft-light'],
 eyes:['Mắt','eye','#8f586c','multiply'],
 eyeliner:['Eyeliner','brush','#2c2227','multiply'],
 brows:['Mày','brush','#614337','multiply'],
 highlight:['Sáng mắt','sun','#f2d4bc','soft-light'],
 hair:['Màu tóc','brush','#6e473b','soft-light']
};

export const MAKEUP_PALETTE=['#a8415c','#c76b83','#df9296','#8f586c','#b5826c','#f2d4bc'];
export const HAIR_PALETTE=['#6e473b','#8c624c','#9e4738','#78596e','#6e7075','#242c38','#c49a5c'];

export const MAKEUP_PRESETS={
 natural:{label:'Tự nhiên',role:'lips',color:'#c97482',opacity:65,blend:'soft-light',strength:38},
 peach:{label:'Đào phai',role:'blush',color:'#e89587',opacity:72,blend:'soft-light',strength:42},
 douyin:{label:'Douyin',role:'lips',color:'#b53852',opacity:85,blend:'multiply',strength:58},
 korean:{label:'Hàn Quốc',role:'eyes',color:'#a8766c',opacity:68,blend:'soft-light',strength:36},
 velvet:{label:'Đỏ rượu',role:'lips',color:'#7d2438',opacity:88,blend:'multiply',strength:62}
};

export function renderMakeupPanel(ui){
 const layer=ui.f.activeMakeupLayer(),role=layer?.studio.makeup.role||ui.makeupMode,restore=ui.brush.mode==='restore',isHair=role==='hair';
 const swatches=isHair?HAIR_PALETTE:MAKEUP_PALETTE;
 const presetsRow=!isHair?`<div class="pro-effect-list">${Object.entries(MAKEUP_PRESETS).map(([id,p])=>`<button data-v2-makeup-preset="${id}" class="${ui.makeupPreset===id?'active':''}">${p.label}</button>`).join('')}</div>`:'';
 const hairKey=ui.hairKey||'brightness',hairLabels={brightness:'Độ sáng tóc',saturation:'Độ bão hòa tóc',highlights:'Highlight tóc',shadows:'Shadow tóc'},hairAdj={...DEFAULT_ADJUSTMENTS,...layer?.studio.adjustments,...ui.draft.adjustments};
 const hairControls=isHair?`<div class="v2-hair-controls">${tabs([['brightness','Độ sáng'],['saturation','Bão hòa'],['highlights','Highlight'],['shadows','Shadow']],hairKey,'data-v2-hair-key')}${ui.slider(hairLabels[hairKey],hairKey,hairAdj[hairKey]||0,-100,100,1,'adjust')}</div>`:'';
 const layerControls=layer?`<div class="v2-makeup-layer-props">${ui.slider('Độ trong suốt lớp','opacity',layer.opacity??100,0,100,1,'layer')}<label class="field-label">Hòa trộn lớp<select class="studio-field" id="layer-blend">${ui.blendOptions(layer.composition)}</select></label>${ui.expanded?`<button class="v2-inline-action" data-v2-action="new-makeup">${icon('plus')}Thêm một lớp màu ${MAKEUP_ROLES[role]?.[0]||'mới'}</button>`:''}</div>`:'';
 return `<div class="v2-makeup-roles">${Object.entries(MAKEUP_ROLES).map(([id,[name,ic]])=>`<button data-v2-makeup-role="${id}" class="${id===role&&!restore?'active':''}">${icon(ic)}${name}</button>`).join('')}<button data-v2-action="makeup-erase" class="${restore?'active':''}">${icon('eraser')}Tẩy</button></div>${presetsRow}<div class="palette v2-makeup-palette">${swatches.map(c=>`<button data-color="${c}" class="swatch ${c===ui.brush.color?'active':''}" style="background:${c}" aria-label="Màu ${c}"></button>`).join('')}<input class="color-input" type="color" value="${ui.brush.color}" data-makeup-color aria-label="Chọn màu riêng"></div>${hairControls}${ui.brushSlider()}<div class="v2-mask-status"><span>${icon('layers')}${layer?esc(layer.name):'Chọn vùng để tạo lớp màu'}</span><button data-v2-action="makeup-layers">Quản lý lớp ${icon('chevronRight')}</button></div>${layerControls}`;
}
