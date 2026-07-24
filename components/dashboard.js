export function renderDashboard(container, state, actions) {
    container.innerHTML = `
        <div class="membership-container" style="max-width: 900px; margin: 0 auto;">
            <div class="membership-intro" style="margin-bottom: 40px; text-align: center;">
                <h2 style="font-family: var(--font-heading); font-size: 32px; font-weight: 800; background: linear-gradient(135deg, var(--primary), var(--secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                    Ultimate Suite Unlocked
                </h2>
                <p style="font-size: 16px; color: var(--text-muted); margin-top: 8px;">
                    Welcome to the <strong>2026/27 FPL Hub Ultimate Edition</strong>. All premium features, statistical models, and AI solvers are fully unlocked and 100% free. No subscriptions required.
                </p>
            </div>

            <!-- Feature Suite Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 24px; margin-bottom: 40px;">
                <!-- AI Optimizer -->
                <div class="pricing-card active-plan" style="max-width: 100%; min-width: auto; padding: 24px; border-color: var(--primary);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                        <div class="lock-icon-wrapper" style="width: 42px; height: 42px; margin-bottom: 0; background: rgba(0, 255, 136, 0.1); border-color: rgba(0, 255, 136, 0.3); color: var(--primary);">
                            <i data-lucide="cpu" style="width: 20px; height: 20px;"></i>
                        </div>
                        <span class="rec-badge" style="font-size: 9px;">UNLOCKED</span>
                    </div>
                    <h4 style="font-family: var(--font-heading); font-size: 16px; font-weight: 700; margin-bottom: 6px;">AI Transfer Optimizer</h4>
                    <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; flex: 1;">
                        Get point-maximizing 1-transfer and 2-transfer combinations calculated instantly by our heuristics solver.
                    </p>
                </div>

                <!-- OPTA Stats Package -->
                <div class="pricing-card active-plan" style="max-width: 100%; min-width: auto; padding: 24px; border-color: var(--primary);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                        <div class="lock-icon-wrapper" style="width: 42px; height: 42px; margin-bottom: 0; background: rgba(0, 255, 136, 0.1); border-color: rgba(0, 255, 136, 0.3); color: var(--primary);">
                            <i data-lucide="bar-chart-3" style="width: 20px; height: 20px;"></i>
                        </div>
                        <span class="rec-badge" style="font-size: 9px;">UNLOCKED</span>
                    </div>
                    <h4 style="font-family: var(--font-heading); font-size: 16px; font-weight: 700; margin-bottom: 6px;">OPTA Stats Hub</h4>
                    <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; flex: 1;">
                        Full access to detailed player performance parameters, expected goals (xG), expected assists (xA), and ICT indexes.
                    </p>
                </div>

                <!-- Expert Team Reveals -->
                <div class="pricing-card active-plan" style="max-width: 100%; min-width: auto; padding: 24px; border-color: var(--primary);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                        <div class="lock-icon-wrapper" style="width: 42px; height: 42px; margin-bottom: 0; background: rgba(0, 255, 136, 0.1); border-color: rgba(0, 255, 136, 0.3); color: var(--primary);">
                            <i data-lucide="eye" style="width: 20px; height: 20px;"></i>
                        </div>
                        <span class="rec-badge" style="font-size: 9px;">UNLOCKED</span>
                    </div>
                    <h4 style="font-family: var(--font-heading); font-size: 16px; font-weight: 700; margin-bottom: 6px;">Expert Reveals</h4>
                    <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; flex: 1;">
                        Track weekly captain picks, active chip usage, and board lineups from top managers in the world.
                    </p>
                </div>

                <!-- Live Price Predictor -->
                <div class="pricing-card active-plan" style="max-width: 100%; min-width: auto; padding: 24px; border-color: var(--primary);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                        <div class="lock-icon-wrapper" style="width: 42px; height: 42px; margin-bottom: 0; background: rgba(0, 255, 136, 0.1); border-color: rgba(0, 255, 136, 0.3); color: var(--primary);">
                            <i data-lucide="trending-up" style="width: 20px; height: 20px;"></i>
                        </div>
                        <span class="rec-badge" style="font-size: 9px;">UNLOCKED</span>
                    </div>
                    <h4 style="font-family: var(--font-heading); font-size: 16px; font-weight: 700; margin-bottom: 6px;">Price Change Predictor</h4>
                    <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; flex: 1;">
                        Monitor daily market fluctuations and secure value growth with progress-to-rise indicators.
                    </p>
                </div>
            </div>

            <!-- Fun Celebration card -->
            <div class="pricing-card premium-ultra" style="max-width: 100%; margin: 0 auto; padding: 32px; border-color: var(--accent-purple); box-shadow: 0 4px 20px rgba(139, 92, 246, 0.15); border-radius: 16px; text-align: center;">
                <h3 style="font-family: var(--font-heading); font-size: 20px; font-weight: 700; margin-bottom: 8px;">Dominating the 2026/27 Season</h3>
                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">
                    Take advantage of our data-driven planners. Click below to trigger a celebration of your complimentary ultimate status!
                </p>
                <button class="pricing-subscribe-btn" id="celebrateBtn" style="background: linear-gradient(135deg, var(--accent-purple), #ec4899); border: none; font-weight:700; font-family: var(--font-heading); font-size: 14px; max-width: 240px; margin: 0 auto; color: #fff; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);">
                    Celebrate Ultimate Access
                </button>
            </div>
        </div>
    `;

    lucide.createIcons();

    // Setup celebration confetti
    const celebrateBtn = container.querySelector('#celebrateBtn');
    if (celebrateBtn) {
        celebrateBtn.addEventListener('click', () => {
            if (window.confetti) {
                confetti({
                    particleCount: 180,
                    spread: 90,
                    origin: { y: 0.55 },
                    colors: ['#00ff88', '#00f2fe', '#8b5cf6', '#ec4899', '#fbbf24']
                });
            }
            actions.showToast('Let the 2026/27 season begin!', 'success');
        });
    }
}
