// Regras do monitoramento do kanban da WasFit, em dias (testadas em tests/kanban-regras.test.js).
// O gestor preenche "Normal até N dias" e "Atrasado até M dias"; Crítico = a partir de M+1. No banco ficam em horas:
// horas_urgente = início do Atrasado ((N+1) × 24), horas_critico = início do Crítico ((M+1) × 24).
// Padrão (pedido do usuário, 26/11/2026): Normal até 7 dias, Atrasado de 8 a 15, Crítico a partir de 16.
export const PADRAO = { normalAte: 7, atrasadoAte: 15 };

export function diasDe(r) {
  if (!r) return { ...PADRAO };
  return { normalAte: Math.max(0, Math.round(r.horas_urgente / 24) - 1), atrasadoAte: Math.max(0, Math.round(r.horas_critico / 24) - 1) };
}

// Valida e converte para horas; devolve { erro } se não fizer sentido
export function horasDe(normalAte, atrasadoAte) {
  const n = Number(normalAte), a = Number(atrasadoAte);
  if (!Number.isInteger(n) || n < 0) return { erro: 'O "Normal até" precisa ser um número inteiro de dias (0 ou mais).' };
  if (!Number.isInteger(a) || a <= n) return { erro: 'O "Atrasado até" precisa ser maior que o "Normal até".' };
  return { horas_urgente: (n + 1) * 24, horas_critico: (a + 1) * 24 };
}

const d = (n) => `${n} dia${n === 1 ? '' : 's'}`;
// "Normal até 7 dias · Atrasado de 8 a 15 dias · Crítico a partir de 16 dias sem ação"
export function texto(r) {
  if (r && r.monitorar === false) return 'não monitorada';
  const { normalAte, atrasadoAte } = diasDe(r);
  const atr = normalAte + 1 === atrasadoAte ? `Atrasado com ${d(atrasadoAte)}` : `Atrasado de ${normalAte + 1} a ${d(atrasadoAte)}`;
  return `Normal até ${d(normalAte)} · ${atr} · Crítico a partir de ${d(atrasadoAte + 1)} sem ação`;
}
