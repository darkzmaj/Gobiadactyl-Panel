import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

const here = resolve(import.meta.dirname);
const core = new Set(
    readFileSync(resolve(here, '../node_modules/@pterodactyl/sdk/core-classes.txt'), 'utf8')
        .split(/\s+/)
        .filter(Boolean)
);

const sources = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            return sources(path);
        }

        return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [path] : [];
    });

/** The class lists the views and skins write: className strings and the extra classes handed to `below()`. */
function classesIn(source: string): string[] {
    const lists = [
        ...source.matchAll(/className=(?:'([^']*)'|"([^"]*)")/g),
        ...source.matchAll(/below\('([^']*)'\)/g),
    ].map((match) => match[1] ?? match[2] ?? '');

    return lists.flatMap((list) => list.split(/\s+/)).filter(Boolean);
}

// theme.css does not import theme-entry.css (that would ship the panel stylesheet twice), so a utility the panel
// stylesheet lacks would silently do nothing. The gb-* classes come from gobia.css.
test('every utility class the theme uses is in the panel stylesheet', () => {
    const missing = sources(here).flatMap((file) =>
        classesIn(readFileSync(file, 'utf8'))
            .filter((name) => !name.startsWith('gb-') && !core.has(name))
            .map((name) => `${name} (${file.slice(here.length + 1)})`)
    );

    expect(missing).toEqual([]);
});
