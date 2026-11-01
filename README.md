# viagens-fontes

Coleta automática de **fontes oficiais** da Ásia-Pacífico: avisos de viagem de governos, perigos naturais, páginas de regras de entrada e câmbio. Guarda um snapshot normalizado por chave e grava uma mudança só quando o hash muda.

- Não há roteiro, datas de viagem nem dados pessoais aqui. Um teste falha se aparecerem.
- O código é determinístico e não chama IA. Quem interpreta as mudanças é um consumidor privado, fora deste repositório.
- Uma execução sem mudança termina sem commit.

## Fontes
| id | Fonte | Grupo (cadência) | Método |
|---|---|---|---|
| `us_state` | State Dept, `cadataapi.state.gov` | governos (6 h) | estrutural (nível) + texto do resumo |
| `uk_fcdo` | FCDO, Content API do gov.uk | governos (6 h) | estrutural (`alert_status`) + texto de *Warnings* |
| `ca_gac` | Canadá, `data.international.gc.ca` | governos (6 h) | estrutural (`advisory-state`) |
| `gdacs` | GDACS (TC, EQ, FL; laranja e vermelho; caixa Ásia-Pacífico) | perigos (30 min) | estrutural |
| `fx_frankfurter` | Frankfurter (BCE), base BRL | diária | estrutural |
| `cn_nia_240h`, `cn_consulado_la_avisos`, `ph_etravel_faq` | páginas oficiais (`catalogo/paginas.json`) | entrada (diária) | hash do texto normalizado |

Países: CN, HK, MO, TW, JP, KR, PH, VN, TH, MY, SG, ID, KH, LA, MM, BN, TL, MN, IN, AU, NZ, PG.

## Layout
- `snapshots/<fonte>/<chave>.json`: último estado (`campos`, `texto`, `hash`, `coletado_em` da última mudança).
- `mudancas/AAAA/MM/DD/<fonte>__<chave>__<hash8>.json`: `MudancaBruta` com os campos que mudaram (antes e depois) e os trechos de texto alterados.
- `estado/<fonte>.json`: gravado só quando a fonte passa a falhar ou volta ao normal.

## Rodar
```
node fontes/coletar.ts governos   # ou perigos, entrada, diaria, todas
npm test
```
Node 24 ou mais novo (TypeScript nativo), sem dependências.

Licenças e atribuições: ver `LICENSE-DADOS.md`.
