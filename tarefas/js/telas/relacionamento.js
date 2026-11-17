// Relacionamento — primeiros 90 dias, entrevista de saída de quem cancelou e campanha de volta dos ex-alunos.
// Chegam sozinhas da EVO toda segunda, divididas entre as consultoras; prazo na sexta.
import { criarTela } from './_grupo.js?v=20261117172941';

export const render = criarTela({
  rota: 'relacionamento', titulo: 'Relacionamento',
  controles: ['primeiros_90', 'cancelou', 'ex_alunos'],
  ajuda: {
    primeiros_90: 'Alunos novos nas semanas 1, 2, 4 e 8 depois da matrícula: pergunte como estão os treinos e ajude no que precisar. Quem veio pouco aparece primeiro — é quem mais corre risco de desistir.',
    cancelou: 'Quem cancelou o contrato na semana passada: pergunte o motivo com calma e registre. É a informação mais valiosa para a academia melhorar.',
    ex_alunos: 'Ex-alunos que saíram há uns 3 ou 6 meses e não voltaram: convide para voltar. Quem fizer contrato novo conta como matrícula recuperada.',
  },
  vazioTexto: 'As listas de relacionamento chegam sozinhas da EVO toda segunda de madrugada. Ainda não há listas.',
});
