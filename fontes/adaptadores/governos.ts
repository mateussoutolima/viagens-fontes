// FT1 State Dept, FT3/FT4 FCDO e FT5 Canadá. Vigia a Ásia-Pacífico inteira, sem roteiro.
import { normalizarHtml, textoDeFragmento } from '../nucleo/normalizar.ts';
import type { Fonte, HttpPort, Snapshot } from '../nucleo/tipos.ts';
import { PAISES } from './paises.ts';

type Bruto = Omit<Snapshot, 'hash'>;

async function json(http: HttpPort, url: string): Promise<any> {
  const r = await http(url);
  if (r.status !== 200) throw new Error(`${url}: HTTP ${r.status}`);
  return JSON.parse(r.texto);
}

const soData = (s: unknown) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);

export const usState: Fonte = {
  id: 'us_state', nome: 'Departamento de Estado dos EUA', licenca: 'domínio público (EUA)', grupo: 'governos',
  async coletar(http, agora) {
    const url = 'https://cadataapi.state.gov/api/TravelAdvisories';
    const lista: any[] = await json(http, url);
    if (!Array.isArray(lista) || lista.length < 100) throw new Error(`State Dept: lista suspeita (${lista?.length})`);
    const out: Bruto[] = [];
    for (const p of PAISES) {
      const it = lista.find(x => Array.isArray(x.Category) && x.Category.includes(p.fips));
      if (!it) continue;
      const nivel = /Level\s*([1-4])/i.exec(it.Title ?? '')?.[0] ?? null;
      if (!nivel) throw new Error(`State Dept ${p.iso}: título sem nível "${it.Title}"`);
      out.push({
        fonte: 'us_state', chave: p.iso, pais: p.iso, url: it.Link ?? url,
        campos: { nivel: nivel.replace(/\s+/g, ' '), atualizado_em: soData(it.Updated) ?? soData(it.Published) },
        texto: textoDeFragmento(it.Summary ?? ''),
        coletado_em: agora,
      });
    }
    return out;
  },
};

export const ukFcdo: Fonte = {
  id: 'uk_fcdo', nome: 'FCDO (Reino Unido)', licenca: 'Open Government Licence v3.0', grupo: 'governos',
  async coletar(http, agora) {
    const out: Bruto[] = [];
    for (const p of PAISES) {
      const url = `https://www.gov.uk/api/content/foreign-travel-advice/${p.fcdo}`;
      const d = await json(http, url);
      const det = d.details ?? {};
      const avisos = (det.parts ?? []).find((x: any) => x.slug === 'warnings-and-insurance');
      out.push({
        fonte: 'uk_fcdo', chave: p.iso, pais: p.iso, url: `https://www.gov.uk/foreign-travel-advice/${p.fcdo}`,
        campos: {
          alert_status: [...(det.alert_status ?? [])].sort().join(',') || 'none',
          atualizado_em: soData(d.public_updated_at),
          mudanca: det.change_description ?? null,
        },
        texto: avisos?.body ? normalizarHtml(avisos.body) : '',
        coletado_em: agora,
      });
    }
    return out;
  },
};

export const caGac: Fonte = {
  id: 'ca_gac', nome: 'Governo do Canadá (travel.gc.ca)', licenca: 'Open Government Licence – Canada', grupo: 'governos',
  async coletar(http, agora) {
    const d = await json(http, 'https://data.international.gc.ca/travel-voyage/index-alpha-eng.json');
    const out: Bruto[] = [];
    for (const p of PAISES) {
      const it = d.data?.[p.iso];
      if (!it) continue;
      out.push({
        fonte: 'ca_gac', chave: p.iso, pais: p.iso,
        url: `https://travel.gc.ca/destinations/${it.eng?.['url-slug'] ?? ''}`,
        campos: {
          advisory_state: it['advisory-state'] ?? null,
          regional: it['has-regional-advisory'] ?? null,
          aviso: it['has-advisory-warning'] ?? null,
          atualizado_em: soData(it['date-published']?.date),
        },
        texto: [it.eng?.['advisory-text'], it.eng?.['recent-updates']].filter(Boolean).join('\n'),
        coletado_em: agora,
      });
    }
    return out;
  },
};
