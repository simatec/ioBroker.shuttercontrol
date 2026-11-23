/*!
 * ioBroker gulpfile
 * Date: 2026-11-23
 */
const fs = require('node:fs');
const { deleteFoldersRecursive, buildReact, copyFiles, npmInstall } = require('@iobroker/build-tools');

function clean() {
    deleteFoldersRecursive(`${__dirname}/src-tab/build`);
    deleteFoldersRecursive(`${__dirname}/admin`, [
        'shuttercontrol.png',
        'shuttercontrol.svg',
        '.json',
        '.json5',
        'img',
        'index_m.html',
        'index_m.js',
        'style.css',
        'words.js',
        'i18n',
    ]);
}

function copyAllFiles() {
    copyFiles([
        'src-tab/build/*',
        `!src-tab/build/index.html`,
        `!src-tab/build/static/js/*.map`,
    ], 'admin/');
    copyFiles(['src-tab/build/assets/*'], 'admin/assets');
}

function patchFiles() {
    if (fs.existsSync(`${__dirname}/src-tab/build/index.html`)) {
        let code = fs.readFileSync(`${__dirname}/src-tab/build/index.html`).toString('utf8');
        code = code.replace(/<script>\s*(?:var|const|let) script\s?=\s?document\.createElement\(["']script["']\)[^<]+<\/script>/,
            `<script type="text/javascript" src="./../../lib/js/socket.io.js"></script>`);

        fs.existsSync(`${__dirname}/admin/tab_m.html`) && fs.unlinkSync(`${__dirname}/admin/tab_m.html`);
        fs.writeFileSync(`${__dirname}/admin/tab_m.html`, code);
    }
}

if (process.argv.includes('--0-clean')) {
    clean();
} else if (process.argv.includes('--1-npm')) {
    if (!fs.existsSync(`${__dirname}/src-tab/node_modules`)) {
        npmInstall(`${__dirname}/src-tab/`).catch(e => console.error(e));
    }
} else if (process.argv.includes('--2-build')) {
    buildReact(`${__dirname}/src-tab/`, { rootDir: __dirname, vite: true }).catch(e => console.error(e));
} else if (process.argv.includes('--3-copy')) {
    copyAllFiles();
} else if (process.argv.includes('--4-patch')) {
    patchFiles();
} else {
    clean();
    let installPromise;
    if (!fs.existsSync(`${__dirname}/src-tab/node_modules`)) {
        installPromise = npmInstall(`${__dirname}/src-tab/`).catch(e => console.error(e));
    } else {
        installPromise = Promise.resolve();
    }
    installPromise
        .then(() => buildReact(`${__dirname}/src-tab/`, { rootDir: __dirname, vite: true }))
        .then(() => copyAllFiles())
        .then(() => patchFiles())
        .catch(e => console.error(e));
}
