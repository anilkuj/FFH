import { PLAYERS, TEAMS } from '../data.js';

export const QUICK_HIGHLIGHTS = {
    fitReturns: [
        {
            team: "BHA",
            teamName: "Brighton",
            player: "Dunk",
            price: "4.5m",
            ownership: "1.0%",
            text: "Fit and set to make his 300th Premier League appearance."
        },
        {
            team: "ARS",
            teamName: "Arsenal",
            player: "Gabriel Jesus",
            price: "6.8m",
            ownership: "2.5%",
            text: "Returned to full team training and available for selection."
        }
    ],
    managerInsights: [
        {
            team: "ARS",
            tag: "Transfer",
            text: "Arteta addressed transfer speculation surrounding Gabriel Jesus and Gabriel Martinelli, acknowledging personal situations are being managed."
        },
        {
            team: "ARS",
            tag: "Rotation",
            text: "Arteta highlighted the versatility of Eberechi Eze and other players, noting they will play in different positions depending on the opponent."
        },
        {
            team: "LIV",
            tag: "Formation",
            text: "Under Andoni Iraola, Frimpong is being used exclusively as a right-back rather than sharing duties on the wing."
        },
        {
            team: "BRE",
            tag: "Formation",
            text: "The manager praised the fluidity, freedom, and unpredictability of his midfield, which led to goal contributions from multiple central players."
        },
        {
            team: "LEE",
            tag: "League Cup",
            text: "Farke explained a tactical shift to overload the center of midfield, using hybrid roles for Daniel James and Sean Longstaff to gain dominance."
        }
    ],
    tacticalNotes: [
        {
            team: "ARS",
            tag: "Versatility",
            text: "Arteta emphasized the tactical versatility of Eberechi Eze, noting he can play as a left winger, left attacking midfielder, or right attacking midfielder, allowing for fluid positional changes depending on the opponent."
        },
        {
            team: "LIV",
            tag: "Tactics",
            text: "Jeremie Frimpong's role has been locked down as a traditional right back under Iraola, increasing his defensive and recovery responsibilities compared to his utility wing/full back role last season, which may slightly lower his out of position attacking ceiling in FPL."
        },
        {
            team: "CHE",
            tag: "League Cup",
            text: "Pedro Neto's tactical versatility was discussed, with the manager noting he can function as either a winger or a wing-back to provide team balance."
        },
        {
            team: "FUL",
            tag: "League Cup",
            text: "Arbeloa wants his team to dominate games through possession and attacking in the opponent's half, but stresses that 'rest defense' and controlling counter-attacks are critical to their defensive stability."
        },
        {
            team: "BRE",
            tag: "Tactics",
            text: "Brentford's midfield setup under Keith Andrews is highly fluid and unpredictable, giving central midfielders like Janelt, Sangaré, and Lewis-Potter the license to push forward, make late runs into the box, and contribute directly to goals."
        }
    ]
};

export const PRESS_CONFERENCES = [
    {
        teamCode: "ARS",
        teamName: "Arsenal",
        updateCount: 17,
        updatedTime: "about 14 hours ago",
        fixtureLabel: "vs AVL GW2",
        matchStatus: "100% PRE",
        fixtureUpdateCount: 6,
        players: [
            {
                name: "Konsa",
                badge: "Fit",
                badgeType: "fit",
                risk: "LOW",
                stats: "0min • 4.5m • 11.1%",
                subtitle: "Confirmed available and in contention to make his debut against his former club Aston Villa.",
                quote: "“Yeah, he’s available, he’s been training really well and he will be available for selection.”"
            },
            {
                name: "Martinelli",
                badge: "Doubt",
                badgeType: "doubt",
                risk: "LOW",
                stats: "0min • 6.4m • -0.2%",
                subtitle: "Left training early due to a personal situation amid transfer speculation.",
                quote: "“Again, that’s another personal situation that we are dealing with.”"
            },
            {
                name: "J.Timber",
                badge: "Out",
                badgeType: "out",
                risk: "LOW",
                stats: "Known Injury • 0min • 6.5m • -0.1%",
                subtitle: "Progressing well on the grass but not yet ready to return to full training.",
                quote: "“Jurrien is progressing really well... if everything goes well, I think next week we can step it up again.”"
            },
            {
                name: "Saliba",
                badge: "Out",
                badgeType: "out",
                risk: "LOW",
                stats: "Known Injury • 0min • 6.0m • -0.3%",
                subtitle: "Undergoing conservative load management and is expected to be out for a while.",
                quote: "“Willy, obviously, is in a much conservative load management right now, so that’s going to take a while.”"
            },
            {
                name: "Eze",
                badge: "Fit",
                badgeType: "fit",
                risk: "LOW",
                stats: "0min • 6.5m • 1.3%",
                subtitle: "Fully fit and praised for his versatility to play across multiple attacking positions.",
                quote: "“Eze is one of them. He plays as a left winger, as a left attacking midfielder, right attacking midfielder, and he can deliver the role in a great way.”"
            },
            {
                name: "Gyökeres",
                badge: "Doubt",
                badgeType: "doubt",
                risk: "LOW",
                stats: "0min • 7.4m • 7.2%",
                subtitle: "Building up match fitness after being left out of the previous match to avoid overexposure.",
                quote: "“Some of them because some players they cannot last still 90 minutes, we didn’t want to expose them.”"
            }
        ]
    },
    {
        teamCode: "AVL",
        teamName: "Aston Villa",
        updateCount: 12,
        updatedTime: "about 16 hours ago",
        fixtureLabel: "vs ARS GW2",
        matchStatus: "100% PRE",
        fixtureUpdateCount: 4,
        players: [
            {
                name: "Watkins",
                badge: "Fit",
                badgeType: "fit",
                risk: "LOW",
                stats: "0min • 9.0m • 28.5%",
                subtitle: "Fully fit and leading the line in training ahead of the home clash against Arsenal.",
                quote: "“Ollie has trained all week with full intensity. He is completely ready and motivated.”"
            },
            {
                name: "Kamara",
                badge: "Out",
                badgeType: "out",
                risk: "HIGH",
                stats: "Known Injury • 0min • 5.0m • 0.5%",
                subtitle: "Continuing ACL rehabilitation with medical staff.",
                quote: "“Boubacar is working hard with the physios, but he remains unavailable for selection.”"
            }
        ]
    },
    {
        teamCode: "CHE",
        teamName: "Chelsea",
        updateCount: 15,
        updatedTime: "about 12 hours ago",
        fixtureLabel: "vs WOL GW2",
        matchStatus: "100% PRE",
        fixtureUpdateCount: 5,
        players: [
            {
                name: "Cole Palmer",
                badge: "Fit",
                badgeType: "fit",
                risk: "LOW",
                stats: "0min • 10.5m • 45.2%",
                subtitle: "In peak condition following a double-digit haul in GW1.",
                quote: "“Cole is feeling great, full of confidence, and ready to start.”"
            },
            {
                name: "Pedro Neto",
                badge: "Fit",
                badgeType: "fit",
                risk: "LOW",
                stats: "0min • 7.0m • 8.1%",
                subtitle: "Versatility highlighted ahead of Wolves match.",
                quote: "“Pedro can play on either wing or as a wing-back depending on tactical demands.”"
            }
        ]
    },
    {
        teamCode: "LIV",
        teamName: "Liverpool",
        updateCount: 14,
        updatedTime: "about 18 hours ago",
        fixtureLabel: "vs NFO GW2",
        matchStatus: "100% PRE",
        fixtureUpdateCount: 5,
        players: [
            {
                name: "Frimpong",
                badge: "Fit",
                badgeType: "fit",
                risk: "LOW",
                stats: "0min • 6.5m • 14.2%",
                subtitle: "Locked down as a traditional right back under Iraola.",
                quote: "“Jeremie is being used exclusively as a right back to ensure defensive stability and recovery speed.”"
            },
            {
                name: "Isak",
                badge: "Fit",
                badgeType: "fit",
                risk: "LOW",
                stats: "0min • 8.5m • 32.0%",
                subtitle: "Sharp in training following his GW1 debut.",
                quote: "“Alexander is integrating rapidly with the squad. He is sharp and ready for the home fixture.”"
            }
        ]
    },
    {
        teamCode: "MCI",
        teamName: "Manchester City",
        updateCount: 18,
        updatedTime: "about 10 hours ago",
        fixtureLabel: "vs CRY GW2",
        matchStatus: "100% PRE",
        fixtureUpdateCount: 6,
        players: [
            {
                name: "Haaland",
                badge: "Fit",
                badgeType: "fit",
                risk: "LOW",
                stats: "0min • 15.0m • 64.0%",
                subtitle: "Fit and fully rested ahead of the away trip.",
                quote: "“Erling is in great condition. He trained fantastically well this week.”"
            },
            {
                name: "Phil Foden",
                badge: "Fit",
                badgeType: "fit",
                risk: "LOW",
                stats: "0min • 9.5m • 18.0%",
                subtitle: "Cleared following minor illness earlier in the week.",
                quote: "“Phil is back, completely recovered, and available for selection.”"
            }
        ]
    }
];

export function renderPressConference(container, state, actions) {
    const isLight = document.documentElement.classList.contains("light-theme");
    const cardBg = isLight ? "#ffffff" : "var(--bg-card)";
    const panelBg = isLight ? "#f8fafc" : "var(--bg-panel)";
    const border = isLight ? "#e2e8f0" : "var(--border-color)";
    const textMain = isLight ? "#0f172a" : "var(--text-main)";
    const textMuted = isLight ? "#64748b" : "var(--text-muted)";

    // Read current filters from dataset
    const selectedTeam = container.dataset.pcTeam || "ALL";
    const selectedType = container.dataset.pcType || "ALL";
    const selectedSource = container.dataset.pcSource || "ALL";
    const searchQuery = (container.dataset.pcSearch || "").toLowerCase();

    // Filter press conference teams
    let filteredTeams = PRESS_CONFERENCES;
    if (selectedTeam !== "ALL") {
        filteredTeams = filteredTeams.filter(t => t.teamCode === selectedTeam || t.teamName.toLowerCase().includes(selectedTeam.toLowerCase()));
    }

    if (searchQuery) {
        filteredTeams = filteredTeams.map(t => {
            const matchingPlayers = t.players.filter(p => 
                p.name.toLowerCase().includes(searchQuery) ||
                p.subtitle.toLowerCase().includes(searchQuery) ||
                p.quote.toLowerCase().includes(searchQuery)
            );
            return { ...t, players: matchingPlayers };
        }).filter(t => t.players.length > 0);
    }

    container.innerHTML = `
        <div class="press-conference-container" style="display: flex; flex-direction: column; gap: 24px; max-width: 1200px; margin: 0 auto; padding-bottom: 40px;">
            
            <!-- Page Header Title -->
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid ${border}; padding-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #ec4899, #8b5cf6); display: flex; align-items: center; justify-content: center; color: #fff; box-shadow: 0 4px 12px rgba(236, 72, 153, 0.3);">
                        <i data-lucide="mic" style="width: 22px; height: 22px;"></i>
                    </div>
                    <div>
                        <h2 style="font-family: var(--font-heading); font-size: 22px; font-weight: 800; color: ${textMain}; margin: 0 0 4px 0;">
                            Press Conference & Manager Insights
                        </h2>
                        <p style="color: ${textMuted}; font-size: 13px; margin: 0;">
                            Real-time Premier League manager quotes, player fitness statuses, and tactical news summaries.
                        </p>
                    </div>
                </div>
                
                <div style="font-size: 11px; background: rgba(34, 197, 94, 0.15); color: #22c55e; padding: 4px 12px; border-radius: 999px; border: 1px solid rgba(34, 197, 94, 0.3); font-weight: 800; display: flex; align-items: center; gap: 6px;">
                    <span style="width: 7px; height: 7px; border-radius: 50%; background: #22c55e; display: inline-block;"></span>
                    9 Teams • 44 Updates Live
                </div>
            </div>

            <!-- ⚡ Quick Highlights Section -->
            <div style="background: ${cardBg}; border: 1px solid ${border}; border-radius: 14px; padding: 20px; box-shadow: var(--shadow-md);">
                <h3 style="font-family: var(--font-heading); font-size: 16px; font-weight: 800; color: ${textMain}; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="zap" style="color: var(--primary); width: 18px; height: 18px;"></i>
                    Quick Highlights
                </h3>

                <!-- Fit Returns Category -->
                <div style="margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #22c55e; margin-bottom: 8px;">
                        <i data-lucide="check-circle-2" style="width: 14px; height: 14px;"></i>
                        <span>Fit Returns</span>
                        <span style="font-size: 10px; background: rgba(34, 197, 94, 0.2); padding: 1px 6px; border-radius: 4px;">${QUICK_HIGHLIGHTS.fitReturns.length}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${QUICK_HIGHLIGHTS.fitReturns.map(item => `
                            <div style="background: rgba(34, 197, 94, 0.06); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; font-size: 12px;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span style="background: #22c55e; color: #000; font-weight: 800; font-size: 10px; padding: 2px 6px; border-radius: 4px;">${item.team}</span>
                                    <strong style="color: ${textMain};">${item.player}</strong>
                                    <span style="color: ${textMuted}; font-size: 11px;">${item.price} • ${item.ownership}</span>
                                </div>
                                <div style="color: ${textMuted}; font-size: 11.5px;">${item.text}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Manager Insights Category -->
                <div style="margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: var(--secondary); margin-bottom: 8px;">
                        <i data-lucide="clipboard-list" style="width: 14px; height: 14px;"></i>
                        <span>Manager Insights</span>
                        <span style="font-size: 10px; background: rgba(0, 242, 254, 0.15); padding: 1px 6px; border-radius: 4px;">${QUICK_HIGHLIGHTS.managerInsights.length}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${QUICK_HIGHLIGHTS.managerInsights.map(item => `
                            <div style="background: ${panelBg}; border: 1px solid ${border}; border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; gap: 12px; font-size: 12px;">
                                <span style="background: var(--bg-card); color: var(--secondary); border: 1px solid var(--secondary-glow); font-weight: 800; font-size: 10px; padding: 2px 6px; border-radius: 4px; flex-shrink: 0;">${item.team}</span>
                                <span style="font-size: 10px; background: rgba(255, 255, 255, 0.05); color: ${textMuted}; padding: 1px 6px; border-radius: 4px; flex-shrink: 0;">${item.tag}</span>
                                <div style="color: ${textMuted}; font-size: 11.5px; line-height: 1.4;">${item.text}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Tactical Notes Category -->
                <div>
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #8b5cf6; margin-bottom: 8px;">
                        <i data-lucide="lightbulb" style="width: 14px; height: 14px;"></i>
                        <span>Tactical Notes</span>
                        <span style="font-size: 10px; background: rgba(139, 92, 246, 0.2); padding: 1px 6px; border-radius: 4px;">${QUICK_HIGHLIGHTS.tacticalNotes.length}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${QUICK_HIGHLIGHTS.tacticalNotes.map(item => `
                            <div style="background: rgba(139, 92, 246, 0.05); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 8px; padding: 10px 14px; display: flex; align-items: flex-start; gap: 12px; font-size: 12px;">
                                <span style="background: #8b5cf6; color: #fff; font-weight: 800; font-size: 10px; padding: 2px 6px; border-radius: 4px; flex-shrink: 0; margin-top: 2px;">${item.team}</span>
                                <div style="color: ${textMuted}; font-size: 11.5px; line-height: 1.4;">${item.text}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- Filter Controls Bar -->
            <div style="background: ${cardBg}; border: 1px solid ${border}; border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; box-shadow: var(--shadow-sm);">
                <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                    <!-- Team Dropdown -->
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label style="font-size: 12px; font-weight: 700; color: ${textMuted};">Team:</label>
                        <select id="pcTeamSelect" style="padding: 6px 12px; font-size: 12px; background: ${panelBg}; border: 1px solid ${border}; border-radius: 6px; color: ${textMain}; outline: none; cursor: pointer;">
                            <option value="ALL" ${selectedTeam === "ALL" ? "selected" : ""}>All teams</option>
                            <option value="ARS" ${selectedTeam === "ARS" ? "selected" : ""}>Arsenal</option>
                            <option value="AVL" ${selectedTeam === "AVL" ? "selected" : ""}>Aston Villa</option>
                            <option value="CHE" ${selectedTeam === "CHE" ? "selected" : ""}>Chelsea</option>
                            <option value="LIV" ${selectedTeam === "LIV" ? "selected" : ""}>Liverpool</option>
                            <option value="MCI" ${selectedTeam === "MCI" ? "selected" : ""}>Man City</option>
                        </select>
                    </div>

                    <!-- Type Filter Buttons -->
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 12px; font-weight: 700; color: ${textMuted};">Type:</span>
                        <div style="display: flex; background: ${panelBg}; padding: 2px; border-radius: 6px; border: 1px solid ${border};">
                            ${["ALL", "Pre-Match", "Post-Match"].map(type => `
                                <button class="pc-type-btn" data-type="${type}" style="padding: 4px 10px; font-size: 11px; font-weight: 700; border: none; border-radius: 4px; cursor: pointer; ${selectedType === type ? 'background: var(--primary); color: var(--text-dark);' : 'background: transparent; color: ' + textMuted + ';'}">
                                    ${type === "ALL" ? "All" : type}
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Source Filter Buttons -->
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 12px; font-weight: 700; color: ${textMuted};">Source:</span>
                        <div style="display: flex; background: ${panelBg}; padding: 2px; border-radius: 6px; border: 1px solid ${border};">
                            ${["ALL", "YouTube", "Website"].map(src => `
                                <button class="pc-source-btn" data-source="${src}" style="padding: 4px 10px; font-size: 11px; font-weight: 700; border: none; border-radius: 4px; cursor: pointer; ${selectedSource === src ? 'background: var(--secondary); color: var(--text-dark);' : 'background: transparent; color: ' + textMuted + ';'}">
                                    ${src === "ALL" ? "All" : src}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Search Input -->
                <div style="display: flex; align-items: center; gap: 8px; flex: 1; max-width: 260px;">
                    <div style="position: relative; width: 100%;">
                        <i data-lucide="search" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; color: ${textMuted};"></i>
                        <input type="text" id="pcSearchInput" value="${container.dataset.pcSearch || ''}" placeholder="Search player or quote..." style="width: 100%; padding: 6px 12px 6px 30px; font-size: 12px; background: ${panelBg}; border: 1px solid ${border}; border-radius: 6px; color: ${textMain}; outline: none;">
                    </div>
                </div>
            </div>

            <!-- Team-by-Team Manager Quotes & Player Cards -->
            <div style="display: flex; flex-direction: column; gap: 20px;">
                ${filteredTeams.length === 0 ? `
                    <div style="text-align: center; padding: 40px; color: ${textMuted}; font-size: 13px; background: ${cardBg}; border-radius: 12px; border: 1px solid ${border};">
                        No press conference updates found matching your search.
                    </div>
                ` : filteredTeams.map(team => `
                    <div class="optimizer-card" style="background: ${cardBg}; border: 1px solid ${border}; border-radius: 14px; padding: 20px; box-shadow: var(--shadow-md);">
                        
                        <!-- Team Header -->
                        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid ${border}; padding-bottom: 12px; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 800; color: ${textMain}; margin: 0;">
                                    ${team.teamName}
                                </h3>
                                <span style="background: rgba(139, 92, 246, 0.15); color: #8b5cf6; border: 1px solid rgba(139, 92, 246, 0.3); font-weight: 800; font-size: 10px; padding: 2px 8px; border-radius: 4px;">
                                    ${team.teamCode}
                                </span>
                                <span style="font-size: 11.5px; color: ${textMuted};">${team.updateCount} updates</span>
                            </div>
                            <div style="font-size: 11.5px; color: ${textMuted}; font-weight: 600;">
                                ${team.updatedTime}
                            </div>
                        </div>

                        <!-- Match Fixture Header Pill -->
                        <div style="background: ${panelBg}; border: 1px solid ${border}; border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: ${textMain};">
                                <i data-lucide="video" style="width: 14px; height: 14px; color: var(--secondary);"></i>
                                <span>${team.fixtureLabel}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 11px;">
                                <span style="background: rgba(34, 197, 94, 0.15); color: #22c55e; padding: 2px 6px; border-radius: 4px; font-weight: 800;">${team.matchStatus}</span>
                                <span style="color: ${textMuted}; font-weight: 600;">${team.fixtureUpdateCount} updates</span>
                            </div>
                        </div>

                        <!-- Player Quote Cards Stack -->
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            ${team.players.map(p => {
                                let badgeColor = "#22c55e";
                                let badgeBg = "rgba(34, 197, 94, 0.15)";
                                let badgeBorder = "rgba(34, 197, 94, 0.3)";
                                if (p.badgeType === "doubt") {
                                    badgeColor = "#f59e0b";
                                    badgeBg = "rgba(245, 158, 11, 0.15)";
                                    badgeBorder = "rgba(245, 158, 11, 0.3)";
                                } else if (p.badgeType === "out") {
                                    badgeColor = "#ef4444";
                                    badgeBg = "rgba(239, 68, 68, 0.15)";
                                    badgeBorder = "rgba(239, 68, 68, 0.3)";
                                }

                                return `
                                    <div style="background: ${panelBg}; border: 1px solid ${border}; border-radius: 10px; padding: 14px 16px;">
                                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 6px;">
                                            <div>
                                                <div style="font-weight: 800; font-size: 13.5px; color: ${textMain}; display: flex; align-items: center; gap: 8px;">
                                                    <span>${p.name}</span>
                                                    <span style="font-size: 10.5px; color: ${textMuted}; font-weight: 500;">${p.stats}</span>
                                                </div>
                                                <p style="margin: 4px 0 0 0; font-size: 12px; color: ${textMuted}; line-height: 1.4;">
                                                    ${p.subtitle}
                                                </p>
                                            </div>
                                            <span style="font-size: 10px; font-weight: 800; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; padding: 3px 10px; border-radius: 6px; text-transform: uppercase; white-space: nowrap;">
                                                ${p.badge} ${p.risk}
                                            </span>
                                        </div>
                                        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px stroke ${border}; font-size: 12px; font-style: italic; color: ${textMain}; line-height: 1.5; background: rgba(0, 0, 0, 0.15); padding: 8px 12px; border-radius: 6px;">
                                            ${p.quote}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>

                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // Initialize Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Attach Event Listeners

    // Team Select
    const teamSelect = container.querySelector('#pcTeamSelect');
    if (teamSelect) {
        teamSelect.addEventListener('change', () => {
            container.dataset.pcTeam = teamSelect.value;
            renderPressConference(container, state, actions);
        });
    }

    // Type Filter Buttons
    container.querySelectorAll('.pc-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.dataset.pcType = btn.getAttribute('data-type');
            renderPressConference(container, state, actions);
        });
    });

    // Source Filter Buttons
    container.querySelectorAll('.pc-source-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.dataset.pcSource = btn.getAttribute('data-source');
            renderPressConference(container, state, actions);
        });
    });

    // Search Input
    const searchInput = container.querySelector('#pcSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            container.dataset.pcSearch = searchInput.value;
            renderPressConference(container, state, actions);
        });
    }
}
