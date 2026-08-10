export function computeBasePPG({ minutes, appearances, totalPoints, position, teamShort, price, isPromotedOrTransfer, manualOverridePPG }) {
    let basePPG = 0.5;

    if (manualOverridePPG !== undefined && manualOverridePPG !== null) {
        basePPG = manualOverridePPG;
    } else if (minutes > 500 && appearances > 0) {
        basePPG = totalPoints / appearances;
    } else if (minutes > 0 && appearances > 0) {
        const playingRatio = Math.min(1.0, minutes / 500);
        const defaultPPG = (position === 'GKP' ? 3.0 : (position === 'DEF' ? 2.8 : (position === 'MID' ? 3.2 : 3.5)));
        basePPG = 0.5 + (defaultPPG - 0.5) * playingRatio;
    } else if (isPromotedOrTransfer) {
        basePPG = (position === 'GKP' ? 3.0 : (position === 'DEF' ? 2.8 : (position === 'MID' ? 3.2 : 3.5)));
    } else {
        basePPG = (price > 6.0) ? 2.0 : 0.5;
    }

    const TOP_TEAMS = ['MCI', 'ARS', 'LIV', 'TOT', 'CHE', 'MUN'];
    if (position === 'GKP') {
        const minGkpPpg = TOP_TEAMS.includes(teamShort) ? 3.2 : 1.8;
        basePPG = Math.max(minGkpPpg, Math.min(4.2, basePPG));
    } else if (position === 'DEF') {
        basePPG = Math.max(1.5, Math.min(4.5, basePPG));
    } else if (position === 'MID') {
        basePPG = Math.max(1.8, Math.min(6.0, basePPG));
    } else if (position === 'FWD') {
        basePPG = Math.max(2.0, Math.min(6.0, basePPG));
    }

    return basePPG;
}

export function getCleanSheetProb(diff, loc) {
    let base;
    if (diff <= 2) base = 0.48;
    else if (diff === 3) base = 0.30;
    else if (diff === 4) base = 0.18;
    else base = 0.08;

    base += (loc === 'H') ? 0.05 : -0.05;
    return Math.max(0.02, Math.min(0.65, base));
}

export function getExpectedSavePts({ position, diff, loc, saves90 }) {
    if (position !== 'GKP') return 0;

    let diffMultiplier;
    if (diff <= 2) diffMultiplier = 0.65;
    else if (diff === 3) diffMultiplier = 1.0;
    else if (diff === 4) diffMultiplier = 1.30;
    else diffMultiplier = 1.60;

    const locMultiplier = (loc === 'A') ? 1.10 : 0.92;
    const baseSaves90 = saves90 > 0 ? saves90 : 3.0;
    const expectedSavesPerGame = baseSaves90 * diffMultiplier * locMultiplier;

    return expectedSavesPerGame / 3;
}

export function computeGwPrediction({ basePPG, position, xG90, xA90, saves90, mppg, starts, chanceOfPlaying, fixture }) {
    const breakdown = { fdrMultiplier: 1.0, homeAwayAdj: 0, csAdj: 0, xgiAdj: 0, savesAdj: 0 };
    let pts = basePPG;

    if (fixture.opp !== 'BYE') {
        if (fixture.diff === 2) breakdown.fdrMultiplier = 1.12;
        else if (fixture.diff === 4) breakdown.fdrMultiplier = 0.88;
        else if (fixture.diff === 5) breakdown.fdrMultiplier = 0.70;
        pts *= breakdown.fdrMultiplier;

        breakdown.homeAwayAdj = (fixture.loc === 'H') ? 0.35 : -0.35;
        pts += breakdown.homeAwayAdj;

        if (position === 'GKP' || position === 'DEF') {
            const csProb = getCleanSheetProb(fixture.diff, fixture.loc);
            const avgCsProb = getCleanSheetProb(3, 'H');
            breakdown.csAdj = (csProb - avgCsProb) * 4;
            pts += breakdown.csAdj;

            if (position === 'GKP') {
                breakdown.savesAdj = getExpectedSavePts({ position, diff: fixture.diff, loc: fixture.loc, saves90 });
                pts += breakdown.savesAdj;
            }
        } else if (position === 'MID') {
            const csProb = getCleanSheetProb(fixture.diff, fixture.loc);
            const avgCsProb = getCleanSheetProb(3, 'H');
            breakdown.csAdj = (csProb - avgCsProb) * 1;
            pts += breakdown.csAdj;

            const xGI90 = xG90 + xA90;
            if (xGI90 > 0.1) {
                if (fixture.diff === 2) breakdown.xgiAdj = xGI90 * 0.8;
                if (fixture.diff === 5) breakdown.xgiAdj = -xGI90 * 0.6;
            }
            pts += breakdown.xgiAdj;
        } else {
            const xGI90 = xG90 + xA90;
            if (xGI90 > 0.1) {
                if (fixture.diff === 2) breakdown.xgiAdj = xGI90 * 0.8;
                if (fixture.diff === 5) breakdown.xgiAdj = -xGI90 * 0.6;
            }
            pts += breakdown.xgiAdj;
        }
    } else {
        pts = 0.0;
    }

    const chance = (chanceOfPlaying !== null && chanceOfPlaying !== undefined) ? chanceOfPlaying / 100 : 1.0;
    pts *= chance;

    const isExpectedStarter = chance > 0.8 && (mppg >= 45 || starts >= 15);
    if (isExpectedStarter && fixture.opp !== 'BYE') {
        pts = Math.max(0.8, pts);
    }

    pts = Math.max(0, Math.round(pts * 10) / 10);

    return { pts, breakdown };
}
