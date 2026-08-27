// Shot Map Component - powered by PitchAPI (EPL only)
// Pitch: 105m x 68m. x=105 = attacking goal. Posts: y=30.34 & y=37.66.

export function renderShotMap(container, state, actions) {
    const isLight = document.documentElement.classList.contains("light-theme");

    // Always read LIVE from dataset — never cache as const (stale closure bug)
    const getDate       = () => container.dataset.smDate       || new Date().toISOString().slice(0,10);
    const getMatchId    = () => container.dataset.smMatchId    || "";
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

    // Mount chrome once on first load
    function mountChrome() {
        renderChrome();
        // Load matches for the initial date
        const ms = container.querySelector("#sm-match-select");
        const currentDate = getDate();
        if (currentDate && ms) loadMatches(currentDate, ms);
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
        if (a) a.innerHTML = "<div style='padding:60px;text-align:center;color:" + textMuted + ";'><p style=\"font-size:14px;font-weight:600;color:" + textMain + ";\">Select a match to view the shot map</p><p style='font-size:12px;'>Choose a date and pick a Premier League match above</p></div>";
    }

    function renderChrome() {
        const today = new Date().toISOString().slice(0,10);
        const currentDate   = getDate();
        const currentFilter = getTeamFilter();
        const filterBtns = ["all","home","away"].map(f =>
            "<button data-smfilter='" + f + "' style='padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid " + border + ";background:" + (currentFilter===f?"rgba(59,130,246,0.15)":cardBg) + ";color:" + (currentFilter===f?"#3b82f6":textMuted) + ";'>" +
            f.charAt(0).toUpperCase()+f.slice(1) + "</button>"
        ).join("");

        container.innerHTML =
            "<div style='padding:20px 24px 0;max-width:1200px;margin:0 auto;'>" +
            "<div style='display:flex;align-items:center;gap:12px;margin-bottom:20px;'>" +
            "<div style='width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0;'>" +
            "<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><line x1='22' x2='18' y1='12' y2='12'/><line x1='6' x2='2' y1='12' y2='12'/><line x1='12' x2='12' y1='6' y2='2'/><line x1='12' x2='12' y1='22' y2='18'/></svg></div>" +
            "<div><h2 style='margin:0;font-size:18px;font-weight:700;color:" + textMain + ";'>Shot Map</h2>" +
            "<p style='margin:0;font-size:12px;color:" + textMuted + ";'>EPL shot-level xG data &bull; Powered by PitchAPI</p></div></div>" +
            "<div style='display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;align-items:flex-end;'>" +
            "<div><label style='display:block;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:" + textMuted + ";margin-bottom:6px;'>Match Date</label>" +
            "<input type='date' id='sm-date-picker' value='" + currentDate + "' max='" + today + "' style='background:" + cardBg + ";border:1px solid " + border + ";border-radius:8px;padding:8px 12px;font-size:13px;color:" + textMain + ";cursor:pointer;outline:none;height:38px;'></div>" +
            "<div style='flex:1;min-width:240px;'><label style='display:block;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:" + textMuted + ";margin-bottom:6px;'>Match</label>" +
            "<select id='sm-match-select' style='width:100%;background:" + cardBg + ";border:1px solid " + border + ";border-radius:8px;padding:8px 12px;font-size:13px;color:" + textMain + ";cursor:pointer;outline:none;height:38px;'><option value=''>- Pick a date to load matches -</option></select></div>" +
            "<div><label style='display:block;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:" + textMuted + ";margin-bottom:6px;'>Show</label><div style='display:flex;gap:4px;'>" + filterBtns + "</div></div></div>" +
            "<div style='display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;font-size:11px;color:" + textMuted + ";'>" +
            "<span style='color:#22c55e;'>&#9899;</span> Goal &nbsp;" +
            "<span style='color:" + HOME_COLOR + ";'>&#9899;</span> On Target (Home) &nbsp;" +
            "<span style='color:" + AWAY_COLOR + ";'>&#9899;</span> On Target (Away) &nbsp;" +
            "Bubble size = xG</div></div>" +
            "<div id='sm-shot-area' style='padding:0 24px 24px;max-width:1200px;margin:0 auto;'></div>";

        const dp = container.querySelector("#sm-date-picker");
        const ms = container.querySelector("#sm-match-select");
        dp.addEventListener("change", () => {
            container.dataset.smDate = dp.value;
            container.dataset.smMatchId = "";
            container.dataset.smMatchObj = "";
            loadMatches(dp.value, ms);
            renderEmptyPrompt();
        });
        ms.addEventListener("change", () => {
            const opt = ms.options[ms.selectedIndex];
            container.dataset.smMatchId = ms.value;
            container.dataset.smMatchObj = opt.dataset.matchObj || "";
            refreshShots();
        });
        container.querySelectorAll("[data-smfilter]").forEach(btn => {
            btn.addEventListener("click", () => {
                container.dataset.smTeamFilter = btn.dataset.smfilter;
                refreshShots();
            });
        });
    }

    async function loadMatches(date, selectEl) {
        selectEl.innerHTML = "<option value=''>Loading matches...</option>";
        try {
            const res = await fetch("/api/pitchapi/date/" + date + "?league=epl");
            if (!res.ok) throw new Error("HTTP " + res.status);
            const json = await res.json();
            const matches = json.matches || [];
            if (matches.length === 0) {
                selectEl.innerHTML = "<option value=''>No EPL matches on this date</option>";
                renderEmptyPrompt(); return;
            }
            selectEl.innerHTML = "<option value=''>- Select a match -</option>" +
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
            console.error("loadMatches:", e);
        }
    }

    function renderShotContent(sJson, lJson, mObj) {
        const shotArea = container.querySelector("#sm-shot-area");
        if (!shotArea) return;
        if (!sJson || !sJson.success || !sJson.data) {
            shotArea.innerHTML = "<div style='padding:24px;color:" + textMuted + ";font-size:13px;'>No shot data available.</div>"; return;
        }
        const sides = sJson.data.shots;
        if (!sides || sides.length === 0) {
            shotArea.innerHTML = "<div style='padding:24px;color:" + textMuted + ";font-size:13px;'>Shot data not yet rated for this match.</div>"; return;
        }
        let allShots = [];
        let homeId   = mObj ? mObj.home_team.id   : null;
        let awayId   = mObj ? mObj.away_team.id   : null;
        let homeName = mObj ? mObj.home_team.name : "Home";
        let awayName = mObj ? mObj.away_team.name : "Away";
        sides.forEach(side => {
            if (!homeId) homeId = sides[0].team_id;
            if (!awayId && sides.length > 1) awayId = sides[1].team_id;
            (side.shots||[]).forEach(s => allShots.push(Object.assign({},s,{team_id:side.team_id})));
        });
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
        const MIN_R=5, MAX_R=22;
        const r = xg => (MIN_R+Math.sqrt((xg||0.001)/maxXg)*(MAX_R-MIN_R)).toFixed(1);
        const col = s => s.event_type==="Goal"?"#22c55e":s.is_on_target?(s.team_id===homeId?HOME_COLOR:AWAY_COLOR):(isLight?"#94a3b8":"#475569");
        const op  = s => s.event_type==="Goal"?"0.95":s.is_on_target?"0.75":"0.45";

        const stripes = [0,1,2,3,4,5,6].map(i =>
            "<rect x='" + px(i*15) + "' y='0' width='" + px(15) + "' height='" + H + "' fill='" + (i%2===0?pitchGreen:pitchAlt) + "' opacity='0.5'/>"
        ).join("");

        function dot(s) {
            const cx=px(s.x||0), cy=py(s.y||0), rad=r(s.expected_goals);
            const c=col(s), o=op(s), isG=s.event_type==="Goal";
            const pl=s.player?s.player.name:"Unknown";
            const min=(s.minute||0)+(s.minute_added?"+"+s.minute_added:"");
            const tip=pl+"|"+min+"'|xG "+(s.expected_goals||0).toFixed(3)+"|"+(s.shot_type||"")+(s.situation?"|"+s.situation:"");
            return "<g class='sm-shot' data-tip=\""+tip+"\" style='cursor:pointer;'>" +
                "<circle cx='"+cx+"' cy='"+cy+"' r='"+rad+"' fill='"+c+"' opacity='"+o+"' stroke='"+(isG?"#fff":"none")+"' stroke-width='"+(isG?"1.5":"0")+"'/>" +
                (isG?"<text x='"+cx+"' y='"+(parseFloat(cy)+4)+"' text-anchor='middle' font-size='10' fill='white' font-family='sans-serif'>&#9917;</text>":"") +
                "</g>";
        }
        const nonGoals = shots.filter(s=>s.event_type!=="Goal").map(dot).join("");
        const goals    = shots.filter(s=>s.event_type==="Goal").map(dot).join("");

        return "<div><div style='font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:" + textMuted + ";margin-bottom:8px;'>Shot Map (all shots attack right)</div>" +
            "<svg viewBox='0 0 "+W+" "+H+"' xmlns='http://www.w3.org/2000/svg' style='width:100%;border-radius:10px;border:1px solid "+border+";display:block;'>" +
            "<rect x='0' y='0' width='"+W+"' height='"+H+"' fill='"+pitchGreen+"' rx='4'/>" + stripes +
            "<line x1='"+px(52.5)+"' y1='0' x2='"+px(52.5)+"' y2='"+H+"' stroke='"+pitchLine+"' stroke-width='1.5'/>" +
            "<circle cx='"+px(52.5)+"' cy='"+py(34)+"' r='"+py(9.15)+"' fill='none' stroke='"+pitchLine+"' stroke-width='1.5'/>" +
            "<circle cx='"+px(52.5)+"' cy='"+py(34)+"' r='3' fill='"+pitchLine+"'/>" +
            "<rect x='1' y='1' width='"+(W-2)+"' height='"+(H-2)+"' fill='none' stroke='"+pitchLine+"' stroke-width='2'/>" +
            "<rect x='"+px(0)+"' y='"+py(13.84)+"' width='"+px(16.5)+"' height='"+py(40.32)+"' fill='none' stroke='"+pitchLine+"' stroke-width='1.5'/>" +
            "<rect x='"+px(0)+"' y='"+py(24.84)+"' width='"+px(5.5)+"' height='"+py(18.32)+"' fill='none' stroke='"+pitchLine+"' stroke-width='1.5'/>" +
            "<circle cx='"+px(11)+"' cy='"+py(34)+"' r='2.5' fill='"+pitchLine+"'/>" +
            "<rect x='"+px(88.5)+"' y='"+py(13.84)+"' width='"+px(16.5)+"' height='"+py(40.32)+"' fill='none' stroke='"+pitchLine+"' stroke-width='1.5'/>" +
            "<rect x='"+px(99.5)+"' y='"+py(24.84)+"' width='"+px(5.5)+"' height='"+py(18.32)+"' fill='none' stroke='"+pitchLine+"' stroke-width='1.5'/>" +
            "<circle cx='"+px(94)+"' cy='"+py(34)+"' r='2.5' fill='"+pitchLine+"'/>" +
            "<rect x='"+px(-2)+"' y='"+py(30.34)+"' width='"+px(2)+"' height='"+py(7.32)+"' fill='rgba(255,255,255,0.3)' stroke='"+pitchLine+"' stroke-width='1.5'/>" +
            "<rect x='"+px(105)+"' y='"+py(30.34)+"' width='"+px(2)+"' height='"+py(7.32)+"' fill='rgba(255,255,255,0.3)' stroke='"+pitchLine+"' stroke-width='1.5'/>" +
            "<text x='"+px(90)+"' y='"+(H-8)+"' font-size='10' fill='"+pitchLine+"' text-anchor='middle' font-family='sans-serif'>Attack &gt;&gt;&gt;</text>" +
            nonGoals + goals + "</svg></div>";
    }

    function goalMouth(shots, homeId, hn, awayId, an) {
        const GW=180, GH=100, PAD=20;
        const GOAL_W=7.32, GOAL_H=2.44, PY_LEFT=30.34;
        const TW=GW+PAD*2, TH=GH+PAD*2+20;
        const my = gy => (PAD+((gy-PY_LEFT)/GOAL_W)*GW).toFixed(1);
        const mz = gz => (PAD+(1-(gz/(GOAL_H*1.5)))*GH).toFixed(1);
        const cbY = mz(2.44), pL = my(PY_LEFT), pR = my(PY_LEFT+GOAL_W);
        const onT = shots.filter(s=>s.is_on_target&&s.goal_crossed_y!=null);
        const gridV = [1,2,3,4,5,6].map(i=>{
            const x=(parseFloat(pL)+i*(parseFloat(pR)-parseFloat(pL))/7).toFixed(1);
            return "<line x1='"+x+"' y1='"+cbY+"' x2='"+x+"' y2='"+(GH+PAD)+"' stroke='"+pitchLine+"' stroke-width='0.5' opacity='0.4'/>";
        }).join("");
        const gridH = [1,2,3,4].map(i=>{
            const y=(parseFloat(cbY)+i*(GH+PAD-parseFloat(cbY))/5).toFixed(1);
            return "<line x1='"+pL+"' y1='"+y+"' x2='"+pR+"' y2='"+y+"' stroke='"+pitchLine+"' stroke-width='0.5' opacity='0.4'/>";
        }).join("");
        const dots = onT.map(s=>{
            const sx=my(s.goal_crossed_y), sy=mz(Math.min(s.goal_crossed_z||0,GOAL_H*1.4));
            const isG=s.event_type==="Goal";
            const c=isG?"#22c55e":(s.team_id===homeId?HOME_COLOR:AWAY_COLOR);
            const tip=(s.player?s.player.name:"")+"|"+s.minute+"'|xGOT "+(s.expected_goals_on_target||0).toFixed(3)+"|"+s.event_type;
            return "<circle cx='"+sx+"' cy='"+sy+"' r='"+(isG?7:5)+"' fill='"+c+"' opacity='"+(isG?0.9:0.65)+"' stroke='"+(isG?"#fff":"none")+"' stroke-width='"+(isG?1.5:0)+"' class='sm-shot' data-tip=\""+tip+"\" style='cursor:pointer;'/>";
        }).join("");
        return "<div style='background:"+cardBg+";border:1px solid "+border+";border-radius:10px;padding:12px;'>" +
            "<div style='font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:"+textMuted+";margin-bottom:8px;'>Goal Mouth</div>" +
            "<svg viewBox='0 0 "+TW+" "+TH+"' xmlns='http://www.w3.org/2000/svg' style='width:100%;display:block;'>" +
            "<rect x='"+pL+"' y='"+cbY+"' width='"+(parseFloat(pR)-parseFloat(pL))+"' height='"+(GH+PAD-parseFloat(cbY))+"' fill='rgba(255,255,255,0.04)' stroke='"+pitchLine+"' stroke-width='1.5' rx='2'/>" +
            gridV+gridH +
            "<line x1='"+pL+"' y1='"+cbY+"' x2='"+pL+"' y2='"+(GH+PAD)+"' stroke='white' stroke-width='3'/>" +
            "<line x1='"+pR+"' y1='"+cbY+"' x2='"+pR+"' y2='"+(GH+PAD)+"' stroke='white' stroke-width='3'/>" +
            "<line x1='"+pL+"' y1='"+cbY+"' x2='"+pR+"' y2='"+cbY+"' stroke='white' stroke-width='3'/>" +
            dots +
            "<text x='"+TW/2+"' y='"+(TH-4)+"' text-anchor='middle' font-size='9' fill='"+textMuted+"' font-family='sans-serif'>"+onT.length+" on-target shot"+(onT.length!==1?"s":"")+"</text>" +
            "</svg>" +
            "<div style='display:flex;gap:8px;margin-top:6px;justify-content:center;flex-wrap:wrap;font-size:10px;color:"+textMuted+";'>" +
            "<span><span style='color:"+HOME_COLOR+";'>&#9899;</span> "+hn+"</span>" +
            "<span><span style='color:"+AWAY_COLOR+";'>&#9899;</span> "+an+"</span>" +
            "<span><span style='color:#22c55e;'>&#9899;</span> Goal</span></div></div>";
    }

    function xgTimeline(shots, homeId, awayId, hn, an) {
        const MAX=95, PTS=96;
        let hTotal=0, aTotal=0;
        const hLine=new Array(PTS).fill(0), aLine=new Array(PTS).fill(0);
        shots.forEach(s=>{
            const min=Math.min(Math.round(s.minute||0)+(s.minute_added||0),MAX);
            if(s.team_id===homeId) hTotal+=(s.expected_goals||0);
            else aTotal+=(s.expected_goals||0);
            for(let m=min;m<=MAX;m++){
                if(s.team_id===homeId) hLine[m]=Math.max(hLine[m],hTotal);
                else aLine[m]=Math.max(aLine[m],aTotal);
            }
        });
        const TW=680, TH=80;
        const mxY=Math.max(...hLine,...aLine,0.5);
        const sX=TW/MAX;
        const path=line=>line.map((v,i)=>(i===0?"M":"L")+(i*sX).toFixed(1)+","+(TH-v*(TH/mxY)).toFixed(1)).join(" ");
        const vLines=[45,90].map(m=>
            "<line x1='"+(m*sX).toFixed(1)+"' y1='0' x2='"+(m*sX).toFixed(1)+"' y2='"+TH+"' stroke='"+textMuted+"' stroke-width='1' opacity='0.25' stroke-dasharray='4,4'/>" +
            "<text x='"+(m*sX).toFixed(1)+"' y='"+(TH+12)+"' text-anchor='middle' font-size='9' fill='"+textMuted+"' font-family='sans-serif'>"+m+"'</text>"
        ).join("");
        return "<div style='background:"+cardBg+";border:1px solid "+border+";border-radius:10px;padding:14px 16px;margin-top:16px;'>" +
            "<div style='font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:"+textMuted+";margin-bottom:8px;'>Cumulative xG Timeline</div>" +
            "<svg viewBox='0 0 "+TW+" "+(TH+16)+"' xmlns='http://www.w3.org/2000/svg' style='width:100%;display:block;'>" +
            vLines +
            "<path d='"+path(hLine)+"' fill='none' stroke='"+HOME_COLOR+"' stroke-width='2' opacity='0.85'/>" +
            "<path d='"+path(aLine)+"' fill='none' stroke='"+AWAY_COLOR+"' stroke-width='2' opacity='0.85'/>" +
            "</svg>" +
            "<div style='display:flex;gap:16px;margin-top:6px;font-size:10px;color:"+textMuted+";'>" +
            "<span style='color:"+HOME_COLOR+";'>&#9632;</span> "+hn+" ("+hTotal.toFixed(2)+" xG)" +
            " &nbsp; <span style='color:"+AWAY_COLOR+";'>&#9632;</span> "+an+" ("+aTotal.toFixed(2)+" xG)</div></div>";
    }

    function shotLog(shots, homeId, hn, awayId, an) {
        const sorted=[...shots].sort((a,b)=>(a.minute||0)-(b.minute||0));
        const thStyle="padding:7px 10px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:"+textMuted+";text-align:left;font-weight:600;white-space:nowrap;";
        const headers=["Min","Team","Player","Foot","Situation","xG","xGOT","Outcome"].map(h=>"<th style='"+thStyle+"'>"+h+"</th>").join("");
        const rows=sorted.map(s=>{
            const isH=s.team_id===homeId;
            const tc=isH?HOME_COLOR:AWAY_COLOR;
            const tn=isH?hn:an;
            const xg=(s.expected_goals||0).toFixed(3);
            const xgot=s.expected_goals_on_target!=null?s.expected_goals_on_target.toFixed(3):"-";
            const out=s.event_type==="Goal"?"&#9917; Goal":s.is_on_target?"On Target":s.is_blocked?"Blocked":"Off Target";
            const oc=s.event_type==="Goal"?"#22c55e":s.is_on_target?"#3b82f6":textMuted;
            const min=(s.minute||0)+(s.minute_added?"+"+s.minute_added:"");
            return "<tr style='border-bottom:1px solid "+border+";'>" +
                "<td style='padding:8px 10px;font-size:12px;color:"+textMuted+";'>"+min+"'</td>" +
                "<td style='padding:8px 10px;font-size:12px;color:"+tc+";font-weight:600;'>"+tn+"</td>" +
                "<td style='padding:8px 10px;font-size:12px;color:"+textMain+";'>"+(s.player?s.player.name:"-")+"</td>" +
                "<td style='padding:8px 10px;font-size:12px;color:"+textMuted+";'>"+(s.shot_type||"-")+"</td>" +
                "<td style='padding:8px 10px;font-size:12px;color:"+textMuted+";'>"+(s.situation||"-")+"</td>" +
                "<td style='padding:8px 10px;font-size:12px;color:#8b5cf6;font-family:monospace;'>"+xg+"</td>" +
                "<td style='padding:8px 10px;font-size:12px;color:#a78bfa;font-family:monospace;'>"+xgot+"</td>" +
                "<td style='padding:8px 10px;font-size:12px;color:"+oc+";font-weight:600;'>"+out+"</td></tr>";
        }).join("");
        return "<div style='margin-top:16px;background:"+cardBg+";border:1px solid "+border+";border-radius:10px;overflow:hidden;'>" +
            "<div style='padding:10px 14px;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:"+textMuted+";border-bottom:1px solid "+border+";'>Shot Log ("+sorted.length+" shots)</div>" +
            "<div style='overflow-x:auto;'><table style='width:100%;border-collapse:collapse;min-width:600px;'>" +
            "<thead><tr style='background:rgba(0,0,0,0.1);'>"+headers+"</tr></thead>" +
            "<tbody>"+rows+"</tbody></table></div></div>";
    }

    function attachTooltips() {
        let tip=document.getElementById("sm-tooltip");
        if(!tip){
            tip=document.createElement("div"); tip.id="sm-tooltip";
            tip.style.cssText="position:fixed;z-index:9999;pointer-events:none;background:rgba(15,23,42,0.95);color:#f8fafc;border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:8px 12px;font-size:12px;max-width:280px;white-space:pre-wrap;display:none;box-shadow:0 4px 20px rgba(0,0,0,0.4);line-height:1.5;";
            document.body.appendChild(tip);
        }
        container.querySelectorAll(".sm-shot").forEach(el=>{
            el.addEventListener("mouseenter",()=>{
                tip.textContent=(el.getAttribute("data-tip")||"").replace(/\|/g,"\n");
                tip.style.display="block";
            });
            el.addEventListener("mousemove",e=>{tip.style.left=(e.clientX+14)+"px";tip.style.top=(e.clientY-28)+"px";});
            el.addEventListener("mouseleave",()=>{tip.style.display="none";});
        });
    }

    mountChrome();
}
