// Renovação de contratos — "a vencer" (procurar e marcar) e "venceu e não renovou" (registrar o motivo).
// As listas chegam sozinhas da EVO toda segunda e são divididas entre as consultoras.
import { criarTela } from './_grupo.js?v=20261126210347';

export const render = criarTela({
  rota: 'renovacao', titulo: 'Renovação',
  controles: ['renovacao_vencer', 'renovacao_venceu'],
  ajuda: {
    renovacao_vencer: 'Contratos que vencem nos próximos dias: chame no WhatsApp, ofereça a renovação e marque quem você procurou. Quem não renovar aparece na lista "venceu" na semana seguinte.',
    renovacao_venceu: 'Contratos que venceram e não foram renovados: pergunte o motivo e registre. Assim a academia sabe o que fazer para trazer de volta.',
  },
  vazioTexto: 'As listas de renovação chegam sozinhas da EVO toda segunda de madrugada. Ainda não há listas.',
});
