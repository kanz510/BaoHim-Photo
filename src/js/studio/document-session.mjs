/** A single status owner for document I/O, separate from native edit history. */
export class DocumentSession{
 constructor(notify=()=>{}){this.notify=notify;this.epoch=0;this.phase='ready';}
 begin(label){if(this.phase==='opening')throw new Error('Đang mở ảnh hoặc dự án. Hãy đợi một chút.');this.phase='opening';const token=++this.epoch;this.notify({phase:this.phase,label,token});return token;}
 finish(token,error){if(token!==this.epoch)return false;this.phase=error?'error':'ready';this.notify({phase:this.phase,label:'',error,token});return true;}
}
