import { describe, it, expect } from 'vitest';
import { parseLegacyWords } from './domain';
describe('legacy vocabulary compatibility', () => { it('preserves bilingual words and review information', () => { const words = [{en:'Apple',fa:'سیب',kept:false,timestamp:1,review:{due:2,interval:1,count:1,correct:1}}]; expect(parseLegacyWords(JSON.stringify(words))).toEqual(words); }); it('rejects malformed data instead of silently clearing it', () => { expect(() => parseLegacyWords('[{}]')).toThrow(); }); });
