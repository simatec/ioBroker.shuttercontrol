import React from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';
import pack from '../package.json';

declare global {
    interface Window {
        sentryDSN: string;
        adapterName: string | undefined;
    }
}

window.adapterName = 'shuttercontrol';
// window.sentryDSN = 'https://5f58df7167d846e3a90bae5414d4fc09@sentry.iobroker.net/62';

console.log(`iobroker.${window.adapterName}@${pack.version}`);

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
