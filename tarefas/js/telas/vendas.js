// Vendas — ex-alunos (campanha de volta), que chegam toda segunda com prazo na sexta.
// Os interessados (cadastro sem experimental e experimental sem matrícula) ficam no "Por que não fechou?" (lista diária).
import { criarTela } from './_grupo.js?v=20261124194920';

export const render = criarTela({
  rota: 'vendas', titulo: 'Vendas',
  controles: ['ex_alunos'],
  ajuda: {
    ex_alunos: 'Ex-alunos que saíram há uns 3 ou 6 meses e não voltaram: convide para voltar. Quem fizer contrato novo conta como matrícula recuperada.',
  },
  vazioTexto: 'A lista de ex-alunos chega sozinha da EVO toda segunda. Os interessados que não fecharam estão em "Por que não fechou?". Ainda não há listas.',
});
