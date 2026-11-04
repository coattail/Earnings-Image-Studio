// Checked-in production assets support hosts that publish the repository root.
// Source modules and Node rendering share one ordered runtime manifest.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const manifest = require('../js/runtime-files.json');
const digest = content => crypto.createHash('sha256').update(content).digest('hex');
const files = [...manifest.browserPrefix, ...manifest.shared, ...manifest.browserSuffix];
const inputs = Object.fromEntries(['js/runtime-files.json', 'package.json', 'scripts/build_frontend.cjs', ...files.map(f => `js/${f}`)]
  .map(f => [f, digest(fs.readFileSync(path.join(root, f)))]));
const source = files.map(f => `\n// ${f}\n${fs.readFileSync(path.join(root, 'js', f), 'utf8')}\n;`).join('\n');
// Keep the classic-script global boundary used by the direct renderer and UI;
// esbuild can safely shorten private function locals without changing it.
const result = esbuild.transformSync(source, {
  minify: true, target: 'es2020', charset: 'utf8', legalComments: 'none', sourcefile: 'earnings-runtime.js',
});
const bundle = `assets/earnings-app.${digest(result.code).slice(0, 16)}.js`;
const assets = path.join(root, 'assets');
fs.mkdirSync(assets, {recursive: true});
fs.writeFileSync(path.join(root, bundle), result.code);
fs.writeFileSync(path.join(assets, 'frontend-manifest.json'), JSON.stringify({bundle, sha256: digest(result.code), inputs}, null, 2) + '\n');
const index = path.join(root, 'index.html');
const html = fs.readFileSync(index, 'utf8');
const block = `<!-- app scripts:start -->\n    <script defer src="${bundle}"></script>\n    <!-- app scripts:end -->`;
const marker = /<!-- app scripts:start -->[\s\S]*?<!-- app scripts:end -->/;
if (!marker.test(html)) throw new Error('Missing frontend script markers in index.html');
fs.writeFileSync(index, html.replace(marker, block));
for (const name of fs.readdirSync(assets)) {
  if (/^earnings-app\.[a-f0-9]+\.js$/.test(name) && name !== path.basename(bundle)) fs.unlinkSync(path.join(assets, name));
}
console.log(`[frontend] ${files.length} source modules: ${Buffer.byteLength(source)} → ${Buffer.byteLength(result.code)} bytes (${bundle})`);
