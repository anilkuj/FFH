import { PLAYERS, TEAMS } from '../data.js';
import { getShirtSVG } from './planner.js';

let comparisonChartInstance = null; // Store chart instance globally for this component to destroy/re-render cleanly

export function renderCompare(container, state, actions) {
    // Default selected players if not set yet
    let p1Id = parseInt(container.dataset.player1Id) || 302; // Cole Palmer
    let p2Id = parseInt(container.dataset.player2Id) || 401; // Haaland

    let player1 = PLAYERS.find(p => p.id === p1Id);
    let player2 = PLAYERS.find(p => p.id === p2Id);

    const renderDetails = () => {
        if (!player1 || !player2) return;

        const t1 = TEAMS.find(t => t.shortName === player1.team) || { color: "#ffffff" };
        const t2 = TEAMS.find(t => t.shortName === player2.team) || { color: "#ffffff" };

        const pred1 = (player1.predictions.find(pr => pr.gw === state.currentGw) || { pts: 0 }).pts;
        const pred2 = (player2.predictions.find(pr => pr.gw === state.currentGw) || { pts: 0 }).pts;

        const detailsBox = container.querySelector('#compareDetailsGrid');
        if (!detailsBox) return;

        detailsBox.innerHTML = `
            <!-- Left Cards: Player Info Profiles -->
            <div class="compare-cards-column">
                <div class="compare-player-profile-card compare-card-accent-p1">
                    <div class="profile-card-header">
                        <div class="profile-avatar-shirt">
                            ${getShirtSVG(t1.color, player1.team)}
                        </div>
                        <div class="profile-title-info">
                            <h3>${player1.name}</h3>
                            <p>${player1.position} • ${player1.team}</p>
                        </div>
                    </div>
                    <div class="profile-stats-grid">
                        <div class="profile-stat-box">
                            <span class="profile-stat-val">£${player1.price.toFixed(1)}m</span>
                            <span class="profile-stat-lbl">Price</span>
                        </div>
                        <div class="profile-stat-box">
                            <span class="profile-stat-val">${player1.ownership.toFixed(1)}%</span>
                            <span class="profile-stat-lbl">Ownership</span>
                        </div>
                        <div class="profile-stat-box">
                            <span class="profile-stat-val">${player1.points}</span>
                            <span class="profile-stat-lbl">Total Points</span>
                        </div>
                    </div>
                </div>

                <div class="compare-player-profile-card compare-card-accent-p2">
                    <div class="profile-card-header">
                        <div class="profile-avatar-shirt">
                            ${getShirtSVG(t2.color, player2.team)}
                        </div>
                        <div class="profile-title-info">
                            <h3>${player2.name}</h3>
                            <p>${player2.position} • ${player2.team}</p>
                        </div>
                    </div>
                    <div class="profile-stats-grid">
                        <div class="profile-stat-box">
                            <span class="profile-stat-val">£${player2.price.toFixed(1)}m</span>
                            <span class="profile-stat-lbl">Price</span>
                        </div>
                        <div class="profile-stat-box">
                            <span class="profile-stat-val">${player2.ownership.toFixed(1)}%</span>
                            <span class="profile-stat-lbl">Ownership</span>
                        </div>
                        <div class="profile-stat-box">
                            <span class="profile-stat-val">${player2.points}</span>
                            <span class="profile-stat-lbl">Total Points</span>
                        </div>
                    </div>
                </div>

                <!-- Stats Compare Table -->
                <div class="stats-table-wrapper" style="margin-top: 8px;">
                    <table class="stats-table" style="font-size:12px;">
                        <thead>
                            <tr>
                                <th>Metric</th>
                                <th style="color:var(--primary); font-weight:700;">${actions.getWebName(player1.name)}</th>
                                <th style="color:var(--secondary); font-weight:700;">${actions.getWebName(player2.name)}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Expected Points (GW${state.currentGw})</td>
                                <td>${pred1.toFixed(1)}</td>
                                <td>${pred2.toFixed(1)}</td>
                            </tr>
                            <tr>
                                <td>10-GW Expected Points (10-GW XP)</td>
                                <td>${player1.xp10.toFixed(1)}</td>
                                <td>${player2.xp10.toFixed(1)}</td>
                            </tr>
                            <tr>
                                <td>Expected Goals (xG)</td>
                                <td>${player1.xG.toFixed(2)}</td>
                                <td>${player2.xG.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td>xG per 90 (xG90)</td>
                                <td>${player1.xG90.toFixed(2)}</td>
                                <td>${player2.xG90.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td>Expected Assists (xA)</td>
                                <td>${player1.xA.toFixed(2)}</td>
                                <td>${player2.xA.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td>xA per 90 (xA90)</td>
                                <td>${player1.xA90.toFixed(2)}</td>
                                <td>${player2.xA90.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td>xG Involvement (xGI)</td>
                                <td>${player1.xGI.toFixed(2)}</td>
                                <td>${player2.xGI.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td>Shots on Target</td>
                                <td>${player1.shots}</td>
                                <td>${player2.shots}</td>
                            </tr>
                            <tr>
                                <td>ICT Index</td>
                                <td>${player1.ictIndex.toFixed(1)}</td>
                                <td>${player2.ictIndex.toFixed(1)}</td>
                            </tr>
                            <tr>
                                <td>Games Started (GS)</td>
                                <td>${player1.GS}</td>
                                <td>${player2.GS}</td>
                            </tr>
                            <tr>
                                <td>Avg Min Per Game (MPPG)</td>
                                <td>${player1.MPPG.toFixed(1)}</td>
                                <td>${player2.MPPG.toFixed(1)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Right Card: Radar Chart comparison -->
            <div class="compare-chart-card">
                <h3 style="font-family: var(--font-heading); margin-bottom: 20px; font-weight:700;">OPTA Performance Radar</h3>
                <div class="chart-container-compare">
                    <canvas id="radarCompareCanvas"></canvas>
                </div>
            </div>
        </div>
    `;

    renderRadarChart(player1, player2);
  };

  container.innerHTML = `
      <div class="compare-view-container">
          <div class="compare-selectors-card">
              <div class="compare-dropdown-wrapper">
                  <label style="font-size:12px; color: var(--text-muted);">Player 1</label>
                  <select class="compare-select" id="p1CompareSelect">
                      ${PLAYERS.map(p => `<option value="${p.id}" ${p.id === p1Id ? 'selected' : ''}>${p.name} (${p.team} • MID)</option>`).join('')}
                  </select>
              </div>

              <div class="vs-divider">VS</div>

              <div class="compare-dropdown-wrapper">
                  <label style="font-size:12px; color: var(--text-muted);">Player 2</label>
                  <select class="compare-select" id="p2CompareSelect">
                      ${PLAYERS.map(p => `<option value="${p.id}" ${p.id === p2Id ? 'selected' : ''}>${p.name} (${p.team} • FWD)</option>`).join('')}
                  </select>
              </div>
          </div>

          <div class="compare-details-grid" id="compareDetailsGrid">
              <!-- Rendered via JS -->
          </div>
      </div>
  `;

  renderDetails();

  // Listeners
  const select1 = container.querySelector('#p1CompareSelect');
  select1.addEventListener('change', e => {
      p1Id = parseInt(e.target.value);
      player1 = PLAYERS.find(p => p.id === p1Id);
      container.dataset.player1Id = p1Id;
      renderDetails();
  });

  const select2 = container.querySelector('#p2CompareSelect');
  select2.addEventListener('change', e => {
      p2Id = parseInt(e.target.value);
      player2 = PLAYERS.find(p => p.id === p2Id);
      container.dataset.player2Id = p2Id;
      renderDetails();
  });
}

function renderRadarChart(p1, p2) {
    const ctx = document.getElementById('radarCompareCanvas');
    if (!ctx) return;

    if (comparisonChartInstance) {
        comparisonChartInstance.destroy();
    }

    // Normalized stats for Radar (Values 0 - 100)
    const normP1 = [
        Math.min(100, (p1.points / 250) * 100),
        Math.min(100, (p1.price / 15) * 100),
        Math.min(100, (p1.xG / 25) * 100),
        Math.min(100, (p1.xA / 12) * 100),
        Math.min(100, (p1.shots / 130) * 100),
        Math.min(100, (p1.ictIndex / 310) * 100)
    ];

    const normP2 = [
        Math.min(100, (p2.points / 250) * 100),
        Math.min(100, (p2.price / 15) * 100),
        Math.min(100, (p2.xG / 25) * 100),
        Math.min(100, (p2.xA / 12) * 100),
        Math.min(100, (p2.shots / 130) * 100),
        Math.min(100, (p2.ictIndex / 310) * 100)
    ];

    const isLight = document.documentElement.classList.contains('light-theme');
    const color1 = isLight ? '#15803d' : '#00ff88';
    const bg1 = isLight ? 'rgba(21, 128, 61, 0.12)' : 'rgba(0, 255, 136, 0.15)';
    const color2 = isLight ? '#0f766e' : '#00f2fe';
    const bg2 = isLight ? 'rgba(15, 118, 110, 0.12)' : 'rgba(0, 242, 254, 0.15)';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';
    const labelColor = isLight ? '#4b5563' : '#94a3b8';

    comparisonChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Total Points', 'Cost', 'xG', 'xA', 'Shots', 'ICT Index'],
            datasets: [
                {
                    label: p1.name,
                    data: normP1,
                    backgroundColor: bg1,
                    borderColor: color1,
                    pointBackgroundColor: color1,
                    pointBorderColor: color1,
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: color1
                },
                {
                    label: p2.name,
                    data: normP2,
                    backgroundColor: bg2,
                    borderColor: color2,
                    pointBackgroundColor: color2,
                    pointBorderColor: color2,
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: color2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: {
                        color: gridColor
                    },
                    grid: {
                        color: gridColor
                    },
                    pointLabels: {
                        color: labelColor,
                        font: {
                            family: 'Inter',
                            size: 11,
                            weight: '500'
                        }
                    },
                    ticks: {
                        display: false,
                        maxTicksLimit: 5
                    },
                    min: 0,
                    max: 100
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#f8fafc',
                        font: {
                            family: 'Inter',
                            size: 12,
                            weight: '600'
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            // Map value back to human readable or display raw normalized
                            return `${context.dataset.label}: ${context.raw.toFixed(1)}/100 (Relative)`;
                        }
                    }
                }
            }
        }
    });
}
