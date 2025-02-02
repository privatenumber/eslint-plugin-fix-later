import { ESLint } from 'eslint';

declare const _default: ESLint.Plugin & {
    configs: {
        recommended: {
            plugins: {
                'fix-later': ESLint.Plugin;
            };
            rules: {
                'fix-later/fix-later': ["warn", {
                    insertDisableComment: string;
                    commentTemplate: string;
                }];
            };
        };
    };
};

export { _default as default };
