import {MobilePreviewUI} from './mobile-ui.mjs';
import {icon,hydrateIcons} from './icons.mjs';
import {PRESETS,AUTO_PRESETS,DEFAULT_ADJUSTMENTS} from './math.mjs';
import {LOOK_GROUPS,lookGroup,matchesLookGroup,lookFromStudio} from './look-catalog.mjs';
import {RESHAPE_PRESETS,manualReshapePreset} from './reshape-presets.mjs';
import {StudioPreferences} from './studio-preferences.mjs';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={home:'Chỉnh ảnh',auto:'Auto Cân bằng',beauty:'Làm đẹp',adjust:'Ánh sáng & màu',filters:'Bộ lọc màu',reshape:'Chỉnh đường nét',makeup:'Trang điểm',text:'Typography',stickers:'Sticker',frames:'Khung ảnh',collage:'Ghép ảnh',templates:'Mẫu thiết kế',layers:'Các lớp',geometry:'Cắt & căn chỉnh',draw:'Vẽ & xóa'};
export const V3_CATEGORIES=Object.freeze([
 {id:'auto',label:'AUTO',tools:['auto']},
 {id:'face',label:'MẶT',tools:['beauty','reshape','makeup']},
 {id:'body',label:'DÁNG',tools:['reshape']},
 {id:'color',label:'MÀU',tools:['filters','adjust']},
 {id:'creative',label:'SÁNG TẠO',tools:['text','stickers','collage','frames','templates','geometry','layers','draw']}
]);
const adjustmentGroups={light:[['exposure','Phơi sáng',-2,2,.05],['brightness','Độ sáng',-100,100,1],['contrast','Tương phản',-100,100,1],['highlights','Vùng sáng',-100,100,1],['shadows','Vùng tối',-100,100,1]],color:[['temperature','Nhiệt độ',-100,100,1],['tint','Sắc độ',-100,100,1],['saturation','Bão hòa',-100,100,1]],detail:[['blur','Làm mờ',0,100,1],['sharpen','Sắc nét',0,100,1],['grain','Hạt film',0,100,1],['vignette','Viền tối',0,100,1],['bloom','Bloom',0,100,1],['glow','Glow',0,100,1],['halation','Halation',0,100,1],['lightLeak','Light leak',0,100,1],['chromatic','Tán sắc',0,100,1]]};
const CUBE_LUT_ENTRIES=[['none','Không LUT'],['ccd-digicam','CCD Digicam .cube'],['kodak-2383','Kodak 2383 .cube'],['fuji-eterna','Fuji Eterna .cube'],['teal-orange','Teal & Orange .cube']];
const tabs=(items,active,attr)=>`<div class="v2-tabs">${items.map(([id,label])=>`<button ${attr}="${id}" class="${id===active?'active':''}">${label}</button>`).join('')}</div>`;
const miniNote=text=>`<p class="v2-tool-note">${text}</p>`;

/** A preview presentation layer. All edits still use the native command history. */
export class PremiumUI extends MobilePreviewUI{
 constructor(facade,viewport){
  super(facade,viewport);this.preferences=new StudioPreferences();this.looks=[];this.thumbURLs=new Map();this.filterCache=new Map();this.homeTab='studio';this.filterGroup='all';this.adjustGroup='light';this.adjustKey='exposure';this.textTab='content';this.geometryTab='crop';this.brushSetting='strength';this.toneSetting='warmth';this.frameStyle='paper';this.framePercent=5;this.homeEpoch=0;this.makeupStudio=null;this.creativeStudio=null;this.lutStudio=null;this.bindPremium();
  this.isV5=typeof window!=='undefined'&&new URLSearchParams(window.location?.search).get('ui')==='v5';
  if(this.isV5&&typeof document!=='undefined'){
   document.body?.classList.remove('immersive-v4');
   document.body?.classList.add('immersive-v5');
  }
  const stops=this.sheet.stops.bind(this.sheet);this.sheet.stops=()=>{const s=stops(),vh=window.visualViewport?.height||window.innerHeight;s.expanded=Math.min(s.expanded,Math.round(vh*.52));const baseCompact=this.isV5?(vh<520?168:196):(vh<520?168:220);s.compact=Math.min(s.expanded,this.sheet.keyboard?172:baseCompact);return s;};
  this.preferences.listLooks().then(looks=>{this.looks=looks;if(this.tool==='filters')this.renderPanel();}).catch(()=>{});this.renderPanel();
 }
 async ensureMakeupStudio(){
  if(!this.makeupStudio)this.makeupStudio=await import(/* webpackChunkName: "studio-makeup" */ './makeup-studio.mjs');
  return this.makeupStudio;
 }
 async ensureCreativeStudio(){
  if(!this.creativeStudio)this.creativeStudio=await import(/* webpackChunkName: "studio-creative" */ './creative-studio.mjs');
  return this.creativeStudio;
 }
 async ensureLutStudio(){
  if(!this.lutStudio)this.lutStudio=await import(/* webpackChunkName: "studio-lut" */ './lut-cube.mjs');
  return this.lutStudio;
 }
 activeCategory(){
  if(this.tool==='auto')return 'auto';
  if(this.tool==='reshape'&&this.reshapeMode==='body')return 'body';
  if(['beauty','reshape','makeup'].includes(this.tool))return 'face';
  if(['filters','adjust'].includes(this.tool))return 'color';
  if(['text','stickers','collage','frames','templates','geometry','layers','draw'].includes(this.tool))return 'creative';
  return null;
 }
 categorySubnav(){
  const cat=this.activeCategory();
  if(cat==='face')return `<div class="v3-subnav"><button data-v3-subtool="beauty" class="${this.tool==='beauty'?'active':''}">Làm đẹp</button><button data-v3-subtool="face-reshape" class="${this.tool==='reshape'&&this.reshapeMode!=='body'?'active':''}">Khuôn mặt</button><button data-v3-subtool="makeup" class="${this.tool==='makeup'?'active':''}">Makeup & Tóc</button></div>`;
  if(cat==='body')return `<div class="v3-subnav"><button data-v3-subtool="body-reshape" class="active">Vóc dáng</button><button data-v3-subtool="face-reshape">Khuôn mặt</button></div>`;
  if(cat==='color')return `<div class="v3-subnav"><button data-v3-subtool="filters" class="${this.tool==='filters'?'active':''}">Filter & LUT</button><button data-v3-subtool="adjust" class="${this.tool==='adjust'?'active':''}">HSL & Curve</button></div>`;
  if(cat==='creative')return `<div class="v3-subnav"><button data-v3-subtool="text" class="${this.tool==='text'?'active':''}">Chữ</button><button data-v3-subtool="stickers" class="${this.tool==='stickers'?'active':''}">Sticker</button><button data-v3-subtool="collage" class="${this.tool==='collage'?'active':''}">Ghép</button><button data-v3-subtool="frames" class="${this.tool==='frames'?'active':''}">Khung</button><button data-v3-subtool="templates" class="${this.tool==='templates'?'active':''}">Mẫu</button><button data-v3-subtool="geometry" class="${this.tool==='geometry'?'active':''}">Cắt</button><button data-v3-subtool="layers" class="${this.tool==='layers'?'active':''}">Lớp</button><button data-v3-subtool="draw" class="${this.tool==='draw'?'active':''}">Vẽ</button></div>`;
  return '';
 }
 switchCategory(cat){
  return this.navigate(async()=>{
   if(cat==='auto'){await this.openTool('auto');return;}
   if(cat==='face'){this.reshapeMode='face';await this.openTool('beauty');return;}
   if(cat==='body'){this.reshapeMode='body';await this.openTool('reshape');return;}
   if(cat==='color'){await this.openTool('filters');return;}
   if(cat==='creative'){await this.openTool('text');return;}
  });
 }
 header(){if(this.isV5&&this.activeCategory()!=='creative')return '';return `<div class="mobile-panel-heading"><h2>${this.tool==='reshape'&&this.reshapeMode==='body'?'Chỉnh vóc dáng':names[this.tool]||'Chỉnh ảnh'}</h2>${this.categorySubnav()}<div><span class="v2-manual-label">${['beauty','reshape','makeup'].includes(this.tool)?'THỦ CÔNG':this.tool==='auto'?'THUẬT TOÁN':''}</span><button class="sheet-detail-toggle" data-mobile-action="sheet-toggle" aria-label="${this.expanded?'Thu gọn':'Mở rộng'} bảng">${icon(this.expanded?'chevronDown':'sliders')}</button><button class="sheet-close" data-mobile-action="sheet-close" aria-label="Đóng công cụ">${icon('close')}</button></div></div>`;}
 updateChrome(){
  super.updateChrome();if(!$('#mobile-title'))return;$('#mobile-title').textContent=this.tool==='reshape'&&this.reshapeMode==='body'?'Chỉnh vóc dáng':names[this.tool]||'Chỉnh ảnh';$('#mobile-shell').dataset.tool=this.tool;$('#mobile-shell').dataset.category=this.activeCategory()||'home';
  const bodyBtn=$('#mobile-nav [data-v3-category="body"]:not([data-tool])');
  if(bodyBtn){const active=this.tool==='reshape'&&this.reshapeMode==='body'&&!this.libraryVisible;bodyBtn.classList.toggle('active',active);bodyBtn.setAttribute('aria-pressed',String(active));}
  $('#v2-photo-name').textContent=this.f.name||'';$('#v2-photo-size').textContent=`${this.f.config.WIDTH} × ${this.f.config.HEIGHT}`;
 }
 onFacade(type,value){
  if(type==='worker'){
   if(value?.state==='restarting')this.toast('Bộ xử lý ảnh đang khởi động lại để giữ ứng dụng mượt…');
   else if(value?.state==='failed')this.toast('Tác vụ xử lý ảnh lớn đã dừng để tránh treo máy. Hãy thử lại.');
   return;
  }
  if(type==='document'){this.showLoading(value.phase==='opening');if(value.phase==='opening'){this.router?.cancel();if(this.router){this.router.cloneSource=null;this.router.bodyHandles=[];this.router.faceHandles=[];this.router.placingFace=false;this.router.placingBody=false;this.router.placingPin=false;}const node=$('#studio-loading');node.textContent=value.label;}return;}
  if(type==='checkpoint-error'){if(!this.checkpointWarning)this.toast('Dự án đã lưu. Chưa lưu được mốc lịch sử trên thiết bị.');this.checkpointWarning=true;}if(type==='checkpoint-saved')this.checkpointWarning=false;
  if(this.f.historyJumping)return;super.onFacade(type,value);if(!this.preferences)return;
  const state=$('#v2-save-state');if(['change','saving','saved','save-error'].includes(type)){state.textContent=type==='saved'?'Đã lưu trên máy':type==='save-error'?'Chưa lưu được':'Đang lưu…';state.dataset.state=type;}
  if(type==='compare'){const b=$('[data-v2-action="compare"]');b?.setAttribute('aria-pressed',String(value));}
  if(type==='saved'){clearTimeout(this.thumbnailTimer);this.thumbnailTimer=setTimeout(()=>this.updateDraftThumbnail().catch(()=>{}),220);}
  if(type==='change'||type==='selection')this.updateChrome();
 }
 renderPanel(){
  if(!$('#panel-header'))return;$('#panel-header').innerHTML=this.header();if(this.tool==='home'){this.updateChrome();return;}
  const renderers={auto:()=>this.autoPanel(),beauty:()=>this.beautyPanel(),adjust:()=>this.adjustPanel(),filters:()=>this.filterPanel(),reshape:()=>this.reshapePanel(),makeup:()=>this.makeupPanel(),text:()=>this.textPanel(),stickers:()=>this.stickerPanel(),frames:()=>this.framePanel(),collage:()=>this.collagePanel(),templates:()=>this.templatesPanel(),layers:()=>this.layersPanel(),geometry:()=>this.geometryPanel(),draw:()=>this.drawPanel()};
  const scroll=$('#panel-content').scrollTop,horizontal=[...$('#panel-content').querySelectorAll('.v2-tabs,.v2-tool-strip,.v2-attributes,.v2-filter-strip,.pro-effect-list')].map(e=>e.scrollLeft);$('#panel-content').innerHTML=(renderers[this.tool]||renderers.beauty)();
  const left=this.tool==='filters'?`<button class="sheet-secondary" data-v2-action="save-look">${icon('plus')}Lưu màu</button>`:this.tool==='layers'?`<button class="sheet-secondary" data-action="add-photo">${icon('plus')}Thêm ảnh</button>`:['templates','stickers'].includes(this.tool)?`<button class="sheet-secondary" data-mobile-action="sheet-close">Đóng</button>`:`<button class="sheet-secondary" data-action="reset">${icon('reset')}Đặt lại</button>`;
  $('#panel-footer').innerHTML=`${left}<button class="sheet-confirm" data-action="apply">${this.tool==='collage'?'Ghép ảnh':this.tool==='geometry'&&this.geometryTab==='crop'?'Cắt ảnh':'Xong'}${icon('check')}</button>`;
  $('#panel-content').scrollTop=scroll;[...$('#panel-content').querySelectorAll('.v2-tabs,.v2-tool-strip,.v2-attributes,.v2-filter-strip,.pro-effect-list')].forEach((e,i)=>{e.scrollLeft=horizontal[i]||0;e.querySelector('.active')?.scrollIntoView?.({block:'nearest',inline:'nearest'});});this.updateChrome();if(this.tool==='filters')this.filterThumbnails();if(this.tool==='adjust'&&this.adjustGroup==='curve')this.bindCurve();if(this.isV5&&$('#mobile-shell')?.classList.contains('sheet-open')){const h=Math.round($('#studio-inspector')?.getBoundingClientRect().height||0);if(h>0)$('#mobile-shell').style.setProperty('--sheet-height',`${h}px`);}this.sheet?.viewportChanged();
 }
 slider(label,key,value,min=0,max=100,step=1,group='brush',ends=null){
  if(!this.isV5)return super.slider(label,key,value,min,max,step,group,ends);
  const n=Math.round(value*100)/100;
  return `<label class="slider-field v5-slider-row"><span class="slider-heading">${label}</span><input class="studio-range v5-range" data-slider="${key}" data-group="${group}" type="range" min="${min}" max="${max}" step="${step}" value="${n}"><output>${n}</output>${ends?`<span class="slider-ends"><span>${ends[0]}</span><span>${ends[1]}</span></span>`:''}</label>`;
 }
 autoPanel(){
  return `<div class="pro-effect-list">${AUTO_PRESETS.map(p=>`<button data-v2-auto-preset="${p.id}" class="${(this.autoStyle||'balanced')===p.id?'active':''}">${p.label}</button>`).join('')}</div>${this.slider('Mức độ tự động','autoIntensity',this.autoIntensity??80,0,100,1,'auto')}${miniNote('Cân bằng histogram ánh sáng, tương phản & màu sắc bằng thuật toán truyền thống · Không dùng AI')}`;
 }
 brushSlider(){
  const isSmooth=this.tool==='beauty'&&this.brush.mode==='smooth';
  const setting=this.brushSetting==='detail'&&!isSmooth?'strength':this.brushSetting||'strength';
  const options={strength:['Cường độ',this.brush.strength,0,100],size:['Cỡ cọ',this.brush.size,10,220],hardness:['Độ mềm',100-this.brush.hardness,0,100],feather:['Viền mềm',this.brush.feather??35,0,100],detail:['Chi tiết da',this.brush.detail??65,0,100]};
  const [label,value,min,max]=options[setting]||options.strength;
  const tabItems=[['strength','Cường độ'],['size','Cỡ cọ'],['hardness','Độ mềm'],['feather','Viền mềm'],...(isSmooth?[['detail','Chi tiết da']]:[])];
  return `<div class="v2-brush-controls">${tabs(tabItems,setting,'data-v2-brush-setting')}${this.slider(label,setting,value,min,max,1,'brush')}</div>`;
 }
 beautyPanel(){
  const tone=this.toneSetting||'warmth',toneMap={warmth:['Ấm / Lạnh',this.brush.warmth??0,-100,100],lightness:['Sáng da',this.brush.lightness??0,-100,100],hue:['Sắc độ',this.brush.hue??0,-180,180],saturation:['Bão hòa',this.brush.saturation??0,-100,100]},[tLabel,tVal,tMin,tMax]=toneMap[tone]||toneMap.warmth;
  const toneControls=this.brush.mode==='tone'?`<div class="palette">${['#f2d5be','#e8c2a5','#d6a385','#be8a6c','#916343'].map(c=>`<button data-color="${c}" class="swatch ${c===this.brush.color?'active':''}" style="background:${c}" aria-label="Tông da ${c}"></button>`).join('')}</div><div class="v2-tone-controls">${tabs([['warmth','Ấm / Lạnh'],['lightness','Sáng da'],['hue','Sắc độ'],['saturation','Bão hòa']],tone,'data-v2-tone-setting')}${this.slider(tLabel,tone,tVal,tMin,tMax,1,'brush')}</div>`:'';
  return `<div class="v2-tool-strip">${this.card('Mịn da','smooth','smooth')}${this.card('Xóa mụn','blemish','clone')}${this.card('Sáng da','brighten','sun')}${this.card('Chữa lành','heal','clone')}${this.card('Tông da','tone','makeup')}${this.card('Sao chép','clone','clone')}${this.card('Nhấn sáng','dodge','dodge')}${this.card('Tạo khối','burn','dodge')}${this.card('Phục hồi','restore','eraser')}</div>${toneControls}${this.brushSlider()}${['clone','heal','blemish'].includes(this.brush.mode)?`<button class="v2-inline-action" data-action="clone-source">${this.brush.mode==='blemish'?'Tự động lấy vùng da sạch lân cận · Chạm để chọn nguồn thủ công ':'Chạm để chọn vùng nguồn trên ảnh '}${icon('pointer')}</button>`:miniNote('Tô một ngón để chỉnh · Hai ngón để phóng và di chuyển')}`;
 }
 adjustPanel(){
  const group=this.adjustGroup||'light',s={...DEFAULT_ADJUSTMENTS,...this.f.basePhotoLayer()?.studio.adjustments,...this.draft.adjustments},navigation=tabs([['light','Ánh sáng'],['color','Màu sắc'],['detail','Chi tiết'],['hsl','HSL'],['curve','Đường cong']],group,'data-v2-adjust-group');
  if(group==='hsl'){const band=this.hslBand||'red',channel=this.hslChannel||'hue',values={...this.f.basePhotoLayer()?.studio.hsl?.[band],...this.draft.hsl?.[band]};return `${navigation}<div class="pro-hsl-bands">${Object.entries({red:['Đỏ','#db5d65'],orange:['Cam','#e49c62'],yellow:['Vàng','#d9bd59'],green:['Lục','#71987e'],aqua:['Aqua','#70aab0'],blue:['Lam','#6c85b3'],purple:['Tím','#9a80b3'],magenta:['Hồng','#c37c9f']}).map(([id,[label,color]])=>`<button data-v2-hsl-band="${id}" aria-label="${label}" aria-pressed="${id===band}"><i style="background:${color}"></i></button>`).join('')}</div>${tabs([['hue','Sắc màu'],['saturation','Bão hòa'],['lightness','Độ sáng']],channel,'data-v2-hsl-channel')}${this.slider(({hue:'Sắc màu',saturation:'Bão hòa',lightness:'Độ sáng'})[channel],channel,values[channel]||0,channel==='hue'?-180:-100,channel==='hue'?180:100,1,'hsl')}`;}
  if(group==='curve')return `${navigation}<div class="v2-curve-layout"><canvas id="tone-curve" class="curve-canvas" width="300" height="140" aria-label="Đường cong sáng tối; chạm thêm điểm và kéo"></canvas><button class="v2-inline-action" data-action="reset-curve">Đặt lại đường cong</button></div>${this.expanded?this.slider('Điểm đen','black',this.draft.levels?.black??this.f.basePhotoLayer()?.studio.levels?.black??0,0,150,1,'levels')+this.slider('Điểm trắng','white',this.draft.levels?.white??this.f.basePhotoLayer()?.studio.levels?.white??255,151,255,1,'levels')+this.slider('Gamma','gamma',this.draft.levels?.gamma??this.f.basePhotoLayer()?.studio.levels?.gamma??1,.2,3,.05,'levels'):miniNote('Kéo bảng lên để chỉnh điểm đen, trắng và gamma')}`;
  const options=adjustmentGroups[group]||adjustmentGroups.light,active=options.find(a=>a[0]===this.adjustKey)||options[0];
  return `${navigation}<div class="v2-attributes">${options.map(([id,label])=>`<button data-v2-adjust-key="${id}" class="${id===active[0]?'active':''}"><i>${icon(({exposure:'sun',brightness:'sun',contrast:'dodge',highlights:'sun',shadows:'dodge',temperature:'temperature',tint:'filters',saturation:'filters',sharpen:'detail',grain:'grain',vignette:'frame'})[id])}</i><span>${label}</span>${s[id]!==0?`<small>${s[id]}</small>`:''}</button>`).join('')}</div>${this.slider(active[1],active[0],s[active[0]],active[2],active[3],active[4],'adjust')}${miniNote('Thay đổi trực tiếp · Nhấn giữ Trước / sau để đối chiếu')}`;
 }
 filterPanel(){
  const layer=this.f.basePhotoLayer(),studio={...layer?.studio,...this.draft},group=this.filterGroup||'all';
  const cacheUrls=this.filterCache?.get(layer?.studio?.sourceId)?.urls;
  const blank='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  const filters=group==='saved'?(this.looks||[]):PRESETS.filter(p=>matchesLookGroup(p,group));
  const activeLut=studio.lut?.name||'';
  const lutRow=`<div class="pro-effect-list">${CUBE_LUT_ENTRIES.map(([id,label])=>`<button data-v2-cube-lut="${id}" class="${(id==='none'&&!activeLut)||(id!=='none'&&label===activeLut)?'active':''}">${esc(label)}</button>`).join('')}<button data-v2-action="import-lut">${icon('folder')}Nhập .cube</button></div>`;
  return `${tabs(LOOK_GROUPS,group,'data-v2-filter-group')}<div class="filter-grid v2-filter-strip">${filters.map(p=>{const src=cacheUrls?.get(group==='saved'?JSON.stringify(p.recipe):p.id)||blank;return group==='saved'?`<button class="filter-card" data-v2-look="${esc(p.id)}"><span class="filter-preview"><img src="${src}" alt="" data-saved-preview="${esc(p.id)}"></span><span class="filter-name">${esc(p.name)}</span></button>`:`<button class="filter-card ${studio.preset===p.id?'active':''}" data-preset="${p.id}"><span class="filter-preview"><img src="${src}" alt="" data-filter-preview="${p.id}"></span><span class="filter-name">${p.name}</span></button>`;}).join('')||'<p class="v2-empty-inline">Lưu công thức màu yêu thích để dùng cho ảnh tiếp theo.</p>'}</div>${this.slider('Mức độ','intensity',studio.intensity??100,0,100,1,'filter')}${lutRow}`;
 }
 async filterThumbnails(){
  if(!this.filterCache)return;const layer=this.f.basePhotoLayer(),source=this.f.sources.get(layer?.studio?.sourceId);if(!source)return;const epoch=this.f.epoch,token=++this.filterEpoch||1;this.filterEpoch=token;
  let cache=this.filterCache.get(source.id);if(!cache){const c=document.createElement('canvas'),r=150/Math.max(source.width,source.height);c.width=Math.max(1,Math.round(source.width*r));c.height=Math.max(1,Math.round(source.height*r));c.getContext('2d').drawImage(source.image,0,0,c.width,c.height);cache={canvas:c,urls:new Map()};this.filterCache.set(source.id,cache);if(this.filterCache.size>2)this.filterCache.delete(this.filterCache.keys().next().value);}
  const list=[...document.querySelectorAll('[data-filter-preview],[data-saved-preview]')];for(const img of list){const id=img.dataset.filterPreview||img.dataset.savedPreview,look=this.looks?.find(l=>l.id===id),key=look?JSON.stringify(look.recipe):id;if(!cache.urls.has(key)){const c=await this.f.raster.render(cache.canvas,look?.recipe||{preset:id,intensity:100},{edge:150});cache.urls.set(key,c.toDataURL('image/jpeg',.78));c.width=1;}if(this.f.epoch!==epoch||this.tool!=='filters'||this.filterEpoch!==token)return;if(img.isConnected)img.src=cache.urls.get(key);}
 }
 reshapePanel(){
  if(this.isV5){
   if(!this.f.basePhotoLayer()){
    return `<div class="v5-empty-stage"><span>Chưa có ảnh để chỉnh</span><button type="button" class="v2-inline-action" data-v2-action="open-photo">Chọn ảnh</button></div>`;
   }
   const body=this.reshapeMode==='body';
   const BODY_REGIONS=[['waist','Gọn eo'],['shoulder','Gọn vai'],['arms','Thon tay'],['legs','Thon chân'],['stretch','Kéo chân'],['height','Cao hơn'],['curve','Đường cong']];
   const activeBodyId=BODY_REGIONS.some(([id])=>id===this.brush.mode)?this.brush.mode:(this.bodyRegion||'waist');
   const regionLabel=body?(BODY_REGIONS.find(([id])=>id===activeBodyId)?.[1]||'Gọn eo'):(RESHAPE_PRESETS[this.reshapePreset]?.label||'Gọn mặt');
   const regionList=body
    ?BODY_REGIONS.map(([id,label])=>`<button type="button" role="option" aria-selected="${id===activeBodyId}" data-v5-body-region="${id}" class="${id===activeBodyId?'active':''}">${label}</button>`).join('')
    :Object.entries(RESHAPE_PRESETS).map(([id,p])=>`<button type="button" role="option" aria-selected="${id===this.reshapePreset}" data-v2-reshape-preset="${id}" class="${id===this.reshapePreset?'active':''}">${p.label}</button>`).join('');
   const regionPopover=this.reshapeRegionOpen?`<div class="v5-region-popover" role="listbox" aria-label="Chọn vùng chỉnh">${regionList}</div>`:'';
   const faceMeshSlider=!body&&!['freeze','restore-warp'].includes(this.brush.mode)&&(this.router?.placingFace||this.reshapePreset)?this.slider('Mức độ khuôn mặt','faceAmount',this.faceAmount??40,-100,100,1,'face-mesh'):'';
   let advanced='';
   if(this.brush.mode==='freeze'){
    advanced=`<button type="button" class="v2-inline-action" data-action="clear-freeze">Xóa vùng bảo vệ</button>`;
   }else if(body&&BODY_REGIONS.some(([id])=>id===this.brush.mode)){
    advanced=`<div class="v2-body-actions"><button type="button" data-action="body-place">${icon('pointer')}Đặt hai điểm</button>${this.router?.placingBody||this.router?.bodyHandles?.length?`<button type="button" data-action="body-pin" class="${this.router?.placingPin?'active':''}">${icon('shield')}Ghim giữ nền</button><button type="button" data-action="apply-body">Áp dụng theo điểm${icon('check')}</button>`:''}</div>`;
   }else if(!body&&(this.reshapePreset||this.router?.placingFace)){
    advanced=`<div class="v2-body-actions"><button type="button" data-action="face-place">${icon('pointer')}Đặt điểm khuôn mặt</button>${this.router?.placingFace?`<button type="button" data-action="apply-face">Áp dụng theo điểm${icon('check')}</button>`:''}</div>`;
   }
   return `${tabs([['face','Khuôn mặt'],['body','Vóc dáng']],this.reshapeMode,'data-reshape-group')}<div class="v2-tool-strip">${this.card('Đẩy','push','reshape')}${this.card('Thu gọn','pinch','pinch')}${this.card('Làm đầy','bulge','expand')}${this.card('Bảo vệ','freeze','shield')}${this.card('Phục hồi','restore-warp','eraser')}</div><div class="v5-region-bar"><span class="v5-region-label">Vùng chỉnh:</span><button type="button" class="v5-region-trigger" data-v5-region-toggle aria-expanded="${!!this.reshapeRegionOpen}"><span>${regionLabel}</span>${icon('chevronDown')}</button></div>${regionPopover}${this.brushSlider()}${faceMeshSlider}${advanced}`;
  }
  const body=this.reshapeMode==='body';
  const faceMeshSlider=!body&&(this.router?.placingFace||this.reshapePreset)?this.slider('Mức độ khuôn mặt','faceAmount',this.faceAmount??40,-100,100,1,'face-mesh'):'';
  const faceActions=!body&&!['freeze','restore-warp'].includes(this.brush.mode)?`<div class="v2-body-actions"><button data-action="face-place">${icon('pointer')}Đặt điểm khuôn mặt</button><button data-action="apply-face">Áp dụng theo điểm${icon('check')}</button></div>`:'';
  const bodyCards=this.card('Gọn eo','waist','reshape')+this.card('Gọn vai','shoulder','reshape')+this.card('Thon tay','arms','reshape')+this.card('Thon chân','legs','reshape')+this.card('Kéo chân','stretch','arrowDown')+this.card('Cao hơn','height','arrowDown')+this.card('Đường cong','curve','reshape');
  const bodyActions=body&&['waist','shoulder','arms','legs','stretch','height','curve'].includes(this.brush.mode)?`<div class="v2-body-actions"><button data-action="body-place">${icon('pointer')}Đặt hai điểm</button><button data-action="body-pin" class="${this.router?.placingPin?'active':''}">${icon('shield')}Ghim giữ nền</button><button data-action="apply-body">Áp dụng theo điểm${icon('check')}</button></div>`:'';
  return `${tabs([['face','Đường nét / Liquify'],['body','Vóc dáng']],this.reshapeMode,'data-reshape-group')}<div class="v2-tool-strip">${body?bodyCards:this.card('Đẩy','push','reshape')+this.card('Thu gọn','pinch','pinch')+this.card('Làm đầy','bulge','expand')}${this.card('Bảo vệ','freeze','shield')}${this.card('Phục hồi','restore-warp','eraser')}</div>${!body?`<div class="pro-effect-list">${Object.entries(RESHAPE_PRESETS).map(([id,p])=>`<button data-v2-reshape-preset="${id}" class="${id===this.reshapePreset?'active':''}">${p.label}</button>`).join('')}</div>`:''}${this.brushSlider()}${faceMeshSlider}${bodyActions||faceActions||miniNote(this.brush.mode==='freeze'?'Tô vùng cần giữ nguyên trước khi chỉnh đường nét':'Kéo nhẹ trên ảnh · Mỗi thao tác đều có thể hoàn tác')}${this.expanded?'<button class="v2-inline-action" data-action="clear-freeze">Xóa vùng bảo vệ</button>':''}`;
 }
 makeupPanel(){
  if(this.makeupStudio)return this.makeupStudio.renderMakeupPanel(this);
  this.ensureMakeupStudio().then(()=>{if(this.tool==='makeup')this.renderPanel();}).catch(()=>{});
  return super.makeupPanel();
 }
 textPanel(){
  if(this.creativeStudio)return this.creativeStudio.renderTextPanel(this);
  this.ensureCreativeStudio().then(()=>{if(this.tool==='text')this.renderPanel();}).catch(()=>{});
  return super.textPanel();
 }
 stickerPanel(){return `<div class="v2-sticker-panel">${super.stickerPanel().replace(/<div class="panel-tip">[\s\S]*?<\/div>/,'')}</div>`;}
 framePanel(){
  if(this.creativeStudio)return this.creativeStudio.renderFramePanel(this);
  this.ensureCreativeStudio().then(()=>{if(this.tool==='frames')this.renderPanel();}).catch(()=>{});
  return '';
 }
 collagePanel(){let panel=super.collagePanel().replace(/<div class="panel-tip">[\s\S]*?<\/div>/,'');if(!this.expanded)panel=panel.replace(/<button[^>]+data-action="replace-frame"[^>]*>[\s\S]*?<\/button>/,'');return `<div class="v2-collage-layouts">${panel}</div>`;}
 templatesPanel(){return `<div class="v2-template-strip">${super.templatesPanel().replace(/<div class="panel-tip">[\s\S]*?<\/div>/,'')}</div>`;}
 blendOptions(value){return [['source-over','Bình thường'],['multiply','Nhân màu'],['screen','Làm sáng'],['overlay','Phủ màu'],['soft-light','Ánh sáng mềm'],['color','Sắc màu']].map(([v,n])=>`<option value="${v}" ${value===v?'selected':''}>${n}</option>`).join('');}
 layersPanel(){
  const layers=[...this.f.config.layers].filter(l=>l.type).sort((a,b)=>b.order-a.order),active=this.f.config.layer;
  return `<div class="layers-list">${layers.map(l=>`<div class="layer-row ${l.id===active?.id?'active':''}"><button class="layer-select" data-v2-layer="${l.id}"><span class="layer-thumb ${l.studio?.makeup?'v2-mask-thumb':''}">${l.studio?.makeup?icon('makeup'):l.type==='image'?`<img src="${esc(this.f.sources.get(l.studio?.sourceId)?.url||'./assets/photos/portrait.jpg')}" alt="">`:l.type==='text'?'Aa':icon('frame')}</span><span><span class="layer-name">${esc(l.name)}</span><small class="layer-type">${l.studio?.makeup?'Màu thủ công · Đi theo ảnh':l.type==='text'?'Văn bản':l.studio?.canvasFrame?'Khung ảnh':l.studio?.sticker?'Sticker':'Ảnh gốc & công thức'}</small></span></button><button class="layer-visible" data-visible="${l.id}" aria-label="${l.visible?'Ẩn':'Hiện'} ${esc(l.name)}">${icon(l.visible?'eye':'eyeOff')}</button></div>`).join('')}</div><div class="v2-layer-controls"><button data-action="layer-up" aria-label="Đưa lên">${icon('arrowUp')}</button><button data-action="layer-down" aria-label="Đưa xuống">${icon('arrowDown')}</button><button data-action="duplicate" aria-label="Nhân bản lớp">${icon('copy')}</button><button data-action="delete-layer" aria-label="Xóa lớp">${icon('trash')}</button></div>${this.expanded?`${this.slider('Độ trong suốt','opacity',active?.opacity??100,0,100,1,'layer')}<select class="studio-field" id="layer-blend" aria-label="Hòa trộn lớp">${this.blendOptions(active?.composition)}</select><button class="v2-inline-action" data-action="merge-layers">Gộp với lớp bên dưới</button>`:miniNote('Chọn lớp để di chuyển · Kéo bảng lên để chỉnh hòa trộn')}`;
 }
 geometryPanel(){
  const tab=this.geometryTab||'crop',nav=tabs([['crop','Cắt ảnh'],['rotate','Xoay & lật'],['perspective','Phối cảnh'],['resize','Kích thước']],tab,'data-v2-geometry-tab');
  if(tab==='crop')return `${nav}<div class="v2-crop-ratios">${[['free','Tự do'],['1','1:1'],['0.8','4:5'],['0.666667','2:3'],['0.5625','9:16'],['1.777778','16:9']].map(([id,label])=>`<button data-ratio="${id}"><i style="--ratio:${id==='free'?1.2:id}"></i>${label}</button>`).join('')}</div>${miniNote('Kéo trên ảnh để chọn vùng cắt, hoặc chọn một tỉ lệ')}`;
  if(tab==='rotate')return `${nav}<div class="v2-rotate-actions">${[['rotate','rotate','90°'],['flip-x','flip','Lật ngang'],['flip-y','flip','Lật dọc'],['fit','fit','Vừa khung']].map(([a,ic,label])=>`<button data-action="${a}">${icon(ic)}${label}</button>`).join('')}</div>${this.slider('Góc xoay','angle',this.f.basePhotoLayer()?.rotate||0,-180,360,1,'rotation')}`;
  if(tab==='perspective')return `${nav}${this.slider('Ngang','perspectiveX',this.draft.perspectiveX??this.f.basePhotoLayer()?.studio.perspectiveX??0,-50,50,1,'geometry')}${this.slider('Dọc','perspectiveY',this.draft.perspectiveY??this.f.basePhotoLayer()?.studio.perspectiveY??0,-50,50,1,'geometry')}`;
  return `${nav}<div class="fields-row"><label class="field-label">Rộng · px<input id="resize-width" class="studio-field" type="number" inputmode="numeric" value="${this.f.config.WIDTH}" min="1" max="20000"></label><label class="field-label">Cao · px<input id="resize-height" class="studio-field" type="number" inputmode="numeric" value="${this.f.config.HEIGHT}" min="1" max="20000"></label></div><button class="v2-primary v2-wide" data-action="resize">Đổi kích thước</button>`;
 }
 drawPanel(){return `<div class="v2-tool-strip">${this.card('Bút màu','paint','brush')}${this.card('Tẩy','erase','eraser')}${this.card('Phục hồi','restore','reset')}${this.card('Sao chép','clone','clone')}<label class="v2-brush-color"><input type="color" data-makeup-color value="${this.brush.color}" aria-label="Màu bút">Màu</label></div>${this.brush.mode==='tone'?'<div class="palette">'+['#e8c2a5','#d6a385','#be8a6c','#916343'].map(c=>'<button data-color="'+c+'" class="swatch" style="background:'+c+'" aria-label="Tông da '+c+'"></button>').join('')+'</div>':''}${this.brushSlider()}${['clone','heal'].includes(this.brush.mode)?'<button class="v2-inline-action" data-action="clone-source">Chọn vùng nguồn</button>':miniNote('Tô trên lớp ảnh · Dùng Hoàn tác để bỏ từng nét')}`;}
 navigate(operation){const next=(this.navigation||Promise.resolve()).then(async()=>{const panel=$('#studio-inspector');panel.setAttribute('aria-busy','true');try{return await operation();}finally{panel.setAttribute('aria-busy','false');}});this.navigation=next.catch(()=>{});return next;}
 switchTool(tool){return this.navigate(()=>this.openTool(tool));}
 async openTool(tool){
  if(!names[tool]||tool==='home')return;await this.commitDraft();this.router?.cancel();if(this.router){this.router.placingBody=false;this.router.placingFace=false;this.router.placingPin=false;}
  if(tool==='makeup')await this.ensureMakeupStudio();
  if(['text','stickers','frames','collage','templates'].includes(tool))await this.ensureCreativeStudio();
  this.brush.axis=undefined;this.reshapePreset=undefined;this.reshapeRegionOpen=false;const previousParent=this.f.basePhotoLayer();this.f.workLayerId=null;this.tool=tool;this.showEditor();
  if(['auto','beauty','adjust','filters','reshape','makeup','draw','geometry','frames'].includes(tool)&&previousParent)await this.f.select(previousParent.id);
  if(tool==='makeup'){const existing=this.f.config.layers.find(l=>l.studio?.makeup?.targetId===previousParent?.id&&l.studio.makeup.role===this.makeupMode);if(existing)await this.f.chooseMakeupLayer(existing.id);else await this.f.newMakeupLayer(this.makeupMode);this.brush.mode='makeup';this.brush.blend='source-over';}
  if(tool==='beauty'&&!['smooth','brighten','blemish','clone','heal','tone','dodge','burn','restore'].includes(this.brush.mode))this.brush.mode='smooth';
  if(tool==='reshape')this.brush.mode=this.reshapeMode==='body'?'waist':'push';if(tool==='draw')this.brush.mode='paint';
  await this.f.activate(tool==='geometry'&&this.geometryTab==='crop'?'crop':['auto','beauty','reshape','makeup','draw','adjust','filters','frames'].includes(tool)?'studio':'select');
  if(tool==='layers'&&this.f.config.layer?.studio?.makeup)await this.f.activate('studio');
  this.draft={};this.sheet.set('compact',{render:false});if(tool==='auto')await this.applyAutoEnhance(this.autoStyle||'balanced',this.autoIntensity??80);this.renderPanel();$('#panel-content').scrollTop=0;document.querySelector(`#mobile-nav [data-tool="${tool}"]`)?.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'smooth'});this.mobileViewport.schedule();
 }
 closeSheet(){return this.navigate(async()=>{await super.closeSheet();this.f.workLayerId=null;});}
 async showLibrary(){return this.showHome('studio');}
 async showHome(tab='studio'){
  if(document.activeElement&&!document.activeElement.closest('#mobile-library'))this.lastEditorFocus=document.activeElement;
  await this.closeSheet();this.libraryVisible=true;this.homeTab=tab;$('#mobile-library').hidden=false;$('#mobile-shell').dataset.view='library';
  const h=document.querySelector('.mobile-header'),m=document.getElementById('middle_area'),s=document.getElementById('studio-inspector'),n=document.getElementById('mobile-nav');
  if(h)h.inert=true;if(m)m.inert=true;if(s)s.inert=true;if(n)n.inert=true;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',this.isV5?'#141416':'#fbf9f8');this.updateChrome();await this.renderHome();
 }
 showEditor(){
  super.showEditor();this.homeEpoch=(this.homeEpoch||0)+1;
  const h=document.querySelector('.mobile-header'),m=document.getElementById('middle_area'),s=document.getElementById('studio-inspector'),n=document.getElementById('mobile-nav');
  if(h)h.inert=false;if(m)m.inert=false;if(s)s.inert=false;if(n)n.inert=false;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',this.isV5?'#141416':'#19191D');
  if(this.lastEditorFocus&&document.contains(this.lastEditorFocus)){this.lastEditorFocus.focus();}else{document.querySelector('.mobile-header button[data-action="back"]')?.focus();}
 }
 async renderHome(){
  const token=++this.homeEpoch,tab=this.homeTab;let list=[];try{list=await this.f.repository.list();this.looks=await this.preferences.listLooks();}catch{}
  if(token!==this.homeEpoch||!this.libraryVisible)return;document.querySelectorAll('[data-v2-home]').forEach(b=>b.classList.toggle('active',b.dataset.v2Home===tab));
  const draftMarkup=projects=>projects.length?`<div class="v2-drafts">${projects.map(p=>`<div class="v2-draft-item"><button data-v2-project="${esc(p.id)}"><span class="v2-draft-image" data-v2-thumb="${esc(p.id)}">${icon('image')}</span><strong>${esc(p.name)}</strong><small>${p.width} × ${p.height} · ${new Date(p.modified).toLocaleDateString('vi-VN',{timeZone:'Asia/Bangkok',day:'numeric',month:'numeric'})}</small></button>${tab==='projects'?`<button class="v2-project-delete" data-v2-remove-project="${esc(p.id)}" aria-label="Xóa dự án ${esc(p.name)}">${icon('trash')}</button>`:''}</div>`).join('')}</div>`:'<p class="v2-empty-inline">Dự án bạn tạo sẽ tự lưu trên thiết bị này.</p>';
  const recentRail=projects=>`<div class="${this.isV5?'v5-rail':'v4-rail'}">${projects.map(p=>`<article class="${this.isV5?'v5-recent-card':'v4-recent-card'}"><button data-v2-project="${esc(p.id)}"><span class="${this.isV5?'v5-recent-thumb':'v4-recent-thumb'}" data-v2-thumb="${esc(p.id)}">${icon('image')}</span><span class="${this.isV5?'v5-recent-meta':'v4-recent-meta'}"><strong>${esc(p.name)}</strong><small>${p.width}×${p.height} · ${new Date(p.modified).toLocaleDateString('vi-VN',{timeZone:'Asia/Bangkok',day:'numeric',month:'numeric'})}</small></span></button></article>`).join('')}${this.isV5?`<button class="v5-create-card" data-v2-action="open-photo" aria-label="Mở ảnh mới">${icon('plus')}</button>`:''}</div>`;
  const section=(title,action,body)=>`<section class="${this.isV5?'v5-home-section':'v2-home-section'}"><div class="${this.isV5?'v5-section-heading':'v2-section-heading'}"><h3>${title}</h3>${action||''}</div>${body}</section>`;
  if(tab==='projects')$('#v2-home-content').innerHTML=`<div class="v2-page-intro"><span>YOUR PERSONAL WORKSPACE</span><h2>Dành lại<br>một chút cảm hứng.</h2><p>Dự án và các lớp chỉnh sửa, ngay trên thiết bị.</p></div><div class="v2-project-actions"><button class="v2-primary" data-action="import-project">${icon('folder')}Mở file dự án</button><button data-action="download-project">${icon('download')}Lưu bản sao</button></div>${section(`${list.length} dự án`,'',draftMarkup(list))}`;
  else if(tab==='looks')$('#v2-home-content').innerHTML=`<div class="v2-page-intro"><span>YOUR COLOR SIGNATURE</span><h2>Một sắc màu.<br>Rất riêng bạn.</h2><p>Lưu ánh sáng, đường cong và sắc độ để dùng lại.</p></div>${this.looks.length?`<div class="v2-saved-looks">${this.looks.map(l=>`<div><button data-v2-home-look="${esc(l.id)}"><span>${icon('filters')}</span><strong>${esc(l.name)}</strong><small>${PRESETS.find(p=>p.id===l.recipe.preset)?.name||'Màu riêng'} · ${l.recipe.intensity??100}%</small></button><button data-v2-remove-look="${esc(l.id)}" aria-label="Xóa màu ${esc(l.name)}">${icon('trash')}</button></div>`).join('')}</div>`:`<div class="v2-home-empty">${icon('filters')}<h3>Bắt đầu bộ sưu tập của bạn</h3><p>Chỉnh một bức ảnh, rồi chọn “Lưu màu” trong Bộ lọc.</p><button data-v2-action="current-filters">Thử với ảnh đang mở ${icon('arrowRight')}</button></div>`}${section('Bộ sưu tập phong cách','',this.homeInspiration())}`;
  else if(this.isV5)$('#v2-home-content').innerHTML=`<section class="v5-hero"><img class="v5-hero-img" src="./assets/photos/portrait.jpg" alt="Ảnh chân dung mẫu BaoHim Photo V5"><div class="v5-hero-scrim"><h2 class="v5-hero-title">Chỉnh ảnh<br>chuyên nghiệp</h2><p class="v5-hero-desc">Làm đẹp · Màu sắc · Phong cách</p><svg class="v5-hero-flourish" width="112" height="10" viewBox="0 0 112 10" fill="none" aria-hidden="true"><path d="M2 7.5C28 2.5 74 1.5 110 4.5" stroke="#E27FAB" stroke-width="2.4" stroke-linecap="round"/></svg><div class="v5-hero-actions"><button class="v5-btn-berry" data-v2-action="open-photo">${icon('image')}<span>Chỉnh ảnh</span>${icon('chevronRight')}</button><button class="v5-btn-glass" data-v2-action="demo">Ảnh mẫu</button></div></div></section><div class="v5-quick-grid">${[['beauty','sparkle','Làm đẹp'],['makeup','makeup','Makeup'],['body-reshape','body','Chỉnh dáng'],['filters','filters','Bộ lọc']].map(([target,ic,label])=>`<button class="v5-quick-item" data-v4-launch="${target}"><span class="v5-quick-icon">${icon(ic)}</span><span class="v5-quick-label">${label}</span></button>`).join('')}</div><div class="v5-tool-pills-wrap"><div class="v5-tool-pills"><button class="v5-tool-pill" data-v4-launch="adjust"><span class="v5-pill-icon">${icon('sliders')}</span><span>Chỉnh màu</span></button><button class="v5-tool-pill" data-v4-launch="hsl"><span class="v5-pill-icon">${icon('curve')}</span><span>HSL & Curve</span></button><button class="v5-tool-pill" data-v5-pending="erase"><span class="v5-pill-icon">${icon('bandaid')}</span><span>Xoá vật thể</span></button><button class="v5-tool-pill" data-v4-launch="collage"><span class="v5-pill-icon">${icon('collage')}</span><span>Ghép ảnh</span></button><button class="v5-tool-pill" data-v4-launch="text"><span class="v5-pill-icon">${icon('text')}</span><span>Chữ</span></button><button class="v5-tool-pill" data-v4-launch="stickers"><span class="v5-pill-icon">${icon('star')}</span><span>Sticker</span></button></div><div class="v5-pills-pagination"><span class="v5-dot active"></span><span class="v5-dot"></span></div></div>${section('<span class=\"v5-heading-icon\">✨</span> Phong cách gợi ý',`<button data-v2-action=\"current-filters\">Xem thêm ${icon('chevronRight')}</button>`,this.homeInspiration())}${section('<span class=\"v5-heading-icon\">' + icon('layers') + '</span> Dự án gần đây',`<button data-v2-home=\"projects\">Xem tất cả ${icon('chevronRight')}</button>`,recentRail(list.slice(0,8)))}<div class="v5-home-foot">${icon('shield')}Xử lý cục bộ trên thiết bị · Không AI · Không watermark</div>`;
  else $('#v2-home-content').innerHTML=`<section class="v4-hero"><img class="v4-hero-img" src="./assets/photos/portrait.jpg" alt="Ảnh chân dung mẫu BaoHim Photo V4"><div class="v4-hero-scrim"><span class="v4-hero-kicker">PEARL EDITORIAL · BAO HIM V4</span><h2 class="v4-hero-title">Tinh tế từng đường nét,<br>rạng rỡ trọn chất riêng.</h2><div class="v4-hero-actions"><button class="v4-btn-berry" data-v2-action="open-photo">${icon('plus')}Chỉnh ảnh mới</button><button class="v4-btn-glass" data-v2-action="demo">Ảnh mẫu</button></div></div></section><div class="v4-quick-grid">${[['beauty','beauty','Beauty','Mịn da & heal'],['filters','filters','Filter','Film & CCD'],['makeup','makeup','Makeup','Son, má, tóc'],['body-reshape','body','Body','Dáng & tỷ lệ']].map(([target,ic,label,sub])=>`<button class="v4-quick-item" data-v4-launch="${target}"><span class="v4-quick-icon">${icon(ic)}</span><span class="v4-quick-label">${label}</span><small class="v4-quick-sub">${sub}</small></button>`).join('')}</div>${section('Dự án gần đây',`<button data-v2-home="projects">Xem tất cả ${icon('chevronRight')}</button>`,recentRail(list.slice(0,8)))}${section('Bộ sưu tập phong cách',`<button data-v2-action="current-filters">${PRESETS.length} sắc độ ${icon('chevronRight')}</button>`,this.homeInspiration())}<div class="v2-home-foot">${icon('shield')}Xử lý cục bộ trên thiết bị · Không AI · Không watermark</div>`;
  hydrateIcons($('#mobile-library'));const liveIds=new Set(list.map(p=>p.id));for(const [id,url] of this.thumbURLs)if(!liveIds.has(id)){URL.revokeObjectURL(url);this.thumbURLs.delete(id);}for(const p of list){const blob=await this.preferences.thumbnail(p.id).catch(()=>null);if(token!==this.homeEpoch)return;if(blob){const old=this.thumbURLs.get(p.id);if(old)URL.revokeObjectURL(old);const url=URL.createObjectURL(blob);this.thumbURLs.set(p.id,url);const el=document.querySelector(`[data-v2-thumb="${p.id}"]`);if(el)el.innerHTML=`<img src="${esc(url)}" alt="${esc(p.name)}">`;}}
 }
 homeInspiration(){
  const cardClass=this.isV5?'v5-style-card':'v4-style-card';
  const railClass=this.isV5?'v5-rail':'v4-rail';
  const overlayClass=this.isV5?'v5-style-overlay':'v4-style-overlay';
  const items=this.isV5?[
   ['portrait','film','🔥 Trong trẻo','film','Trong trẻo tự nhiên'],
   ['sunlight','y2k-flash','Film CCD','ccd','Retro 2000s'],
   ['portrait','seoul','Hàn Quốc','korean','Sáng mịn'],
   ['muse','vintage-90','Vintage','vintage','Tone ấm']
  ]:[
   ['portrait','film','Film 35mm','film','Hồng phấn · Da trong'],
   ['sunlight','y2k-flash','CCD Digicam','ccd','Flash nhẹ · Retro 2000'],
   ['portrait','seoul','Hàn Trong Veo','korean','Sáng mịn · Thanh thoát'],
   ['muse','peony','Trung Cổ Điển','chinese','Điện ảnh · Rạng rỡ'],
   ['sunlight','kyoto','Nhật Mờ Sương','japanese','Dịu sáng · Phim trong'],
   ['muse','vintage-90','Vintage Diary','vintage','Nắng ấm · Hạt phim']
  ];
  return `<div class="${railClass}">${items.map(([photo,look,label,group,sub])=>`<button class="${cardClass}" data-v2-sample-look="${look}" data-v2-photo="${photo}" data-v4-filter-group="${group}"><img src="./assets/photos/${photo}.jpg" alt="${esc(label)}"><span class="${overlayClass}"><strong>${label}</strong>${this.isV5?'':`<small>${sub}</small>`}</span></button>`).join('')}</div>`;
 }
 async updateDraftThumbnail(){if(this.thumbnailBusy||!this.f.id||this.f.loadingDocument||this.f.historyJumping)return;this.thumbnailBusy=true;const id=this.f.id,revision=this.f.revision;try{const blob=await this.f.exportImage({format:'jpeg',quality:.7,scale:Math.min(1,240/Math.max(this.f.config.WIDTH,this.f.config.HEIGHT))});if(this.f.id===id&&this.f.revision===revision){await this.preferences.saveThumbnail(id,blob);if(this.libraryVisible)await this.renderHome();}}finally{this.thumbnailBusy=false;}}
 async savePersonalLook(name){await this.commitDraft();const look=lookFromStudio(this.f.basePhotoLayer()?.studio||{},name);await this.preferences.saveLook(look);this.looks=await this.preferences.listLooks();return look;}
 selectMakeupRole(role,options={}){return this.navigate(()=>this.openMakeupRole(role,options));}
 async openMakeupRole(role,{fresh=false}={}){const {MAKEUP_ROLES}=await this.ensureMakeupStudio();if(!MAKEUP_ROLES[role])return;await this.commitDraft();const parent=this.f.basePhotoLayer();this.makeupMode=role;this.router?.cancel();const existing=!fresh&&this.f.config.layers.findLast(l=>l.studio?.makeup?.targetId===parent?.id&&l.studio.makeup.role===role);if(existing)await this.f.chooseMakeupLayer(existing.id);else await this.f.newMakeupLayer(role);this.brush.mode='makeup';this.brush.color=MAKEUP_ROLES[role][2];this.brush.blend='source-over';this.brush.strength=role==='lips'?55:role==='eyeliner'?65:role==='hair'?45:30;if(role==='hair')this.brush.feather=55;if(role==='eyeliner')this.brush.size=24;this.f.activate('studio');this.renderPanel();}
 async applyMakeupPreset(presetId){
  const {MAKEUP_PRESETS}=await this.ensureMakeupStudio();
  const p=MAKEUP_PRESETS[presetId];if(!p)return;
  this.makeupPreset=presetId;
  await this.openMakeupRole(p.role);
  this.brush.color=p.color;this.brush.strength=p.strength;
  const layer=this.f.activeMakeupLayer();
  if(layer){
   await this.f.updateLayer({opacity:p.opacity,composition:p.blend});
   if(layer.studio.strokes?.length){
    await this.f.updateStudio({strokes:layer.studio.strokes.map(s=>s.type==='makeup'?{...s,color:p.color}:s)},layer);
   }
  }
  this.renderPanel();
 }
 async loadProject(project){await this.commitDraft();this.router?.cancel();this.showLoading(true);try{await this.f.restore(project);this.draft={};this.closeDialog();await this.closeSheet();this.showEditor();}catch(error){await this.showHome(this.homeTab||'studio');throw error;}finally{this.showLoading(false);}}
 showLoading(active){super.showLoading(active);if(this.mobileViewport){$('#mobile-nav').inert=active;$('#studio-inspector').inert=active;document.querySelectorAll('.mobile-header button').forEach(b=>b.disabled=active);}if(!active&&this.pendingOpen){const pending=this.pendingOpen;this.pendingOpen=null;if(this.f.id!==pending.id&&pending.chosen)queueMicrotask(()=>this.safely(async()=>{if(pending.look)await this.f.applyLook(pending.look.recipe);if(pending.tool)await this.switchTool(pending.tool);else{await this.closeSheet();this.showEditor();}await this.f.fit();}));}}
 confirmComposition(kind,id){this.pendingComposition={kind,id,epoch:this.f.epoch};this.dialog('Tạo bố cục mới?',`<p>Bố cục mới sẽ sắp xếp lại ảnh và giữ các lớp trang điểm đi kèm. Chữ, sticker và khung hiện có sẽ được thay thế. Bạn có thể hoàn tác để quay lại.</p><button class="v2-primary v2-wide" data-v2-action="apply-composition">Tạo bố cục</button>`);}
 async action(action,button){
  if(this.f.loadingDocument&&action!=='dialog-close')throw new Error('Đang mở ảnh. Hãy đợi ảnh sẵn sàng.');
  if(['open','add-photo','replace-frame'].includes(action)){this.addPhoto=action!=='open';this.replaceFrame=action==='replace-frame';if(this.replaceFrame&&!this.f.config.layer?.studio?.frame){this.toast('Chọn một ảnh trong bố cục trước.');return;}$('#photo-input').click();return;}
  if(action==='apply'&&this.tool==='collage'&&this.f.config.layers.some(l=>l.type==='text'||l.studio?.sticker&&!l.studio?.makeup||l.studio?.canvasFrame)){this.confirmComposition('collage',this.collageLayout);return;}
  if(action==='histogram')return;
  if(action==='projects'){await this.showHome('projects');return;}
  if(action==='add-text'){await this.ensureCreativeStudio();await this.commitDraft();await this.f.addText();this.textTab='content';this.renderPanel();this.sheet.set('compact');$('#studio-text')?.focus();return;}
  if(action==='reset'&&this.tool==='auto'){this.draft={};await this.f.updateStudio({preset:'original',intensity:100,adjustments:{}});this.renderPanel();return;}
  if(action==='reset'&&this.tool==='frames'){await this.f.framePhoto(this.frameStyle||'paper',0);this.renderPanel();return;}
  if(action==='reset'&&this.tool==='makeup'){const layer=this.f.activeMakeupLayer();if(!layer){this.toast('Chọn một lớp trang điểm trước.');return;}await this.f.updateStudio({strokes:[],adjustments:{}},layer);this.renderPanel();return;}
  if(action==='reset'&&this.tool==='text'){await this.commitDraft();await this.f.updateText({meta:{family:'Manrope',bold:false,italic:false,underline:false,stroke_size:0,kerning:0,leading:10},typography:{arc:0,shadow:0,glow:0,depth:0,bubble:'none',gradient:{enabled:false,from:'#ffffff',to:'#d96792',angle:0}}});this.renderPanel();return;}
  if(action==='apply'&&this.tool==='geometry'&&this.geometryTab!=='crop'){await this.commitDraft();await this.closeSheet();return;}
  if(action==='apply'&&this.tool==='frames'){await this.closeSheet();return;}
  if(action==='delete-layer'&&this.f.config.layer?.studio?.canvasFrame){await this.f.framePhoto('paper',0);this.renderPanel();return;}
  if(action==='more'){this.dialog('Dự án của bạn',`<div class="v2-menu-list"><button data-action="download-project">${icon('download')}Lưu file dự án<span>.pbs.json</span></button><button data-action="import-project">${icon('folder')}Mở file dự án</button><button data-v2-action="history">${icon('history')}Lịch sử phiên hiện tại</button><button data-v2-action="save-look">${icon('filters')}Lưu công thức màu</button><button data-v2-action="settings">${icon('info')}Thông tin & ngoại tuyến</button></div>`);$('#dialog-content h2').textContent='Dự án của bạn';return;}
  await super.action(action,button);
 }
 async historyDialog(){await this.commitDraft();const s=this.f.app.State,labels={update_layer:'Tinh chỉnh lớp',insert_layer:'Thêm lớp',delete_layer:'Xóa lớp',studio_frame:'Khung ảnh',studio_collage:'Ghép ảnh',studio_crop:'Cắt ảnh',studio_text:'Chỉnh chữ',update_config:'Đổi kích thước',rotate_layer:'Xoay ảnh',delete_photo:'Xóa ảnh và lớp màu'};this.dialog('Lịch sử chỉnh sửa',`<p class="v2-history-info">Phiên hiện tại · Dự án lưu ảnh gốc và các lớp. Chuỗi hoàn tác bắt đầu lại khi mở dự án.</p><button class="v2-link-row" data-v2-action="checkpoints">Mốc dự án đã lưu trên thiết bị ${icon('chevronRight')}</button><div class="v2-timeline">${[{label:'Khi mở dự án'},...s.action_history.map(a=>({label:labels[a.action_id]||labels[a.id]||a.description||a.action_description||'Chỉnh sửa ảnh'}))].map((a,i)=>`<button data-v2-history="${i}" class="${i===s.action_history_index?'active':''}" ${i>s.action_history_index?'data-future="true"':''}><i></i><span>${esc(a.label)}</span><small>${i===s.action_history_index?'Hiện tại':String(i).padStart(2,'0')}</small></button>`).join('')}</div>`);}
 async checkpointDialog(){await this.commitDraft();await this.f.save();await this.f.checkpointQueue;const list=await this.f.checkpoints.list(this.f.id);this.dialog('Mốc dự án đã lưu',`<p>Giữ tối đa 12 mốc trên thiết bị. Mỗi mốc giữ công thức và các lớp; ảnh gốc được dùng chung. Chuỗi hoàn tác bắt đầu lại khi mở một mốc.</p><div class="v2-timeline">${list.map((p,i)=>`<button data-v2-checkpoint="${esc(p.id)}"><i></i><span>${esc(p.name)}<small>${new Date(p.modified).toLocaleString('vi-VN')}</small></span><small>${i===0?'Mới nhất':'Mở mốc'}</small></button>`).join('')||'<p>Chưa có mốc đã lưu. Dự án hiện tại vẫn được giữ.</p>'}</div>`);}
 async saveLookDialog(){await this.commitDraft();this.closeDialog();this.dialog('Lưu màu của bạn',`<p>Công thức gồm bộ lọc, ánh sáng, sắc độ và đường cong. Dùng lại cho bất kỳ ảnh nào.</p><label class="field-label">Tên công thức<input class="studio-field" id="v2-look-name" maxlength="60" placeholder="Ví dụ: Nắng tháng ba" lang="vi"></label><button class="v2-primary v2-wide" data-v2-action="confirm-look">${icon('check')}Lưu trên thiết bị</button>`);$('#v2-look-name')?.focus();}
 startPhoto(tool,look){this.pendingOpen={id:this.f.id,tool,look,chosen:false};return this.action('open');}
 bindPremium(){
  document.addEventListener('click',event=>{
   const b=event.target.closest('button,a[data-v2-home]');if(!b)return;const d=b.dataset;
   if(d.reshapeGroup)this.reshapeRegionOpen=false;
   if(d.v3Category&&!d.tool){event.preventDefault();event.stopImmediatePropagation();this.safely(()=>this.switchCategory(d.v3Category));return;}
   if(d.v3Subtool){
    event.preventDefault();event.stopImmediatePropagation();
    this.safely(async()=>{
     if(d.v3Subtool==='face-reshape'){this.reshapeMode='face';await this.switchTool('reshape');return;}
     if(d.v3Subtool==='body-reshape'){this.reshapeMode='body';await this.switchTool('reshape');return;}
     await this.switchTool(d.v3Subtool);
    });
    return;
   }
   if(d.template&&['diptych','magazine','long'].includes(d.template)&&this.f.config.layers.some(l=>l.type==='text'||l.studio?.sticker&&!l.studio?.makeup||l.studio?.canvasFrame)){event.preventDefault();event.stopImmediatePropagation();this.safely(async()=>{await this.commitDraft();this.confirmComposition('template',d.template);});return;}
   if(d.v5Pending){event.preventDefault();event.stopImmediatePropagation();this.toast('Công cụ Xóa vật thể sẽ ra mắt ở Đợt 2.');return;}
   if(!Object.keys(d).some(k=>k.startsWith('v2')||k.startsWith('v4')||k.startsWith('v5')))return;event.preventDefault();event.stopImmediatePropagation();this.safely(async()=>{
    if(d.v2Home){await this.showHome(d.v2Home);return;}
    if(d.v4Launch){await this.commitDraft();this.showLoading(true);try{if(!this.f.basePhotoLayer())await this.f.openDemo('portrait');if(d.v4Launch==='body-reshape'){this.reshapeMode='body';await this.switchTool('reshape');}else if(d.v4Launch==='hsl'){this.adjustGroup='color';await this.switchTool('adjust');}else{if(d.v4Launch==='reshape')this.reshapeMode='face';await this.switchTool(d.v4Launch);}}finally{this.showLoading(false);}return;}
    if(d.v2Start){await this.startPhoto(d.v2Start);return;}
    if(d.v2AutoPreset){await this.applyAutoEnhance(d.v2AutoPreset,this.autoIntensity??80);this.renderPanel();return;}
    if(d.v2AdjustGroup){await this.commitDraft();this.adjustGroup=d.v2AdjustGroup;this.adjustKey=adjustmentGroups[d.v2AdjustGroup]?.[0][0];this.renderPanel();return;}
    if(d.v2AdjustKey){this.adjustKey=d.v2AdjustKey;this.renderPanel();return;}
    if(d.v5RegionToggle){this.reshapeRegionOpen=!this.reshapeRegionOpen;this.renderPanel();return;}
    if(d.v5BodyRegion){this.reshapeRegionOpen=false;this.bodyRegion=d.v5BodyRegion;this.brush.mode=d.v5BodyRegion;this.brush.axis=undefined;this.renderPanel();return;}
    if(d.v2ReshapePreset){const p=manualReshapePreset(d.v2ReshapePreset);this.reshapeRegionOpen=false;this.reshapePreset=d.v2ReshapePreset;this.brush.mode=p.mode;this.brush.size=p.size;this.brush.strength=p.strength;this.brush.axis=p.axis;this.renderPanel();this.toast('Chạm hoặc kéo tại vùng bạn muốn chỉnh. Không tự xác định khuôn mặt.');return;}
    if(d.v2HslBand){this.hslBand=d.v2HslBand;this.renderPanel();return;}
    if(d.v2HslChannel){this.hslChannel=d.v2HslChannel;this.renderPanel();return;}
    if(d.v2BrushSetting){this.brushSetting=d.v2BrushSetting;this.renderPanel();return;}
    if(d.v2ToneSetting){this.toneSetting=d.v2ToneSetting;this.renderPanel();return;}
    if(d.v2FilterGroup){this.filterGroup=d.v2FilterGroup;this.renderPanel();return;}
    if(d.v2CubeLut){
     const {BUILTIN_CUBE_LUTS}=await this.ensureLutStudio();
     const lut=d.v2CubeLut==='none'?null:BUILTIN_CUBE_LUTS[d.v2CubeLut]||null;
     this.draft={...this.draft,lut,intensity:this.draft.intensity??this.f.basePhotoLayer()?.studio.intensity??100};
     this.renderPanel();
     await this.f.preview(this.draft);
     return;
    }
    if(d.v2Look){const look=this.looks.find(l=>l.id===d.v2Look);if(look){await this.commitDraft();await this.f.applyLook(look.recipe);this.renderPanel();}return;}
    if(d.v2HomeLook){const look=this.looks.find(l=>l.id===d.v2HomeLook);if(look)await this.startPhoto('filters',look);return;}
    if(d.v2RemoveLook){this.dialog('Xóa công thức màu?',`<p>Ảnh và dự án đã chỉnh sẽ giữ công thức hiện tại.</p><button class="v2-danger v2-wide" data-v2-delete-look="${esc(d.v2RemoveLook)}">Xóa khỏi bộ sưu tập</button>`);return;}
    if(d.v2DeleteLook){await this.preferences.removeLook(d.v2DeleteLook);this.looks=await this.preferences.listLooks();this.closeDialog();await this.renderHome();return;}
    if(d.v2SampleLook){await this.commitDraft();this.showLoading(true);try{if(d.v4FilterGroup)this.filterGroup=d.v4FilterGroup;await this.f.openDemo(d.v2Photo);await this.f.applyLook({preset:d.v2SampleLook,intensity:100});await this.switchTool('filters');}finally{this.showLoading(false);}return;}
    if(d.v2RemoveProject){if(d.v2RemoveProject===this.f.id){this.dialog('Dự án đang mở',`<p>Hãy mở một ảnh hoặc dự án khác trước khi xóa dự án này.</p><button class="v2-primary v2-wide" data-action="dialog-close">Đã hiểu</button>`);return;}this.dialog('Xóa dự án khỏi thiết bị?',`<p>Ảnh gốc trong thư viện điện thoại không bị ảnh hưởng. Bản dự án này và thumbnail của nó sẽ được xóa.</p><button class="v2-danger v2-wide" data-v2-delete-project="${esc(d.v2RemoveProject)}">Xóa dự án</button>`);return;}
    if(d.v2DeleteProject){if(d.v2DeleteProject===this.f.id)throw new Error('Dự án này đang mở.');await this.f.repository.remove(d.v2DeleteProject);await this.f.checkpointQueue;await this.f.checkpoints.remove(d.v2DeleteProject).catch(()=>{});await this.preferences.removeThumbnail(d.v2DeleteProject).catch(()=>{});this.closeDialog();await this.updateProjectCount();await this.renderHome();return;}
    if(d.v2Project){const project=await this.f.repository.load(d.v2Project);if(project)await this.loadProject(project);return;}
    if(d.v2Layer){await this.commitDraft();this.f.workLayerId=null;await this.f.select(d.v2Layer);await this.f.activate(this.f.config.layer?.studio?.makeup||this.f.config.layer?.studio?.canvasFrame?'studio':'select');this.renderPanel();return;}
    if(d.v2MakeupRole){await this.selectMakeupRole(d.v2MakeupRole);return;}
    if(d.v2MakeupPreset){await this.navigate(()=>this.applyMakeupPreset(d.v2MakeupPreset));return;}
    if(d.v2HairKey){await this.commitDraft();this.hairKey=d.v2HairKey;this.renderPanel();return;}
    if(d.v2TextEffect){await this.commitDraft();this.textEffect=d.v2TextEffect;this.renderPanel();return;}
    if(d.v2Bubble){await this.commitDraft();await this.f.updateText({typography:{bubble:d.v2Bubble}});this.renderPanel();return;}
    if(d.v2TextTab){await this.commitDraft();this.textTab=d.v2TextTab;this.renderPanel();return;}
    if(d.v2Font){await this.commitDraft();await this.f.updateText({meta:{family:d.v2Font}});this.renderPanel();return;}
    if(d.v2TypeStyle){await this.commitDraft();const {CREATIVE_TYPE_STYLES}=await this.ensureCreativeStudio();await this.f.updateText(CREATIVE_TYPE_STYLES[d.v2TypeStyle]);this.renderPanel();return;}
    if(d.v2GeometryTab){await this.commitDraft();this.geometryTab=d.v2GeometryTab;await this.f.activate(d.v2GeometryTab==='crop'?'crop':'studio');this.renderPanel();return;}
    if(d.v2Frame){await this.commitDraft();this.frameStyle=d.v2Frame;await this.f.framePhoto(d.v2Frame,this.f.config.layers.find(l=>l.studio?.canvasFrame)?.studio.canvasFrame.percent||this.framePercent||5);this.renderPanel();return;}
    if(d.v2Checkpoint){const project=await this.f.checkpoints.load(d.v2Checkpoint);await this.loadProject(project);this.toast('Đã mở mốc dự án.');return;}
    if(d.v2History!==undefined){await this.f.goHistory(Number(d.v2History));await this.historyDialog();this.renderPanel();return;}
    const action=d.v2Action;
    if(action==='apply-composition'){const pending=this.pendingComposition;if(!pending||pending.epoch!==this.f.epoch)throw new Error('Dự án đã thay đổi. Hãy chọn lại bố cục.');this.pendingComposition=null;this.closeDialog();if(pending.kind==='collage'){await this.f.collage(pending.id,this.collageGap);await this.switchTool('layers');}else{await this.f.template(pending.id);await this.switchTool(pending.id==='long'?'layers':'text');}return;}
    if(action==='open-photo'){await this.startPhoto();return;}
    if(action==='current-filters'){this.closeDialog();await this.switchTool('filters');return;}
    if(action==='demo'){await this.commitDraft();this.showLoading(true);try{await this.f.openDemo();await this.closeSheet();this.showEditor();}finally{this.showLoading(false);}return;}
    if(action==='makeup-erase'){this.brush.mode='restore';this.renderPanel();return;}
    if(action==='new-makeup'){await this.selectMakeupRole(this.makeupMode,{fresh:true});return;}
    if(action==='makeup-layers'){await this.switchTool('layers');this.sheet.set('expanded');return;}
    if(action==='checkpoints'){await this.checkpointDialog();return;}
    if(action==='history'){await this.historyDialog();return;}
    if(action==='save-look'){await this.saveLookDialog();return;}
    if(action==='import-lut'){
     await this.ensureLutStudio();
     let input=$('#lut-file-input');
     if(!input){
      input=document.createElement('input');input.type='file';input.id='lut-file-input';input.accept='.cube,text/plain';input.hidden=true;document.body.append(input);
      input.addEventListener('change',()=>this.safely(async()=>{
       const file=input.files?.[0];if(!file)return;
       if(file.size>8*1024*1024)throw new Error('File LUT .cube vượt quá 8 MB.');
       const {parseCubeLut}=await this.ensureLutStudio();
       const lut=parseCubeLut(await file.text(),file.name.replace(/\.cube$/i,''));
       input.value='';
       this.draft={...this.draft,lut,intensity:this.draft.intensity??this.f.basePhotoLayer()?.studio.intensity??100};
       this.renderPanel();
       await this.f.preview(this.draft);
       this.toast(`Đã nạp 3D LUT ${lut.name}.`);
      }));
     }
     input.click();return;
    }
    if(action==='confirm-look'){const value=$('#v2-look-name').value.trim();if(!value){$('#v2-look-name').focus();return;}b.disabled=true;try{await this.savePersonalLook(value);this.closeDialog();this.toast('Đã lưu màu trên thiết bị.');if(this.tool==='filters'){this.filterGroup='saved';this.renderPanel();}}finally{b.disabled=false;}return;}
    if(action==='settings'){
     const isProfile=b.dataset.v5Tab==='profile'||b.querySelector('[data-icon="user"]')||b.getAttribute('aria-label')==='Cá nhân';
     if(isProfile){
      let pCount=0;try{pCount=(await this.f.repository.list())?.length||0;}catch{}
      const lCount=this.looks?.length||0;
      this.dialog('Không gian cá nhân',`<div class="v5-profile-summary"><div class="v5-profile-avatar">${icon('user')}</div><div class="v5-profile-meta"><strong>Không gian làm việc cục bộ</strong><p>BaoHim Photo V5 · Trên thiết bị này</p></div></div><div class="v5-profile-stats"><div class="v5-stat-card"><strong>${pCount}</strong><small>Dự án đã lưu</small></div><div class="v5-stat-card"><strong>${lCount}</strong><small>Công thức màu</small></div></div><div class="v2-menu-list"><button data-v2-home="projects">${icon('folder')}Quản lý dự án của bạn</button><button data-v2-home="looks">${icon('filters')}Bộ sưu tập công thức màu</button><button data-action="download-project">${icon('download')}Sao lưu toàn bộ dự án</button></div><p class="v2-history-info">Quyền riêng tư tuyệt đối: Không tải ảnh lên máy chủ, không yêu cầu tài khoản, không thu thập dữ liệu cá nhân.</p>`);
      return;
     }
     if(this.isV5){
      this.dialog('Cài đặt & Tùy chọn',`<div class="v2-menu-list"><div class="v2-about-row">${icon('shield')}<div><strong>Lưu trữ & Ngoại tuyến</strong><p>100% dữ liệu xử lý cục bộ trên thiết bị của bạn. Ứng dụng chạy offline sau khi tải lần đầu.</p></div></div><div class="v2-about-row">${icon('image')}<div><strong>Chất lượng xuất ảnh</strong><p>Độ phân giải tối đa 12.5 MP (khuyến nghị cho di động). Mở ảnh gốc tối đa 64 MP. Định dạng: JPG, PNG, WebP chất lượng cao.</p></div></div><div class="v2-about-row">${icon('sparkle')}<div><strong>Phiên bản BaoHim Photo</strong><p>V5 · CN Edition (Giai đoạn 3, Đợt 1). Giữ trọn vẹn engine chỉnh ảnh thủ công V4.</p></div></div></div><a class="v2-link-row" href="./licenses.html" target="_blank" rel="noopener">Giấy phép mã nguồn mở ${icon('arrowUpRight')}</a><a class="v2-link-row" href="./v2-report.html" target="_blank" rel="noopener">Báo cáo kiểm thử studio ${icon('arrowUpRight')}</a>`);
      return;
     }
     this.dialog('BaoHim Photo V4',`<p>Không gian chỉnh ảnh thủ công. Ảnh, công thức và dự án được xử lý trên thiết bị của bạn.</p><div class="v2-about-row">${icon('shield')}<div><strong>Ưu tiên ngoại tuyến</strong><p>Ứng dụng và tài nguyên cần được tải lần đầu. Trình duyệt có thể thu hồi bộ nhớ; hãy giữ file dự án cho ảnh quan trọng.</p></div></div><div class="v2-about-row">${icon('image')}<div><strong>Ảnh tĩnh · Không AI · Không watermark</strong><p>Xuất JPG/PNG/WebP tối đa 12 MP. Mở ảnh gốc tối đa 64 MP; ảnh HEIC tùy khả năng trình duyệt.</p></div></div><a class="v2-link-row" href="./licenses.html" target="_blank" rel="noopener">Nguồn mở & giấy phép ${icon('arrowUpRight')}</a><a class="v2-link-row" href="./v2-report.html" target="_blank" rel="noopener">Kiểm thử studio ${icon('arrowUpRight')}</a><p>BaoHim Photo V4 · Immersive Studio.</p>`);return;
    }
    if(action==='profile'){
     let pCount=0;try{pCount=(await this.f.repository.list())?.length||0;}catch{}
     const lCount=this.looks?.length||0;
     this.dialog('Không gian cá nhân',`<div class="v5-profile-summary"><div class="v5-profile-avatar">${icon('user')}</div><div class="v5-profile-meta"><strong>Không gian làm việc cục bộ</strong><p>BaoHim Photo V5 · Trên thiết bị này</p></div></div><div class="v5-profile-stats"><div class="v5-stat-card"><strong>${pCount}</strong><small>Dự án đã lưu</small></div><div class="v5-stat-card"><strong>${lCount}</strong><small>Công thức màu</small></div></div><div class="v2-menu-list"><button data-v2-home="projects">${icon('folder')}Quản lý dự án của bạn</button><button data-v2-home="looks">${icon('filters')}Bộ sưu tập công thức màu</button><button data-action="download-project">${icon('download')}Sao lưu toàn bộ dự án</button></div><p class="v2-history-info">Quyền riêng tư tuyệt đối: Không tải ảnh lên máy chủ, không yêu cầu tài khoản, không thu thập dữ liệu cá nhân.</p>`);
     return;
    }
    if(action==='compare'&&event.detail===0){await this.commitDraft();await this.f.setCompare(!this.f.compare);}
   });
  },true);
  document.addEventListener('input',event=>{const e=event.target;if(e.dataset.group==='hsl'){const band=this.hslBand||'red';this.draft.hsl={...this.f.basePhotoLayer()?.studio.hsl,...this.draft.hsl,[band]:{...this.f.basePhotoLayer()?.studio.hsl?.[band],...this.draft.hsl?.[band],[e.dataset.range]:Number(e.value)}};this.schedulePreview();}if(e.dataset.group==='gradient'){e.style.setProperty('--range',((Number(e.value)-Number(e.min))/(Number(e.max)-Number(e.min))*100)+'%');e.closest('.slider-field')?.querySelector('output')?.replaceChildren(document.createTextNode(e.value));const current=this.f.config.layer?.studio?.typography?.gradient||{enabled:true,from:'#ffffff',to:'#d96792',angle:0};this.pendingText.typography={...this.pendingText.typography,gradient:{...current,...this.pendingText.typography?.gradient,angle:Number(e.value)}};this.scheduleText();}},true);
  document.addEventListener('change',event=>{const e=event.target;if(e.id==='photo-input'&&e.files?.length&&this.pendingOpen)this.pendingOpen.chosen=true;if(e.id==='pro-bubble-color')this.safely(()=>this.f.updateText({typography:{bubbleColor:e.value}}));if(e.id.startsWith('v2-gradient-'))this.safely(async()=>{await this.commitDraft();const current=this.f.config.layer?.studio?.typography?.gradient||{enabled:false,from:'#ffffff',to:'#d96792',angle:0},key=e.id.slice('v2-gradient-'.length);await this.f.updateText({typography:{gradient:{...current,[key]:key==='enabled'?e.checked:e.value}}});this.renderPanel();});if(e.dataset.group==='frame')this.safely(async()=>{this.framePercent=Number(e.value);await this.f.framePhoto(this.f.config.layers.find(l=>l.studio?.canvasFrame)?.studio.canvasFrame.style||this.frameStyle||'paper',this.framePercent);this.renderPanel();});},true);
  const compare=$('[data-v2-action="compare"]');compare.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();this.compareHold={id:e.pointerId,previous:this.f.compare};compare.setPointerCapture?.(e.pointerId);this.safely(()=>this.commitDraft().then(()=>this.compareHold&&this.f.setCompare(true)));});
  const release=()=>{if(!this.compareHold)return;const previous=this.compareHold.previous;this.compareHold=null;this.safely(()=>this.f.setCompare(previous));};compare.addEventListener('pointerup',release);compare.addEventListener('pointercancel',release);compare.addEventListener('lostpointercapture',release);window.addEventListener('blur',release);
  $('#photo-input').addEventListener('cancel',()=>{this.pendingOpen=null;this.addPhoto=false;this.replaceFrame=false;});
  document.addEventListener('keydown',event=>{if(event.target.closest('input,textarea,select,[contenteditable=true]'))return;if(['delete','backspace'].includes(event.key.toLowerCase())){event.preventDefault();event.stopImmediatePropagation();this.safely(()=>this.action('delete-layer'));}},true);
 }
}
