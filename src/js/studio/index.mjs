import {PremiumFacade} from './premium-facade.mjs';
import {MobileViewport} from './mobile-viewport.mjs';
import {PremiumGestureRouter} from './premium-gestures.mjs';
import {renderTypography} from './typography.mjs';
import zoomView from '../libs/zoomView.js';
import {installNativeMobile} from './native-mobile.mjs';
import {startAppUpdates} from './app-updates.mjs';

export async function initStudio(app){
 const {PremiumUI}=await import(/* webpackChunkName: "studio-ui" */ './premium-ui.mjs');
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
  let restored=false;
  for(const summary of projects){
   try{
    const project=await facade.repository.load(summary.id);
    if(project){await facade.restore(project);restored=true;break;}
   }catch{
    ui.toast('Dự án gần nhất bị hỏng nên đã chuyển về không gian an toàn.');
   }
  }
  if(!restored)await facade.openDemo();
  facade.activate('studio');ui.showLoading(false);ui.renderPanel();await ui.updateProjectCount();await ui.updateDraftThumbnail().catch(()=>{});await ui.showHome('studio');
 }catch(error){
  ui.showLoading(false);ui.toast(error.message||'Không thể khôi phục dự án.');
  const statusEl=document.getElementById('save-status');if(statusEl)statusEl.textContent='Mở ảnh để bắt đầu';
  try{ui.renderPanel();await ui.showHome('studio');}catch{}
 }
 finally{document.getElementById('v2-launch').hidden=true;}
 startAppUpdates(ui);
 return window.Studio;
}
