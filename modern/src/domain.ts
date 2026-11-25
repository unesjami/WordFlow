export interface Review { due: number; interval: number; count: number; correct: number }
export interface Word { en: string; fa: string; kept: boolean; timestamp: number; tags?: string[]; example?: string; review?: Review }
export const legacyStorageKey = 'word_update_fix_v6';
export function isWord(value: unknown): value is Word { if (!value || typeof value !== 'object') return false; const w = value as Partial<Word>; return typeof w.en === 'string' && typeof w.fa === 'string' && typeof w.kept === 'boolean' && typeof w.timestamp === 'number' && Number.isFinite(w.timestamp); }
export function parseLegacyWords(raw: string): Word[] { const parsed: unknown = JSON.parse(raw); if (!Array.isArray(parsed) || !parsed.every(isWord)) throw new Error('Invalid vocabulary backup'); return parsed; }
