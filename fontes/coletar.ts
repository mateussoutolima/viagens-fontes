// CLI do Actions: node fontes/coletar.ts <grupo|todas> [--raiz .]
// Coleta, normaliza, compara o hash com o snapshot e só grava o que mudou.
// Sem mudança: não escreve nada (o workflow não faz commit, a rotina não dispara).
import fs from 'node:fs';
import path from 'node:path';
import { diffDeFonte } from './nucleo/diff.ts';
import { hashConteudo } from './nucleo/hash.ts';
import { jsonCanonico } from './nucleo/normalizar.ts';
import type { Fonte, HttpPort, MudancaBruta, Snapshot } from './nucleo/tipos.ts';
import { caGac, ukFcdo, usState } from './adaptadores/governos.ts';
import { fontesDePaginas, fxFrankfurter, gdacs, type PaginaVigiada } from './adaptadores/outros.ts';

export interface EstadoFonte {
  fonte: string;
  estado: 'ok' | 'falha';
  desde: string;
  erro?: string;
}

export interface Resumo {
  grupo: string;
  coletado_em: string;
  fontes: Array<{ id: string; estado: 'ok' | 'falha'; chaves: number; mudancas: number; erro?: string }>;
  arquivos: string[];
}

export function todasAsFontes(raiz: string): Fonte[] {
  const paginas: PaginaVigiada[] = JSON.parse(fs.readFileSync(path.join(raiz, 'catalogo/paginas.json'), 'utf8'));
  return [usState, ukFcdo, caGac, gdacs, fxFrankfurter, ...fontesDePaginas(paginas)];
}

const seguro = (s: string) => s.replace(/[^A-Za-z0-9_.-]/g, '_');

function escrever(raiz: string, rel: string, dado: unknown, arquivos: string[]) {
  const p = path.join(raiz, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(dado, null, 2) + '\n');
  arquivos.push(rel);
}

function ler<T>(raiz: string, rel: string): T | null {
  try { return JSON.parse(fs.readFileSync(path.join(raiz, rel), 'utf8')); } catch { return null; }
}

export async function coletar(opts: { raiz: string; grupo: string; http: HttpPort; agora: string; fontes?: Fonte[] }): Promise<Resumo> {
  const { raiz, grupo, http, agora } = opts;
  const fontes = (opts.fontes ?? todasAsFontes(raiz)).filter(f => grupo === 'todas' || f.grupo === grupo);
  const resumo: Resumo = { grupo, coletado_em: agora, fontes: [], arquivos: [] };
  const [a, m, d] = agora.slice(0, 10).split('-');
  for (const f of fontes) {
    const relEstado = `estado/${seguro(f.id)}.json`;
    const anterior = ler<EstadoFonte>(raiz, relEstado);
    try {
      const brutos = await f.coletar(http, agora);
      let mudancas = 0;
      for (const b of brutos) {
        const snap: Snapshot = { ...b, hash: await hashConteudo(b) };
        const relSnap = `snapshots/${seguro(snap.fonte)}/${seguro(snap.chave)}.json`;
        const mud: MudancaBruta | null = diffDeFonte(ler<Snapshot>(raiz, relSnap), snap);
        if (!mud) continue;
        mudancas++;
        escrever(raiz, relSnap, snap, resumo.arquivos);
        escrever(raiz, `mudancas/${a}/${m}/${d}/${seguro(snap.fonte)}__${seguro(snap.chave)}__${snap.hash.slice(0, 8)}.json`, mud, resumo.arquivos);
      }
      // estado só é gravado quando muda (falha → ok), para não gerar commit a cada execução
      if (anterior?.estado !== 'ok' && anterior) escrever(raiz, relEstado, { fonte: f.id, estado: 'ok', desde: agora }, resumo.arquivos);
      resumo.fontes.push({ id: f.id, estado: 'ok', chaves: brutos.length, mudancas });
    } catch (e) {
      const erro = String((e as Error)?.message ?? e).slice(0, 300);
      if (anterior?.estado !== 'falha') escrever(raiz, relEstado, { fonte: f.id, estado: 'falha', desde: agora, erro }, resumo.arquivos);
      resumo.fontes.push({ id: f.id, estado: 'falha', chaves: 0, mudancas: 0, erro });
    }
  }
  return resumo;
}

export const httpNode: HttpPort = async url => {
  const r = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (viagens-fontes; +https://github.com/mateussoutolima/viagens-fontes)', accept: '*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  });
  return { status: r.status, texto: await r.text(), url: r.url };
};

if (import.meta.filename === process.argv[1] || import.meta.filename === process.argv[1] + ".ts") {
  const grupo = process.argv[2] ?? 'todas';
  const iRaiz = process.argv.indexOf('--raiz');
  const raiz = iRaiz > 0 ? process.argv[iRaiz + 1] : process.cwd();
  const agora = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const r = await coletar({ raiz, grupo, http: httpNode, agora });
  console.log(jsonCanonico({ ...r, arquivos: r.arquivos.length }));
  for (const f of r.fontes) if (f.estado === 'falha') console.error(`FALHA ${f.id}: ${f.erro}`);
}
