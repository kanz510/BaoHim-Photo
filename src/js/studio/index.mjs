import {PremiumFacade} from './premium-facade.mjs';
import {PremiumUI} from './premium-ui.mjs';
import {MobileViewport} from './mobile-viewport.mjs';
import {PremiumGestureRouter} from './premium-gestures.mjs';
import {renderTypography} from './typography.mjs';
import zoomView from '../libs/zoomView.js';
import {installNativeMobile} from './native-mobile.mjs';

export async function initStudio(app){
 installNativeMobile(app);
 app.GUI.GUI_tools.tools_modules.studio_text={object:{render:renderTypography}};
 app.Layers.studioScreenToWorld=point=>zoomView.toWorld(point.x,point.y);
 const facade=new PremiumFacade(app);facade.pan=(dx,dy)=>{zoomView.move(dx,dy);app.Config.need_render=true;};
 const viewport=new MobileViewport(facade),ui=new PremiumUI(facade,viewport),router=new PremiumGestureRouter(facade,ui,viewport);window.Studio={facade,ui,router,viewport};
 app.GUI.GUI_preview.zoom=value=>viewport.zoom(value===-1?.8:value===1?1.25:Number(value)/100/facade.config.ZOOM);
 app.GUI.GUI_preview.zoom_auto=()=>viewport.fit();
 document.body.classList.add('studio-app');
 try{
  await(document.fonts?.ready||Promise.resolve());let projects=[];try{projects=await facade.repository.list();}catch{}
  if(projects.length){const project=await facade.repository.load(projects[0].id);await facade.restore(project);}
  else await facade.openDemo();
  facade.activate('studio');ui.showLoading(false);ui.renderPanel();await ui.updateProjectCount();await ui.updateDraftThumbnail().catch(()=>{});await ui.showHome('studio');
 }catch(error){ui.showLoading(false);ui.toast(error.message);document.getElementById('save-status').textContent='Mở ảnh để bắt đầu';throw error;}
 finally{document.getElementById('v2-launch').hidden=true;}
 if('serviceWorker'in navigator){navigator.serviceWorker.register('./service-worker.js').then(()=>navigator.serviceWorker.ready).then(()=>{const tag=document.querySelector('.offline-tag');if(tag)tag.innerHTML='<i></i>Sẵn sàng ngoại tuyến';}).catch(()=>{const tag=document.querySelector('.offline-tag');if(tag)tag.innerHTML='<i></i>Xử lý trên thiết bị';});}
 return window.Studio;
}
