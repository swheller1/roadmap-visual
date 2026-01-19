const fs = require('fs');
const path = require('path');

// Patch powerbi-visuals-tools webpack config to fix ESM module resolution
const webpackConfigPath = path.join(
    __dirname,
    '../node_modules/powerbi-visuals-tools/lib/webpack.config.js'
);

if (fs.existsSync(webpackConfigPath)) {
    let content = fs.readFileSync(webpackConfigPath, 'utf8');

    // Fix process/browser ESM import issue
    if (content.includes('process: "process/browser"')) {
        content = content.replace(
            'process: "process/browser"',
            'process: "process/browser.js"'
        );
    }

    // Add fullySpecified: false rule for .mjs files if not present
    if (!content.includes('fullySpecified: false')) {
        content = content.replace(
            `{
                test: /\\.(woff|ttf|ico|woff2|jpg|jpeg|png|webp|gif|svg|eot)$/i,
                type: 'asset/inline'
            }
        ]`,
            `{
                test: /\\.(woff|ttf|ico|woff2|jpg|jpeg|png|webp|gif|svg|eot)$/i,
                type: 'asset/inline'
            },
            {
                test: /\\.m?js/,
                resolve: {
                    fullySpecified: false
                }
            }
        ]`
        );
    }

    fs.writeFileSync(webpackConfigPath, content, 'utf8');
    console.log('Patched powerbi-visuals-tools webpack config for ESM compatibility');
}
