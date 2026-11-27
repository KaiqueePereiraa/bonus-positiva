// Por que não fechou? — lista DIÁRIA que chega sozinha da EVO de segunda a sexta (06:00), com duas etapas:
// quem cadastrou há 5 dias e não fez aula experimental, e quem fez a experimental há 5 dias e não se matriculou.
// Cada consultora registra o motivo (formulário em _motivos.js). O admin vê o progresso e o relatório da diretoria.
import { criarTela } from './_grupo.js?v=20261127183548';
import { cartaoRelatorioDiretoria } from './_relatorio-nf.js?v=20261127183548';

export const render = criarTela({
  rota: 'nao-fechou', titulo: 'Por que não fechou?',
  controles: ['nao_fechou'],
  ajuda: {
    nao_fechou: 'Interessados parados há 5 dias: quem se cadastrou e não fez aula experimental (convide para a aula) e quem fez a experimental e não se matriculou (pergunte como foi e ofereça o plano). Fale com cada um e escolha o motivo. Quem se matricular sai sozinho da lista.',
  },
  vazioTexto: 'A lista "Por que não fechou?" chega sozinha da EVO de segunda a sexta, às 6h, com os interessados parados há 5 dias. Ainda não há lista.',
  extraAdmin: async (el, ctx) => {
    const caixa = document.createElement('div');
    el.append(caixa);
    await cartaoRelatorioDiretoria(caixa, ctx);
  },
});
