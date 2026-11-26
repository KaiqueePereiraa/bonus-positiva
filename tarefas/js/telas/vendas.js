// Vendas — assinatura do contrato (de segunda a sexta: 10, 20 e 30 dias depois da compra + repescagem no começo do mês)
// e ex-alunos (campanha de volta), que chegam toda segunda com prazo na sexta.
// Os interessados (cadastro sem experimental e experimental sem matrícula) ficam no "Por que não fechou?" (lista diária).
import { criarTela } from './_grupo.js?v=20261126205825';

export const render = criarTela({
  rota: 'vendas', titulo: 'Vendas',
  controles: ['assinatura', 'ex_alunos'],
  ajuda: {
    assinatura: 'Quem comprou e ainda não assinou o contrato na EVO (10, 20 e 30 dias depois da compra; no começo do mês, também quem passou de 30 dias). Toque em WhatsApp: a mensagem já vai com o link de assinatura da pessoa. Quem assinar sai sozinho da lista.',
    ex_alunos: 'Ex-alunos que saíram há uns 3 ou 6 meses e não voltaram: convide para voltar. Quem fizer contrato novo conta como matrícula recuperada.',
  },
  vazioTexto: 'A assinatura do contrato chega sozinha da EVO de segunda a sexta, e a lista de ex-alunos toda segunda. Os interessados que não fecharam estão em "Por que não fechou?". Ainda não há listas.',
});
