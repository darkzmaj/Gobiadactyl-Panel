import { describe, expect, it } from 'vitest';
import { parseScheme } from './appearance';

describe('appearance', () => {
    it('parses unknown values as system', () => {
        expect(parseScheme('dark')).toBe('dark');
        expect(parseScheme('light')).toBe('light');
        expect(parseScheme('system')).toBe('system');
        expect(parseScheme('purple')).toBe('system');
        expect(parseScheme(null)).toBe('system');
        expect(parseScheme(undefined)).toBe('system');
    });
});
