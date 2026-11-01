// V2 hashConteudo: sha256 por WebCrypto, o mesmo no Node e no navegador.
import { jsonCanonico } from './normalizar.ts';
import type { Campos } from './tipos.ts';

export async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hashConteudo(n: { campos: Campos; texto: string }): Promise<string> {
  return sha256(jsonCanonico({ campos: n.campos, texto: n.texto }));
}
