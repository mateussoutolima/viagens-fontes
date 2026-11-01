// V1 normalizarConteudo: o mesmo conteúdo sempre vira o mesmo texto,
// independente de data de render, token, ordem de atributos e espaços.

export interface Seletor {
  /** Classe ou id do bloco principal (ex.: "content", "#main"). */
  bloco?: string;
  /** Classes ou ids de blocos a remover dentro do bloco (ex.: "shareMeddile"). */
  remover?: string[];
  /** Recorte no texto já normalizado: começa no primeiro `de` e termina antes do primeiro `ate`. */
  de?: string;
  ate?: string;
}

const ENTIDADES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', middot: '·', copy: '©',
};

export function decodificarEntidades(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTIDADES[e.toLowerCase()] ?? m;
  });
}

/** Acha o elemento que abre em `inicio` e devolve o índice logo depois do seu fechamento. */
function fimDoElemento(html: string, inicio: number): number {
  const tag = /^<([a-z0-9]+)/i.exec(html.slice(inicio))?.[1]?.toLowerCase();
  if (!tag) return inicio;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = inicio;
  let prof = 0;
  for (let m; (m = re.exec(html)); ) {
    if (m[0].endsWith('/>')) continue;
    prof += m[1] ? -1 : 1;
    if (prof === 0) return re.lastIndex;
  }
  return html.length;
}

function reMarcador(sel: string): RegExp {
  const nome = sel.replace(/^[#.]/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return sel.startsWith('#')
    ? new RegExp(`<[a-z0-9]+\\b[^>]*\\bid\\s*=\\s*["']${nome}["'][^>]*>`, 'i')
    : new RegExp(`<[a-z0-9]+\\b[^>]*\\b(?:class|id)\\s*=\\s*["'](?:[^"']*\\s)?${nome}(?:\\s[^"']*)?["'][^>]*>`, 'i');
}

function extrairBloco(html: string, sel: string): string | null {
  const m = reMarcador(sel).exec(html);
  if (!m) return null;
  return html.slice(m.index, fimDoElemento(html, m.index));
}

function removerBlocos(html: string, sel: string): string {
  for (let i = 0; i < 200; i++) {
    const m = reMarcador(sel).exec(html);
    if (!m) break;
    html = html.slice(0, m.index) + ' ' + html.slice(fimDoElemento(html, m.index));
  }
  return html;
}

export function normalizarHtml(html: string, seletor: Seletor = {}): string {
  let h = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  if (seletor.bloco) {
    const b = extrairBloco(h, seletor.bloco);
    if (b == null) throw new Error(`seletor não encontrado: ${seletor.bloco}`);
    h = b;
  }
  h = h.replace(/<(nav|footer|header|form)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  for (const r of seletor.remover ?? []) h = removerBlocos(h, r);
  // quebra de parágrafo nos blocos; o resto das tags vira espaço
  h = h.replace(/<\/?(p|div|li|ul|ol|h[1-6]|tr|table|section|article|br|dt|dd)\b[^>]*>/gi, '\n');
  h = h.replace(/<[^>]+>/g, ' ');
  let t = decodificarEntidades(h)
    .replace(/[​­﻿]/g, '')
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  if (seletor.de) {
    const i = t.indexOf(seletor.de);
    if (i < 0) throw new Error(`recorte não encontrado: ${seletor.de}`);
    t = t.slice(i);
  }
  if (seletor.ate) {
    const i = t.indexOf(seletor.ate);
    if (i >= 0) t = t.slice(0, i).trimEnd();
  }
  return t;
}

/** JSON canônico: chaves ordenadas, sem espaços. */
export function jsonCanonico(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return '[' + v.map(jsonCanonico).join(',') + ']';
  const o = v as Record<string, unknown>;
  return '{' + Object.keys(o).filter(k => o[k] !== undefined).sort()
    .map(k => JSON.stringify(k) + ':' + jsonCanonico(o[k])).join(',') + '}';
}

/** Texto curto de HTML embutido em campo de API (ex.: Summary do State Dept). */
export function textoDeFragmento(html: string): string {
  return normalizarHtml(`<div>${html}</div>`);
}
