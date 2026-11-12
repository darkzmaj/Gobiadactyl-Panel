// The demo's own controls, outside the app: a "Try the demo" card on the sign-in page and a small badge everywhere
// else that says the data is fake and resets the demo.
const signIn = () => {
    localStorage.setItem('gobia-demo:session', '1');
    window.location.assign('/');
};

const reset = () => {
    for (const key of Object.keys(localStorage)) if (key.startsWith('gobia')) localStorage.removeItem(key);
    sessionStorage.clear();
    window.location.assign('/auth/login');
};

function element(tag: string, className: string, text?: string) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
}

export function mountBanner() {
    const mount = () => {
        if (window.location.pathname.startsWith('/auth/')) {
            const card = element('aside', 'gobia-demo-card');
            card.setAttribute('aria-label', 'About this demo');
            const text = element('p', '', 'This is a live demo with fake data. Sign in with anything, or skip the form.');
            const button = element('button', 'gobia-demo-try', 'Try the demo');
            button.type = 'button';
            button.addEventListener('click', signIn);
            card.append(text, button);
            document.body.append(card);
            return;
        }
        const badge = element('aside', 'gobia-demo-badge');
        badge.setAttribute('aria-label', 'Demo mode');
        const label = element('span', '', 'Demo · fake data');
        const button = element('button', '', 'Reset');
        button.type = 'button';
        button.title = 'Forget every change and start over';
        button.addEventListener('click', reset);
        badge.append(label, button);
        document.body.append(badge);
    };
    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount, { once: true });
}
