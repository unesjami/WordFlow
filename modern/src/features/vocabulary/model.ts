import type { Word } from '../../domain';
import {classifyText} from '../../domain';
const norm=(s:string)=>s.trim().normalize('NFKC').toLocaleLowerCase();
export function searchWords(words:Word[],query:string){const q=norm(query);return words.map((word,index)=>({word,index})).filter(({word})=>[word.en,word.fa,...(word.tags??[])].some(value=>norm(value).includes(q)));}
export function saveWord(words:Word[],en:string,fa:string,index:number|null=null,kind?:Word['kind']):Word[]{en=en.trim();fa=fa.trim();if(!en||!fa)throw new Error('Both languages are required.');if(index!==null&&(!Number.isInteger(index)||index<0||index>=words.length))throw new Error('Word no longer exists.');if(index===null)return [...words,{en,fa,kept:false,timestamp:Date.now(),kind:kind??classifyText(en)}];return words.map((w,i)=>i===index?{...w,en,fa}:w);}
export function removeWord(words:Word[],index:number):Word[]{if(!Number.isInteger(index)||index<0||index>=words.length)throw new Error('Word no longer exists.');return words.filter((_,i)=>i!==index);}
