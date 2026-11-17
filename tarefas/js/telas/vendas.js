// Vendas do dia — experimentais (confirmar e pós-aula) e interessados novos. Chegam sozinhas da EVO de segunda a
// sexta de manhã, divididas entre as consultoras; o contato é no mesmo dia.
import { criarTela } from './_grupo.js?v=20261117183018';

export const render = criarTela({
  rota: 'vendas', titulo: 'Vendas do dia',
  controles: ['experimental_confirmar', 'experimental_pos', 'lead_novo'],
  ajuda: {
    experimental_confirmar: 'Aulas experimentais do próximo dia útil (na sexta, também as do fim de semana): confirme se a pessoa vem. Confirmar diminui as faltas na aula.',
    experimental_pos: 'Quem fez aula experimental no último dia útil e ainda não se matriculou: pergunte como foi e ofereça o plano. Quem se matricular sai sozinho da lista.',
    lead_novo: 'Interessados que se cadastraram desde o último dia útil e ainda não são alunos: chame hoje e ofereça uma aula experimental. Interessado esfria rápido.',
  },
  vazioTexto: 'As listas de vendas chegam sozinhas da EVO de segunda a sexta de manhã. Ainda não há listas.',
});
