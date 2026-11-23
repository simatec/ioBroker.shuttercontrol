/*!
 * ioBroker gulpfile
 * Date: 2026-11-23
 */
const fs = require('node:fs');
const { deleteFoldersRecursive, buildReact, copyFiles, npmInstall } = require('@iobroker/build-tools');

// ---------------------------------------------------------------------------------------------
// src-admin: custom components of the jsonConfig (module federation), built to admin/custom
// ---------------------------------------------------------------------------------------------

function buildAdmin() {
    return buildReact(`${__dirname}/src-admin/`, { rootDir: `${__dirname}/src-admin/`, vite: true });
}

function cleanAdmin() {
    deleteFoldersRecursive(`${__dirname}/admin/custom`);
    deleteFoldersRecursive(`${__dirname}/src-admin/build`);
}

function copyAllAdminFiles() {
    copyFiles(['src-admin/build/assets/*.css'], 'admin/custom/assets');
    copyFiles(['src-admin/build/assets/*.js'], 'admin/custom/assets');
    copyFiles(['src-admin/build/assets/*.png'], 'admin/custom/assets');
    copyFiles(['src-admin/build/customComponents.js'], 'admin/custom');
    // The GUI API gate of @iobroker/json-config reads this manifest to detect which component
    // library the remote was built against, so it must sit next to the remote entry.
    copyFiles(['src-admin/build/mf-manifest.json'], 'admin/custom');
    // src-admin is not part of the npm package, so the language files must be copied into admin
    copyFiles(['src-admin/src/i18n/*.json'], 'admin/custom/i18n');
}

// ---------------------------------------------------------------------------------------------
// src-tab: the React tab, built to admin (tab_m.html)
// ---------------------------------------------------------------------------------------------

function clean() {
    deleteFoldersRecursive(`${__dirname}/src-tab/build`);
    deleteFoldersRecursive(`${__dirname}/admin`, [
        'shuttercontrol.png',
        'shuttercontrol.svg',
        '.json',
        '.json5',
        'custom',
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
    // src-tab is not part of the npm package, so the language files must be copied into admin
    copyFiles(['src-tab/src/i18n/*.json'], 'admin/tab/i18n');
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

function buildTab() {
    clean();
    let installPromise;
    if (!fs.existsSync(`${__dirname}/src-tab/node_modules`)) {
        installPromise = npmInstall(`${__dirname}/src-tab/`);
    } else {
        installPromise = Promise.resolve();
    }
    return installPromise
        .then(() => buildReact(`${__dirname}/src-tab/`, { rootDir: __dirname, vite: true }))
        .then(() => copyAllFiles())
        .then(() => patchFiles());
}

function buildAdminAll() {
    cleanAdmin();
    let installPromise;
    if (!fs.existsSync(`${__dirname}/src-admin/node_modules`)) {
        installPromise = npmInstall(`${__dirname}/src-admin/`);
    } else {
        installPromise = Promise.resolve();
    }
    return installPromise
        .then(() => buildAdmin())
        .then(() => copyAllAdminFiles());
}

if (process.argv.includes('--admin-0-clean')) {
    cleanAdmin();
} else if (process.argv.includes('--admin-1-npm')) {
    npmInstall(`${__dirname}/src-admin/`).catch(e => console.error(e));
} else if (process.argv.includes('--admin-2-compile')) {
    buildAdmin().catch(e => console.error(e));
} else if (process.argv.includes('--admin-3-copy')) {
    copyAllAdminFiles();
} else if (process.argv.includes('--admin-build')) {
    buildAdminAll().catch(e => console.error(e));
} else if (process.argv.includes('--0-clean')) {
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
} else if (process.argv.includes('--tab-build')) {
    buildTab().catch(e => console.error(e));
} else {
    // build everything: first the custom components of the configuration, then the tab
    buildAdminAll()
        .then(() => buildTab())
        .catch(e => {
            console.error(e);
            process.exit(1);
        });
}
