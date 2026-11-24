// ioBroker eslint template configuration file for js and ts files
// Please note that esm or react based modules need additional modules loaded.
import config from '@iobroker/eslint-config';

export default [
    ...config,

    {
        // specify files to exclude from linting here
        ignores: [
            'src-tab/**/*',
            'src-admin/**/*',
            'admin/**/*',
            'node_modules/**/*',
            'test/**/*',
            'build/**/*',
            'tasks.js',
            'tmp/**/*',
            '.**/*',
            '.dev-server/',
            '.vscode/',
            '*.test.js',
            'test/**/*.js',
            '*.config.mjs',
            '.ncurc.js',
            'build',
            'admin/build',
            'admin/assets',
            'admin/custom/**/*',
            'admin/admin.d.ts',
            '**/adapter-config.d.ts',
        ],
    },

    {
        // Backend sources.
        files: ['src/**/*.ts'],
        rules: {
            // Several entry points of the automatics are declared `async` without awaiting anything.
            // That is part of their existing shape - dropping the keyword would turn the returned
            // promise into undefined for any caller that awaits them.
            '@typescript-eslint/require-await': 'off',
        },
    },

    {
        // you may disable some 'jsdoc' warnings - but using jsdoc is highly recommended
        // as this improves maintainability. jsdoc warnings will not block buiuld process.
        rules: {
            'jsdoc/require-jsdoc': 'off',
            'no-async-promise-executor': 'off',
            'prettier/prettier': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'curly': 'off',
            'jsdoc/require-returns-description': 'off',
            'no-else-return': 'off',
            'jsdoc/require-param-description': 'off',
            'no-constant-binary-expression': 'off',
            'no-irregular-whitespace': 'off',
            //'no-prototype-builtins': 'off',
            //'no-case-declarations': 'off',
            //'no-useless-escape': 'off',
            //'jsdoc/require-param': 'off',
            //'@typescript-eslint/no-require-imports': 'off',
            //'jsdoc/no-types': 'off',
            //'jsdoc/tag-lines': 'off',
        },
    },
];
