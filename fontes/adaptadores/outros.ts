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

type Anel = Array<[number, number]>;
/**
 * Zona de vento de 60 km/h do ciclone (Poly_Green da geometria do GDACS, sem os WindRadii por horário).
 * Simplificada (≤ 150 vértices por anel, 0,1°) para o hash não mudar à toa. Falha → null (o app casa por país).
 */
export function zonaDeVento(geo: { features?: Array<{ geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> }> }): string | null {
  const aneis: Anel[] = [];
  for (const f of geo.features ?? []) {
    const p = f.properties ?? {};
    if (p.Class !== 'Poly_Green' || p.featuretype) continue;
    const g = f.geometry;
    const polys = g?.type === 'Polygon' ? [g.coordinates as Anel[]] : g?.type === 'MultiPolygon' ? (g.coordinates as Anel[][]) : [];
    for (const poly of polys) if (poly?.[0]?.length >= 4) aneis.push(poly[0]);
  }
  if (!aneis.length) return null;
  const r = (x: number) => Math.round(x * 10) / 10;
  const simples = aneis.map(a => {
    const passo = Math.max(1, Math.ceil(a.length / 150));
    const out: Anel = [];
    for (let i = 0; i < a.length; i += passo) {
      const pt: [number, number] = [r(a[i][0]), r(a[i][1])];
      const u = out[out.length - 1];
      if (!u || u[0] !== pt[0] || u[1] !== pt[1]) out.push(pt);
    }
    return out;
  }).filter(a => a.length >= 3);
  return simples.length ? JSON.stringify(simples) : null;
}

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
          ...(p.eventtype === 'TC' ? { zona60: await zonaDoCiclone(http, p) } : {}),
        },
        texto: '',
        coletado_em: agora,
      });
    }
    return out;
  },
};

async function zonaDoCiclone(http: HttpPort, p: { eventid?: unknown; episodeid?: unknown; url?: { geometry?: string } }): Promise<string | null> {
  const url = p.url?.geometry ?? `https://www.gdacs.org/gdacsapi/api/polygons/getgeometry?eventtype=TC&eventid=${p.eventid}&episodeid=${p.episodeid}`;
  try {
    const r = await http(url);
    return r.status === 200 && r.texto.trim() ? zonaDeVento(JSON.parse(r.texto)) : null;
  } catch { return null; }
}

/** Sismos do USGS (M ≥ 5,5 na caixa Ásia-Pacífico, últimos 10 dias). O PAGER dá o nível de impacto (green/yellow/orange/red). */
export const usgs: Fonte = {
  id: 'usgs', nome: 'USGS (sismos)', licenca: 'USGS: domínio público', grupo: 'perigos',
  async coletar(http, agora) {
    const url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=5.5'
      + `&minlatitude=${CAIXA.latMin}&maxlatitude=${CAIXA.latMax}&minlongitude=${CAIXA.lonMin}&maxlongitude=${CAIXA.lonMax}`
      + `&starttime=${somarDias(agora, -10)}&endtime=${somarDias(agora, 1)}`;
    const d = JSON.parse(await obter(http, url));
    const PAGER: Record<string, string> = { green: 'Green', yellow: 'Yellow', orange: 'Orange', red: 'Red' };
    return (d.features ?? []).map((f: any): Bruto => {
      const p = f.properties ?? {};
      const [lon, lat] = f.geometry?.coordinates ?? [];
      const dia = new Date(p.time).toISOString().slice(0, 10);
      const lugar = String(p.place ?? '');
      return {
        fonte: 'usgs', chave: String(f.id),
        url: p.url ?? 'https://earthquake.usgs.gov',
        campos: {
          tipo: 'EQ', nome: `Sismo M${p.mag} ${lugar}`.trim(), alerta: PAGER[p.alert] ?? null, magnitude: p.mag ?? null,
          paises: lugar.includes(', ') ? lugar.slice(lugar.lastIndexOf(', ') + 2) : lugar, de: dia, ate: dia,
          lon: Math.round(lon * 10) / 10, lat: Math.round(lat * 10) / 10,
        },
        texto: '',
        coletado_em: agora,
      };
    });
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
  /** Grupo do workflow (padrão: entrada, diário). */
  grupo?: 'entrada' | 'perigos';
  /** Tamanho mínimo do texto normalizado (padrão 200): abaixo disso o seletor provavelmente quebrou. */
  minimo?: number;
}

/** Uma Fonte por página: uma página quebrada não derruba as outras. */
export function fontesDePaginas(paginas: PaginaVigiada[]): Fonte[] {
  return paginas.map(p => ({
    id: p.id, nome: p.descricao, licenca: 'link e trecho citado, sem republicação', grupo: p.grupo ?? 'entrada',
    async coletar(http: HttpPort, agora: string) {
      const texto = normalizarHtml(await obter(http, p.url), p.seletor);
      if (texto.length < (p.minimo ?? 200)) throw new Error(`${p.id}: texto curto demais (${texto.length}); seletor quebrado?`);
      return [{ fonte: p.fonte, chave: p.id, pais: p.pais, url: p.url, campos: {}, texto, coletado_em: agora }];
    },
  }));
}
