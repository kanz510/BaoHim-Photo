import{processPixels}from'./pixel-pipeline.mjs';
self.onmessage=event=>{const{id,job}=event.data;try{const pixels=processPixels(job);self.postMessage({id,pixels},[pixels.buffer]);}catch(error){self.postMessage({id,error:String(error.message||error)});}};
