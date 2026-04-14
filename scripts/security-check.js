const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = ['make-color.html', 'README.md', 'vercel.json', 'netlify.toml']
  .map(file => path.join(root, file))
  .filter(file => fs.existsSync(file));

const secretPatterns = [
  /github_pat_[A-Za-z0-9_]+/,
  /ghp_[A-Za-z0-9_]+/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /AIza[0-9A-Za-z_-]{20,}/,
];

let failed = false;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) {
      console.error(`Potential secret found in ${path.relative(root, file)}: ${pattern}`);
      failed = true;
    }
  }
}

if (fs.existsSync(path.join(root, '.env'))) {
  console.error('.env exists locally. Keep it untracked and verify it is not staged.');
  failed = true;
}

if (failed) process.exit(1);
console.log('Security check passed: no obvious secrets in tracked source files.');
