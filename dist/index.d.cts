import * as eslint from 'eslint';

declare const plugin: {
    rules: {
        'fix-later': {
            meta: {
                fixable: "code";
                messages: {
                    remindToFix: string;
                };
                schema: {
                    type: "object";
                    properties: {
                        includeWarnings: {
                            type: "boolean";
                        };
                        insertDisableComment: {
                            enum: string[];
                        };
                        commentTemplate: {
                            type: "string";
                        };
                    };
                    additionalProperties: false;
                }[];
            };
            create: (context: eslint.Rule.RuleContext) => {};
        };
    };
};

export { plugin as default };
