export type Language='en'|'fa';
export function detectLanguage(text:string):Language{return /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(text)?'fa':'en';}
export async function translate(text:string,source:Language,target:Language,signal?:AbortSignal):Promise<string>{
 const clean=text.trim().replace(/\s+/g,' ');
 if(!clean||clean.length>500||source===target)throw new Error('Enter 1–500 characters in the source language.');
 const q=encodeURIComponent(clean);
 const providers=[
 {url:'https://translate.googleapis.com/translate_a/single?client=gtx&sl='+source+'&tl='+target+'&dt=t&q='+q,parse:(d:any)=>Array.isArray(d?.[0])?d[0].map((part:any)=>typeof part?.[0]==='string'?part[0]:'').join(''):''},
 {url:'https://api.mymemory.translated.net/get?q='+q+'&langpair='+source+'%7C'+target,parse:(d:any)=>Number(d?.responseStatus)===200&&typeof d?.responseData?.translatedText==='string'?d.responseData.translatedText:''}
 ];
 for(const provider of providers){
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  const controller=new AbortController();
  const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,7000);
  try{const response=await fetch(provider.url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)continue;const result=provider.parse(await response.json()).trim();if(result&&!signal?.aborted)return result;}
  catch{if(signal?.aborted)throw new DOMException('Aborted','AbortError');}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 throw new Error('Translation unavailable. Try again.');
}
