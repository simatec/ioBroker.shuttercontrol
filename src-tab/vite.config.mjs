import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';

/**
 * In the adapter the tab loads its language files from admin/tab/i18n (copied there by the build).
 * The dev server serves them directly from src/i18n.
 */
function tabI18n() {
    return {
        name: 'tab-i18n',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const match = req.url && req.url.match(/^\/tab\/i18n\/([\w-]+)\.json/);
                if (!match) {
                    return next();
                }
                try {
                    const text = await readFile(new URL(`./src/i18n/${match[1]}.json`, import.meta.url), 'utf8');
                    res.setHeader('Content-Type', 'application/json');
                    res.end(text);
                } catch {
                    res.statusCode = 404;
                    res.end();
                }
            });
        },
    };
}

export default defineConfig(() => {
    return {
        build: {
            outDir: 'build',
        },
        plugins: [react(), tabI18n()],
        base: './',
        server: {
            port: 3000,
            proxy: {
                '/adapter': {
                    target: 'http://localhost:8081',
                    changeOrigin: true,
                    secure: false,
                    configure: (proxy, _options) => {
                        proxy.on('error', (err, _req, _res) => {
                            console.log('proxy error', err);
                        });
                        proxy.on('proxyReq', (proxyReq, req, _res) => {
                            console.log('Sending Request to the Target:', req.method, req.url);
                        });
                        proxy.on('proxyRes', (proxyRes, req, _res) => {
                            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
                        });
                    },
                },
            },
        },
    };
});
