import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.join(__dirname, '..', 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

const target = '// Static File Serving';
const addition = `// API Route: Fetch full processed gameweek breakdown for a league
    if (pathname === '/api/fpl-league-full') {
        const leagueId = reqUrl.searchParams.get('leagueId') || '59168';
        const file = path.join(__dirname, 'league_' + leagueId + '_data.json');
        if (fs.existsSync(file)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: JSON.parse(fs.readFileSync(file, 'utf8')) }));
            return;
        }
    }

    // Direct route for FPL league standings page
    if (pathname === '/league' || pathname === '/league.html') {
        const leagueDist = path.join(DIST_DIR, 'league.html');
        const leagueRoot = path.join(__dirname, 'league.html');
        const fileToServe = fs.existsSync(leagueDist) ? leagueDist : (fs.existsSync(leagueRoot) ? leagueRoot : null);
        if (fileToServe) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(fs.readFileSync(fileToServe));
            return;
        }
    }

    `;

if (content.includes(target) && !content.includes('/api/fpl-league-full')) {
  content = content.replace(target, addition + target);
  fs.writeFileSync(serverPath, content);
  console.log('Successfully updated server.js!');
} else {
  console.log('Already updated or target not found');
}
