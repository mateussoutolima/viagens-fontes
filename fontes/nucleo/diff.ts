// V3 diffDeTexto e V4 diffDeFonte. Determinísticos; cortam por parágrafo (linha).
import type { MudancaBruta, Snapshot, TrechoAlterado } from './tipos.ts';

/** LCS por linha; devolve os blocos alterados, cada um com até `contexto` linhas antes e depois. */
export function diffDeTexto(antes: string, depois: string, contexto = 1): TrechoAlterado[] {
  if (antes === depois) return [];
  const a = antes ? antes.split('\n') : [];
  const b = depois ? depois.split('\n') : [];
  const n = a.length, m = b.length;
  // tabela de LCS (páginas vigiadas têm centenas de linhas, não milhares)
  const L: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  // sequência de operações
  const ops: Array<{ t: '=' | '-' | '+'; s: string }> = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { ops.push({ t: '=', s: a[i] }); i++; j++; }
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { ops.push({ t: '+', s: b[j] }); j++; }
    else { ops.push({ t: '-', s: a[i] }); i++; }
  }
  const trechos: TrechoAlterado[] = [];
  let k = 0;
  while (k < ops.length) {
    if (ops[k].t === '=') { k++; continue; }
    let fim = k;
    // junta blocos alterados separados por poucas linhas iguais
    while (fim < ops.length) {
      if (ops[fim].t !== '=') { fim++; continue; }
      let g = fim;
      while (g < ops.length && ops[g].t === '=') g++;
      if (g < ops.length && g - fim <= 2 * contexto) fim = g; else break;
    }
    const ini = Math.max(0, k - contexto);
    const ate = Math.min(ops.length, fim + contexto);
    const sel = ops.slice(ini, ate);
    trechos.push({
      antes: sel.filter(o => o.t !== '+').map(o => o.s).join('\n'),
      depois: sel.filter(o => o.t !== '-').map(o => o.s).join('\n'),
    });
    k = fim;
  }
  return trechos;
}

/** V4: compara dois snapshots da mesma chave. `null` se nada mudou. */
export function diffDeFonte(anterior: Snapshot | null, atual: Snapshot): MudancaBruta | null {
  if (anterior && anterior.hash === atual.hash) return null;
  const campos: MudancaBruta['campos'] = {};
  const chaves = new Set([...Object.keys(anterior?.campos ?? {}), ...Object.keys(atual.campos)]);
  for (const c of [...chaves].sort()) {
    const x = anterior?.campos[c], y = atual.campos[c];
    if (x !== y) campos[c] = [x, y];
  }
  const trechos = anterior ? diffDeTexto(anterior.texto, atual.texto) : [];
  const tipo = !anterior ? 'nova' : Object.keys(campos).length ? 'estrutural' : 'textual';
  return {
    fonte: atual.fonte, chave: atual.chave, pais: atual.pais, url: atual.url, tipo,
    campos: anterior ? campos : {},
    trechos,
    hash_antes: anterior?.hash ?? null, hash_depois: atual.hash, coletado_em: atual.coletado_em,
  };
}
