import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { diffDeFonte, diffDeTexto } from '../fontes/nucleo/diff.ts';
import { hashConteudo, sha256 } from '../fontes/nucleo/hash.ts';
import { jsonCanonico, normalizarHtml } from '../fontes/nucleo/normalizar.ts';
import type { Snapshot } from '../fontes/nucleo/tipos.ts';
import { coletar } from '../fontes/coletar.ts';
import { caGac, ukFcdo, usState } from '../fontes/adaptadores/governos.ts';
import { gdacs } from '../fontes/adaptadores/outros.ts';

const FX = 'fixtures/2026-10-31/';

test('V1: teste de ruído (render, CSRF, atributos, espaços) → texto idêntico', () => {
  const a = `<html><head><script>var t=1</script></head><body><nav>Menu</nav>
    <div class="x main" data-r="1"><p>Visa-free  for  30 days.</p><input name="csrf" value="aaa"><p>Valid&nbsp;until 2026-12-31</p></div>
    <footer>Rendered at 10:00</footer></body></html>`;
  const b = `<html><body><nav>Outro menu</nav><!-- build 999 -->
    <div data-r="2" class="main x"><p>Visa-free for 30 days.</p>
    <input value="bbb" name="csrf"><p>Valid until 2026-12-31</p></div><footer>Rendered at 11:37</footer><script>x()</script></body></html>`;
  assert.equal(normalizarHtml(a, { bloco: 'main' }), normalizarHtml(b, { bloco: 'main' }));
  assert.equal(normalizarHtml(a, { bloco: 'main' }), 'Visa-free for 30 days.\nValid until 2026-12-31');
});

test('V1: seletor ausente falha alto (não vira texto vazio silencioso)', () => {
  assert.throws(() => normalizarHtml('<div>x</div>', { bloco: 'zoom' }), /seletor/);
});

test('V1: JSON canônico ordena chaves', () => {
  assert.equal(jsonCanonico({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: null } }), '{"a":{"c":null,"d":[2,{"y":2,"z":1}]},"b":1}');
});

test('V1: páginas reais com o seletor do catálogo', () => {
  const pag = JSON.parse(fs.readFileSync('catalogo/paginas.json', 'utf8'));
  const arq: Record<string, string> = { cn_nia_240h: 'nia.html', cn_consulado_la_avisos: 'la.html', ph_etravel_faq: 'etravel.html' };
  for (const p of pag) {
    const t = normalizarHtml(fs.readFileSync(FX + arq[p.id], 'utf8'), p.seletor);
    assert.ok(t.length > 1000, p.id);
  }
});

test('V2: vetor fixo do sha256 (o mesmo no navegador)', async () => {
  assert.equal(await sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const h1 = await hashConteudo({ campos: { b: 1, a: 'x' }, texto: 't' });
  const h2 = await hashConteudo({ campos: { a: 'x', b: 1 }, texto: 't' });
  assert.equal(h1, h2);
});

test('V3: texto igual → []; uma palavra trocada → um trecho', () => {
  assert.deepEqual(diffDeTexto('a\nb\nc', 'a\nb\nc'), []);
  const t = diffDeTexto('p1\np2\nvalid until 2026-12-31\np4\np5', 'p1\np2\nvalid until 2027-12-31\np4\np5');
  assert.equal(t.length, 1);
  assert.equal(t[0].antes, 'p2\nvalid until 2026-12-31\np4');
  assert.equal(t[0].depois, 'p2\nvalid until 2027-12-31\np4');
});

test('V3: duas mudanças distantes → dois trechos', () => {
  const a = ['x', 'a', 'b', 'c', 'd', 'e', 'f', 'y'].join('\n');
  const b = ['X', 'a', 'b', 'c', 'd', 'e', 'f', 'Y'].join('\n');
  assert.equal(diffDeTexto(a, b).length, 2);
});

const snap = (campos: Snapshot['campos'], texto: string, hash: string): Snapshot =>
  ({ fonte: 'uk_fcdo', chave: 'PH', pais: 'PH', url: 'u', campos, texto, hash, coletado_em: '2026-11-01T00:00:00Z' });

test('V4: hash igual → null; campo estrutural → estrutural; só texto → textual', () => {
  const a = snap({ alert_status: 'none' }, 't', 'h1');
  assert.equal(diffDeFonte(a, { ...a }), null);
  const e = diffDeFonte(a, snap({ alert_status: 'avoid_all_travel_to_parts' }, 't', 'h2'))!;
  assert.equal(e.tipo, 'estrutural');
  assert.deepEqual(e.campos, { alert_status: ['none', 'avoid_all_travel_to_parts'] });
  const t = diffDeFonte(a, snap({ alert_status: 'none' }, 't2', 'h3'))!;
  assert.equal(t.tipo, 'textual');
  assert.equal(t.trechos.length, 1);
  assert.equal(diffDeFonte(null, a)!.tipo, 'nova');
});

const httpFixture = (mapa: Record<string, string>) => async (url: string) => {
  const k = Object.keys(mapa).find(p => url.includes(p));
  if (!k) return { status: 404, texto: '', url };
  return { status: 200, texto: fs.readFileSync(FX + mapa[k], 'utf8'), url };
};

test('T17 (coleta): State Dept com FIPS RP → PH e nível do título', async () => {
  const s = await usState.coletar(httpFixture({ TravelAdvisories: 'us.json' }), '2026-10-31T00:00:00Z');
  const ph = s.find(x => x.chave === 'PH')!;
  assert.equal(ph.campos.nivel, 'Level 2');
  assert.ok(ph.texto.includes('Mindanao'));
  assert.equal(s.find(x => x.chave === 'CN')!.campos.nivel, 'Level 2');
});

test('T17 (coleta): Canadá e FCDO pelos fixtures', async () => {
  const ca = await caGac.coletar(httpFixture({ 'index-alpha': 'ca-idx.json' }), '2026-10-31T00:00:00Z');
  assert.equal(ca.find(x => x.chave === 'PH')!.campos.regional, 1);
  const uk = await ukFcdo.coletar(httpFixture({ philippines: 'fcdo-ph.json' }), '2026-10-31T00:00:00Z').catch(e => e);
  assert.ok(uk instanceof Error, 'sem fixture dos outros países a coleta falha alto');
});

test('GDACS: só eventos dentro da caixa Ásia-Pacífico', async () => {
  const g = await gdacs.coletar(httpFixture({ geteventlist: 'gdacs.json' }), '2026-10-31T00:00:00Z');
  for (const e of g) assert.ok((e.campos.lon as number) >= 60);
});

test('coletar: segunda passada sem mudança não escreve nada; falha grava estado uma vez', async () => {
  const raiz = fs.mkdtempSync('/tmp/vf-');
  fs.mkdirSync(raiz + '/catalogo'); fs.writeFileSync(raiz + '/catalogo/paginas.json', '[]');
  const http = httpFixture({ TravelAdvisories: 'us.json' });
  const r1 = await coletar({ raiz, grupo: 'todas', http, agora: '2026-11-01T00:00:00Z', fontes: [usState] });
  assert.equal(r1.fontes[0].mudancas, 22);
  const r2 = await coletar({ raiz, grupo: 'todas', http, agora: '2026-11-01T06:00:00Z', fontes: [usState] });
  assert.deepEqual(r2.arquivos, []);
  const quebrado = async (u: string) => ({ status: 500, texto: '', url: u });
  const r3 = await coletar({ raiz, grupo: 'todas', http: quebrado, agora: '2026-11-01T12:00:00Z', fontes: [usState] });
  assert.deepEqual(r3.arquivos, ['estado/us_state.json']);
  const r4 = await coletar({ raiz, grupo: 'todas', http: quebrado, agora: '2026-11-01T18:00:00Z', fontes: [usState] });
  assert.deepEqual(r4.arquivos, []);
  const r5 = await coletar({ raiz, grupo: 'todas', http, agora: '2026-11-02T00:00:00Z', fontes: [usState] });
  assert.deepEqual(r5.arquivos, ['estado/us_state.json']);
});

test('privacidade: nada da viagem no repositório público', () => {
  const proibido = /Mateus|\bIsa\b|2027-09|2027-10|v-asia-2027/;
  const andar = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true })
    .flatMap(e => (e.isDirectory() ? andar(`${d}/${e.name}`) : [`${d}/${e.name}`]));
  for (const d of ['snapshots', 'catalogo', 'mudancas', 'estado', 'fontes'].filter(x => fs.existsSync(x)))
    for (const f of andar(d)) assert.ok(!proibido.test(fs.readFileSync(f, 'utf8')), f);
});
