import { installTransport, installWebSocket } from './transport';
import { route } from './routes';
import { connectWings } from './wings';
import { mountBanner } from './banner';

// Only the page's own origin is reachable over the network; data: and blob: URLs (the console's WebAssembly) stay local.
installTransport(route, (url) => /^(https?|wss?):$/.test(url.protocol) && url.origin !== window.location.origin);
installWebSocket(connectWings);
mountBanner();
