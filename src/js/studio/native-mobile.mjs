/** Remove only the legacy presentation after native tool/plugin initialization. */
export function installNativeMobile(app){
 const gui=app.GUI,noop=()=>{};
 for(const [object,methods] of [[gui.GUI_layers,['render_layers']],[gui.GUI_details,['render_details']],[gui.GUI_tools,['show_action_attributes','render_tools']],[gui.GUI_information,['show_size']],[gui.GUI_colors,['render_selected_color','render_ui_deferred']],[gui.GUI_preview,['prepare_canvas','render_preview_active_zone']]])for(const method of methods)object[method]=noop;
 app.Layers.render_preview=noop;
 document.querySelector('.native-support')?.remove();
 const prepare=gui.prepare_canvas.bind(gui);
 gui.prepare_canvas=()=>{
  prepare();const canvas=document.getElementById('canvas_minipaint'),w=canvas.width,h=canvas.height,d=Math.max(1,Math.min(3,globalThis.devicePixelRatio||1));
  canvas.studioViewportWidth=w;canvas.studioViewportHeight=h;canvas.studioPixelRatio=d;
  canvas.style.setProperty('width',w+'px','important');canvas.style.setProperty('height',h+'px','important');
  canvas.width=Math.max(1,Math.round(w*d));canvas.height=Math.max(1,Math.round(h*d));canvas.getContext('2d').imageSmoothingEnabled=app.Config.ZOOM<1;
 };
}
