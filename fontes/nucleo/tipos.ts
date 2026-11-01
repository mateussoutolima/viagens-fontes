// Tipos do núcleo. Nada aqui conhece viagem, datas de viagem ou pessoas.

export type InstanteUTC = string; // ISO 8601 com Z

/** Campos estruturais comparados sem IA (nível, estado, datas). */
export type Campos = Record<string, string | number | boolean | null>;

/** Último estado normalizado de uma chave (país, evento, página) de uma fonte. */
export interface Snapshot {
  fonte: string;
  chave: string;
  /** País ISO 3166-1 alfa-2, quando a chave é de um país. */
  pais?: string;
  url: string;
  campos: Campos;
  /** Texto normalizado (V1). Vazio para fontes só estruturais. */
  texto: string;
  /** sha256 de campos + texto (V2). Não inclui coletado_em. */
  hash: string;
  coletado_em: InstanteUTC;
}

export interface TrechoAlterado {
  antes: string;
  depois: string;
}

export interface MudancaBruta {
  fonte: string;
  chave: string;
  pais?: string;
  url: string;
  tipo: 'nova' | 'estrutural' | 'textual';
  /** Campo → [antes, depois], só os que mudaram. */
  campos: Record<string, [Campos[string] | undefined, Campos[string] | undefined]>;
  trechos: TrechoAlterado[];
  hash_antes: string | null;
  hash_depois: string;
  coletado_em: InstanteUTC;
}

export interface HttpResposta {
  status: number;
  texto: string;
  url: string;
}

/** HttpPort: fetch do Node no Actions, dublê com fixtures nos testes. */
export type HttpPort = (url: string) => Promise<HttpResposta>;

/** SourcePort: um adaptador por fonte. */
export interface Fonte {
  id: string;
  nome: string;
  licenca: string;
  grupo: 'governos' | 'perigos' | 'entrada' | 'diaria';
  coletar(http: HttpPort, agora: InstanteUTC): Promise<Omit<Snapshot, 'hash'>[]>;
}
