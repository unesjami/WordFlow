import type {Word,Review} from '../../domain';
export const ratings={Again:0,Hard:1.2,Good:2,Easy:3} as const;
export type Rating=keyof typeof ratings;
export type Mode='choice'|'typing'|'listen'|'cloze';
export const normalizeAnswer=(s:string)=>s.normalize('NFKC').trim().toLowerCase().replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u064b-\u065f]/g,'').replace(/\s+/g,' ');
export function dueQueue(words:Word[],now=Date.now()){return words.map((w,index)=>({w,index})).filter(({w})=>!w.review||w.review.due<=now).sort((a,b)=>(a.w.review?.due||0)-(b.w.review?.due||0)).slice(0,30).map(x=>x.index);}
export function rate(word:Word,rating:Rating,now=Date.now()):Review{const old=word.review??{interval:0,count:0,correct:0,due:0};const factor=ratings[rating];const interval=factor===0?0:Math.min(365,Math.max(1,Math.round((old.interval||1)*factor)));return {interval,due:now+(interval?interval*86400000:600000),count:old.count+1,correct:old.correct+(factor>0?1:0)};}
export function shuffle<T>(items:T[],random=Math.random):T[]{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function cloze(w:Word):string|null{if(!w.example||!w.en.trim())return null;const escaped=w.en.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const pattern=new RegExp(escaped,'iu');return pattern.test(w.example)?w.example.replace(pattern,'_____'):null;}
export function practiceQueue(words:Word[],mode:Mode){let pool=words.filter(w=>w.en.trim()&&w.fa.trim());if(mode==='cloze')pool=pool.filter(w=>cloze(w)!==null);if(mode==='choice'&&new Set(pool.map(w=>normalizeAnswer(w.fa))).size<2)return [];return shuffle(pool).slice(0,10);}
export function choices(word:Word,words:Word[]){const seen=new Set([normalizeAnswer(word.fa)]);const alternatives=shuffle(words).filter(w=>{const n=normalizeAnswer(w.fa);if(!n||seen.has(n))return false;seen.add(n);return true;}).slice(0,3).map(w=>w.fa);return shuffle([word.fa,...alternatives]);}
