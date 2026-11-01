// FT7 GDACS, FT22 câmbio (Frankfurter/BCE) e as páginas vigiadas por hash (catalogo/paginas.json).
import { normalizarHtml, type Seletor } from '../nucleo/normalizar.ts';
import type { Fonte, HttpPort, Snapshot } from '../nucleo/tipos.ts';
import { CAIXA } from './paises.ts';

type Bruto = Omit<Snapshot, 'hash'>;

async function obter(http: HttpPort, url: string): Promise<string> {
  const r = await http(url);
  if (r.status !== 200) throw new Error(`${url}: HTTP ${r.status}`);
  return r.texto;
}

const somarDias = (iso: string, d: number) => new Date(Date.parse(iso) + d * 864e5).toISOString().slice(0, 10);

export const gdacs: Fonte = {
  id: 'gdacs', nome: 'GDACS (ONU/Comissão Europeia)', licenca: 'GDACS: uso livre com atribuição', grupo: 'perigos',
  async coletar(http, agora) {
    const url = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC;EQ;FL'
      + `&alertlevel=Orange;Red&fromDate=${somarDias(agora, -10)}&toDate=${somarDias(agora, 1)}`;
    const txt = await obter(http, url);
    const d = txt.trim() ? JSON.parse(txt) : { features: [] };
    const out: Bruto[] = [];
    for (const f of d.features ?? []) {
      const [lon, lat] = f.geometry?.coordinates ?? [];
      if (!(lon >= CAIXA.lonMin && lon <= CAIXA.lonMax && lat >= CAIXA.latMin && lat <= CAIXA.latMax)) continue;
      const p = f.properties ?? {};
      out.push({
        fonte: 'gdacs', chave: `${p.eventtype}-${p.eventid}`,
        url: p.url?.report ?? 'https://www.gdacs.org',
        campos: {
          tipo: p.eventtype ?? null, nome: p.eventname || p.name || null, alerta: p.alertlevel ?? null,
          alerta_episodio: p.episodealertlevel ?? null, paises: p.country ?? null,
          de: String(p.fromdate ?? '').slice(0, 10) || null, ate: String(p.todate ?? '').slice(0, 10) || null,
          atual: p.iscurrent === 'true' || p.iscurrent === true,
          lon: Math.round(lon * 10) / 10, lat: Math.round(lat * 10) / 10,
        },
        texto: '',
        coletado_em: agora,
      });
    }
    return out;
  },
};

export const fxFrankfurter: Fonte = {
  id: 'fx_frankfurter', nome: 'Frankfurter (taxas de referência do BCE)', licenca: 'dados do BCE, uso livre', grupo: 'diaria',
  async coletar(http, agora) {
    const url = 'https://api.frankfurter.dev/v1/latest?base=BRL&symbols=USD,CNY,JPY,PHP,EUR';
    const d = JSON.parse(await obter(http, url));
    if (!d.rates?.USD) throw new Error('Frankfurter: sem USD');
    const campos: Snapshot['campos'] = { data: d.date };
    for (const k of Object.keys(d.rates).sort()) campos[k] = String(d.rates[k]);
    return [{ fonte: 'fx_frankfurter', chave: 'BRL', url, campos, texto: '', coletado_em: agora }];
  },
};

export interface PaginaVigiada {
  id: string;
  fonte: string;
  pais: string;
  url: string;
  descricao: string;
  seletor: Seletor;
}

/** Uma Fonte por página: uma página quebrada não derruba as outras. */
export function fontesDePaginas(paginas: PaginaVigiada[]): Fonte[] {
  return paginas.map(p => ({
    id: p.id, nome: p.descricao, licenca: 'link e trecho citado, sem republicação', grupo: 'entrada' as const,
    async coletar(http: HttpPort, agora: string) {
      const texto = normalizarHtml(await obter(http, p.url), p.seletor);
      if (texto.length < 200) throw new Error(`${p.id}: texto curto demais (${texto.length}); seletor quebrado?`);
      return [{ fonte: p.fonte, chave: p.id, pais: p.pais, url: p.url, campos: {}, texto, coletado_em: agora }];
    },
  }));
}
