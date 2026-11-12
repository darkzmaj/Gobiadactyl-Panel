// Replaces fetch, XMLHttpRequest and WebSocket so that every Panel API call and the console socket are answered in the
// browser. Requests to anything that is not the demo's own origin are refused: the demo never talks to a real host.
export interface MockRequest {
    method: string;
    url: URL;
    body: unknown;
}

export interface MockResponse {
    status: number;
    body?: unknown;
    headers?: Record<string, string>;
}

export type Handler = (request: MockRequest) => Promise<MockResponse | null>;

const realFetch = window.fetch.bind(window);
const RealXHR = window.XMLHttpRequest;

const isMocked = (url: URL) => url.origin === window.location.origin && /^\/(api|auth|sanctum)\//.test(url.pathname);

function parseBody(body: unknown): unknown {
    if (typeof body !== 'string') return body ?? null;
    try {
        return JSON.parse(body);
    } catch {
        return body;
    }
}

function encode(response: MockResponse): { text: string; type: string } {
    if (typeof response.body === 'string') return { text: response.body, type: response.headers?.['content-type'] ?? 'text/plain' };
    return { text: response.body === undefined ? '' : JSON.stringify(response.body), type: 'application/json' };
}

// A little latency so loading states (skeletons) show the way they do against a real Panel.
const delay = () => new Promise((resolve) => setTimeout(resolve, 60 + Math.random() * 140));

export function installTransport(handle: Handler, refuse: (url: URL) => boolean) {
    const respond = async (request: MockRequest): Promise<MockResponse> => {
        await delay();
        try {
            return (await handle(request)) ?? { status: 404, body: { errors: [{ code: 'NotFoundHttpException', status: '404', detail: 'This is not part of the demo.' }] } };
        } catch (error) {
            console.warn('[demo] handler failed', request.method, request.url.pathname, error);
            return { status: 500, body: { errors: [{ code: 'DemoError', status: '500', detail: 'The demo could not answer this request.' }] } };
        }
    };

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = input instanceof Request ? input : null;
        const url = new URL(request ? request.url : String(input), window.location.href);
        if (refuse(url)) return Promise.reject(new TypeError('Blocked by the demo: ' + url.origin));
        if (!isMocked(url)) return realFetch(input, init);
        const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
        let body: unknown = init?.body ?? null;
        if (body === null && request && method !== 'GET' && method !== 'HEAD') body = await request.clone().text();
        const response = await respond({ method, url, body: body instanceof FormData ? body : parseBody(body) });
        const { text, type } = encode(response);
        return new Response(response.status === 204 ? null : text, { status: response.status, headers: { 'content-type': type, ...response.headers } });
    };

    class DemoXHR extends EventTarget {
        static readonly UNSENT = 0;
        static readonly OPENED = 1;
        static readonly HEADERS_RECEIVED = 2;
        static readonly LOADING = 3;
        static readonly DONE = 4;
        readyState = 0;
        status = 0;
        statusText = '';
        response: unknown = null;
        responseText = '';
        responseType: XMLHttpRequestResponseType = '';
        responseURL = '';
        timeout = 0;
        withCredentials = false;
        upload = new EventTarget();
        onreadystatechange: ((event: Event) => void) | null = null;
        onload: ((event: Event) => void) | null = null;
        onloadend: ((event: Event) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        onabort: ((event: Event) => void) | null = null;
        ontimeout: ((event: Event) => void) | null = null;
        private method = 'GET';
        private url = new URL(window.location.href);
        private headers: Record<string, string> = {};
        private aborted = false;
        private real: XMLHttpRequest | null = null;

        open(method: string, url: string | URL) {
            this.method = method.toUpperCase();
            this.url = new URL(String(url), window.location.href);
            this.setState(1);
        }

        setRequestHeader() {}

        overrideMimeType() {}

        getAllResponseHeaders() {
            return Object.entries(this.headers)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\r\n');
        }

        getResponseHeader(name: string) {
            return this.headers[name.toLowerCase()] ?? null;
        }

        abort() {
            this.aborted = true;
            this.fire('abort');
            this.fire('loadend');
        }

        send(body?: Document | XMLHttpRequestBodyInit | null) {
            if (refuse(this.url) || !isMocked(this.url)) {
                this.status = 0;
                setTimeout(() => (this.fire('error'), this.fire('loadend')));
                return;
            }
            void respond({ method: this.method, url: this.url, body: body instanceof FormData ? body : parseBody(body) }).then((response) => {
                if (this.aborted) return;
                const { text, type } = encode(response);
                this.headers = { 'content-type': type, ...response.headers };
                this.status = response.status;
                this.statusText = String(response.status);
                this.responseURL = this.url.href;
                this.responseText = text;
                this.response = this.responseType === 'json' ? parseBody(text) : this.responseType === 'blob' ? new Blob([text], { type }) : text;
                this.setState(2);
                this.setState(3);
                this.setState(4);
                this.fire('load');
                this.fire('loadend');
            });
        }

        private setState(state: number) {
            this.readyState = state;
            this.fire('readystatechange');
        }

        private fire(type: string) {
            const event = new ProgressEvent(type);
            const handler = (this as unknown as Record<string, unknown>)['on' + type];
            if (typeof handler === 'function') handler.call(this, event);
            this.dispatchEvent(event);
        }
    }
    void RealXHR;
    window.XMLHttpRequest = DemoXHR as unknown as typeof XMLHttpRequest;
}

export interface SocketPeer {
    send(event: string, ...args: string[]): void;
    closed: boolean;
}

/** The console websocket. `connect` receives the URL and returns the handler of each message the page sends. */
export function installWebSocket(connect: (url: URL, peer: SocketPeer) => (event: string, args: string[]) => void) {
    class DemoSocket extends EventTarget {
        static readonly CONNECTING = 0;
        static readonly OPEN = 1;
        static readonly CLOSING = 2;
        static readonly CLOSED = 3;
        readyState = 0;
        url: string;
        protocol = '';
        extensions = '';
        binaryType: BinaryType = 'blob';
        bufferedAmount = 0;
        onopen: ((event: Event) => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        onclose: ((event: CloseEvent) => void) | null = null;
        private receive: (event: string, args: string[]) => void = () => {};
        private peer: SocketPeer;

        constructor(url: string | URL) {
            super();
            this.url = String(url);
            this.peer = {
                closed: false,
                send: (event, ...args) => {
                    if (this.readyState !== 1) return;
                    this.emit(new MessageEvent('message', { data: JSON.stringify({ event, args }) }));
                },
            };
            setTimeout(() => {
                this.readyState = 1;
                this.receive = connect(new URL(this.url), this.peer);
                this.emit(new Event('open'));
            }, 120);
        }

        send(data: string) {
            if (this.readyState !== 1) return;
            const message = JSON.parse(data) as { event: string; args?: string[] };
            setTimeout(() => this.receive(message.event, message.args ?? []), 20);
        }

        close(code = 1000) {
            if (this.readyState >= 2) return;
            this.readyState = 3;
            this.peer.closed = true;
            this.emit(new CloseEvent('close', { code, wasClean: true }));
        }

        private emit(event: Event) {
            const handler = (this as unknown as Record<string, unknown>)['on' + event.type];
            if (typeof handler === 'function') handler.call(this, event);
            this.dispatchEvent(event);
        }
    }
    window.WebSocket = DemoSocket as unknown as typeof WebSocket;
}
