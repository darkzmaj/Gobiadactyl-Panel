import { useEffect, useRef } from 'react';
import type { ViewProps } from '@pterodactyl/sdk';
import { applyTheme, languageOf, monaco } from '../workspace/monaco';

const isDark = () => document.documentElement.classList.contains('dark');

/**
 * The editing surface of the panel's own editor page in the legacy file mode: the same Monaco editor as the workspace
 * (theme, no minimap). The panel keeps the buffer, the save, the read-only rule and the unsaved changes guard; this
 * reports every edit with `change()` and saves with Ctrl or Cmd+S through `save()`.
 */
export default function MonacoCanvas({ model, className }: ViewProps<'server.files.editor.canvas'>) {
    const host = useRef<HTMLDivElement>(null);
    const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const latest = useRef(model);
    latest.current = model;

    useEffect(() => {
        const instance = monaco.editor.create(host.current as HTMLElement, {
            value: latest.current.content,
            language: languageOf(latest.current.name || latest.current.path),
            readOnly: latest.current.readOnly,
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
            scrollBeyondLastLine: false,
            tabSize: 4,
            fixedOverflowWidgets: true,
            quickSuggestions: false,
            padding: { top: 8, bottom: 8 },
        });
        editor.current = instance;
        applyTheme(isDark());

        const changed = instance.onDidChangeModelContent(() => latest.current.change(instance.getValue()));
        instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void latest.current.save());
        // Follow the scheme switch (the panel swaps the class on <html>).
        const scheme = new MutationObserver(() => applyTheme(isDark()));
        scheme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        return () => {
            scheme.disconnect();
            changed.dispose();
            instance.getModel()?.dispose();
            instance.dispose();
            editor.current = null;
        };
    }, []);

    useEffect(() => {
        editor.current?.updateOptions({ readOnly: model.readOnly });
    }, [model.readOnly]);

    return (
        <div
            ref={host}
            className={className}
            style={{ height: '70vh', minHeight: 320, borderRadius: 12, overflow: 'hidden' }}
            aria-label={`Editing ${model.name || 'a new file'}`}
        />
    );
}
