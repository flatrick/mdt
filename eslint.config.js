const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    {
        ignores: ['.cursor/**', 'node_modules/**']
    },
    js.configs.recommended,
    {
        files: ['**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.es2022
            }
        }
    },
    {
        files: ['**/*.js', '**/*.cjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...globals.es2022
            }
        },
        rules: {
            'no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }],
            'no-undef': 'error',
            'eqeqeq': 'error'
        }
    },
    {
        files: ['scripts/**/*.js'],
        rules: {
            'complexity': ['error', 12],
            'max-lines-per-function': ['error', 80],
            'max-depth': ['error', 4],
            'no-param-reassign': 'error'
        }
    }
];
