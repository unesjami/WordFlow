export interface Review { due: number; interval: number; count: number; correct: number }
export interface Word { en: string; fa: string; kept: boolean; timestamp: number; tags?: string[]; example?: string; kind?: 'word'|'sentence'; review?: Review }
export const legacyStorageKey = 'word_update_fix_v6';
export function isWord(value: unknown): value is Word { if (!value || typeof value !== 'object') return false; const w = value as Partial<Word>; return typeof w.en === 'string' && typeof w.fa === 'string' && typeof w.kept === 'boolean' && typeof w.timestamp === 'number' && Number.isFinite(w.timestamp); }
export function parseLegacyWords(raw: string): Word[] { const parsed: unknown = JSON.parse(raw); if (!Array.isArray(parsed) || !parsed.every(isWord)) throw new Error('Invalid vocabulary backup'); return parsed; }

export function classifyText(text:string):'word'|'sentence' {
 const clean=text.trim(),tokens=clean.match(/[\p{L}\p{N}]+(?:['’‌-][\p{L}\p{N}]+)*/gu)??[];
 if(tokens.length<=1)return 'word';
 if(/[.!?؟。！؛;]/.test(clean)||/\n/.test(clean)||tokens.length>=6)return 'sentence';
 if(/^(i|you|he|she|we|they|it|this|that|there|what|why|how|who|where|when|do|does|did|can|could|would|will|is|are|was|were)\s/i.test(clean))return 'sentence';
 if(/^(من|تو|او|ما|شما|آنها|آن‌ها)\s/u.test(clean)||/(?:است|هست|بود|شد|کردم|کنم|کنید|دارم|دارد|رفت|رفتم|می‌روم|می‌رود)$/u.test(clean))return 'sentence';
 return 'word';
}
export function entryKind(w:Word):'word'|'sentence'{return w.kind==='word'||w.kind==='sentence'?w.kind:classifyText(w.en);}
export function learningWords(words:Word[]){return words.filter(w=>entryKind(w)==='word');}
