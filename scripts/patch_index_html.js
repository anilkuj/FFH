import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const indexPath = path.join(__dirname, '..', 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

const target = '<span>League Analyzer</span>\r\n                </a>';
const addition = `\r\n                <a href="/league" class="nav-item" target="_blank" title="Gameweek by Gameweek League Standings">
                    <i data-lucide="trophy"></i>
                    <span>GW Standings</span>
                    <span style="font-size: 0.65rem; background: var(--accent); color: #000; padding: 2px 5px; border-radius: 4px; font-weight: bold; margin-left: auto;">59168</span>
                </a>`;

if (content.includes('<span>League Analyzer</span>') && !content.includes('/league')) {
  content = content.replace(/(<span>League Analyzer<\/span>[\r\n\s]*<\/a>)/, `$1${addition}`);
  fs.writeFileSync(indexPath, content);
  console.log('Updated index.html successfully!');
} else {
  console.log('Already updated or target not found');
}
