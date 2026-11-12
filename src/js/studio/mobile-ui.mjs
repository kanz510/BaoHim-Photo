import {StudioUI} from './ui.mjs';
import {icon,hydrateIcons} from './icons.mjs';
import {PRESETS,DEFAULT_ADJUSTMENTS} from './math.mjs';
import {MobileSheet} from './mobile-sheet.mjs';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titles={home:'Chỉnh ảnh',auto:'Auto Cân bằng',beauty:'Làm đẹp',adjust:'Điều chỉnh',filters:'Bộ lọc',reshape:'Chỉnh dáng',makeup:'Trang điểm',text:'Văn bản',stickers:'Nhãn dán',collage:'Ghép ảnh',templates:'Mẫu thiết kế',layers:'Lớp ảnh',geometry:'Cắt & xoay',draw:'Vẽ & xóa'};
const adjustments=[['brightness','Sáng',-100,100,1],['contrast','Tương phản',-100,100,1],['saturation','Bão hòa',-100,100,1],['temperature','Nhiệt',-100,100,1],['exposure','Phơi sáng',-2,2,.05],['highlights','Vùng sáng',-100,100,1],['shadows','Vùng tối',-100,100,1],['tint','Sắc độ',-100,100,1],['sharpen','Sắc nét',0,100,1],['grain','Hạt film',0,100,1],['vignette','Viền tối',0,100,1]];

export class MobilePreviewUI extends StudioUI{
 constructor(facade,viewport){
  super(facade);this.mobileViewport=viewport;this.tool='home';this.adjustKey='brightness';this.libraryVisible=false;this.composing=false;
  this.sheet=new MobileSheet(this);this.bindMobile();this.renderPanel();this.updateChrome();
 }
 get expanded(){return this.sheet?.detent==='expanded';}
 header(){return `<div class="mobile-panel-heading"><h2>${titles[this.tool]||'Chỉnh ảnh'}</h2><div><button class="sheet-detail-toggle" data-mobile-action="sheet-toggle" aria-label="${this.expanded?'Thu gọn':'Mở rộng'} bảng công cụ">${icon(this.expanded?'chevronDown':'sliders')}</button><button class="sheet-close" data-mobile-action="sheet-close" aria-label="Đóng bảng công cụ">${icon('close')}</button></div></div>`;}
 beautyPanel(){
  if(this.expanded)return super.beautyPanel();
  return `<div class="tool-cards compact-tool-row">${this.card('Mịn da','smooth','smooth')}${this.card('Sáng da','brighten','sun')}${this.card('Sao chép','clone','clone')}${this.card('Nhấn sáng','dodge','dodge')}</div>${this.slider('Cường độ','strength',this.brush.strength,0,100,1,'brush')}${this.brush.mode==='clone'?'<button class="compact-link" data-action="clone-source">Chọn vùng nguồn trên ảnh</button>':'<p class="compact-caption">Tô nhẹ lên vùng ảnh muốn chăm chút.</p>'}`;
 }
 adjustPanel(){
  if(this.expanded)return super.adjustPanel();
  const active=adjustments.find(a=>a[0]===this.adjustKey)||adjustments[0],s={...DEFAULT_ADJUSTMENTS,...this.f.photoLayer()?.studio.adjustments,...this.draft.adjustments};
  return `<div class="adjust-options" aria-label="Thông số điều chỉnh">${adjustments.map(([key,label])=>`<button data-adjust-key="${key}" class="${active[0]===key?'active':''}">${label}</button>`).join('')}</div>${this.slider(active[1],active[0],s[active[0]],active[2],active[3],active[4],'adjust')}<p class="compact-caption">Kéo thanh để tìm sắc độ của riêng bạn.</p>`;
 }
 filterPanel(){
  const studio={...this.f.photoLayer()?.studio,...this.draft};
  return `<div class="filter-grid">${PRESETS.map(p=>`<button class="filter-card ${studio.preset===p.id?'active':''}" data-preset="${p.id}"><span class="filter-preview"><img src="./assets/photos/portrait.jpg" alt="${p.name}" data-filter-preview="${p.id}"></span><span class="filter-name">${p.name}</span></button>`).join('')}</div>${this.slider('Mức độ','intensity',studio.intensity??100,0,100,1,'filter')}`;
 }
 reshapePanel(){
  if(this.expanded)return super.reshapePanel();
  return `<div class="tool-cards compact-tool-row">${this.card('Đẩy nhẹ','push','reshape')}${this.card('Thu gọn','pinch','pointer')}${this.card('Làm đầy','bulge','sun')}${this.card('Bảo vệ','freeze','shield')}</div>${this.slider('Cường độ','strength',this.brush.strength,0,100,1,'brush')}<button class="compact-link" data-mobile-action="sheet-expand">Chỉnh vóc dáng & điểm điều khiển ${icon('chevronRight')}</button>`;
 }
 makeupPanel(){
  if(this.expanded)return super.makeupPanel();
  const colors=['#a8415c','#c76b83','#dd8c91','#9f6b84','#b5826c','#f2d4bc'];
  return `<div class="makeup-quick"><div class="tool-cards compact-tool-row">${this.card('Môi','lips','makeup',this.makeupMode)}${this.card('Má','blush','heart',this.makeupMode)}${this.card('Mắt','eyes','eye',this.makeupMode)}${this.card('Bắt sáng','highlight','sun',this.makeupMode)}</div><div class="palette">${colors.map(c=>`<button class="swatch ${c===this.brush.color?'active':''}" data-color="${c}" style="--swatch:${c};background:${c}" aria-label="Màu ${c}"></button>`).join('')}</div></div>${this.slider('Cường độ','strength',this.brush.strength,0,100,1,'brush')}`;
 }
 renderPanel(){
  if(this.tool==='home'){if($('#panel-header'))$('#panel-header').innerHTML=this.header();this.updateChrome();this.f.activate('studio');return;}
  const scroll=$('#panel-content')?.scrollTop||0;super.renderPanel();
  const viewOnly=['templates','stickers','layers'].includes(this.tool),left=viewOnly?(this.tool==='layers'?`<button class="sheet-secondary" data-action="add-photo">${icon('plus')}Thêm ảnh</button>`:`<button class="sheet-secondary" data-mobile-action="sheet-close">Đóng</button>`):`<button class="sheet-secondary" data-action="reset">${icon('reset')}Đặt lại</button>`;
  $('#panel-footer').innerHTML=`${left}<button class="sheet-confirm" data-action="apply">${this.tool==='collage'?'Tạo bố cục':this.tool==='geometry'?'Áp dụng':'Xong'}${icon('check')}</button>`;
  if($('#panel-content'))$('#panel-content').scrollTop=scroll;
  if(['beauty','reshape','makeup','draw'].includes(this.tool))this.f.activate('studio');this.updateChrome();
 }
 updateChrome(){
  if(!$('#mobile-title'))return;$('#mobile-title').textContent=this.libraryVisible?'Ảnh của bạn':titles[this.tool]||'Chỉnh ảnh';
  document.querySelectorAll('#mobile-nav [data-tool]').forEach(b=>{const active=b.dataset.tool===this.tool&&!this.libraryVisible;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 }
 async switchTool(tool){
  if(!titles[tool]||tool==='home')return;await this.commitDraft();this.router?.cancel();if(this.router)this.router.placingBody=false;
  const same=this.tool===tool;this.tool=tool;this.libraryVisible=false;$('#mobile-library').hidden=true;$('#mobile-shell').dataset.view='editor';
  if(['beauty','adjust','filters','reshape','makeup','draw'].includes(tool))await this.f.selectPhoto();
  await this.f.activate(tool==='geometry'?'crop':['beauty','reshape','makeup','draw'].includes(tool)?'studio':'select');
  if(tool==='beauty'&&!['smooth','brighten','clone','dodge','restore','burn'].includes(this.brush.mode))this.brush.mode='smooth';
  if(tool==='reshape')this.brush.mode=this.reshapeMode==='body'?'waist':'push';if(tool==='makeup')this.brush.mode='makeup';if(tool==='draw')this.brush.mode='paint';
  this.draft={};this.sheet.set(same&&this.sheet.detent==='expanded'?'compact':'compact',{render:false});this.renderPanel();$('#panel-content').scrollTop=0;
  document.querySelector(`#mobile-nav [data-tool="${tool}"]`)?.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'smooth'});this.mobileViewport.schedule();
 }
 async closeSheet(){if(document.activeElement?.closest('#studio-inspector'))document.activeElement.blur();await this.commitDraft();this.router?.cancel();this.tool='home';await this.f.activate('studio');this.sheet.set('closed',{render:false});this.updateChrome();this.mobileViewport.schedule();}
 async showLibrary(){await this.closeSheet();this.libraryVisible=true;$('#mobile-library').hidden=false;$('#mobile-shell').dataset.view='library';this.updateChrome();}
 showEditor(){this.libraryVisible=false;$('#mobile-library').hidden=true;$('#mobile-shell').dataset.view='editor';this.updateChrome();this.mobileViewport?.schedule();}
 showLoading(active){if(active)this.showEditor();super.showLoading(active);if(!active&&this.tool==='home')this.f.activate('studio');}
 onFacade(type,value){
  super.onFacade(type,value);if(!this.mobileViewport)return;
  if(type==='change'){
   const dimensions=`${this.f.config.WIDTH}:${this.f.config.HEIGHT}`;if(this.documentDimensions!==dimensions){this.documentDimensions=dimensions;this.mobileViewport.fit();}
  }
  if(type==='selection'&&this.libraryVisible)this.updateChrome();
 }
 scheduleText(){if(this.composing){clearTimeout(this.textTimer);return;}super.scheduleText();}
 async action(action,button){
  if(action==='add-text'){await super.action(action,button);this.sheet.set('expanded');$('#studio-text')?.focus();return;}
  if(action==='collapse'){this.sheet.set(this.expanded?'compact':'expanded');return;}
  if(action==='apply'){
   const previous=this.tool,selection=this.f.app.GUI.GUI_tools.tools_modules.crop.object.selection,canCrop=selection?.width>0&&selection?.height>0;
   await super.action(action,button);if(previous==='collage'||previous==='geometry'&&!canCrop)return;await this.closeSheet();return;
  }
  if(action==='select'){await this.closeSheet();await this.f.activate('select');this.toast('Kéo để di chuyển lớp, kéo góc để đổi kích thước.');return;}
  await super.action(action,button);
 }
 async exportDialog(){
  await super.exportDialog();$('#dialog-content h2').textContent='Lưu ảnh';
  const body=$('#dialog-content .dialog-body'),label=document.createElement('label');label.className='field-label';label.innerHTML=`Tên ảnh<input id="mobile-document-name" class="studio-field" value="${esc(this.f.name)}" maxlength="120">`;body.querySelector('.export-preview').after(label);
  try{const blob=await this.f.exportImage({format:'png',scale:Math.min(1,320/Math.max(this.f.config.WIDTH,this.f.config.HEIGHT))}),url=URL.createObjectURL(blob);if($('#studio-dialog').open){$('#dialog-content .export-preview img').src=url;this.exportPreviewURL=url;}else URL.revokeObjectURL(url);}catch{}
 }
 closeDialog(){super.closeDialog();if(this.exportPreviewURL){URL.revokeObjectURL(this.exportPreviewURL);this.exportPreviewURL=null;}}
 bindMobile(){
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
   if(b.dataset.adjustKey){e.preventDefault();e.stopImmediatePropagation();this.adjustKey=b.dataset.adjustKey;this.renderPanel();return;}
   const action=b.dataset.mobileAction;if(!action)return;e.preventDefault();e.stopImmediatePropagation();
   this.safely(async()=>{
    if(action==='sheet-toggle'){if(performance.now()<(this.sheet.suppressClickUntil||0))return;this.sheet.set(this.expanded?'compact':'expanded');}
    if(action==='sheet-expand')this.sheet.set('expanded');if(action==='sheet-close')await this.closeSheet();
    if(action==='back'){if(this.libraryVisible)this.showEditor();else if(this.tool!=='home')await this.closeSheet();else await this.showLibrary();}
   });
  },true);
  document.addEventListener('compositionstart',e=>{if(e.target.id==='studio-text'){this.composing=true;clearTimeout(this.textTimer);}});
  document.addEventListener('compositionend',e=>{if(e.target.id==='studio-text'){this.composing=false;this.pendingText.text=e.target.value;this.scheduleText();}});
  document.addEventListener('focusin',e=>{if(e.target.matches('#studio-text,#mobile-document-name')){this.sheet.viewportChanged();setTimeout(()=>{this.sheet.viewportChanged();e.target.scrollIntoView?.({block:'nearest'});},250);}});
  document.addEventListener('focusout',()=>setTimeout(()=>this.sheet.viewportChanged(),120));
  document.addEventListener('change',e=>{if(e.target.id==='mobile-document-name'){const original=$('#document-name');original.value=e.target.value;original.dispatchEvent(new Event('change',{bubbles:true}));}});
 }
}
