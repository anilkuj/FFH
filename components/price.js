import { PLAYERS } from '../data.js';

export function renderPrice(container, state, actions) {
    // Separate rising and falling candidates
    const rises = PLAYERS
        .filter(p => p.priceChangeTarget > 0)
        .sort((a, b) => b.priceChangeTarget - a.priceChangeTarget);

    const falls = PLAYERS
        .filter(p => p.priceChangeTarget < 0)
        .sort((a, b) => a.priceChangeTarget - b.priceChangeTarget); // negative targets

    container.innerHTML = `
        <div class="price-predictor-container">
            <div style="margin-bottom: 32px;">
                <h2 style="font-family: var(--font-heading); font-weight:800; font-size:24px; margin-bottom:6px;">FPL Price Change Predictor</h2>
                <p style="color:var(--text-muted); font-size:14px;">Track transfer volumes in real-time. Players reaching 100% are highly likely to rise in cost tonight, while players hitting -100% are bound to fall.</p>
            </div>

            <div class="price-predictor-grid">
                <!-- predicted price rises -->
                <div class="price-card">
                    <h3 class="price-rise-title">
                        <i data-lucide="trending-up"></i> Predicted Price Rises
                    </h3>
                    <div class="price-player-list">
                        ${rises.map(player => {
                            return `
                                <div class="price-row-item">
                                    <div class="price-row-header">
                                        <div class="price-player-info">
                                            <span class="price-name">${player.name}</span>
                                            <span class="price-sub">${player.team} • ${player.position}</span>
                                        </div>
                                        <div class="price-figures">
                                            <span class="price-value-cur">£${player.price.toFixed(1)}m</span>
                                            <span class="price-target-pct pct-up">+${player.priceChangeTarget.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                    <div class="progress-track">
                                        <div class="progress-bar-fill fill-rise" style="width: 0%;"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- predicted price falls -->
                <div class="price-card">
                    <h3 class="price-fall-title">
                        <i data-lucide="trending-down"></i> Predicted Price Falls
                    </h3>
                    <div class="price-player-list">
                        ${falls.map(player => {
                            const absPct = Math.abs(player.priceChangeTarget);
                            return `
                                <div class="price-row-item">
                                    <div class="price-row-header">
                                        <div class="price-player-info">
                                            <span class="price-name">${player.name}</span>
                                            <span class="price-sub">${player.team} • ${player.position}</span>
                                        </div>
                                        <div class="price-figures">
                                            <span class="price-value-cur">£${player.price.toFixed(1)}m</span>
                                            <span class="price-target-pct pct-down">${player.priceChangeTarget.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                    <div class="progress-track">
                                        <div class="progress-bar-fill fill-fall" style="width: 0%;"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    lucide.createIcons();

    // Trigger transition animations for progress bars
    setTimeout(() => {
        const riseFills = container.querySelectorAll('.fill-rise');
        rises.forEach((player, idx) => {
            if (riseFills[idx]) {
                riseFills[idx].style.width = `${player.priceChangeTarget}%`;
            }
        });

        const fallFills = container.querySelectorAll('.fill-fall');
        falls.forEach((player, idx) => {
            if (fallFills[idx]) {
                fallFills[idx].style.width = `${Math.abs(player.priceChangeTarget)}%`;
            }
        });
    }, 150);
}
