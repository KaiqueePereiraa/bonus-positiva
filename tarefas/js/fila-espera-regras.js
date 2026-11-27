// Fila "Em espera" no Meu dia (27/11/2026) — regras puras, testadas em tests/fila-espera.test.js.
// Tempo corrido (inclusive à noite), como no Kanban. Cores: até 15 min verde, até 1 h laranja, acima vermelho.
export const LIMITE_VERDE = 15;
export const LIMITE_LARANJA = 60;

export const nivelEspera = (min) => (min == null ? 'verde' : min <= LIMITE_VERDE ? 'verde' : min <= LIMITE_LARANJA ? 'laranja' : 'vermelho');

export function tempoEspera(min) {
  if (min == null) return '—';
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  if (m < 48 * 60) { const h = Math.floor(m / 60), r = m % 60; return r ? `${h} h ${r} min` : `${h} h`; }
  return `${Math.floor(m / 1440)} dias`;
}

// Frase do placar dela no mês (no cartão "Seu mês"): quantos assumiu e o tempo típico × equipe
export function placarFila(f) {
  if (!f || !f.equipe_assumidos) return null;
  const n = f.meus_assumidos || 0;
  if (!n) return { numero: 0, texto: `A equipe assumiu ${f.equipe_assumidos} da fila no mês (tempo típico ${tempoEspera(f.equipe_mediana_min)}). Você ainda não assumiu nenhum.` };
  const melhor = f.minha_mediana_min != null && f.equipe_mediana_min != null && f.minha_mediana_min <= f.equipe_mediana_min;
  return { numero: n, texto: `Tempo típico ${tempoEspera(f.minha_mediana_min)} · equipe ${tempoEspera(f.equipe_mediana_min)}${melhor ? ' — mais rápida que a equipe 👏' : ''}` };
}
