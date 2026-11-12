import {icon,hydrateIcons} from './icons.mjs';
import {PRESETS,AUTO_PRESETS,DEFAULT_ADJUSTMENTS,clamp,bodyWarps,faceMeshWarps,computeAutoEnhance} from './math.mjs';
import {blobDataURL} from './project-repository.mjs';
import {MAX_PROJECT_FILE_BYTES,projectFileBlob} from './project-schema.mjs';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tools={auto:['Auto','Cân bằng ánh sáng và màu tự động bằng thuật toán.','sparkle'],draw:['Vẽ & xóa','Thêm nét màu, giữ lại khoảng trống.','eraser'],beauty:['Làm đẹp','Một chút chăm chút. Vẫn là bạn.','beauty'],adjust:['Điều chỉnh','Ánh sáng đẹp, cảm xúc trọn vẹn.','sliders'],filters:['Bộ lọc','Một sắc màu, một câu chuyện.','filters'],reshape:['Chỉnh dáng','Tinh chỉnh đường nét theo ý bạn.','reshape'],makeup:['Trang điểm','Chạm nhẹ một chút sắc màu.','makeup'],text:['Văn bản','Viết nên dấu ấn của riêng bạn.','text'],stickers:['Nhãn dán','Một chi tiết nhỏ. Thật nhiều cảm hứng.','sticker'],collage:['Ghép ảnh','Gom những khoảnh khắc vào một khung.','collage'],templates:['Mẫu thiết kế','Một điểm bắt đầu cho cảm hứng.','template'],layers:['Lớp ảnh','Sắp xếp từng chi tiết trong bức ảnh.','layers'],geometry:['Cắt & xoay','Tìm khung hình dành cho bạn.','crop']};
const stickers=['bloom','sparkle','heart','bow','daisy','star','moon','butterfly','ribbon','petals','sun','pearl','frame','lovely','kiss','cloud','cherry','tulip','coffee','paperclip','photoNote','music','leaf','smile'];
export class StudioUI{
 constructor(facade){
  this.f=facade;this.tool='beauty';this.autoStyle='balanced';this.autoIntensity=80;this.brush={mode:'smooth',size:85,strength:35,hardness:55,feather:35,detail:65,warmth:0,hue:0,saturation:0,lightness:0,color:'#c76b83',blend:'soft-light'};this.reshapeMode='face';this.faceAmount=40;this.makeupMode='lips';this.draft={};this.pendingText={};this.collageLayout='duo';this.collageGap=28;this.addPhoto=false;this.replaceFrame=false;this.router=null;
  this.f.subscribe((type,value)=>this.onFacade(type,value));hydrateIcons();this.bind();this.renderPanel();
 }
 setRouter(router){this.router=router;}
 toast(message){const el=$('#studio-toast');el.textContent=message;el.hidden=false;clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>el.hidden=true,4500);}
 async safely(operation){try{return await operation();}catch(error){this.toast(error.message||'Thao tác chưa thực hiện được. Hãy thử lại.');}}
 onFacade(type,value){
  if(type==='selection'&&this.pendingTextLayerId&&this.pendingTextLayerId!==this.f.config.layer?.id)this.safely(()=>this.flushText());
  if(type==='render-error')this.toast(value.message||'Không thể dựng bản xem trước. Hãy hoàn tác hoặc thử lại.');
  if(type==='change'||type==='selection'){
   const count=this.f.config.layers.filter(l=>l.type).length;$('#layer-count').textContent=count;
   $('#document-name').value=this.f.name;$('#photo-info').innerHTML=`${this.f.config.WIDTH} × ${this.f.config.HEIGHT} px<span>Ảnh tĩnh · Chỉnh sửa trên thiết bị</span>`;
   const s=this.f.app.State;document.querySelectorAll('[data-action="undo"]').forEach(b=>b.disabled=!s.can_undo());document.querySelectorAll('[data-action="redo"]').forEach(b=>b.disabled=!s.can_redo());
   if(this.tool==='layers'||type==='selection'&&this.tool==='text')this.renderPanel();
   if(type==='change'){$('#save-status').textContent='Đang lưu thay đổi…';$('#save-status').classList.remove('saved');}
  }
  if(type==='saving')$('#save-status').textContent='Đang lưu trên thiết bị…';
  if(type==='saved'){$('#save-status').textContent='Đã lưu trên thiết bị';$('#save-status').classList.add('saved');this.updateProjectCount();}
  if(type==='save-error'){$('#save-status').textContent='Chưa lưu được · hãy tải file dự án';$('#save-status').classList.remove('saved');this.toast(value.message||'Bộ nhớ thiết bị chưa cho phép lưu. Hãy tải file dự án để giữ bản sao.');}
  if(type==='viewport')$('#zoom-value').textContent=Math.round(this.f.config.ZOOM*100)+'%';
  if(type==='compare'){$('#comparison-badge').hidden=!value;document.querySelectorAll('[data-action="compare"]').forEach(b=>b.setAttribute('aria-pressed',value));}
 }
 async updateProjectCount(){try{$('#project-count').textContent=(await this.f.repository.list()).length;}catch{}}
 async switchTool(tool){
  await this.commitDraft();this.router?.cancel();if(this.router){this.router.placingBody=false;this.router.placingFace=false;this.router.placingPin=false;}this.tool=tool;document.querySelectorAll('.nav-tool').forEach(b=>{b.classList.toggle('active',b.dataset.tool===tool);b.setAttribute('aria-pressed',b.dataset.tool===tool);});
  $('#stage-mode').textContent=tools[tool][0];$('#studio-inspector').classList.remove('minimized');
  if(['beauty','adjust','filters','reshape','makeup','draw'].includes(tool))await this.f.selectPhoto();
  this.f.activate(tool==='geometry'?'crop':['beauty','reshape','makeup','draw'].includes(tool)?'studio':'select');
  if(tool==='beauty'&&!['smooth','brighten','blemish','heal','tone','clone','dodge','burn','restore'].includes(this.brush.mode))this.brush.mode='smooth';
  if(tool==='reshape')this.brush.mode=this.reshapeMode==='face'?'push':'waist';
  if(tool==='makeup')this.brush.mode='makeup';
  if(tool==='draw')this.brush.mode='paint';
  this.draft={};this.renderPanel();
  document.querySelector(`[data-tool="${tool}"].nav-tool`)?.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'smooth'});
  const hint={beauty:'Tô nhẹ lên vùng da bạn muốn chăm chút',reshape:'Kéo nhẹ vùng ảnh cần tinh chỉnh',makeup:'Tô lên vùng muốn thêm màu',text:'Chọn lớp chữ để tinh chỉnh kiểu dáng',geometry:'Kéo trên ảnh để chọn vùng cắt'};$('#workspace-hint').textContent=hint[tool]||'Mọi khoảnh khắc, một dấu ấn riêng';
  setTimeout(()=>this.f.fit(),40);
 }
 header(){const [title,subtitle]=tools[this.tool];return `<div class="panel-title-row"><h2>${title}</h2>${['beauty','reshape','makeup','draw'].includes(this.tool)?'<span class="manual-badge">Dùng cọ</span>':''}<button class="panel-collapse" data-action="collapse" aria-label="Thu gọn bảng công cụ">${icon('chevronDown')}</button></div><p>${subtitle}</p>`;}
 slider(label,key,value,min=0,max=100,step=1,group='brush',ends=null){
  const n=Number.isFinite(Number(value))?Number(value):0;
  return `<label class="slider-field"><span class="slider-heading">${label}<output>${n}</output></span><input class="studio-range" type="range" data-range="${key}" data-group="${group}" value="${n}" min="${min}" max="${max}" step="${step}" style="--range:${(n-min)/(max-min)*100}%" aria-label="${label}">${ends?`<span class="range-ends"><span>${ends[0]}</span><span>${ends[1]}</span></span>`:''}</label>`;
 }
 card(label,id,ic,active=this.brush.mode){return `<button class="tool-card ${id===active?'active':''}" data-brush="${id}">${icon(ic)}<span>${label}</span></button>`;}
 tip(text){return `<div class="panel-tip">${icon('info')}<span>${text}</span></div>`;}
 brushControls(){return `<div class="tool-divider"></div><div class="section-label">CÀI ĐẶT CỌ <span>Tinh chỉnh vừa đủ</span></div>${this.slider('Kích thước','size',this.brush.size,10,220,1,'brush',['Nhỏ','Lớn'])}${this.slider('Cường độ','strength',this.brush.strength,0,100,1,'brush',['Nhẹ nhàng','Rõ nét'])}${this.slider('Độ mềm','hardness',100-this.brush.hardness,0,100)}<div class="brush-preview"><span class="brush-preview-dot"></span><span><strong>Mềm mại ở từng nét chạm</strong><small>Tô nhẹ nhiều lần để dễ kiểm soát.</small></span></div>`;}
 beautyPanel(){return `<div class="segmented"><button class="active" data-beauty-group="skin">Chăm chút làn da</button><button data-beauty-group="detail">Điểm nhấn</button></div><div class="tool-cards">${this.card('Làm mịn','smooth','smooth')}${this.card('Sáng da','brighten','sun')}${this.card('Sao chép vùng','clone','clone')}${this.card('Nhấn sáng','dodge','dodge')}</div>${this.brushControls()}<div class="brush-actions"><button data-brush="restore" class="${this.brush.mode==='restore'?'active':''}">${icon('eraser')}Cọ phục hồi</button><button data-action="undo">${icon('undo')}Bỏ nét vừa tô</button></div>${this.tip(this.brush.mode==='clone'?'Chọn vùng nguồn, rồi tô lên nơi muốn sao chép. Bạn có thể giữ Alt và chạm để chọn lại nguồn.':'Tô lên vùng muốn chỉnh. Dùng hai ngón để phóng to và di chuyển ảnh.')} ${this.brush.mode==='clone'?'<button class="button button-soft button-wide" data-action="clone-source">Chọn vùng nguồn</button>':''}`;}
 adjustPanel(){const s={...DEFAULT_ADJUSTMENTS,...this.f.photoLayer()?.studio.adjustments,...this.draft.adjustments};return `<div class="section-label">ÁNH SÁNG <button data-action="histogram" title="Xem biểu đồ màu">${icon('sliders')}</button></div>${this.slider('Phơi sáng','exposure',s.exposure,-2,2,.05,'adjust')}${this.slider('Độ sáng','brightness',s.brightness,-100,100,1,'adjust')}${this.slider('Tương phản','contrast',s.contrast,-100,100,1,'adjust')}${this.slider('Vùng sáng','highlights',s.highlights,-100,100,1,'adjust')}${this.slider('Vùng tối','shadows',s.shadows,-100,100,1,'adjust')}<div class="tool-divider"></div><div class="section-label">SẮC MÀU</div>${this.slider('Nhiệt độ','temperature',s.temperature,-100,100,1,'adjust',['Lạnh','Ấm'])}${this.slider('Sắc độ','tint',s.tint,-100,100,1,'adjust')}${this.slider('Bão hòa','saturation',s.saturation,-100,100,1,'adjust')}<div class="tool-divider"></div><div class="section-label">ĐIỂM ĐEN & TRẮNG</div>${this.slider('Điểm đen','black',this.draft.levels?.black??this.f.photoLayer()?.studio.levels?.black??0,0,150,1,'levels')}${this.slider('Điểm trắng','white',this.draft.levels?.white??this.f.photoLayer()?.studio.levels?.white??255,151,255,1,'levels')}${this.slider('Gamma','gamma',this.draft.levels?.gamma??this.f.photoLayer()?.studio.levels?.gamma??1,.2,3,.05,'levels')}<div class="section-label">ĐƯỜNG CONG <button data-action="reset-curve">Đặt lại</button></div><canvas id="tone-curve" class="curve-canvas" width="260" height="160" aria-label="Đường cong sáng tối, chạm và kéo để thêm điểm"></canvas><p class="curve-caption">Chạm để thêm điểm. Kéo lên để làm sáng, kéo xuống để làm tối.</p><div class="section-label">CHI TIẾT</div>${this.slider('Sắc nét','sharpen',s.sharpen,0,100,1,'adjust')}${this.slider('Hạt film','grain',s.grain,0,100,1,'adjust')}${this.slider('Viền tối','vignette',s.vignette,0,100,1,'adjust')}`;}
 filterPanel(){const studio={...this.f.photoLayer()?.studio,...this.draft};return `<div class="chip-row"><button class="chip active" data-filter-category="all">Tất cả</button><button class="chip" data-filter-category="portrait">Chân dung</button><button class="chip" data-filter-category="film">Film</button></div><div class="filter-grid">${PRESETS.map(p=>`<button class="filter-card ${studio.preset===p.id?'active':''}" data-preset="${esc(p.id)}"><span class="filter-preview"><img src="./assets/photos/portrait.jpg" alt="Xem trước bộ lọc ${p.name}" data-filter-preview="${esc(p.id)}"></span><span class="filter-name">${p.name}</span><span class="filter-tag">${p.tag}</span></button>`).join('')}</div><div class="tool-divider"></div>${this.slider('Mức độ','intensity',studio.intensity??100,0,100,1,'filter')}${this.tip('Bộ lọc có thể kết hợp với bảng Điều chỉnh để tạo sắc màu của riêng bạn.')}`;}
 reshapePanel(){return `<div class="segmented"><button data-reshape-group="face" class="${this.reshapeMode==='face'?'active':''}">Đường nét</button><button data-reshape-group="body" class="${this.reshapeMode==='body'?'active':''}">Vóc dáng</button></div><div class="tool-cards">${this.reshapeMode==='face'?this.card('Đẩy nhẹ','push','reshape')+this.card('Thu gọn','pinch','pointer')+this.card('Làm đầy','bulge','sun')+this.card('Bảo vệ vùng','freeze','shield'):this.card('Gọn eo','waist','reshape')+this.card('Kéo cục bộ','stretch','arrowDown')+this.card('Cân đường nét','push','sliders')+this.card('Bảo vệ vùng','freeze','shield')}</div>${this.brushControls()}${this.reshapeMode==='body'&&['waist','stretch'].includes(this.brush.mode)?'<button class="button button-outline button-wide" data-action="body-place">Đặt hai điểm điều khiển</button><button class="button button-soft button-wide" data-action="apply-body" style="margin-top:10px">Áp dụng theo điểm đã đặt</button>':''}${this.tip(this.brush.mode==='freeze'?'Tô vùng nền cần giữ nguyên trước khi biến dạng. Lớp màu hồng chỉ là dấu vùng bảo vệ.':this.brush.mode==='waist'?'Đặt hai điểm hai bên eo để chỉnh theo vị trí của bạn. Hoặc đặt cọ ở một bên eo rồi kéo vào trong để chỉnh quanh tâm ảnh.':'Kéo nhẹ trên vùng ảnh muốn chỉnh. Nên dùng cường độ thấp và tăng dần.')}<div class="brush-actions"><button data-brush="restore-warp">${icon('eraser')}Phục hồi vùng</button><button data-action="clear-freeze">${icon('shield')}Xóa bảo vệ</button><button data-action="undo">${icon('undo')}Hoàn tác</button></div>`;}
 drawPanel(){return `<div class="tool-cards">${this.card('Bút vẽ','paint','text')}${this.card('Tẩy trong suốt','erase','eraser')}${this.card('Khôi phục','restore','reset')}${this.card('Sao chép vùng','clone','clone')}</div><label class="field-label">Màu bút<input type="color" class="studio-field" data-makeup-color value="${this.brush.color}"></label>${this.brushControls()}${this.tip('Vẽ hoặc tẩy trực tiếp trên lớp ảnh đang chọn. Dùng cọ Khôi phục để lấy lại ảnh gốc trong vùng đã tô. Mỗi nét có thể hoàn tác.')}`;}
 makeupPanel(){const colors=['#a8415c','#c76b83','#df9296','#e6aa99','#b16e78','#8f586c','#deb2a0','#f2d4bc'];return `<div class="tool-cards">${this.card('Son môi','lips','makeup',this.makeupMode)}${this.card('Má hồng','blush','heart',this.makeupMode)}${this.card('Màu mắt','eyes','eye',this.makeupMode)}${this.card('Highlight','highlight','sun',this.makeupMode)}</div><div class="section-label">BẢNG MÀU <span>Chọn sắc độ riêng</span></div><div class="palette">${colors.map(c=>`<button class="swatch ${c===this.brush.color?'active':''}" data-color="${c}" style="background:${c}" aria-label="Chọn màu ${c}"></button>`).join('')}<input class="color-input" type="color" value="${this.brush.color}" data-makeup-color aria-label="Màu trang điểm tùy chọn"></div><label class="field-label" for="makeup-blend">Cách hòa màu</label><select id="makeup-blend" class="studio-field"><option value="soft-light" ${this.brush.blend==='soft-light'?'selected':''}>Ánh sáng mềm</option><option value="multiply" ${this.brush.blend==='multiply'?'selected':''}>Đậm màu</option><option value="color" ${this.brush.blend==='color'?'selected':''}>Giữ sắc độ</option><option value="source-over" ${this.brush.blend==='source-over'?'selected':''}>Màu phủ</option></select>${this.brushControls()}${this.tip('Tô trực tiếp lên vùng môi, má hoặc mắt. Giảm cường độ để giữ lại kết cấu tự nhiên của da.')}<div class="brush-actions"><button data-brush="restore">${icon('eraser')}Cọ phục hồi</button><button data-action="undo">${icon('undo')}Bỏ nét vừa tô</button></div>`;}
 textPanel(){const layer=this.f.config.layer?.type==='text'?this.f.config.layer:null,meta=layer?.data?.[0]?.[0]?.meta||{},text=layer?.data?.map(line=>line.map(s=>s.text).join('')).join('\n')||'';
  return `<button class="button button-soft button-wide" data-action="add-text">${icon('plus')}Thêm văn bản</button><label class="field-label" for="studio-text">Nội dung của bạn</label><textarea id="studio-text" class="studio-field" placeholder="Viết điều bạn muốn giữ lại…" ${layer?'':'disabled'}>${esc(text)}</textarea><label class="field-label" for="studio-font">Phông chữ</label><select class="studio-field" id="studio-font" ${layer?'':'disabled'}>${['Manrope','Playfair Display','Arial','Georgia','PingFang SC'].map(f=>`<option ${f===(meta.family||'Manrope')?'selected':''}>${f}</option>`).join('')}</select><div class="chip-row" style="margin-top:15px"><button class="chip ${meta.bold?'active':''}" data-text-style="bold"><b>B</b></button><button class="chip ${meta.italic?'active':''}" data-text-style="italic"><i>I</i></button><button class="chip ${meta.underline?'active':''}" data-text-style="underline"><u>U</u></button>${['left','center','right'].map(a=>`<button class="chip ${layer?.params.halign===a?'active':''}" data-align="${a}">${{left:'Trái',center:'Giữa',right:'Phải'}[a]}</button>`).join('')}</div>${this.slider('Cỡ chữ','size',meta.size||72,8,240,1,'text')}${this.slider('Giãn chữ','kerning',meta.kerning||0,-5,30,1,'text')}${this.slider('Giãn dòng','leading',meta.leading||0,0,80,1,'text')}<div class="fields-row"><label class="field-label">Màu chữ<input class="studio-field" type="color" id="text-color" value="${meta.fill_color?.slice(0,7)||'#ffffff'}"></label><label class="field-label">Màu viền<input class="studio-field" type="color" id="text-stroke" value="${meta.stroke_color?.slice(0,7)||'#3b2936'}"></label></div>${this.slider('Độ dày viền','stroke_size',meta.stroke_size||0,0,12,1,'text')}${this.slider('Độ cong','arc',layer?.studio?.typography?.arc||0,-100,100,1,'typography')}${this.slider('Đổ bóng','shadow',layer?.studio?.typography?.shadow||0,0,60,1,'typography')}${this.tip('Chọn mũi tên trên khung ảnh để di chuyển, xoay và kéo giãn lớp chữ.')}`;
 }
 stickerPanel(){return `<div class="chip-row"><button class="chip active" data-sticker-category="all">Tất cả</button><button class="chip" data-sticker-category="gentle">Dịu dàng</button><button class="chip" data-sticker-category="shape">Hình khối</button><button class="chip" data-sticker-category="paper">Đời thường</button></div><div class="shape-grid">${stickers.map((s,i)=>`<button class="sticker-card" data-sticker="${s}" data-sticker-kind="${i<8?'gentle':i<16?'shape':'paper'}" title="Thêm nhãn dán ${s}"><img src="./assets/stickers/${s}.png" alt="${s}" loading="lazy"></button>`).join('')}</div>${this.tip('Chạm nhãn dán để thêm vào ảnh. Kéo các góc để thay đổi kích thước, kéo nút xoay để đổi góc.')}<button class="button button-outline button-wide" data-action="add-photo">${icon('upload')}Thêm hình của bạn</button>`;}
 collagePanel(){const layouts={duo:['Hai khoảnh khắc',2,1],trio:['Bộ ba',3,1],grid:['Ô vuông',2,2],stack:['Hai tầng',1,2],six:['Nhật ký nhỏ',3,2],long:['Ảnh dài',1,3],magazine:['Tạp chí',2,2]};return `<div class="layout-options">${Object.entries(layouts).map(([id,[label,c,r]])=>`<button class="layout-card ${id===this.collageLayout?'active':''}" data-layout="${id}"><span class="layout-thumb" style="grid-template-columns:repeat(${c},1fr);grid-template-rows:repeat(${r},1fr)">${'<i></i>'.repeat(c*r)}</span>${label}</button>`).join('')}</div><div class="tool-divider"></div>${this.slider('Khoảng cách','gap',this.collageGap,0,80,1,'collage')}<button class="button button-outline button-wide" data-action="add-photo">${icon('plus')}Thêm ảnh vào bố cục</button>${this.tip('Thêm nhiều ảnh trước khi tạo bố cục. Nếu chỉ có một ảnh, các ô sẽ dùng cùng ảnh đó. Sau khi ghép, chọn lớp để di chuyển ảnh trong ô.')}<button class="button button-soft button-wide" data-action="replace-frame">Thay ảnh trong ô đang chọn</button>`;}
 templatesPanel(){const t=[['editorial','Portrait editorial','Chân dung','portrait','THE BEAUTY<br>OF BEING YOU'],['minimal','Less, but lovely','Tối giản','sunlight','less, but lovely.'],['polaroid','Một chút kỷ niệm','Nhật ký','muse','a little moment'],['diptych','Hai khoảnh khắc','Ghép ảnh','portrait','together.'],['poster','Studio poster','Ấn phẩm','sunlight','YOUR OWN<br>KIND OF BEAUTIFUL'],['cinema-poster','Poster điện ảnh','Poster','muse','A FILM BY YOU'],['ig-story','Story 9:16','Mạng xã hội','portrait','NEW STORY<br>MOMENT'],['ig-post','Feed Instagram','Mạng xã hội','sunlight','DAILY AESTHETIC'],['magazine','Daydream','Tạp chí','muse','DAYDREAM'],['long','Nhật ký ảnh dài','Ảnh dài','portrait','a visual diary']];return `${t.map(([id,label,tag,p,caption])=>`<button class="template-card" data-template="${id}"><span class="template-preview"><img src="./assets/photos/${p}.jpg" alt="Xem trước mẫu ${label}"><span>${caption}</span></span><span class="template-name">${label}<span>${tag}</span></span></button>`).join('')}${this.tip('Mẫu được áp dụng lên ảnh đang mở. Chữ và các lớp ảnh vẫn chỉnh sửa riêng được.')}`;}
 layersPanel(){const layers=[...this.f.config.layers].filter(l=>l.type).sort((a,b)=>b.order-a.order),active=this.f.config.layer;return `<div class="section-label">${layers.length} LỚP <button data-action="add-photo">+ Thêm ảnh</button></div><div class="layers-list">${layers.map(l=>`<div class="layer-row ${l.id===active?.id?'active':''}"><button class="layer-select" data-layer="${l.id}"><span class="layer-thumb">${l.type==='image'?`<img src="${esc(this.f.sources.get(l.studio?.sourceId)?.url||'./assets/photos/portrait.jpg')}" alt="">`:l.type==='text'?'T':icon('image')}</span><span><span class="layer-name">${esc(l.name)}</span><small class="layer-type">${l.type==='text'?'Văn bản':l.studio?.sticker?'Nhãn dán':l.studio?.frame?'Ảnh trong khung':'Lớp ảnh'}</small></span></button><button class="layer-visible" data-visible="${l.id}" aria-label="${l.visible?'Ẩn':'Hiện'} ${esc(l.name)}">${icon(l.visible?'eye':'eyeOff')}</button></div>`).join('')}</div><div class="layer-actions"><button data-action="layer-up" title="Đưa lên một lớp">${icon('arrowUp')}</button><button data-action="layer-down" title="Đưa xuống một lớp">${icon('arrowDown')}</button><button data-action="duplicate" title="Nhân bản lớp">${icon('copy')}</button><button data-action="delete-layer" title="Xóa lớp">${icon('trash')}</button></div><button class="button button-outline button-wide" data-action="merge-layers" style="margin-bottom:16px">Gộp với lớp bên dưới</button>${this.slider('Độ trong suốt','opacity',active?.opacity??100,0,100,1,'layer')}<label class="field-label" for="layer-blend">Hòa trộn</label><select id="layer-blend" class="studio-field">${[['source-over','Bình thường'],['multiply','Nhân màu'],['screen','Làm sáng'],['overlay','Phủ màu'],['soft-light','Ánh sáng mềm'],['color','Sắc màu']].map(([v,n])=>`<option value="${v}" ${active?.composition===v?'selected':''}>${n}</option>`).join('')}</select>`;}
 geometryPanel(){return `<div class="section-label">TỈ LỆ KHUNG HÌNH</div><div class="chip-row">${[['free','Tự do'],['1','1:1'],['0.8','4:5'],['0.666667','2:3'],['0.5625','9:16'],['1.777778','16:9']].map(([r,label])=>`<button class="chip" data-ratio="${r}">${label}</button>`).join('')}</div>${this.tip('Kéo trên ảnh để chọn vùng cắt hoặc chọn một tỉ lệ có sẵn. Nhấn Áp dụng để cắt.')}<div class="tool-divider"></div><div class="section-label">XOAY & LẬT</div><div class="tool-cards"><button class="tool-card" data-action="rotate">${icon('rotate')}Xoay 90°</button><button class="tool-card" data-action="flip-x">${icon('flip')}Lật ngang</button><button class="tool-card" data-action="flip-y">${icon('flip')}Lật dọc</button><button class="tool-card" data-action="fit">${icon('fit')}Vừa khung</button></div><div class="tool-divider"></div>${this.slider('Góc xoay','angle',this.f.photoLayer()?.rotate||0,-180,360,1,'rotation')}<div class="section-label">PHỐI CẢNH</div>${this.slider('Ngang','perspectiveX',this.f.photoLayer()?.studio.perspectiveX||0,-50,50,1,'geometry')}${this.slider('Dọc','perspectiveY',this.f.photoLayer()?.studio.perspectiveY||0,-50,50,1,'geometry')}<button class="button button-soft button-wide" data-tool="draw" style="margin-bottom:18px">${icon('eraser')}Vẽ, tẩy & phục hồi</button><div class="section-label">KÍCH THƯỚC ẢNH</div><div class="fields-row"><label class="field-label">Rộng<input type="number" class="studio-field" id="resize-width" value="${this.f.config.WIDTH}" min="1" max="20000"></label><label class="field-label">Cao<input type="number" class="studio-field" id="resize-height" value="${this.f.config.HEIGHT}" min="1" max="20000"></label></div><button class="button button-outline button-wide" data-action="resize" style="margin-top:14px">Đổi kích thước</button>`;}
 autoPanel(){
  return `<div class="pro-effect-list">${AUTO_PRESETS.map(p=>`<button data-v2-auto-preset="${p.id}" class="${this.autoStyle===p.id?'active':''}">${p.label}</button>`).join('')}</div>${this.slider('Cường độ tự động','autoIntensity',this.autoIntensity??80,0,100,1,'auto')}${this.tip('Cân bằng histogram ánh sáng, tương phản và sắc độ bằng thuật toán cổ điển — không dùng AI.')}`;
 }
 async applyAutoEnhance(style=this.autoStyle||'balanced',intensity=this.autoIntensity??80){
  this.autoStyle=style;this.autoIntensity=intensity;
  const layer=this.f.basePhotoLayer?.()||this.f.photoLayer();
  const source=this.f.sources.get(layer?.studio?.sourceId);
  const sample=document.createElement('canvas');sample.width=64;sample.height=64;
  const ctx=sample.getContext('2d');
  if(source?.image)ctx.drawImage(source.image,0,0,64,64);
  else if(layer?.link_canvas)ctx.drawImage(layer.link_canvas,0,0,64,64);
  const pixels=ctx.getImageData(0,0,64,64).data;
  const recipe=computeAutoEnhance(pixels,style,intensity);
  this.draft={...this.draft,...recipe};
  await this.f.preview(this.draft);
 }
 renderPanel(){
  $('#panel-header').innerHTML=this.header();const renderers={auto:()=>this.autoPanel(),draw:()=>this.drawPanel(),beauty:()=>this.beautyPanel(),adjust:()=>this.adjustPanel(),filters:()=>this.filterPanel(),reshape:()=>this.reshapePanel(),makeup:()=>this.makeupPanel(),text:()=>this.textPanel(),stickers:()=>this.stickerPanel(),collage:()=>this.collagePanel(),templates:()=>this.templatesPanel(),layers:()=>this.layersPanel(),geometry:()=>this.geometryPanel()};
  $('#panel-content').innerHTML=(renderers[this.tool]||renderers.beauty)();
  const apply=['auto','adjust','filters','text','geometry'].includes(this.tool)?'Áp dụng':this.tool==='collage'?'Tạo bố cục':'Hoàn tất';
  $('#panel-footer').innerHTML=`<button class="button" data-action="reset">${icon('reset','reset-icon')}Đặt lại</button><button class="button button-pink" data-action="apply">${apply}${icon('check')}</button>`;
  if(this.tool==='filters')this.filterThumbnails();if(this.tool==='adjust')this.bindCurve();
 }
 async filterThumbnails(){const layer=this.f.photoLayer(),source=this.f.sources.get(layer?.studio?.sourceId);if(!source)return;const epoch=this.f.epoch;for(const preset of PRESETS){const canvas=await this.f.raster.render(source.image,{preset:preset.id},{edge:180});if(this.f.epoch!==epoch||this.tool!=='filters')return;const img=document.querySelector(`[data-filter-preview="${preset.id}"]`);if(img)img.src=canvas.toDataURL('image/jpeg',.8);}}
 async loadProject(project){await this.commitDraft();this.router?.cancel();await this.f.restore(project);this.draft={};this.closeDialog();await this.switchTool('beauty');}
 async commitDraft(){
  clearTimeout(this.previewTimer);await this.flushText();
  if(Object.keys(this.draft).length){const value=this.draft;this.draft={};await this.f.updateStudio(value);}
 }
 dialog(title,body){const el=$('#studio-dialog');$('#dialog-content').innerHTML=`<div class="dialog-header"><h2>${title}</h2><button data-action="dialog-close" aria-label="Đóng">${icon('close')}</button></div><div class="dialog-body">${body}</div>`;if(!el.open){if(el.showModal)el.showModal();else el.setAttribute('open','');}}
 closeDialog(){const d=$('#studio-dialog');if(d.close)d.close();else d.removeAttribute('open');}
 download(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 canShareFiles(){return typeof navigator?.share==='function';}
 async shareOrDownload(blob,filename){
  if(this.canShareFiles()&&typeof File==='function'){
   try{
    const file=new File([blob],filename,{type:blob.type});
    if(!navigator.canShare||navigator.canShare({files:[file]})){
     await navigator.share({files:[file],title:this.f.name||'BaoHim Photo'});
     return 'shared';
    }
   }catch(error){
    if(error?.name==='AbortError')return 'cancelled';
   }
  }
  this.download(blob,filename);
  return 'downloaded';
 }
 async exportDialog(){await this.commitDraft();const layer=this.f.photoLayer(),source=this.f.sources.get(layer?.studio.sourceId),mp=this.f.config.WIDTH*this.f.config.HEIGHT/1e6;this.dialog('Giữ lại khoảnh khắc đẹp',`<div class="export-preview"><img src="${esc(source?.url||'./assets/photos/portrait.jpg')}" alt="Ảnh đang xuất"><div><strong>${esc(this.f.name)}</strong><span>${this.f.config.WIDTH} × ${this.f.config.HEIGHT} px · ${mp.toFixed(1)} MP</span></div></div><label class="field-label" for="export-format">Định dạng</label><select id="export-format" class="studio-field"><option value="jpeg">JPEG · Ảnh chất lượng cao</option><option value="png">PNG · Giữ trong suốt</option><option value="webp">WebP · File nhỏ hơn</option></select><label class="field-label" for="export-scale">Kích thước</label><select id="export-scale" class="studio-field"><option value="${mp>12?Math.sqrt(12/mp):1}">${mp>12?'12 MP':'Kích thước gốc'}</option><option value="${Math.min(1,2048/Math.max(this.f.config.WIDTH,this.f.config.HEIGHT))}">Cạnh dài 2048 px</option><option value="${Math.min(1,1080/Math.max(this.f.config.WIDTH,this.f.config.HEIGHT))}">Cạnh dài 1080 px</option></select><label class="field-label" for="export-quality">Chất lượng JPEG/WebP</label><select id="export-quality" class="studio-field"><option value=".95">95% · Rất cao</option><option value="1">100% · Tối đa</option><option value=".85">85% · Nhẹ hơn</option></select><p>Không watermark. Ảnh được tạo ngay trên thiết bị của bạn.</p><div class="dialog-footer"><button class="button button-outline" data-action="download-project">Lưu file dự án</button><button class="button button-outline" data-action="share-image">Chia sẻ</button><button class="button button-dark" data-action="download-image">${icon('download')}Tải ảnh xuống</button></div>`);}
 async projectsDialog(){await this.commitDraft();await this.f.save().catch(()=>{});const list=await this.f.repository.list();this.dialog('Dự án của tôi',`${list.length?list.map(p=>`<div class="project-row"><button data-open-project="${esc(p.id)}"><strong>${esc(p.name)}</strong><small>${p.width} × ${p.height} px · ${new Date(p.modified).toLocaleDateString('vi-VN')}</small></button><button data-remove-project="${esc(p.id)}" aria-label="Xóa ${esc(p.name)}">${icon('trash')}</button></div>`).join(''):'<div class="empty-message">Những khoảnh khắc của bạn sẽ xuất hiện ở đây.</div>'}<div class="dialog-footer"><button class="button button-outline" data-action="import-project">${icon('folder')}Mở file dự án</button><button class="button button-dark" data-action="download-project">Lưu bản sao</button></div>`);}
 // Event routing and gestures are attached once; panel HTML can be replaced without duplicate listeners.
 bind(){this.bindEvents();}
 bindEvents(){
  document.addEventListener('click',event=>{
   const button=event.target.closest('button');if(!button||button.closest('.native-support')||button.closest('#popups'))return;
   this.safely(async()=>{
    if(button.dataset.tool){await this.switchTool(button.dataset.tool);return;}
    if(button.dataset.sample){await this.commitDraft();this.showLoading(true);try{await this.f.openDemo(button.dataset.sample);document.querySelectorAll('[data-sample]').forEach(b=>b.classList.toggle('selected',b===button));await this.switchTool('beauty');}finally{this.showLoading(false);}return;}
    if(button.dataset.brush){
     const id=button.dataset.brush;this.brush.axis=undefined;this.reshapePreset=undefined;
     if(this.tool==='makeup'&&['lips','blush','eyes','highlight'].includes(id)){this.makeupMode=id;this.brush.mode='makeup';const colors={lips:'#a8415c',blush:'#df9296',eyes:'#8f586c',highlight:'#f2d4bc'};this.brush.color=colors[id];this.brush.strength=id==='lips'?55:35;this.brush.blend=id==='lips'?'multiply':'soft-light';}
     else{this.brush.mode=id;if(id==='blemish'&&this.router)this.router.cloneSource=null;}
     if(this.router){this.router.placingBody=false;this.router.placingFace=false;this.router.placingPin=false;}this.f.activate('studio');this.renderPanel();return;
    }
    if(button.dataset.beautyGroup){
     document.querySelectorAll('[data-beauty-group]').forEach(b=>b.classList.toggle('active',b===button));
     $('.tool-cards').innerHTML=button.dataset.beautyGroup==='detail'?this.card('Nhấn sáng','dodge','sun')+this.card('Tạo khối','burn','dodge')+this.card('Cọ phục hồi','restore','eraser')+this.card('Sao chép vùng','clone','clone'):this.card('Làm mịn','smooth','smooth')+this.card('Sáng da','brighten','sun')+this.card('Sao chép vùng','clone','clone')+this.card('Nhấn sáng','dodge','dodge');return;
    }
    if(button.dataset.reshapeGroup){this.brush.axis=undefined;this.reshapePreset=undefined;this.reshapeMode=button.dataset.reshapeGroup;this.brush.mode=this.reshapeMode==='face'?'push':'waist';this.renderPanel();return;}
    if(button.dataset.color){this.brush.color=button.dataset.color;this.renderPanel();return;}
    if(button.dataset.preset){this.draft={...this.draft,preset:button.dataset.preset,intensity:this.draft.intensity??this.f.photoLayer()?.studio.intensity??100};document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b===button));await this.f.preview(this.draft);return;}
    if(button.dataset.filterCategory){const allowed=button.dataset.filterCategory==='portrait'?['original','muse','peach','milk','clear','morning']:button.dataset.filterCategory==='film'?['film','mono','night']:PRESETS.map(p=>p.id);document.querySelectorAll('[data-preset]').forEach(b=>b.hidden=!allowed.includes(b.dataset.preset));button.parentElement.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===button));return;}
    if(button.dataset.sticker){await this.f.addSticker(button.dataset.sticker);this.toast('Đã thêm nhãn dán. Kéo trên ảnh để sắp xếp.');return;}
    if(button.dataset.stickerCategory){document.querySelectorAll('[data-sticker-kind]').forEach(b=>b.hidden=button.dataset.stickerCategory!=='all'&&button.dataset.stickerCategory!==b.dataset.stickerKind);button.parentElement.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===button));return;}
    if(button.dataset.layout){this.collageLayout=button.dataset.layout;document.querySelectorAll('[data-layout]').forEach(b=>b.classList.toggle('active',b===button));return;}
    if(button.dataset.template){await this.f.template(button.dataset.template);await this.switchTool('text');this.toast('Mẫu đã được áp dụng. Bạn có thể sửa từng lớp.');return;}
    if(button.dataset.layer){await this.f.select(button.dataset.layer);this.f.activate('select');this.renderPanel();return;}
    if(button.dataset.visible){await this.f.select(button.dataset.visible);await this.f.updateLayer({visible:!this.f.config.layer.visible});return;}
    if(button.dataset.textStyle){if(this.f.config.layer?.type!=='text'){this.toast('Thêm hoặc chọn lớp chữ trước.');return;}const key=button.dataset.textStyle;await this.f.updateText({meta:{[key]:!this.f.config.layer.data?.[0]?.[0]?.meta?.[key]}});this.renderPanel();return;}
    if(button.dataset.align){await this.f.updateText({params:{halign:button.dataset.align}});this.renderPanel();return;}
    if(button.dataset.ratio){this.f.activate('crop');document.querySelectorAll('[data-ratio]').forEach(b=>b.classList.toggle('active',b===button));if(button.dataset.ratio!=='free'){const ratio=Number(button.dataset.ratio),W=this.f.config.WIDTH,H=this.f.config.HEIGHT;let w=W*.85,h=w/ratio;if(h>H*.85){h=H*.85;w=h*ratio;}this.f.app.GUI.GUI_tools.tools_modules.crop.object.selection={x:(W-w)/2,y:(H-h)/2,width:w,height:h};this.f.config.need_render=true;}return;}
    if(button.dataset.openProject){const project=await this.f.repository.load(button.dataset.openProject);if(project)await this.loadProject(project);return;}
    if(button.dataset.removeProject){if(button.dataset.removeProject===this.f.id){this.toast('Hãy mở một dự án khác trước khi xóa dự án này.');return;}if(confirm('Xóa dự án này khỏi thiết bị?')){await this.f.repository.remove(button.dataset.removeProject);await this.projectsDialog();this.updateProjectCount();}return;}
    if(button.dataset.action)await this.action(button.dataset.action,button);
   });
  });
  document.addEventListener('input',event=>{
   const el=event.target;if(el.dataset.range){const value=Number(el.value);el.style.setProperty('--range',((value-Number(el.min))/(Number(el.max)-Number(el.min))*100)+'%');el.closest('.slider-field')?.querySelector('output')?.replaceChildren(document.createTextNode(String(value)));
    const key=el.dataset.range,group=el.dataset.group;
    if(group==='brush'){this.brush[key]=key==='hardness'?100-value:value;this.router?.updateCursor();if(key==='strength'&&this.router?.placingBody&&this.router.bodyHandles.length===2)this.scheduleBodyPreview();}
    if(group==='adjust'){this.draft.adjustments={...this.f.photoLayer()?.studio.adjustments,...this.draft.adjustments,[key]:value};this.schedulePreview();}
    if(group==='filter'||group==='geometry'){this.draft[key]=value;this.schedulePreview();}
    if(group==='levels'){this.draft.levels={black:0,white:255,gamma:1,...this.f.photoLayer()?.studio.levels,...this.draft.levels,[key]:value};this.schedulePreview();}
    if(group==='collage')this.collageGap=value;
    if(group==='face-mesh'){this.faceAmount=value;this.scheduleFaceMeshPreview();}
    if(group==='auto'){this.autoIntensity=value;clearTimeout(this.autoTimer);this.autoTimer=setTimeout(()=>this.safely(()=>this.applyAutoEnhance(this.autoStyle,this.autoIntensity)),45);}
    if(group==='text'){this.pendingText.meta={...this.pendingText.meta,[key]:value};this.scheduleText();}
    if(group==='typography'){this.pendingText.typography={...this.pendingText.typography,[key]:value};this.scheduleText();}
   }
   if(el.id==='studio-text'){this.pendingText.text=el.value;this.scheduleText();}
   if(el.hasAttribute('data-makeup-color')){this.brush.color=el.value;document.querySelectorAll('[data-color]').forEach(b=>b.classList.remove('active'));}
  });
  document.addEventListener('change',event=>this.safely(async()=>{
   const el=event.target;
   if(el.id==='document-name'){this.f.name=el.value.trim().replace(/[<>]/g,'').slice(0,120)||'Ảnh của tôi';await this.f.save();}
   if(el.id==='studio-font')await this.f.updateText({meta:{family:el.value}});
   if(el.id==='text-color')await this.f.updateText({meta:{fill_color:el.value}});
   if(el.id==='text-stroke')await this.f.updateText({meta:{stroke_color:el.value}});
   if(el.id==='makeup-blend')this.brush.blend=el.value;
   if(el.id==='layer-blend')await this.f.updateLayer({composition:el.value});
   if(el.dataset.group==='rotation')await this.f.rotateTo(Number(el.value));
   if(el.dataset.group==='layer')await this.f.updateLayer({opacity:Number(el.value)});
   if(el.id==='photo-input'){
    const files=[...el.files];if(!files.length)return;await this.commitDraft();this.router?.cancel();this.showLoading(true);
    try{
     for(let i=0;i<files.length;i++){
      if(this.replaceFrame&&i===0){await this.f.replacePhoto(files[i],files[i].name);continue;}
      await this.f.open(files[i],files[i].name,{replace:!this.addPhoto&&i===0});
     }
     this.addPhoto=false;this.replaceFrame=false;el.value='';this.f.activate('select');this.renderPanel();
    }finally{this.showLoading(false);}
   }
   if(el.id==='project-input'&&el.files[0]){if(el.files[0].size>MAX_PROJECT_FILE_BYTES)throw new Error('File dự án vượt quá 180 MB.');const project=JSON.parse(await el.files[0].text());await this.loadProject(project);el.value='';}
  }));
  document.addEventListener('keydown',event=>{
   if(event.target.closest('input,textarea,select,[contenteditable=true]'))return;
   const key=event.key.toLowerCase();
   if((event.metaKey||event.ctrlKey)&&['z','y','s','o'].includes(key)){
    event.preventDefault();event.stopImmediatePropagation();this.safely(async()=>{if(key==='z')await this.action(event.shiftKey?'redo':'undo');if(key==='y')await this.action('redo');if(key==='s')await this.action('download-project');if(key==='o')await this.action('open');});
   }
   if(key==='\\'&&!event.repeat){event.preventDefault();this.safely(()=>this.f.setCompare(!this.f.compare));}
   if(key==='escape'){this.closeDialog();this.router?.cancel();}
   if(!['arrowup','arrowdown','arrowleft','arrowright','delete','backspace',' ','escape'].includes(key))event.stopImmediatePropagation();
  },true);
  $('#studio-dialog').addEventListener('click',e=>{if(e.target===$('#studio-dialog'))this.closeDialog();});
  window.addEventListener('resize',()=>{clearTimeout(this.resizeTimer);this.resizeTimer=setTimeout(()=>this.f.fit(),180);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.f.save().catch(()=>{});});
  const stage=$('#studio-stage');stage.addEventListener('dragover',e=>{e.preventDefault();stage.classList.add('drag-over');});stage.addEventListener('dragleave',()=>stage.classList.remove('drag-over'));stage.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();stage.classList.remove('drag-over');if(e.dataTransfer.files[0])this.safely(async()=>{await this.commitDraft();this.router?.cancel();await this.f.open(e.dataTransfer.files[0],e.dataTransfer.files[0].name);this.draft={};this.renderPanel();});},true);
 }
 schedulePreview(){clearTimeout(this.previewTimer);this.previewTimer=setTimeout(()=>this.safely(()=>this.f.preview(this.draft)),45);}
 scheduleFaceMeshPreview(){
  clearTimeout(this.faceMeshTimer);
  this.faceMeshTimer=setTimeout(()=>this.safely(async()=>{
   const layer=this.f.photoLayer();if(!layer||!this.router?.faceHandles||this.router.faceHandles.length<2)return;
   const meshWarps=faceMeshWarps(this.router.faceHandles,this.reshapePreset||'face',this.faceAmount??40,layer.studio.freezes?.length||0);
   await this.f.preview({warps:[...(layer.studio.warps||[]),...meshWarps]});
  }),45);
 }
 defaultFaceHandles(feature='face'){
  const layer=this.f.photoLayer(),W=layer?.width_original||this.f.config.WIDTH||1000,H=layer?.height_original||this.f.config.HEIGHT||1200;
  if(['nose','chin','forehead','ratio'].includes(feature))return [{x:Math.round(W*.5),y:Math.round(H*.38)},{x:Math.round(W*.5),y:Math.round(H*.58)}];
  return [{x:Math.round(W*.36),y:Math.round(H*.48)},{x:Math.round(W*.64),y:Math.round(H*.48)}];
 }
 scheduleBodyPreview(){
  clearTimeout(this.bodyPreviewTimer);
  this.bodyPreviewTimer=setTimeout(()=>this.safely(async()=>{
   const layer=this.f.photoLayer();if(!layer||!this.router?.bodyHandles||this.router.bodyHandles.length<2)return;
   const warps=bodyWarps(this.router.bodyHandles,this.brush.mode,this.brush.strength,layer.studio.freezes?.length||0);
   await this.f.preview({warps:[...(layer.studio.warps||[]),...warps]});
  }),45);
 }
 scheduleText(){this.pendingTextLayerId??=this.f.config.layer?.id;clearTimeout(this.textTimer);this.textTimer=setTimeout(()=>this.safely(()=>this.flushText()),320);}
 async flushText(){clearTimeout(this.textTimer);const changes=this.pendingText,id=this.pendingTextLayerId;this.pendingText={};this.pendingTextLayerId=null;if(id&&Object.keys(changes).length)await this.f.updateText(changes,id);}
 showLoading(active){const node=$('#studio-loading');node.hidden=!active;node.textContent=active?'Đang mở ảnh của bạn…':'';$('#mobile-shell')?.setAttribute('aria-busy',String(active));}
 async action(action,button){
  const f=this.f;
  if(action==='open'||action==='add-photo'||action==='replace-frame'){
   await this.commitDraft();this.addPhoto=action!=='open';this.replaceFrame=action==='replace-frame';
   if(this.replaceFrame&&!f.config.layer?.studio?.frame){this.toast('Chọn một lớp ảnh trong bố cục trước.');return;}
   $('#photo-input').click();return;
  }
  if(action==='undo'){if(Object.keys(this.draft).length){clearTimeout(this.previewTimer);this.draft={};f.cache.clear();await f.renderPreview();}else{await this.flushText();await f.undo();}this.renderPanel();return;}if(action==='redo'){await this.commitDraft();await f.redo();this.renderPanel();return;}
  if(action==='zoom-in'){await f.zoom(1.2);return;}if(action==='zoom-out'){await f.zoom(1/1.2);return;}if(action==='fit'){await f.fit();return;}
  if(action==='select'){this.router?.cancel();f.activate('select');this.toast('Kéo để di chuyển lớp. Dùng các góc để đổi kích thước.');return;}
  if(action==='compare'){await this.commitDraft();await f.setCompare(!f.compare);return;}
  if(action==='export'){await this.exportDialog();return;}if(action==='projects'){await this.projectsDialog();return;}
  if(action==='editor'){this.closeDialog();return;}
  if(action==='collapse'){$('#studio-inspector').classList.toggle('minimized');setTimeout(()=>f.fit(),220);return;}
  if(action==='dialog-close'){this.closeDialog();return;}
  if(action==='clone-source'){this.router.clonePicking=true;f.activate('studio');this.toast('Chạm lên ảnh để chọn vùng nguồn.');return;}
  if(action==='add-text'){await f.addText();this.renderPanel();return;}
  if(action==='body-place'){this.router.cancel();this.router.placingFace=false;this.router.placingPin=false;this.router.bodyHandles=[];this.router.placingBody=true;await f.activate('studio');this.toast(this.brush.mode==='waist'?'Chạm hai bên eo trên ảnh, rồi kéo các điểm để căn vị trí.':'Chạm điểm bắt đầu và kết thúc vùng cần chỉnh, rồi kéo để căn vị trí.');return;}
  if(action==='body-pin'){this.router.cancel();this.router.placingFace=false;this.router.placingBody=false;this.router.placingPin=!this.router.placingPin;await f.activate('studio');this.renderPanel();this.toast(this.router.placingPin?'Chạm lên đường thẳng, khung cửa hoặc tường phía sau để ghim khóa vùng nền.':'Đã tắt chế độ ghim nền.');return;}
  if(action==='apply-body'){clearTimeout(this.bodyPreviewTimer);await f.addWarp(bodyWarps(this.router.bodyHandles,this.brush.mode,this.brush.strength,f.photoLayer()?.studio.freezes?.length||0));this.router.placingBody=false;this.toast('Đã chỉnh vùng do bạn đặt. Có thể hoàn tác từng lần.');return;}
  if(action==='face-place'){this.router.cancel();this.router.placingBody=false;this.router.placingFace=true;this.router.faceLayerId=f.photoLayer()?.id;if(this.router.faceHandles.length<2)this.router.faceHandles=this.defaultFaceHandles(this.reshapePreset||'face');await f.activate('studio');f.config.need_render=true;this.renderPanel();this.scheduleFaceMeshPreview();this.toast('Kéo hai điểm điều khiển trên khuôn mặt và trượt mức độ để xem trước.');return;}
  if(action==='apply-face'){clearTimeout(this.faceMeshTimer);const layer=f.photoLayer();if(!this.router.faceHandles||this.router.faceHandles.length<2)this.router.faceHandles=this.defaultFaceHandles(this.reshapePreset||'face');const warps=faceMeshWarps(this.router.faceHandles,this.reshapePreset||'face',this.faceAmount??40,layer?.studio.freezes?.length||0);if(warps.length)await f.addWarp(warps);this.router.placingFace=false;f.config.need_render=true;this.renderPanel();this.toast('Đã áp dụng chỉnh khuôn mặt theo lưới điểm điều khiển. Có thể hoàn tác.');return;}
  if(action==='clear-freeze'){await f.updateStudio({freezes:[...(f.photoLayer()?.studio.freezes||[]),{clear:true}]});this.toast('Đã xóa vùng bảo vệ cho những nét chỉnh tiếp theo.');return;}
  if(action==='histogram'){f.app.GUI.modules['image/histogram'].histogram();return;}
  if(action==='reset-curve'){this.curvePoints=[];this.draft.curve=[];this.drawCurve();await f.preview(this.draft);return;}
  if(action==='rotate'){await this.commitDraft();await f.rotate();this.renderPanel();return;}
  if(action==='flip-x'||action==='flip-y'){await f.flip(action==='flip-x'?'x':'y');return;}
  if(action==='resize'){await f.resize(Number($('#resize-width').value),Number($('#resize-height').value));this.renderPanel();return;}
  if(action==='layer-up'){await f.reorder(1);return;}if(action==='layer-down'){await f.reorder(-1);return;}if(action==='duplicate'){await f.duplicate();return;}if(action==='delete-layer'){await f.deleteLayer();return;}
  if(action==='merge-layers'){await this.commitDraft();await f.merge();this.renderPanel();return;}
  if(action==='apply'){
   await this.commitDraft();if(this.tool==='collage'){await f.collage(this.collageLayout,this.collageGap);await this.switchTool('layers');this.toast('Đã tạo bố cục. Chọn từng lớp để căn ảnh trong ô.');return;}
   if(this.tool==='geometry'){const sel=f.app.GUI.GUI_tools.tools_modules.crop.object.selection;if(!sel?.width||!sel?.height){this.toast('Chọn vùng cắt trên ảnh hoặc chọn tỉ lệ trước.');return;}await f.crop(sel);this.renderPanel();this.toast('Đã cắt ảnh.');return;}
   if(['beauty','reshape','makeup','draw'].includes(this.tool)){f.activate('select');this.toast('Đã hoàn tất. Chọn công cụ để tiếp tục tinh chỉnh.');if(window.innerWidth<761)$('#studio-inspector').classList.add('minimized');}
   else this.toast('Đã áp dụng thay đổi.');return;
  }
  if(action==='reset'){
   this.draft={};this.pendingText={};const layer=f.photoLayer();
   if(this.tool==='adjust')await f.updateStudio({adjustments:{},hsl:{},levels:null,curve:[]});
   else if(this.tool==='filters')await f.updateStudio({preset:'original',intensity:100,lut:null});
   else if(this.tool==='reshape')await f.updateStudio({warps:[],freezes:[]});
   else if(this.tool==='draw')await f.updateStudio({strokes:(layer?.studio.strokes||[]).filter(s=>!['paint','erase'].includes(s.type))});
   else if(this.tool==='beauty')await f.updateStudio({strokes:(layer?.studio.strokes||[]).filter(s=>s.type==='makeup')});
   else if(this.tool==='makeup')await f.updateStudio({strokes:(layer?.studio.strokes||[]).filter(s=>s.type!=='makeup')});
   else if(this.tool==='text'){if(f.config.layer?.type!=='text'){this.toast('Thêm hoặc chọn lớp chữ trước.');return;}await f.updateText({meta:{family:'Manrope',bold:false,italic:false,underline:false,stroke_size:0,kerning:0,leading:10},typography:{arc:0,shadow:0}});}
   else if(this.tool==='geometry'){await f.updateStudio({perspectiveX:0,perspectiveY:0});f.app.GUI.GUI_tools.tools_modules.crop.object.selection={x:null,y:null,width:null,height:null};f.config.need_render=true;}
   else if(this.tool==='collage'){this.collageLayout='duo';this.collageGap=28;}
   else{await this.switchTool('layers');return;}
   this.renderPanel();return;
  }
  if(action==='download-project'){
   await this.commitDraft();const project=await f.portableProject();this.download(projectFileBlob(project),f.name+'.pbs.json');this.toast('Đã tạo file dự án, giữ đầy đủ lớp và ảnh gốc.');return;
  }
  if(action==='import-project'){$('#project-input').click();return;}
  if(action==='download-image'||action==='share-image'){
   button.disabled=true;const text=button.innerHTML;button.textContent='Đang tạo ảnh…';
   try{
    const format=$('#export-format').value,blob=await f.exportImage({format,quality:Number($('#export-quality').value),scale:Number($('#export-scale').value)}),filename=f.name+'.'+(format==='jpeg'?'jpg':format);
    if(action==='share-image'){
     const outcome=await this.shareOrDownload(blob,filename);
     if(outcome!=='cancelled'){this.closeDialog();this.toast(outcome==='shared'?'Đã chia sẻ ảnh thành công.':'Trình duyệt chưa hỗ trợ chia sẻ trực tiếp; đã tải ảnh xuống máy.');}
    }else{
     this.download(blob,filename);this.closeDialog();this.toast('Ảnh đã sẵn sàng trong mục tải xuống.');
    }
   }finally{button.disabled=false;button.innerHTML=text;}return;
  }
  if(action==='more'){this.dialog('Dự án của bạn',`<button class="button button-outline button-wide" data-action="download-project">${icon('download')}Tải file dự án</button><button class="button button-outline button-wide" data-action="import-project" style="margin-top:12px">${icon('folder')}Mở file dự án</button><button class="button button-outline button-wide" data-action="projects" style="margin-top:12px">${icon('layers')}Dự án đã lưu trên thiết bị</button><p>File dự án giữ ảnh gốc, các lớp và tham số chỉnh sửa để bạn có thể tiếp tục sau.</p>`);return;}
  if(action==='about'){this.dialog('Một không gian, dành riêng cho bạn.',`<p>PHOTO BEAUTY STUDIO là không gian chỉnh ảnh và làm đẹp thủ công. Bạn kiểm soát từng nét cọ, từng sắc màu.</p><p>Ảnh được xử lý và lưu ngay trên thiết bị. Không tải ảnh lên server. Sau khi ứng dụng và tài nguyên được lưu lần đầu, bạn có thể dùng các công cụ khi không có mạng.</p><p>Bộ nhớ trình duyệt có thể bị xóa bởi thiết bị. Hãy tải file dự án để giữ bản sao quan trọng.</p><a class="button button-outline button-wide" href="./licenses.html" target="_blank" rel="noopener">Nguồn mở & giấy phép tài nguyên</a>`);}
 }
 bindCurve(){
  const canvas=$('#tone-curve');if(!canvas)return;this.curvePoints=JSON.parse(JSON.stringify(this.draft.curve||this.f.photoLayer()?.studio.curve||[]));this.drawCurve();let index=-1;
  const point=e=>{const r=canvas.getBoundingClientRect();return [clamp((e.clientX-r.left)/r.width,.02,.98),clamp(1-(e.clientY-r.top)/r.height,.02,.98)];};
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture?.(e.pointerId);const p=point(e);index=this.curvePoints.findIndex(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<.08);if(index<0){if(this.curvePoints.length>=8)this.curvePoints.shift();this.curvePoints.push(p);index=this.curvePoints.length-1;}this.drawCurve();});
  canvas.addEventListener('pointermove',e=>{if(index<0)return;e.preventDefault();this.curvePoints[index]=point(e);this.draft.curve=this.curvePoints.map(p=>p.slice());this.drawCurve();this.schedulePreview();});
  canvas.addEventListener('pointerup',()=>{index=-1;this.draft.curve=this.curvePoints.map(p=>p.slice());this.schedulePreview();});
  canvas.addEventListener('pointercancel',()=>index=-1);
 }
 drawCurve(){
  const canvas=$('#tone-curve');if(!canvas)return;const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.strokeStyle='#ece2e8';ctx.lineWidth=1;
  for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(w*i/4,0);ctx.lineTo(w*i/4,h);ctx.stroke();ctx.beginPath();ctx.moveTo(0,h*i/4);ctx.lineTo(w,h*i/4);ctx.stroke();}
  const points=[[0,0],...(this.draft.curve||this.curvePoints||[]),[1,1]].sort((a,b)=>a[0]-b[0]);ctx.beginPath();ctx.strokeStyle='#cf8aaa';ctx.lineWidth=2;
  points.forEach(([x,y],i)=>{if(i===0)ctx.moveTo(x*w,(1-y)*h);else ctx.lineTo(x*w,(1-y)*h);});ctx.stroke();
  for(const [x,y] of points.slice(1,-1)){ctx.beginPath();ctx.arc(x*w,(1-y)*h,4,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.stroke();}
 }
}
