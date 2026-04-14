const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const assets = path.join(dist, 'assets');

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .trim();
}

function minifyJs(js) {
  return js
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

cleanDir(dist);
fs.mkdirSync(assets, { recursive: true });

const source = fs.readFileSync(path.join(root, 'make-color.html'), 'utf8');
const styleMatch = source.match(/<style>([\s\S]*?)<\/style>/);
const scriptMatch = source.match(/<script>([\s\S]*?)<\/script>/);

if (!styleMatch || !scriptMatch) {
  throw new Error('Expected one inline <style> and one inline <script> block.');
}

const adsenseClientId = process.env.PUBLIC_ADSENSE_CLIENT_ID || '';
const css = minifyCss(styleMatch[1]);
const js = minifyJs(scriptMatch[1]).replaceAll('%%ADSENSE_CLIENT_ID%%', adsenseClientId);

fs.writeFileSync(path.join(assets, 'styles.css'), css);
fs.writeFileSync(path.join(assets, 'app.min.js'), js);

const html = source
  .replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="/assets/styles.css">')
  .replace(/<script>[\s\S]*?<\/script>/, '<script src="/assets/app.min.js" defer></script>')
  .replaceAll('%%ADSENSE_CLIENT_ID%%', adsenseClientId)
  .replace(/\n{2,}/g, '\n');

fs.writeFileSync(path.join(dist, 'index.html'), html);
fs.copyFileSync(path.join(root, 'README.md'), path.join(dist, 'README.md'));

console.log('Built production assets in dist/ without source maps.');
