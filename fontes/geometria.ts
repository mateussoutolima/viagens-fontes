// Ferramenta avulsa: zona de vento de 60 km/h de ciclones passados do GDACS, para recalcular replays.
// Uso: node fontes/geometria.ts TC-1001211:25 TC-1001214:22 ...  → JSON { "TC-1001211": "<zona60>" | null } no stdout.
// Recebe só ids de evento do GDACS; nada de viagem passa por aqui.
import { zonaDeVento } from './adaptadores/outros.ts';

const out: Record<string, string | null> = {};
for (const arg of process.argv.slice(2)) {
  const m = /^TC-(\d+):(\d+)$/.exec(arg);
  if (!m) throw new Error(`argumento inválido: ${arg} (use TC-<eventid>:<episodeid>)`);
  const url = `https://www.gdacs.org/gdacsapi/api/polygons/getgeometry?eventtype=TC&eventid=${m[1]}&episodeid=${m[2]}`;
  const r = await fetch(url);
  out[`TC-${m[1]}`] = r.ok ? zonaDeVento(await r.json()) : null;
  console.error(`${arg}: HTTP ${r.status}`);
}
console.log(JSON.stringify(out, null, 1));
