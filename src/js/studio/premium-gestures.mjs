import {MobileGestureRouter} from './mobile-gestures.mjs';
export class PremiumGestureRouter extends MobileGestureRouter{
 down(event){
  if(this.ui.tool==='makeup'&&!this.f.activeMakeupLayer()&&!this.pointers.size){this.stop(event);this.ui.toast('Chọn Môi, Má hoặc Mắt để tiếp tục trên một lớp màu.');return;}
  return super.down(event);
 }
}
