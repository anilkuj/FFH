import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.join(__dirname, '..', 'league_59168_data.json');
const leagueData = fs.readFileSync(jsonPath, 'utf8');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Robbinsville FPL Warriors · Gameweek Standings</title>
  <meta name="description" content="Scroll through all Gameweeks played so far in Robbinsville FPL Warriors (League 59168) ranked by Gameweek Points in descending order.">
  <meta property="og:title" content="Robbinsville FPL Warriors · Gameweek Standings">
  <meta property="og:description" content="View gameweek by gameweek scores, winners, captains, chips, and rankings for League 59168.">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏆</text></svg>">
  <style>
    :root {
      --bg-base: #0b0f19;
      --bg-surface: #111827;
      --bg-card: #182235;
      --bg-card-hover: #1e2c45;
      --bg-card-winner: linear-gradient(135deg, rgba(234, 179, 8, 0.12) 0%, rgba(24, 34, 53, 0.95) 100%);
      --border-color: #243046;
      --border-winner: #eab308;
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --text-dim: #6b7280;
      --accent: #00ff87;
      --accent-glow: rgba(0, 255, 135, 0.25);
      --purple: #7e22ce;
      --purple-dark: #38003c;
      --cyan: #06b6d4;
      --gold: #f59e0b;
      --gold-glow: rgba(245, 158, 11, 0.25);
      --silver: #94a3b8;
      --bronze: #d97706;
      --danger: #ef4444;
      --success: #10b981;
      --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.25);
      --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.35);
      --shadow-lg: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
      --radius-sm: 6px;
      --radius-md: 10px;
      --radius-lg: 16px;
      --radius-full: 9999px;
    }

    [data-theme="light"] {
      --bg-base: #f8fafc;
      --bg-surface: #ffffff;
      --bg-card: #ffffff;
      --bg-card-hover: #f1f5f9;
      --bg-card-winner: linear-gradient(135deg, rgba(254, 240, 138, 0.35) 0%, rgba(255, 255, 255, 0.95) 100%);
      --border-color: #e2e8f0;
      --border-winner: #eab308;
      --text-main: #0f172a;
      --text-muted: #475569;
      --text-dim: #94a3b8;
      --accent: #059669;
      --accent-glow: rgba(5, 150, 105, 0.2);
      --purple: #6b21a8;
      --purple-dark: #4c1d95;
      --cyan: #0891b2;
      --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--font-family);
      background-color: var(--bg-base);
      color: var(--text-main);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      padding-bottom: 80px;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    /* Top Navigation Header */
    .header-bar {
      background: linear-gradient(135deg, #2b0036 0%, #150020 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: var(--shadow-md);
      backdrop-filter: blur(12px);
    }

    .header-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .brand-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #00ff87 0%, #06b6d4 100%);
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      box-shadow: 0 0 15px rgba(0, 255, 135, 0.4);
    }

    .brand-text h1 {
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .brand-subtitle {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.7);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .badge-fpl {
      background: rgba(0, 255, 135, 0.2);
      color: #00ff87;
      border: 1px solid rgba(0, 255, 135, 0.4);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: var(--radius-md);
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .btn-primary {
      background: #00ff87;
      color: #0b0f19;
      box-shadow: 0 0 12px rgba(0, 255, 135, 0.3);
    }

    .btn-primary:hover {
      background: #22ffa0;
      transform: translateY(-1px);
    }

    .btn-glass {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
      border-color: rgba(255, 255, 255, 0.15);
    }

    .btn-glass:hover {
      background: rgba(255, 255, 255, 0.18);
    }

    .btn-icon {
      padding: 7px 10px;
    }

    /* Subheader & GW Navigator */
    .subnav-bar {
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 65px;
      z-index: 90;
      box-shadow: var(--shadow-sm);
    }

    .subnav-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 10px 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .subnav-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .view-tabs {
      display: flex;
      background: var(--bg-base);
      padding: 3px;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-color);
    }

    .view-tab {
      padding: 6px 14px;
      font-size: 0.82rem;
      font-weight: 600;
      border-radius: var(--radius-md);
      color: var(--text-muted);
      cursor: pointer;
      border: none;
      background: transparent;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .view-tab.active {
      background: var(--bg-card);
      color: var(--text-main);
      box-shadow: var(--shadow-sm);
    }

    .subnav-controls {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .filter-select, .search-input {
      background: var(--bg-base);
      color: var(--text-main);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 6px 12px;
      font-size: 0.82rem;
      outline: none;
      transition: border 0.15s;
    }

    .filter-select:focus, .search-input:focus {
      border-color: var(--cyan);
    }

    /* GW Pills Scroll Bar */
    .gw-scroll-container {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow-x: auto;
      padding: 4px 0 6px 0;
      scrollbar-width: thin;
      scrollbar-color: var(--border-color) transparent;
      -webkit-overflow-scrolling: touch;
    }

    .gw-scroll-container::-webkit-scrollbar {
      height: 4px;
    }

    .gw-scroll-container::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 4px;
    }

    .gw-pill {
      flex-shrink: 0;
      padding: 6px 14px;
      border-radius: var(--radius-full);
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }

    .gw-pill:hover {
      background: var(--bg-card-hover);
      color: var(--text-main);
      border-color: var(--cyan);
    }

    .gw-pill.active {
      background: linear-gradient(135deg, #00ff87 0%, #06b6d4 100%);
      color: #0b0f19;
      border-color: transparent;
      box-shadow: 0 0 10px rgba(0, 255, 135, 0.4);
    }

    .gw-pill .pill-sub {
      font-size: 0.7rem;
      opacity: 0.85;
      font-weight: 500;
    }

    /* Main Container */
    .main-container {
      max-width: 1200px;
      margin: 24px auto 0 auto;
      padding: 0 20px;
    }

    /* League KPI Summary Bar */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
      margin-bottom: 28px;
    }

    .kpi-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 16px 20px;
      box-shadow: var(--shadow-sm);
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .kpi-icon {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
    }

    .kpi-lead {
      background: rgba(234, 179, 8, 0.15);
      color: var(--gold);
    }

    .kpi-high {
      background: rgba(0, 255, 135, 0.15);
      color: #00ff87;
    }

    .kpi-avg {
      background: rgba(6, 182, 212, 0.15);
      color: var(--cyan);
    }

    .kpi-gws {
      background: rgba(126, 34, 206, 0.15);
      color: #c084fc;
    }

    .kpi-info .kpi-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      font-weight: 600;
    }

    .kpi-info .kpi-val {
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--text-main);
      line-height: 1.2;
    }

    .kpi-info .kpi-sub {
      font-size: 0.78rem;
      color: var(--text-dim);
    }

    /* Section Feed */
    .feed-section {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    /* Gameweek Card */
    .gw-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      overflow: hidden;
      scroll-margin-top: 150px;
      transition: transform 0.15s ease, border-color 0.15s ease;
    }

    .gw-card:hover {
      border-color: rgba(6, 182, 212, 0.4);
    }

    .gw-header {
      background: linear-gradient(90deg, rgba(30, 41, 59, 0.8) 0%, rgba(17, 24, 39, 0.95) 100%);
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .gw-title-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .gw-badge {
      background: linear-gradient(135deg, #7e22ce 0%, #38003c 100%);
      color: #ffffff;
      padding: 6px 14px;
      border-radius: var(--radius-md);
      font-weight: 800;
      font-size: 1.05rem;
      letter-spacing: -0.01em;
      box-shadow: 0 0 10px rgba(126, 34, 206, 0.3);
    }

    .gw-badge.latest {
      background: linear-gradient(135deg, #00ff87 0%, #06b6d4 100%);
      color: #0b0f19;
      box-shadow: 0 0 15px rgba(0, 255, 135, 0.4);
    }

    .gw-subtitle {
      font-size: 0.82rem;
      color: var(--text-muted);
    }

    .gw-stats-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .gw-stat-chip {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      padding: 4px 10px;
      border-radius: var(--radius-full);
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .gw-stat-chip strong {
      color: var(--text-main);
    }

    .gw-stat-chip.winner-chip {
      background: rgba(245, 158, 11, 0.15);
      border-color: rgba(245, 158, 11, 0.35);
      color: var(--gold);
    }

    .gw-stat-chip.winner-chip strong {
      color: var(--gold);
    }

    /* Managers List Table/Cards in GW */
    .managers-list {
      display: flex;
      flex-direction: column;
    }

    .manager-row {
      display: grid;
      grid-template-columns: 50px 1fr auto auto;
      align-items: center;
      padding: 14px 20px;
      border-bottom: 1px solid var(--border-color);
      gap: 16px;
      transition: background-color 0.12s ease;
    }

    .manager-row:last-child {
      border-bottom: none;
    }

    .manager-row:hover {
      background-color: var(--bg-card-hover);
    }

    .manager-row.is-winner {
      background: var(--bg-card-winner);
      border-left: 4px solid var(--border-winner);
    }

    .manager-row.is-highlighted {
      background: rgba(6, 182, 212, 0.12);
      border-left: 4px solid var(--cyan);
    }

    /* Rank Column */
    .rank-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .rank-number {
      font-size: 1.1rem;
      font-weight: 800;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-card);
      color: var(--text-muted);
      border: 1px solid var(--border-color);
    }

    .rank-1 {
      background: linear-gradient(135deg, #f59e0b 0%, #b45309 100%);
      color: #ffffff;
      border: none;
      box-shadow: 0 0 10px rgba(245, 158, 11, 0.4);
    }

    .rank-2 {
      background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
      color: #ffffff;
      border: none;
    }

    .rank-3 {
      background: linear-gradient(135deg, #d97706 0%, #92400e 100%);
      color: #ffffff;
      border: none;
    }

    /* Manager Identity Column */
    .manager-info-col {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
    }

    .manager-avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.9rem;
      color: var(--cyan);
      flex-shrink: 0;
      overflow: hidden;
    }

    .manager-avatar img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .manager-names {
      min-width: 0;
    }

    .manager-team {
      font-size: 0.98rem;
      font-weight: 700;
      color: var(--text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .manager-person {
      font-size: 0.82rem;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cumulative-rank-badge {
      font-size: 0.72rem;
      color: var(--text-dim);
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 2px;
    }

    .rank-up {
      color: var(--success);
      font-weight: 700;
    }

    .rank-down {
      color: var(--danger);
      font-weight: 700;
    }

    .rank-same {
      color: var(--text-dim);
    }

    /* Tactical Info Column (Captain, Chip, Hits) */
    .tactical-col {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .chip-badge {
      padding: 3px 8px;
      border-radius: var(--radius-sm);
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .chip-wildcard {
      background: rgba(147, 51, 234, 0.2);
      color: #c084fc;
      border: 1px solid rgba(147, 51, 234, 0.4);
    }

    .chip-freehit {
      background: rgba(6, 182, 212, 0.2);
      color: #22d3ee;
      border: 1px solid rgba(6, 182, 212, 0.4);
    }

    .chip-3xc {
      background: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.4);
    }

    .chip-bboost {
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }

    .captain-badge {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      padding: 4px 10px;
      border-radius: var(--radius-full);
      font-size: 0.78rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }

    .captain-badge .cap-c {
      width: 17px;
      height: 17px;
      background: #00ff87;
      color: #0b0f19;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 0.65rem;
    }

    .captain-badge .cap-tc {
      width: 19px;
      height: 17px;
      background: var(--gold);
      color: #0b0f19;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 0.65rem;
    }

    .captain-badge strong {
      color: var(--text-main);
    }

    .cap-points {
      color: var(--accent);
      font-weight: 700;
      margin-left: 2px;
    }

    .hit-badge {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.35);
      padding: 3px 8px;
      border-radius: var(--radius-sm);
      font-size: 0.72rem;
      font-weight: 700;
    }

    .bench-badge {
      font-size: 0.72rem;
      color: var(--text-dim);
      padding: 3px 6px;
    }

    /* Score Column */
    .score-col {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      min-width: 80px;
    }

    .score-main {
      font-size: 1.6rem;
      font-weight: 900;
      color: var(--text-main);
      letter-spacing: -0.02em;
      line-height: 1;
      display: flex;
      align-items: baseline;
      gap: 3px;
    }

    .score-pts {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    .score-net {
      font-size: 0.72rem;
      color: var(--text-dim);
      margin-top: 3px;
    }

    .score-winner {
      color: var(--gold);
      text-shadow: 0 0 12px rgba(245, 158, 11, 0.3);
    }

    /* Matrix View Table */
    .matrix-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 20px;
      overflow-x: auto;
      box-shadow: var(--shadow-md);
    }

    .matrix-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      text-align: center;
    }

    .matrix-table th, .matrix-table td {
      padding: 10px 12px;
      border: 1px solid var(--border-color);
      white-space: nowrap;
    }

    .matrix-table th {
      background: var(--bg-card);
      color: var(--text-muted);
      font-weight: 700;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }

    .matrix-table td.manager-cell {
      text-align: left;
      font-weight: 700;
      color: var(--text-main);
      background: var(--bg-surface);
      position: sticky;
      left: 0;
      z-index: 2;
    }

    .matrix-score {
      font-weight: 800;
      border-radius: 4px;
      padding: 4px 6px;
      display: inline-block;
      min-width: 36px;
    }

    .matrix-winner {
      background: rgba(245, 158, 11, 0.25);
      color: var(--gold);
      border: 1px solid rgba(245, 158, 11, 0.5);
    }

    .matrix-high {
      background: rgba(0, 255, 135, 0.15);
      color: #00ff87;
    }

    .matrix-mid {
      background: rgba(255, 255, 255, 0.04);
      color: var(--text-main);
    }

    .matrix-low {
      background: rgba(239, 68, 68, 0.12);
      color: #f87171;
    }

    /* Standings Table */
    .standings-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    .standings-table th, .standings-table td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }

    .standings-table th {
      background: var(--bg-card);
      color: var(--text-muted);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .standings-table tr:hover {
      background: var(--bg-card-hover);
    }

    .form-pills {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .form-pill {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      color: var(--text-muted);
    }

    /* Modals & Toasts */
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #111827;
      color: #00ff87;
      border: 1px solid #00ff87;
      padding: 12px 24px;
      border-radius: var(--radius-full);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
      font-weight: 600;
      font-size: 0.9rem;
      z-index: 1000;
      transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .toast.show {
      transform: translateX(-50%) translateY(0);
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 200;
      padding: 20px;
    }

    .modal-overlay.active {
      display: flex;
    }

    .modal-box {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 24px;
      max-width: 480px;
      width: 100%;
      box-shadow: var(--shadow-lg);
    }

    .modal-title {
      font-size: 1.25rem;
      font-weight: 800;
      margin-bottom: 12px;
      color: var(--text-main);
    }

    /* Responsive */
    @media (max-width: 768px) {
      .header-container {
        padding: 10px 14px;
      }
      .brand-text h1 {
        font-size: 1.05rem;
      }
      .manager-row {
        grid-template-columns: 36px 1fr auto;
        gap: 10px;
        padding: 12px 14px;
      }
      .tactical-col {
        grid-column: 2 / 4;
        justify-content: flex-start;
        margin-top: 4px;
      }
      .score-col {
        grid-column: 3;
        grid-row: 1;
      }
      .kpi-grid {
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .subnav-container {
        padding: 8px 14px;
      }
    }
  </style>
</head>
<body>

  <!-- Top Navigation Header -->
  <header class="header-bar">
    <div class="header-container">
      <div class="brand-section">
        <div class="brand-icon">🏆</div>
        <div class="brand-text">
          <h1 id="leagueNameDisplay">Robbinsville FPL Warriors</h1>
          <div class="brand-subtitle">
            <span class="badge-pill badge-fpl">FPL Classic League</span>
            <span id="leagueIdDisplay">#59168</span>
            <span>·</span>
            <span id="headerGwCount">10 Gameweeks Played</span>
          </div>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" id="btnShare" title="Share this league page">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
          <span>Share</span>
        </button>
        <button class="btn btn-glass btn-icon" id="btnLeaguePicker" title="Change League ID">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </button>
        <button class="btn btn-glass btn-icon" id="btnThemeToggle" title="Toggle Theme">
          <span id="themeIcon">☀️</span>
        </button>
      </div>
    </div>
  </header>

  <!-- Sticky Subnav Bar with Tabs & Gameweek Pills -->
  <nav class="subnav-bar">
    <div class="subnav-container">
      <div class="subnav-top">
        <div class="view-tabs">
          <button class="view-tab active" data-view="feed">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            <span>Gameweek Feed</span>
          </button>
          <button class="view-tab" data-view="single">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18M15 3v18"/></svg>
            <span>Single GW</span>
          </button>
          <button class="view-tab" data-view="matrix">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
            <span>Points Matrix</span>
          </button>
          <button class="view-tab" data-view="standings">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <span>Standings</span>
          </button>
        </div>

        <div class="subnav-controls">
          <select id="managerFilter" class="filter-select">
            <option value="">All Managers (8)</option>
          </select>
          <button class="btn btn-glass" id="btnRefreshLive" title="Refresh Live Data">
            <svg id="refreshSvg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <!-- Quick Jump Gameweek Pills -->
      <div class="gw-scroll-container" id="gwPillsContainer">
        <!-- Rendered dynamically -->
      </div>
    </div>
  </nav>

  <!-- Main Content Area -->
  <main class="main-container">

    <!-- KPI Summary Grid -->
    <div class="kpi-grid" id="kpiGrid">
      <div class="kpi-card">
        <div class="kpi-icon kpi-lead">👑</div>
        <div class="kpi-info">
          <div class="kpi-label">Current Leader</div>
          <div class="kpi-val" id="kpiLeaderName">-</div>
          <div class="kpi-sub" id="kpiLeaderPts">-</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon kpi-high">🚀</div>
        <div class="kpi-info">
          <div class="kpi-label">Highest GW Score</div>
          <div class="kpi-val" id="kpiHighScore">-</div>
          <div class="kpi-sub" id="kpiHighManager">-</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon kpi-avg">📊</div>
        <div class="kpi-info">
          <div class="kpi-label">League Average</div>
          <div class="kpi-val" id="kpiAvgScore">-</div>
          <div class="kpi-sub">Across all 10 Gameweeks</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon kpi-gws">⚽</div>
        <div class="kpi-info">
          <div class="kpi-label">Total Points Scored</div>
          <div class="kpi-val" id="kpiTotalLeaguePts">-</div>
          <div class="kpi-sub">8 Managers competing</div>
        </div>
      </div>
    </div>

    <!-- View Container: Gameweek Feed (Default) -->
    <div id="viewFeed" class="feed-section">
      <!-- Gameweek Cards rendered here descending -->
    </div>

    <!-- View Container: Single GW View -->
    <div id="viewSingle" style="display: none;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
        <button class="btn btn-glass" id="btnPrevGw">‹ Previous GW</button>
        <h2 id="singleGwHeading" style="font-size: 1.3rem; font-weight: 800;">Gameweek 10</h2>
        <button class="btn btn-glass" id="btnNextGw">Next GW ›</button>
      </div>
      <div id="singleGwCardContainer"></div>
    </div>

    <!-- View Container: Points Matrix / Heatmap -->
    <div id="viewMatrix" style="display: none;">
      <div class="matrix-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 1.15rem; font-weight: 800;">Season Points Heatmap</h2>
            <p style="font-size: 0.82rem; color: var(--text-muted);">Points scored in every Gameweek (Latest GW10 on left). Gold badges indicate Gameweek winner.</p>
          </div>
        </div>
        <table class="matrix-table" id="matrixTable">
          <!-- Dynamically populated -->
        </table>
      </div>
    </div>

    <!-- View Container: Standings -->
    <div id="viewStandings" style="display: none;">
      <div class="matrix-card">
        <h2 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 16px;">Current Overall Standings</h2>
        <table class="standings-table" id="standingsTable">
          <thead>
            <tr>
              <th style="width: 50px;">Rank</th>
              <th>Manager / Team</th>
              <th>Total Points</th>
              <th>GW10 Points</th>
              <th>Gap to Leader</th>
            </tr>
          </thead>
          <tbody>
            <!-- Dynamically populated -->
          </tbody>
        </table>
      </div>
    </div>

  </main>

  <!-- Toast Notification -->
  <div class="toast" id="toast">
    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
    <span id="toastMsg">Link copied to clipboard!</span>
  </div>

  <!-- Change League Modal -->
  <div class="modal-overlay" id="leagueModal">
    <div class="modal-box">
      <h3 class="modal-title">Load FPL Mini-League</h3>
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px;">
        Enter any FPL Classic League ID or paste the full league URL from fantasy.premierleague.com.
      </p>
      <input type="text" id="leagueInput" class="search-input" style="width: 100%; margin-bottom: 16px; padding: 10px 14px; font-size: 0.95rem;" placeholder="e.g. 59168 or paste league URL" value="59168">
      <div style="display: flex; justify-content: flex-end; gap: 10px;">
        <button class="btn btn-glass" id="btnCancelModal">Cancel</button>
        <button class="btn btn-primary" id="btnSubmitLeague">Load League</button>
      </div>
    </div>
  </div>

  <script>
    // Embedded Pre-calculated Data for Robbinsville FPL Warriors (League 59168)
    const EMBEDDED_DATA = ${leagueData};

    let activeData = EMBEDDED_DATA;
    let selectedManager = '';
    let currentSingleGw = EMBEDDED_DATA.currentGameweek || 10;
    let activeView = 'feed';

    // Initialize application
    function init() {
      // Check for URL query param ?league=...
      const urlParams = new URLSearchParams(window.location.search);
      const leagueParam = urlParams.get('league');

      if (leagueParam && leagueParam !== String(EMBEDDED_DATA.league.id)) {
        loadRemoteLeague(leagueParam);
      } else {
        renderAll(activeData);
      }

      setupEventListeners();
      setupScrollSpy();
    }

    // Render entire UI from data object
    function renderAll(data) {
      activeData = data;
      document.title = \`\${data.league.name} · Gameweek Standings\`;
      document.getElementById('leagueNameDisplay').textContent = data.league.name;
      document.getElementById('leagueIdDisplay').textContent = \`#\${data.league.id}\`;
      document.getElementById('headerGwCount').textContent = \`\${data.gameweeks.length} Gameweeks Played\`;

      // Render KPIs
      renderKpis(data);

      // Render Manager Filter Dropdown
      renderManagerFilter(data);

      // Render Quick Jump Pills
      renderGwPills(data);

      // Render Views
      renderFeed(data);
      renderSingleGw(data, currentSingleGw);
      renderMatrix(data);
      renderStandings(data);
    }

    // Render KPIs
    function renderKpis(data) {
      const leader = data.overallStandings && data.overallStandings[0];
      if (leader) {
        document.getElementById('kpiLeaderName').textContent = leader.playerName;
        document.getElementById('kpiLeaderPts').textContent = \`\${leader.total} pts (\${leader.teamName})\`;
      }

      let highestScore = 0;
      let highestManager = '';
      let totalPts = 0;
      let count = 0;

      data.gameweeks.forEach(gw => {
        gw.managers.forEach(m => {
          totalPts += m.stats.grossPoints;
          count++;
          if (m.stats.grossPoints > highestScore) {
            highestScore = m.stats.grossPoints;
            highestManager = \`\${m.playerName} (GW\${gw.gw})\`;
          }
        });
      });

      document.getElementById('kpiHighScore').textContent = \`\${highestScore} pts\`;
      document.getElementById('kpiHighManager').textContent = highestManager;
      document.getElementById('kpiAvgScore').textContent = count ? \`\${(totalPts / count).toFixed(1)} pts\` : '-';
      document.getElementById('kpiTotalLeaguePts').textContent = totalPts.toLocaleString();
    }

    // Render Manager Filter Dropdown
    function renderManagerFilter(data) {
      const select = document.getElementById('managerFilter');
      const managers = data.overallStandings || [];
      select.innerHTML = \`<option value="">All Managers (\${managers.length})</option>\`;
      managers.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.playerName;
        opt.textContent = \`\${m.playerName} (\${m.teamName})\`;
        if (selectedManager === m.playerName) opt.selected = true;
        select.appendChild(opt);
      });
    }

    // Render Gameweek Pills
    function renderGwPills(data) {
      const container = document.getElementById('gwPillsContainer');
      container.innerHTML = '';

      data.gameweeks.forEach((gw, idx) => {
        const pill = document.createElement('button');
        pill.className = \`gw-pill \${idx === 0 ? 'active' : ''}\`;
        pill.dataset.gw = gw.gw;
        pill.innerHTML = \`
          <span>GW\${gw.gw}</span>
          <span class="pill-sub">👑 \${gw.highScore}</span>
        \`;
        pill.addEventListener('click', () => {
          if (activeView === 'single') {
            currentSingleGw = gw.gw;
            renderSingleGw(activeData, currentSingleGw);
          } else {
            switchView('feed');
            const target = document.getElementById(\`gw-section-\${gw.gw}\`);
            if (target) {
              target.scrollIntoView({ behavior: 'smooth' });
            }
          }
          document.querySelectorAll('.gw-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
        });
        container.appendChild(pill);
      });
    }

    // Render Gameweek Feed (Latest First)
    function renderFeed(data) {
      const feed = document.getElementById('viewFeed');
      feed.innerHTML = '';

      data.gameweeks.forEach((gw, idx) => {
        const isLatest = idx === 0;
        const card = document.createElement('div');
        card.className = 'gw-card';
        card.id = \`gw-section-\${gw.gw}\`;

        // Format Deadline date if available
        let dateStr = '';
        if (gw.deadline) {
          try {
            const d = new Date(gw.deadline);
            dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          } catch(e) {}
        }

        // Card Header
        card.innerHTML = \`
          <div class="gw-header">
            <div class="gw-title-group">
              <span class="gw-badge \${isLatest ? 'latest' : ''}">GW\${gw.gw}</span>
              <div>
                <h2 style="font-size: 1.15rem; font-weight: 800;">\${gw.name} \${isLatest ? '· Latest' : ''}</h2>
                <div class="gw-subtitle">\${dateStr ? dateStr + ' · ' : ''}Points ranked high to low</div>
              </div>
            </div>
            <div class="gw-stats-bar">
              <div class="gw-stat-chip winner-chip">
                <span>👑 Winner:</span>
                <strong>\${gw.winner?.playerName || 'N/A'} (\${gw.highScore} pts)</strong>
              </div>
              <div class="gw-stat-chip">
                <span>Avg:</span>
                <strong>\${gw.averageScore} pts</strong>
              </div>
              <div class="gw-stat-chip">
                <span>Low:</span>
                <strong>\${gw.lowScore} pts</strong>
              </div>
            </div>
          </div>
          <div class="managers-list" id="managers-gw-\${gw.gw}">
            <!-- Rows rendered below -->
          </div>
        \`;

        const managersList = card.querySelector(\`#managers-gw-\${gw.gw}\`);

        // Sort managers for this gameweek strictly by GW points descending
        const sortedManagers = [...gw.managers].sort((a, b) => b.stats.grossPoints - a.stats.grossPoints || b.stats.netPoints - a.stats.netPoints);

        sortedManagers.forEach((m, mIdx) => {
          const isWinner = m.stats.grossPoints === gw.highScore;
          const isHighlight = selectedManager && m.playerName.toLowerCase() === selectedManager.toLowerCase();
          const row = createManagerRow(m, mIdx + 1, isWinner, isHighlight);
          managersList.appendChild(row);
        });

        feed.appendChild(card);
      });
    }

    // Helper: Create single manager row
    function createManagerRow(m, rankNumber, isWinner, isHighlight) {
      const row = document.createElement('div');
      row.className = \`manager-row \${isWinner ? 'is-winner' : ''} \${isHighlight ? 'is-highlighted' : ''}\`;

      // Rank Badge
      let rankClass = 'rank-number';
      if (rankNumber === 1) rankClass += ' rank-1';
      else if (rankNumber === 2) rankClass += ' rank-2';
      else if (rankNumber === 3) rankClass += ' rank-3';

      // Rank change indicator
      let rankChangeHtml = '';
      if (m.rankChange > 0) {
        rankChangeHtml = \`<span class="rank-up">▲ \${m.rankChange}</span>\`;
      } else if (m.rankChange < 0) {
        rankChangeHtml = \`<span class="rank-down">▼ \${Math.abs(m.rankChange)}</span>\`;
      } else if (m.rankChange === 0) {
        rankChangeHtml = \`<span class="rank-same">━ 0</span>\`;
      }

      // Tactical pills (Chips, Captain, Hits, Bench)
      let tacticalHtml = '';

      // Active Chip
      if (m.stats.chip) {
        const chip = m.stats.chip.toLowerCase();
        let chipName = chip;
        let chipClass = 'chip-badge';
        if (chip === 'wildcard') { chipName = '🃏 Wildcard'; chipClass += ' chip-wildcard'; }
        else if (chip === 'freehit') { chipName = '🚀 Free Hit'; chipClass += ' chip-freehit'; }
        else if (chip === '3xc') { chipName = '⚡ Triple Captain'; chipClass += ' chip-3xc'; }
        else if (chip === 'bboost') { chipName = '🛡️ Bench Boost'; chipClass += ' chip-bboost'; }
        tacticalHtml += \`<span class="\${chipClass}">\${chipName}</span>\`;
      }

      // Captain
      if (m.stats.captain) {
        const c = m.stats.captain;
        const icon = c.isTriple ? '<span class="cap-tc">TC</span>' : '<span class="cap-c">C</span>';
        tacticalHtml += \`
          <span class="captain-badge">
            \${icon}
            <strong>\${c.name}</strong>
            <span class="cap-points">(\${c.totalPoints} pts)</span>
          </span>
        \`;
      }

      // Transfer Hits
      if (m.stats.transferCost > 0) {
        tacticalHtml += \`<span class="hit-badge">-\${m.stats.transferCost} pts hit</span>\`;
      } else if (m.stats.transfersMade > 0) {
        tacticalHtml += \`<span style="font-size:0.75rem; color:var(--text-dim);">\${m.stats.transfersMade} FT</span>\`;
      }

      // Bench points
      if (m.stats.benchPoints > 0) {
        tacticalHtml += \`<span class="bench-badge">🪑 \${m.stats.benchPoints}b</span>\`;
      }

      // Score breakdown if hit taken
      let scoreNetHtml = '';
      if (m.stats.transferCost > 0) {
        scoreNetHtml = \`<div class="score-net">\${m.stats.grossPoints} - \${m.stats.transferCost} = \${m.stats.netPoints} net</div>\`;
      }

      // Avatar
      const initials = m.playerName.split(' ').map(n => n[0]).join('').substring(0, 2);
      const avatarHtml = m.badge
        ? \`<img src="\${m.badge}" alt="\${m.playerName}" loading="lazy">\`
        : initials;

      row.innerHTML = \`
        <div class="rank-col">
          <div class="\${rankClass}">\${rankNumber}</div>
        </div>
        <div class="manager-info-col">
          <div class="manager-avatar">\${avatarHtml}</div>
          <div class="manager-names">
            <div class="manager-team">\${m.teamName} \${isWinner ? '👑' : ''}</div>
            <div class="manager-person">\${m.playerName}</div>
            <div class="cumulative-rank-badge">
              <span>Overall: #\${m.cumulativeLeagueRank || '-'} (\${m.cumulativeTotalPoints || 0} pts)</span>
              <span>·</span>
              \${rankChangeHtml}
            </div>
          </div>
        </div>
        <div class="tactical-col">
          \${tacticalHtml}
        </div>
        <div class="score-col">
          <div class="score-main \${isWinner ? 'score-winner' : ''}">
            \${m.stats.grossPoints}
            <span class="score-pts">pts</span>
          </div>
          \${scoreNetHtml}
        </div>
      \`;

      return row;
    }

    // Render Single GW View
    function renderSingleGw(data, gwNum) {
      const container = document.getElementById('singleGwCardContainer');
      const gw = data.gameweeks.find(g => g.gw === gwNum) || data.gameweeks[0];
      if (!gw) return;

      currentSingleGw = gw.gw;
      document.getElementById('singleGwHeading').textContent = \`\${gw.name} Standings\`;

      container.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'gw-card';

      card.innerHTML = \`
        <div class="gw-header">
          <div class="gw-title-group">
            <span class="gw-badge latest">GW\${gw.gw}</span>
            <div>
              <h2 style="font-size: 1.2rem; font-weight: 800;">\${gw.name}</h2>
              <div class="gw-subtitle">Ranked by Points (High to Low)</div>
            </div>
          </div>
          <div class="gw-stats-bar">
            <div class="gw-stat-chip winner-chip">
              <span>👑 Winner:</span>
              <strong>\${gw.winner?.playerName || 'N/A'} (\${gw.highScore} pts)</strong>
            </div>
            <div class="gw-stat-chip">
              <span>Avg:</span>
              <strong>\${gw.averageScore} pts</strong>
            </div>
          </div>
        </div>
        <div class="managers-list"></div>
      \`;

      const list = card.querySelector('.managers-list');
      const sorted = [...gw.managers].sort((a, b) => b.stats.grossPoints - a.stats.grossPoints || b.stats.netPoints - a.stats.netPoints);
      sorted.forEach((m, idx) => {
        const isWinner = m.stats.grossPoints === gw.highScore;
        const isHighlight = selectedManager && m.playerName.toLowerCase() === selectedManager.toLowerCase();
        list.appendChild(createManagerRow(m, idx + 1, isWinner, isHighlight));
      });

      container.appendChild(card);
    }

    // Render Points Matrix / Heatmap Table
    function renderMatrix(data) {
      const table = document.getElementById('matrixTable');
      table.innerHTML = '';

      // Table Header: Manager | GW10 | GW9 | ... | GW1 | Total | Avg
      const thead = document.createElement('thead');
      let ths = '<th class="manager-cell">Manager</th>';
      data.gameweeks.forEach(gw => {
        ths += \`<th>GW\${gw.gw}</th>\`;
      });
      ths += '<th>Total</th><th>Avg</th>';
      thead.innerHTML = \`<tr>\${ths}</tr>\`;
      table.appendChild(thead);

      // Table Body
      const tbody = document.createElement('tbody');
      const managers = data.overallStandings || [];

      managers.forEach(mgr => {
        let tds = \`<td class="manager-cell">
          <div style="font-weight:700;">\${mgr.teamName}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">\${mgr.playerName}</div>
        </td>\`;

        let sum = 0;
        let count = 0;

        data.gameweeks.forEach(gw => {
          const mGw = gw.managers.find(m => m.entry === mgr.entry);
          const pts = mGw ? mGw.stats.grossPoints : 0;
          sum += pts;
          count++;

          const isWinner = pts === gw.highScore;
          let scoreClass = 'matrix-score';
          if (isWinner) scoreClass += ' matrix-winner';
          else if (pts >= 75) scoreClass += ' matrix-high';
          else if (pts <= 45) scoreClass += ' matrix-low';
          else scoreClass += ' matrix-mid';

          tds += \`<td><span class="\${scoreClass}">\${pts}\${isWinner ? ' 👑' : ''}</span></td>\`;
        });

        const avg = count ? (sum / count).toFixed(1) : 0;
        tds += \`<td style="font-weight:900; color:var(--text-main);">\${mgr.total}</td>\`;
        tds += \`<td style="font-weight:700; color:var(--cyan);">\${avg}</td>\`;

        const tr = document.createElement('tr');
        tr.innerHTML = tds;
        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
    }

    // Render Standings Table
    function renderStandings(data) {
      const tbody = document.querySelector('#standingsTable tbody');
      tbody.innerHTML = '';

      const managers = data.overallStandings || [];
      const leaderTotal = managers[0]?.total || 0;

      managers.forEach((m, idx) => {
        const gap = idx === 0 ? 'Leader' : \`-\${leaderTotal - m.total} pts\`;
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>
            <div class="rank-number \${idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : ''}">\${idx + 1}</div>
          </td>
          <td>
            <div style="font-weight:700; font-size:0.95rem;">\${m.teamName}</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">\${m.playerName}</div>
          </td>
          <td style="font-size:1.1rem; font-weight:800; color:var(--text-main);">\${m.total} pts</td>
          <td style="font-weight:700; color:var(--cyan);">\${m.eventTotal} pts</td>
          <td style="font-size:0.85rem; font-weight:600; color:\${idx === 0 ? 'var(--gold)' : 'var(--text-muted)'};">\${gap}</td>
        \`;
        tbody.appendChild(tr);
      });
    }

    // Switch View Tabs
    function switchView(viewName) {
      activeView = viewName;
      document.querySelectorAll('.view-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.view === viewName);
      });

      document.getElementById('viewFeed').style.display = viewName === 'feed' ? 'flex' : 'none';
      document.getElementById('viewSingle').style.display = viewName === 'single' ? 'block' : 'none';
      document.getElementById('viewMatrix').style.display = viewName === 'matrix' ? 'block' : 'none';
      document.getElementById('viewStandings').style.display = viewName === 'standings' ? 'block' : 'none';

      if (viewName === 'single') {
        renderSingleGw(activeData, currentSingleGw);
      }
    }

    // Toast message helper
    function showToast(msg) {
      const toast = document.getElementById('toast');
      document.getElementById('toastMsg').textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // Scrollspy: update active pill while scrolling feed
    function setupScrollSpy() {
      let ticking = false;
      window.addEventListener('scroll', () => {
        if (!ticking && activeView === 'feed') {
          window.requestAnimationFrame(() => {
            const cards = document.querySelectorAll('.gw-card');
            let current = '';
            cards.forEach(c => {
              const rect = c.getBoundingClientRect();
              if (rect.top <= 250 && rect.bottom >= 200) {
                current = c.id.replace('gw-section-', '');
              }
            });
            if (current) {
              document.querySelectorAll('.gw-pill').forEach(p => {
                p.classList.toggle('active', p.dataset.gw === current);
              });
            }
            ticking = false;
          });
          ticking = true;
        }
      });
    }

    // Event Listeners setup
    function setupEventListeners() {
      // View tabs click
      document.querySelectorAll('.view-tab').forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
      });

      // Manager filter change
      document.getElementById('managerFilter').addEventListener('change', (e) => {
        selectedManager = e.target.value;
        renderFeed(activeData);
        if (activeView === 'single') renderSingleGw(activeData, currentSingleGw);
      });

      // Share button click
      document.getElementById('btnShare').addEventListener('click', async () => {
        const shareUrl = window.location.href.split('#')[0];
        if (navigator.share) {
          try {
            await navigator.share({
              title: activeData.league.name + ' · Gameweek Standings',
              text: 'Check out the gameweek standings for ' + activeData.league.name + ' on FPL Hub!',
              url: shareUrl
            });
            return;
          } catch(e) {}
        }
        navigator.clipboard.writeText(shareUrl).then(() => {
          showToast('Link copied to clipboard!');
        }).catch(() => {
          prompt('Copy link below:', shareUrl);
        });
      });

      // Single view prev/next buttons
      document.getElementById('btnPrevGw').addEventListener('click', () => {
        const gws = activeData.gameweeks.map(g => g.gw);
        const idx = gws.indexOf(currentSingleGw);
        if (idx < gws.length - 1) {
          renderSingleGw(activeData, gws[idx + 1]);
        }
      });

      document.getElementById('btnNextGw').addEventListener('click', () => {
        const gws = activeData.gameweeks.map(g => g.gw);
        const idx = gws.indexOf(currentSingleGw);
        if (idx > 0) {
          renderSingleGw(activeData, gws[idx - 1]);
        }
      });

      // Theme toggle
      const btnTheme = document.getElementById('btnThemeToggle');
      const themeIcon = document.getElementById('themeIcon');
      btnTheme.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
        themeIcon.textContent = isDark ? '🌙' : '☀️';
      });

      // League Picker Modal
      const modal = document.getElementById('leagueModal');
      document.getElementById('btnLeaguePicker').addEventListener('click', () => {
        modal.classList.add('active');
      });
      document.getElementById('btnCancelModal').addEventListener('click', () => {
        modal.classList.remove('active');
      });
      document.getElementById('btnSubmitLeague').addEventListener('click', () => {
        let input = document.getElementById('leagueInput').value.trim();
        const match = input.match(/leagues\\/(\\d+)/);
        if (match) input = match[1];
        if (input) {
          modal.classList.remove('active');
          loadRemoteLeague(input);
        }
      });

      // Live Refresh Button
      document.getElementById('btnRefreshLive').addEventListener('click', () => {
        const svg = document.getElementById('refreshSvg');
        svg.style.animation = 'spin 1s linear infinite';
        loadRemoteLeague(activeData.league.id).finally(() => {
          svg.style.animation = '';
        });
      });
    }

    // Dynamic Remote League Fetcher
    async function loadRemoteLeague(leagueId) {
      showToast(\`Fetching League #\${leagueId}...\`);
      
      try {
        // Try local backend proxy first
        const localRes = await fetch(\`/api/fpl-league-full?leagueId=\${leagueId}\`).catch(() => null);
        if (localRes && localRes.ok) {
          const json = await localRes.json();
          if (json.success && json.data) {
            renderAll(json.data);
            showToast(\`Loaded \${json.data.league.name}!\`);
            return;
          }
        }

        // If local API proxy not available or on static hosting, use direct / CORS proxies
        const corsBase = 'https://api.allorigins.win/raw?url=';
        const standingsUrl = \`https://fantasy.premierleague.com/api/leagues-classic/\${leagueId}/standings/\`;
        
        let res = await fetch(standingsUrl).catch(() => null);
        if (!res || !res.ok) {
          res = await fetch(corsBase + encodeURIComponent(standingsUrl));
        }
        
        if (!res.ok) throw new Error('Could not reach FPL API for this league.');
        const standingsJson = await res.json();
        
        // If this is league 59168, reuse embedded data
        if (String(leagueId) === String(EMBEDDED_DATA.league.id)) {
          renderAll(EMBEDDED_DATA);
          showToast('Updated with latest league data!');
          return;
        }

        showToast(\`Found \${standingsJson.league.name}. Generating gameweek breakdown...\`);
        // Basic fallback viewer if dynamic multi-fetch CORS blocks
        renderBasicStandings(standingsJson);
      } catch(err) {
        console.error('Remote fetch error:', err);
        showToast(\`Error loading league: \${err.message}\`);
      }
    }

    // Initialize on DOM load
    document.addEventListener('DOMContentLoaded', init);
  </script>
</body>
</html>
`;

// Write to league.html (root) and dist/league.html (if dist exists)
fs.writeFileSync(path.join(__dirname, '..', 'league.html'), htmlContent);
console.log('Created league.html successfully!');

const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  fs.writeFileSync(path.join(distDir, 'league.html'), htmlContent);
  console.log('Copied to dist/league.html!');
}
