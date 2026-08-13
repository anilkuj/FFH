import { PLAYERS } from '../data.js';

function compareTeam(teamCode, solio) {
  let sumOurs = 0, sumSolio = 0;
  Object.entries(solio).forEach(([name, solioVal]) => {
    const p = PLAYERS.find(pl => pl.web_name === name && pl.team === teamCode);
    if (!p) {
      return;
    }
    const ours = p.predictions.slice(0,5).reduce((s,pr)=>s+pr.pts,0) / 5;
    sumOurs += ours;
    sumSolio += solioVal;
    console.log(`  ${name}: Ours=${ours.toFixed(2)}, Solio=${solioVal.toFixed(2)} (${(((ours/solioVal)-1)*100).toFixed(0)}% diff)`);
  });
  console.log(`${teamCode} Ours: ${sumOurs.toFixed(1)}, Solio: ${sumSolio.toFixed(1)} (${(((sumOurs/sumSolio)-1)*100).toFixed(0)}% higher)`);
}

console.log("Arsenal comparison:");
compareTeam('ARS', {
  Gabriel: 4.96, Saka: 4.57, Mosquera: 4.18, Raya: 3.95, 'Bruno G.': 3.88,
  Rice: 3.67, Havertz: 3.52, Tzolis: 3.41, Calafiori: 3.40, 'J.Timber': 2.86,
  'Ødegaard': 2.66, 'Gyökeres': 2.40, Eze: 2.01, Hincapie: 1.79, White: 1.57,
  Zubimendi: 1.48, Madueke: 1.24, Martinelli: 1.16, Merino: 0.91,
  'Lewis-Skelly': 0.74, 'G.Jesus': 0.48, Dowman: 0.24, Nwaneri: 0.11
});

console.log("\nMan City comparison:");
compareTeam('MCI', {
  Haaland: 6.68, Semenyo: 4.98, Anderson: 4.24, "O'Reilly": 4.08, 'Matheus N.': 3.82,
  Doku: 3.82, Gvardiol: 3.80, Donnarumma: 3.62, Foden: 3.43, Cherki: 3.22,
  'Rúben': 1.95, 'N.Gonzalez': 1.71, 'Aït-Nouri': 1.42, Savinho: 1.05, Marmoush: 0.97,
  Khusanov: 0.92, Reijnders: 0.86, 'Kovačić': 0.66, Lewis: 0.25, Grealish: 0.21
});
