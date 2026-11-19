// Relacionamento — primeiros 90 dias e entrevista de saída de quem cancelou (os ex-alunos ficam em Vendas).
// Chegam sozinhas da EVO toda segunda, divididas entre as consultoras; prazo na sexta.
import { criarTela } from './_grupo.js?v=20261119094038';

export const render = criarTela({
  rota: 'relacionamento', titulo: 'Relacionamento',
  controles: ['primeiros_90', 'cancelou'],
  ajuda: {
    primeiros_90: 'Alunos novos nas semanas 1, 2, 4 e 8 depois da matrícula: pergunte como estão os treinos e ajude no que precisar. Quem veio pouco aparece primeiro — é quem mais corre risco de desistir.',
    cancelou: 'Quem cancelou o contrato na semana passada: pergunte o motivo com calma e registre. É a informação mais valiosa para a academia melhorar.',
  },
  vazioTexto: 'As listas de relacionamento chegam sozinhas da EVO toda segunda de madrugada. Ainda não há listas.',
});
