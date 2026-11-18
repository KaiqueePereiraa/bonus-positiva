// Vendas — experimentais (confirmar e pós-aula) e interessados novos, que chegam sozinhos da EVO de segunda a sexta
// de manhã (contato no mesmo dia), e ex-alunos (campanha de volta), que chegam toda segunda com prazo na sexta.
import { criarTela } from './_grupo.js?v=20261118095302';

export const render = criarTela({
  rota: 'vendas', titulo: 'Vendas',
  controles: ['experimental_confirmar', 'experimental_pos', 'lead_novo', 'ex_alunos'],
  ajuda: {
    experimental_confirmar: 'Aulas experimentais do próximo dia útil (na sexta, também as do fim de semana): confirme se a pessoa vem. Confirmar diminui as faltas na aula.',
    experimental_pos: 'Quem fez aula experimental no último dia útil e ainda não se matriculou: pergunte como foi e ofereça o plano. Quem se matricular sai sozinho da lista.',
    lead_novo: 'Interessados que se cadastraram desde o último dia útil e ainda não são alunos: chame hoje e ofereça uma aula experimental. Interessado esfria rápido.',
    ex_alunos: 'Ex-alunos que saíram há uns 3 ou 6 meses e não voltaram: convide para voltar. Quem fizer contrato novo conta como matrícula recuperada.',
  },
  vazioTexto: 'As listas de vendas chegam sozinhas da EVO: experimentais e interessados de segunda a sexta de manhã, ex-alunos toda segunda. Ainda não há listas.',
});
