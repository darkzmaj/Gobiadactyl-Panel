import { useEffect, useRef, type RefObject } from 'react';
import type { Terminal } from 'ghostty-web';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import { normalizeTransferStatus } from '@/components/server/transfer';
import type { Websocket } from '@/plugins/Websocket';

/**
 * Gobia: the prompt in front of the panel's own lines, bold bright blue. gobia-core publishes the text an administrator
 * chose as `data-gobia-console-prompt` on <html>; control characters are dropped so it can never carry escape codes.
 */
const DEFAULT_PROMPT = 'panel@gobia~';
// oxlint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

const terminalPrelude = () => {
    const custom = (document.documentElement.dataset.gobiaConsolePrompt ?? '').replace(CONTROL_CHARACTERS, '').trim();

    return `\u001b[1m\u001b[94m${custom || DEFAULT_PROMPT} \u001b[0m`;
};

/** Gobia: Wings' own status lines are muted so the server's output stands out. */
const DAEMON_TEXT = '\u001b[90m';

// Wings answers a throttled request with this event, naming the request it dropped.
const THROTTLED_EVENT = 'throttled';

// Wings grants one more `send logs` request every five seconds once its burst is spent.
const SEND_LOGS_RETRY_MS = 5_000;

const MAX_RETAINED_TRANSFER_LINES = 1_000;

const formatLine = (line: string, prelude = false) =>
    `${(prelude ? terminalPrelude() + DAEMON_TEXT : '') + line.replace(/(?:\r\n|\r|\n)$/im, '')}\u001b[0m`;

/** Streams the server's socket output into the terminal, requesting log history on each connection. */
export const useConsoleSocketLogs = ({
    connected,
    instance,
    terminal,
    terminalReady,
}: {
    connected: boolean;
    instance: Websocket | null;
    terminal: RefObject<Terminal | null>;
    terminalReady: boolean;
}) => {
    const transferLines = useRef<string[]>([]);

    // react-doctor-disable-next-line react-doctor/effect-needs-cleanup
    useEffect(() => {
        const term = terminal.current;

        if (!terminalReady || !term || !connected || !instance) {
            return;
        }

        const writeTransferLine = (line: string) => {
            const lines = transferLines.current;

            lines.push(line);
            if (lines.length > MAX_RETAINED_TRANSFER_LINES) {
                lines.splice(0, lines.length - MAX_RETAINED_TRANSFER_LINES);
            }

            term.writeln(line);
        };

        const handleTransferStatus = (status: string) => {
            if (normalizeTransferStatus(status) === 'failed') {
                writeTransferLine(`${terminalPrelude()}Transfer has failed.\u001b[0m`);
            }
        };

        const handleDaemonErrorOutput = (line: string) =>
            term.writeln(`${terminalPrelude()}\u001b[1m\u001b[41m${formatLine(line)}`);

        // Gobia: the same state reported again (a reconnect, a repeated event) is not printed a second time.
        let lastState: string | null = null;
        const handlePowerChangeEvent = (state: string) => {
            if (state === lastState) {
                return;
            }

            lastState = state;
            term.writeln(`${terminalPrelude()}${DAEMON_TEXT}Server marked as ${state}...\u001b[0m`);
        };

        const listeners = [
            [SocketEvent.STATUS, handlePowerChangeEvent],
            [SocketEvent.CONSOLE_OUTPUT, (line: string) => term.writeln(formatLine(line))],
            [SocketEvent.INSTALL_OUTPUT, (line: string) => term.writeln(formatLine(line))],
            [SocketEvent.TRANSFER_LOGS, (line: string) => writeTransferLine(formatLine(line))],
            [SocketEvent.TRANSFER_STATUS, handleTransferStatus],
            [SocketEvent.DAEMON_MESSAGE, (line: string) => term.writeln(formatLine(line, true))],
            [SocketEvent.DAEMON_ERROR, handleDaemonErrorOutput],
        ] satisfies readonly (readonly [SocketEvent, (line: string) => void])[];

        const requestHistory = () => {
            term.clear();
            for (const line of transferLines.current) {
                term.writeln(line);
            }

            instance.send(SocketRequest.SEND_LOGS);
        };

        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        const handleThrottled = (request: string) => {
            if (request !== SocketRequest.SEND_LOGS || retryTimer !== undefined) {
                return;
            }

            retryTimer = setTimeout(() => {
                retryTimer = undefined;
                requestHistory();
            }, SEND_LOGS_RETRY_MS);
        };

        for (const [event, listener] of listeners) {
            instance.addListener(event, listener);
        }

        instance.addListener(THROTTLED_EVENT, handleThrottled);
        requestHistory();

        return () => {
            clearTimeout(retryTimer);
            for (const [event, listener] of listeners) {
                instance.removeListener(event, listener);
            }

            instance.removeListener(THROTTLED_EVENT, handleThrottled);
        };
    }, [connected, instance, terminal, terminalReady]);
};
