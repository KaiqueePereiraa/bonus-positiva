// Aba Professores (27/11/2026) — regras puras, testadas em tests/professores-regras.test.js.
// Retenção: % dos alunos do professor que saíram no mês, comparada com a média da unidade (mesmo mês) e com o mês anterior
// (mesmo período). Só avalia quem tem pelo menos MIN_ALUNOS alunos; folga de FOLGA pontos para não acusar ruído.
export const MIN_ALUNOS = 15;
export const FOLGA = 3;   // pontos percentuais
export const MIN_EXPERIMENTAIS = 5;

const pct = (a, b) => (b > 0 ? Math.round((1000 * a) / b) / 10 : null);
const br = (n) => String(n).replace('.', ',');

export function avaliarUnidade(u, antes) {
  const media = pct(u.sairam, u.alunos);
  const ant = new Map((antes?.professores || []).map((p) => [p.professor, p]));
  const linhas = (u.professores || []).map((p) => {
    const taxa = pct(p.sairam, p.alunos);
    const a = ant.get(p.professor);
    const taxaAnt = a ? pct(a.sairam, a.alunos) : null;
    const conversao = pct(p.viraram_cliente, p.experimentais);
    let status = 'poucos';
    if (p.alunos >= MIN_ALUNOS && taxa != null && media != null) {
      status = taxa > media + FOLGA ? 'perde_mais' : taxa < media - FOLGA ? 'perde_menos' : 'na_media';
    }
    let leitura;
    if (status === 'perde_mais') leitura = `Perdeu ${br(taxa)}% dos alunos no mês, acima da média da unidade (${br(media)}%). Vale ver as aulas e conversar com quem saiu.`;
    else if (status === 'perde_menos') leitura = `Segura bem a turma: ${br(taxa)}% de saída contra ${br(media)}% da unidade.`;
    else if (status === 'na_media') leitura = `Saída dentro da média da unidade (${br(media)}%).`;
    else leitura = p.alunos ? `Poucos alunos para avaliar (${p.alunos}).` : 'Sem turmas no período (só experimentais).';
    return { ...p, taxa, taxaAnt, conversao, status, leitura };
  });
  const experimentais = linhas.reduce((t, p) => t + p.experimentais, 0);
  const viraram = linhas.reduce((t, p) => t + p.viraram_cliente, 0);
  return { unidade: u.unidade, alunos: u.alunos, sairam: u.sairam, media, conversaoUnidade: pct(viraram, experimentais), experimentais, linhas };
}

// Alerta para o Painel: professor que perde bem mais que a média (com alunos suficientes)
export function alertasProfessores(unidades) {
  return unidades.flatMap((u) => u.linhas.filter((p) => p.status === 'perde_mais')
    .map((p) => ({ unidade: u.unidade, professor: p.professor, taxa: p.taxa, media: u.media })));
}
