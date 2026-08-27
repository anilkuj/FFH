// Shot Map Component - powered by PitchAPI (EPL only)
// Pitch: 105m x 68m. x=105 = attacking goal. Posts: y=30.34 & y=37.66.

export function renderShotMap(container, state, actions) {
    const isLight = document.documentElement.classList.contains("light-theme");

    // Always read LIVE from dataset — never cache as const (stale closure bug)
    const getDate       = () => container.dataset.smDate       || "";
    const getMatchId    = () => container.dataset.smMatchId    || "";
    const getTeamName   = () => container.dataset.smTeamName   || "";
    const getTeamFilter = () => container.dataset.smTeamFilter || "all";

    const cardBg   = isLight ? "#ffffff" : "#1e293b";
    const border   = isLight ? "#e2e8f0" : "rgba(255,255,255,0.08)";
    const textMain = isLight ? "#0f172a" : "#f8fafc";
    const textMuted= isLight ? "#64748b" : "#94a3b8";
    const pitchGreen = "#15803d";
    const pitchAlt   = "#166534";
    const pitchLine  = "rgba(255,255,255,0.55)";
    const HOME_COLOR = "#3b82f6";
    const AWAY_COLOR = "#f97316";

    const EPL_TEAMS = [
        "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton",
        "Chelsea", "Crystal Palace", "Everton", "Fulham", "Ipswich",
        "Leicester", "Liverpool", "Man City", "Man Utd", "Newcastle",
        "Nottingham Forest", "Southampton", "Tottenham", "West Ham", "Wolves"
    ];

    // Mount chrome once on first load
    function mountChrome() {
        renderChrome();
        const ms = container.querySelector("#sm-match-select");
        const currentDate = getDate();
        const currentTeam = getTeamName();
        
        // Initial load based on whichever filter is active (Team OR Date)
        if (ms) {
            if (currentTeam) {
                loadMatchesByTeam(currentTeam, ms);
            } else if (currentDate) {
                loadMatchesByDate(currentDate, ms);
            } else {
                // Default to initial date
                const today = new Date().toISOString().slice(0,10);
                container.dataset.smDate = today;
                const dp = container.querySelector("#sm-date-picker");
                if (dp) dp.value = today;
                loadMatchesByDate(today, ms);
            }
        }
    }

    // Refresh only the shot content area — called every time match/filter changes
    async function refreshShots() {
        const matchId = getMatchId();
        if (!matchId) { renderEmptyPrompt(); return; }
        showShotLoading();
        try {
            const [sRes, lRes] = await Promise.all([
                fetch("/api/pitchapi/shots/" + matchId),
                fetch("/api/pitchapi/lineups/" + matchId)
            ]);
            const sJson = sRes.ok ? await sRes.json() : null;
            const lJson = lRes.ok ? await lRes.json() : null;
            let mObj = null;
            try { mObj = JSON.parse(container.dataset.smMatchObj || "null"); } catch(e){}
            renderShotContent(sJson, lJson, mObj);
        } catch(e) { showInlineError("Failed to load: " + e.message); }
    }

    function showShotLoading() {
        const a = container.querySelector("#sm-shot-area");
        if (a) a.innerHTML = "<div style='padding:60px;text-align:center;color:" + textMuted + ";'><p>Loading shot data...</p></div>";
    }

    function showInlineError(msg) {
        const a = container.querySelector("#sm-shot-area");
        if (a) a.innerHTML = "<div style='padding:24px;color:#ef4444;font-size:13px;'>" + msg + "</div>";
    }

    function renderEmptyPrompt() {
        const a = container.querySelector("#sm-shot-area");
        if (a) a.innerHTML = "<div style='padding:60px;text-align:center;color:" + textMuted + ";'><p style=\"font-size:14px;font-weight:600;color:" + textMain + ";\">Select a match to view the shot map</p><p style='font-size:12px;'>Select either a Team OR a Date to pick a Premier League match above</p></div>";
    }

    function renderChrome() {
        const today = new Date().toISOString().slice(0,10);
        const currentDate   = getDate();
        const currentTeam   = getTeamName();
        const currentFilter = getTeamFilter();
        const filterBtns = ["all","home","away"].map(f =>
            "<button data-smfilter='" + f + "' style='padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid " + border + ";background:" + (currentFilter===f?"rgba(59,130,246,0.15)":cardBg) + ";color:" + (currentFilter===f?"#3b82f6":textMuted) + ";'>" +
            f.charAt(0).toUpperCase()+f.slice(1) + "</button>"
        ).join("");

        const teamOptions = "<option value=''>-- Select Team --</option>" +
            EPL_TEAMS.map(t => "<option value='" + t + "'" + (currentTeam === t ? " selected" : "") + ">" + t + "</option>").join("");

        container.innerHTML =
            "<div style='padding:20px 24px 0;max-width:1200px;margin:0 auto;'>" +
            "<div style='display:flex;align-items:center;gap:12px;margin-bottom:20px;'>" +
            "<div style='width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0;'>" +
            "<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><line x1='22' x2='18' y1='12' y2='12'/><line x1='6' x2='2' y1='12' y2='12'/><line x1='12' x2='12' y1='6' y2='2'/><line x1='12' x2='12' y1='22' y2='18'/></svg></div>" +
            "<div><h2 style='margin:0;font-size:18px;font-weight:700;color:" + textMain + ";'>Shot Map</h2>" +
            "<p style='margin:0;font-size:12px;color:" + textMuted + ";'>EPL shot-level xG data &bull; Powered by PitchAPI</p></div></div>" +
            "<div style='display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;align-items:flex-end;'>" +
            
            "<!-- FILTER BY TEAM NAME (MUTUALLY EXCLUSIVE) -->" +
            "<div><label style='display:block;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:" + textMuted + ";margin-bottom:6px;'>Option A: Filter by Team</label>" +
            "<select id='sm-team-picker' style='background:" + cardBg + ";border:1px solid " + border + ";border-radius:8px;padding:8px 12px;font-size:13px;color:" + textMain + ";cursor:pointer;outline:none;height:38px;'>" + teamOptions + "</select></div>" +

            "<div style='padding-bottom:10px;font-weight:700;font-size:11px;color:" + textMuted + ";'>OR</div>" +

            "<!-- MATCH DATE (MUTUALLY EXCLUSIVE) -->" +
            "<div><label style='display:block;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:" + textMuted + ";margin-bottom:6px;'>Option B: Filter by Date</label>" +
            "<input type='date' id='sm-date-picker' value='" + currentDate + "' max='" + today + "' style='background:" + cardBg + ";border:1px solid " + border + ";border-radius:8px;padding:8px 12px;font-size:13px;color:" + textMain + ";cursor:pointer;outline:none;height:38px;'></div>" +
            
            "<!-- MATCH SELECTOR -->" +
            "<div style='flex:1;min-width:240px;'><label style='display:block;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:" + textMuted + ";margin-bottom:6px;'>Match</label>" +
            "<select id='sm-match-select' style='width:100%;background:" + cardBg + ";border:1px solid " + border + ";border-radius:8px;padding:8px 12px;font-size:13px;color:" + textMain + ";cursor:pointer;outline:none;height:38px;'><option value=''>- Pick a Team OR Date to load matches -</option></select></div>" +
            
            "<!-- SHOW SHOT TYPE -->" +
            "<div><label style='display:block;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:" + textMuted + ";margin-bottom:6px;'>Show</label><div style='display:flex;gap:4px;'>" + filterBtns + "</div></div></div>" +
            
            "<div style='display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;font-size:11px;color:" + textMuted + ";'>" +
            "<span style='color:#22c55e;'>&#9899;</span> Goal &nbsp;" +
            "<span style='color:" + HOME_COLOR + ";'>&#9899;</span> On Target (Home) &nbsp;" +
            "<span style='color:" + AWAY_COLOR + ";'>&#9899;</span> On Target (Away) &nbsp;" +
            "Bubble size = xG</div></div>" +
            "<div id='sm-shot-area' style='padding:0 24px 24px;max-width:1200px;margin:0 auto;'></div>";

        const tp = container.querySelector("#sm-team-picker");
        const dp = container.querySelector("#sm-date-picker");
        const ms = container.querySelector("#sm-match-select");

        // Team Picker Event Listener (Clears Date Picker)
        tp.addEventListener("change", () => {
            const teamVal = tp.value;
            if (teamVal) {
                // Clear Date filter when filtering by Team
                dp.value = "";
                container.dataset.smDate = "";
                container.dataset.smTeamName = teamVal;
                container.dataset.smMatchId = "";
                container.dataset.smMatchObj = "";
                loadMatchesByTeam(teamVal, ms);
            } else {
                container.dataset.smTeamName = "";
            }
            renderEmptyPrompt();
        });

        // Date Picker Event Listener (Clears Team Picker)
        dp.addEventListener("change", () => {
            const dateVal = dp.value;
            if (dateVal) {
                // Clear Team filter when filtering by Date
                tp.value = "";
                container.dataset.smTeamName = "";
                container.dataset.smDate = dateVal;
                container.dataset.smMatchId = "";
                container.dataset.smMatchObj = "";
                loadMatchesByDate(dateVal, ms);
            } else {
                container.dataset.smDate = "";
            }
            renderEmptyPrompt();
        });

        // Match Select Event Listener
        ms.addEventListener("change", () => {
            const opt = ms.options[ms.selectedIndex];
            container.dataset.smMatchId = ms.value;
            container.dataset.smMatchObj = opt.dataset.matchObj || "";
            refreshShots();
        });

        // Shot Filter Buttons Event Listener
        container.querySelectorAll("[data-smfilter]").forEach(btn => {
            btn.addEventListener("click", () => {
                container.dataset.smTeamFilter = btn.dataset.smfilter;
                refreshShots();
            });
        });
    }

    // Filter Mode A: Load matches strictly by selected TEAM NAME
    async function loadMatchesByTeam(teamName, selectEl) {
        selectEl.innerHTML = "<option value=''>Loading " + teamName + " matches...</option>";
        const targetDates = ["2026-08-26", "2026-08-25", "2026-08-24", "2026-08-23", "2026-08-22", "2026-08-17", "2026-08-16", "2026-08-15"];

        try {
            let matches = [];
            for (const d of targetDates) {
                const res = await fetch("/api/pitchapi/date/" + d + "?league=epl").catch(() => null);
                if (res && res.ok) {
                    const json = await res.json();
                    const mList = json.matches || [];
                    mList.forEach(m => {
                        const queryName = teamName.toLowerCase();
                        if ((m.home_team && m.home_team.name.toLowerCase().includes(queryName)) ||
                            (m.away_team && m.away_team.name.toLowerCase().includes(queryName))) {
                            m._matchDate = d;
                            matches.push(m);
                        }
                    });
                }
            }

            if (matches.length === 0) {
                selectEl.innerHTML = "<option value=''>No EPL matches found for " + teamName + "</option>";
                renderEmptyPrompt();
                return;
            }

            selectEl.innerHTML = "<option value=''>- Select a " + teamName + " match -</option>" +
                matches.map(m => {
                    const score = (m.status==="finished"||m.status==="inprogress") ? " " + m.score_home + "-" + m.score_away : "";
                    const dateLabel = m._matchDate ? " (" + m._matchDate + ")" : "";
                    const label = m.home_team.name + " vs " + m.away_team.name + score + dateLabel;
                    const safeObj = JSON.stringify(m).replace(/"/g,"&quot;");
                    return "<option value='" + m.id + "' data-match-date='" + (m._matchDate || '') + "' data-match-obj=\"" + safeObj + "\">" + label + "</option>";
                }).join("");

            if (container.dataset.smMatchId) selectEl.value = container.dataset.smMatchId;
        } catch(e) {
            selectEl.innerHTML = "<option value=''>Failed to load matches</option>";
            console.error("loadMatchesByTeam:", e);
        }
    }

    // Filter Mode B: Load matches strictly by selected DATE
    async function loadMatchesByDate(date, selectEl) {
        selectEl.innerHTML = "<option value=''>Loading matches for " + date + "...</option>";
        try {
            const res = await fetch("/api/pitchapi/date/" + date + "?league=epl");
            if (!res.ok) throw new Error("HTTP " + res.status);
            const json = await res.json();
            const matches = json.matches || [];
            if (matches.length === 0) {
                selectEl.innerHTML = "<option value=''>No EPL matches on " + date + "</option>";
                renderEmptyPrompt(); return;
            }
            selectEl.innerHTML = "<option value=''>- Select a match on " + date + " -</option>" +
                matches.map(m => {
                    const score = (m.status==="finished"||m.status==="inprogress") ? " " + m.score_home + "-" + m.score_away : "";
                    const time  = m.time_utc ? new Date(m.time_utc).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "";
                    const label = m.home_team.name + " vs " + m.away_team.name + score + " (" + time + ")";
                    const safeObj = JSON.stringify(m).replace(/"/g,"&quot;");
                    return "<option value='" + m.id + "' data-match-obj=\"" + safeObj + "\">" + label + "</option>";
                }).join("");
            if (container.dataset.smMatchId) selectEl.value = container.dataset.smMatchId;
        } catch(e) {
            selectEl.innerHTML = "<option value=''>Failed to load matches</option>";
            console.error("loadMatchesByDate:", e);
        }
    }

    function renderShotContent(sJson, lJson, mObj) {
        const shotArea = container.querySelector("#sm-shot-area");
        if (!shotArea) return;
        if (!sJson || !sJson.success || !sJson.data) {
            shotArea.innerHTML = "<div style='padding:24px;color:" + textMuted + ";font-size:13px;'>No shot data available.</div>"; return;
        }

        const periods = sJson.data.periods;
        if (!periods || periods.length === 0) {
            shotArea.innerHTML = "<div style='padding:24px;color:" + textMuted + ";font-size:13px;'>Shot data not yet available for this match.</div>"; return;
        }

        let allShots = [];
        periods.forEach(period => {
            (period.shots || []).forEach(s => allShots.push(s));
        });

        if (allShots.length === 0) {
            shotArea.innerHTML = "<div style='padding:24px;color:" + textMuted + ";font-size:13px;'>No shots recorded for this match yet.</div>"; return;
        }

        let homeId   = mObj ? mObj.home_team.id   : null;
        let awayId   = mObj ? mObj.away_team.id   : null;
        let homeName = mObj ? mObj.home_team.name : "Home";
        let awayName = mObj ? mObj.away_team.name : "Away";

        if (!homeId) {
            const teamIds = [...new Set(allShots.map(s => s.team_id).filter(Boolean))];
            homeId = teamIds[0] || null;
            awayId = teamIds[1] || null;
        }
        const filter = getTeamFilter();
        let filtered = filter==="home" ? allShots.filter(s=>s.team_id===homeId)
                      : filter==="away" ? allShots.filter(s=>s.team_id===awayId)
                      : allShots;
        const homeShots = allShots.filter(s=>s.team_id===homeId);
        const awayShots = allShots.filter(s=>s.team_id===awayId);
        const homeXg = homeShots.reduce((a,s)=>a+(s.expected_goals||0),0);
        const awayXg = awayShots.reduce((a,s)=>a+(s.expected_goals||0),0);
        const homeG  = homeShots.filter(s=>s.event_type==="Goal").length;
        const awayG  = awayShots.filter(s=>s.event_type==="Goal").length;

        shotArea.innerHTML =
            xgSummary(homeName,awayName,homeXg,awayXg,homeShots.length,awayShots.length,homeG,awayG,mObj) +
            "<div style='display:grid;grid-template-columns:1fr 200px;gap:16px;align-items:start;margin-top:16px;'>" +
            "<div>" + pitchSVG(filtered,homeId,awayId) + "</div>" +
            "<div>" + goalMouth(filtered,homeId,homeName,awayId,awayName) + "</div></div>" +
            xgTimeline(allShots,homeId,awayId,homeName,awayName) +
            shotLog(filtered,homeId,homeName,awayId,awayName);
        attachTooltips();
    }

    function xgSummary(hn,an,hxg,axg,hsh,ash,hg,ag,mObj) {
        const tot = hxg+axg||1;
        const hp  = Math.round((hxg/tot)*100);
        const score = mObj ? mObj.score_home+" - "+mObj.score_away : hg+" - "+ag;
        return "<div style='background:" + cardBg + ";border:1px solid " + border + ";border-radius:12px;padding:16px 20px;'>" +
            "<div style='display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;'>" +
            "<div style='flex:1;min-width:120px;'><div style='font-size:15px;font-weight:700;color:" + HOME_COLOR + ";'>" + hn + "</div>" +
            "<div style='font-size:28px;font-weight:800;color:" + textMain + ";'>xG " + hxg.toFixed(2) + "</div>" +
            "<div style='font-size:11px;color:" + textMuted + ";'>" + hsh + " shots &bull; " + hg + " goal" + (hg!==1?"s":"") + "</div></div>" +
            "<div style='text-align:center;padding:0 16px;'><div style='font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:" + textMuted + ";margin-bottom:4px;'>Score</div>" +
            "<div style='font-size:24px;font-weight:800;color:" + textMain + ";'>" + score + "</div></div>" +
            "<div style='flex:1;min-width:120px;text-align:right;'><div style='font-size:15px;font-weight:700;color:" + AWAY_COLOR + ";'>" + an + "</div>" +
            "<div style='font-size:28px;font-weight:800;color:" + textMain + ";'>xG " + axg.toFixed(2) + "</div>" +
            "<div style='font-size:11px;color:" + textMuted + ";'>" + ash + " shots &bull; " + ag + " goal" + (ag!==1?"s":"") + "</div></div></div>" +
            "<div style='margin-top:12px;height:6px;border-radius:3px;background:" + AWAY_COLOR + ";overflow:hidden;'>" +
            "<div style='height:100%;width:" + hp + "%;background:" + HOME_COLOR + ";border-radius:3px;'></div></div>" +
            "<div style='display:flex;justify-content:space-between;margin-top:4px;font-size:10px;color:" + textMuted + ";'><span>" + hp + "% xG share</span><span>" + (100-hp) + "%</span></div></div>";
    }

    function pitchSVG(shots, homeId, awayId) {
        const W=700, H=460;
        const px = m => (m*W/105).toFixed(1);
        const py = m => (m*H/68).toFixed(1);
        const maxXg = shots.reduce((max,s)=>Math.max(max,s.expected_goals||0),0.01);

        const svgShots = shots.map(s => {
            const isHome = s.team_id === homeId;
            const col    = s.event_type==="Goal" ? "#22c55e" : (isHome ? HOME_COLOR : AWAY_COLOR);
            const xg     = s.expected_goals || 0;
            const r      = Math.max(5, Math.min(22, 6 + (xg/maxXg)*16)).toFixed(1);
            let cx = px(s.x || 52.5);
            let cy = py(s.y || 34.0);
            if (!isHome) {
                cx = (W - cx).toFixed(1);
                cy = (H - cy).toFixed(1);
            }
            const name  = s.player_name || "Unknown";
            const type  = s.event_type  || "Shot";
            const min   = s.minute !== undefined ? s.minute + "'" : "";
            const tip   = name + " (" + type + " " + min + ") — xG: " + xg.toFixed(2);
            return "<circle cx='" + cx + "' cy='" + cy + "' r='" + r + "' fill='" + col + "' fill-opacity='0.75' stroke='#ffffff' stroke-width='1.5' class='sm-shot-node' data-tip=\"" + tip.replace(/"/g,"&quot;") + "\" style='cursor:pointer;transition:transform 0.1s;'/>";
        }).join("");

        return "<div style='background:" + pitchGreen + ";border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.3);position:relative;'>" +
            "<svg viewBox='0 0 " + W + " " + H + "' style='width:100%;height:auto;display:block;'>" +
            "<rect width='" + W + "' height='" + H + "' fill='" + pitchGreen + "'/>" +
            "<rect x='0' y='0' width='" + W/2 + "' height='" + H + "' fill='" + pitchAlt + "' fill-opacity='0.25'/>" +
            "<rect x='0' y='0' width='" + W + "' height='" + H + "' fill='none' stroke='" + pitchLine + "' stroke-width='2'/>" +
            "<line x1='" + W/2 + "' y1='0' x2='" + W/2 + "' y2='" + H + "' stroke='" + pitchLine + "' stroke-width='2'/>" +
            "<circle cx='" + W/2 + "' cy='" + H/2 + "' r='60' fill='none' stroke='" + pitchLine + "' stroke-width='2'/>" +
            "<circle cx='" + W/2 + "' cy='" + H/2 + "' r='3' fill='" + pitchLine + "'/>" +
            "<rect x='0' y='" + py(13.84) + "' width='" + px(16.5) + "' height='" + py(40.32) + "' fill='none' stroke='" + pitchLine + "' stroke-width='2'/>" +
            "<rect x='0' y='" + py(24.84) + "' width='" + px(5.5) + "' height='" + py(18.32) + "' fill='none' stroke='" + pitchLine + "' stroke-width='2'/>" +
            "<circle cx='" + px(11) + "' cy='" + H/2 + "' r='3' fill='" + pitchLine + "'/>" +
            "<rect x='" + (W - px(16.5)) + "' y='" + py(13.84) + "' width='" + px(16.5) + "' height='" + py(40.32) + "' fill='none' stroke='" + pitchLine + "' stroke-width='2'/>" +
            "<rect x='" + (W - px(5.5)) + "' y='" + py(24.84) + "' width='" + px(5.5) + "' height='" + py(18.32) + "' fill='none' stroke='" + pitchLine + "' stroke-width='2'/>" +
            "<circle cx='" + (W - px(11)) + "' cy='" + H/2 + "' r='3' fill='" + pitchLine + "'/>" +
            svgShots +
            "</svg></div>";
    }

    function goalMouth(shots, homeId, homeName, awayId, awayName) {
        const W=180, H=120;
        const targetShots = shots.filter(s => s.z !== undefined && s.z !== null);
        const dots = targetShots.map(s => {
            const isHome = s.team_id === homeId;
            const col    = s.event_type==="Goal" ? "#22c55e" : (isHome ? HOME_COLOR : AWAY_COLOR);
            const gx     = Math.max(10, Math.min(W-10, (s.y_target || 34)/68 * W)).toFixed(1);
            const gy     = Math.max(10, Math.min(H-10, H - (s.z || 1.2)/2.44 * H)).toFixed(1);
            const name   = s.player_name || "Shot";
            const xg     = s.expected_goals ? s.expected_goals.toFixed(2) : "0.00";
            return "<circle cx='" + gx + "' cy='" + gy + "' r='5' fill='" + col + "' stroke='#ffffff' stroke-width='1' class='sm-shot-node' data-tip=\"" + name.replace(/"/g,"&quot;") + " — xG " + xg + "\" style='cursor:pointer;'/>";
        }).join("");

        return "<div style='background:" + cardBg + ";border:1px solid " + border + ";border-radius:12px;padding:12px;'>" +
            "<div style='font-size:11px;font-weight:700;color:" + textMain + ";margin-bottom:8px;'>Goal Target Placement</div>" +
            "<div style='position:relative;background:rgba(0,0,0,0.2);border:2px solid " + pitchLine + ";border-bottom:3px solid #ffffff;border-radius:4px 4px 0 0;'>" +
            "<svg viewBox='0 0 " + W + " " + H + "' style='width:100%;height:auto;display:block;'>" +
            "<rect width='" + W + "' height='" + H + "' fill='none'/>" +
            "<line x1='0' y1='" + H/2 + "' x2='" + W + "' y2='" + H/2 + "' stroke='rgba(255,255,255,0.15)' stroke-dasharray='4'/>" +
            dots +
            "</svg></div>" +
            "<div style='font-size:10px;color:" + textMuted + ";margin-top:6px;text-align:center;'>Goal Frame (Front View)</div></div>";
    }

    function xgTimeline(shots, homeId, awayId, homeName, awayName) {
        let hCumulative = 0, aCumulative = 0;
        const sorted = [...shots].sort((a,b)=>(a.minute||0)-(b.minute||0));
        const points = [];

        sorted.forEach(s => {
            const min = s.minute || 0;
            const xg  = s.expected_goals || 0;
            if (s.team_id === homeId) hCumulative += xg;
            else if (s.team_id === awayId) aCumulative += xg;
            points.push({ min, hXg: hCumulative, aXg: aCumulative, player: s.player_name, type: s.event_type, team: s.team_id === homeId ? homeName : awayName });
        });

        const maxXg = Math.max(hCumulative, aCumulative, 1);
        const W=700, H=100;
        const px = m => (m/90 * W).toFixed(1);
        const py = xg => (H - (xg/maxXg * (H-20)) - 10).toFixed(1);

        let hPath = "M 0 " + py(0);
        let aPath = "M 0 " + py(0);
        points.forEach(p => {
            hPath += " L " + px(p.min) + " " + py(p.hXg);
            aPath += " L " + px(p.min) + " " + py(p.aXg);
        });
        hPath += " L " + W + " " + py(hCumulative);
        aPath += " L " + W + " " + py(aCumulative);

        return "<div style='background:" + cardBg + ";border:1px solid " + border + ";border-radius:12px;padding:16px;margin-top:16px;'>" +
            "<div style='font-size:12px;font-weight:700;color:" + textMain + ";margin-bottom:10px;'>Cumulative xG Timeline</div>" +
            "<svg viewBox='0 0 " + W + " " + H + "' style='width:100%;height:auto;display:block;'>" +
            "<path d='" + hPath + "' fill='none' stroke='" + HOME_COLOR + "' stroke-width='2.5'/>" +
            "<path d='" + aPath + "' fill='none' stroke='" + AWAY_COLOR + "' stroke-width='2.5'/>" +
            "</svg>" +
            "<div style='display:flex;justify-content:space-between;font-size:10px;color:" + textMuted + ";margin-top:4px;'><span>0'</span><span>45'</span><span>90'</span></div></div>";
    }

    function shotLog(shots, homeId, homeName, awayId, awayName) {
        const rows = shots.slice().sort((a,b)=>(b.minute||0)-(a.minute||0)).map(s => {
            const isHome = s.team_id === homeId;
            const team   = isHome ? homeName : awayName;
            const col    = isHome ? HOME_COLOR : AWAY_COLOR;
            const isGoal = s.event_type === "Goal";
            return "<tr style='border-bottom:1px solid " + border + ";'>" +
                "<td style='padding:8px;font-weight:700;color:" + textMain + ";'>" + (s.minute||0) + "'</td>" +
                "<td style='padding:8px;color:" + col + ";font-weight:600;'>" + team + "</td>" +
                "<td style='padding:8px;color:" + textMain + ";font-weight:600;'>" + (s.player_name||"Shot") + "</td>" +
                "<td style='padding:8px;'><span style='font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:" + (isGoal?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.06)") + ";color:" + (isGoal?"#22c55e":textMuted) + ";'>" + (s.event_type||"Shot") + "</span></td>" +
                "<td style='padding:8px;text-align:right;font-weight:700;color:" + textMain + ";'>" + (s.expected_goals ? s.expected_goals.toFixed(2) : "0.00") + "</td>" +
                "</tr>";
        }).join("");

        return "<div style='background:" + cardBg + ";border:1px solid " + border + ";border-radius:12px;padding:16px;margin-top:16px;'>" +
            "<div style='font-size:12px;font-weight:700;color:" + textMain + ";margin-bottom:10px;'>Detailed Shot Log</div>" +
            "<div style='max-height:240px;overflow-y:auto;'><table style='width:100%;border-collapse:collapse;font-size:12px;'>" +
            "<thead><tr style='border-bottom:1px solid " + border + ";color:" + textMuted + ";font-size:10px;text-transform:uppercase;'>" +
            "<th style='padding:6px;text-align:left;'>Min</th><th style='padding:6px;text-align:left;'>Team</th><th style='padding:6px;text-align:left;'>Player</th><th style='padding:6px;text-align:left;'>Result</th><th style='padding:6px;text-align:right;'>xG</th>" +
            "</tr></thead><tbody>" + rows + "</tbody></table></div></div>";
    }

    function attachTooltips() {
        container.querySelectorAll(".sm-shot-node").forEach(node => {
            node.addEventListener("mouseenter", (e) => {
                const tipText = node.dataset.tip;
                if (!tipText) return;
                let tt = container.querySelector("#sm-tooltip");
                if (!tt) {
                    tt = document.createElement("div");
                    tt.id = "sm-tooltip";
                    tt.style.cssText = "position:fixed;z-index:9999;padding:6px 10px;background:rgba(15,23,42,0.95);color:#f8fafc;font-size:11px;font-weight:600;border-radius:6px;border:1px solid rgba(255,255,255,0.15);pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,0.5);";
                    document.body.appendChild(tt);
                }
                tt.innerText = tipText;
                tt.style.display = "block";
                const rect = node.getBoundingClientRect();
                tt.style.left = (rect.left + window.scrollX + 12) + "px";
                tt.style.top  = (rect.top  + window.scrollY - 24) + "px";
            });
            node.addEventListener("mouseleave", () => {
                const tt = document.querySelector("#sm-tooltip");
                if (tt) tt.style.display = "none";
            });
        });
    }

    mountChrome();
}
