// Desempenho comercial — regras puras (testadas em tests/comercial-regras.test.js).
// Conversão de cada consultora = dos cadastros que ELA fez no mês, quantos viraram cliente no mesmo mês (não importa quem
// fechou a venda). Compara com a equipe (dentro / acima / abaixo do padrão) e com o mês anterior (melhorou / piorou).

export const MIN_CADASTROS = 5;     // com menos que isso no mês, a % ainda não diz muita coisa
export const MARGEM_PADRAO = 10;    // pontos percentuais acima/abaixo da taxa da equipe para sair do "dentro do padrão"
export const MARGEM_TENDENCIA = 5;  // pontos percentuais para dizer que melhorou ou piorou

const br = (n) => String(n).replace('.', ',');
export const pct = (vendas, base) => (base > 0 ? Math.round((1000 * vendas) / base) / 10 : null);

// Variação entre dois números (para "cresceu x%")
export function variacao(atual, anterior) {
  if (!anterior) return atual ? null : 0;
  return Math.round((1000 * (atual - anterior)) / anterior) / 10;
}

// Média de cadastros por consultora (só quem cadastrou alguma coisa no mês)
export function mediaCadastros(pessoas) {
  const com = pessoas.filter((p) => p.atual.cadastros > 0);
  return com.length ? com.reduce((a, p) => a + p.atual.cadastros, 0) / com.length : 0;
}

export function tendencia(taxaAtual, taxaAnterior) {
  if (taxaAtual == null || taxaAnterior == null) return null;
  const d = Math.round((taxaAtual - taxaAnterior) * 10) / 10;
  if (d >= MARGEM_TENDENCIA) return { tipo: 'melhorou', pontos: d };
  if (d <= -MARGEM_TENDENCIA) return { tipo: 'piorou', pontos: d };
  return { tipo: 'estavel', pontos: d };
}

// Situação da consultora na equipe + uma frase de diagnóstico para o gestor
export function avaliar(p, taxaEquipe, media) {
  const c = p.atual.cadastros, taxa = pct(p.atual.vendas, c);
  const taxaAnt = pct(p.anterior.vendas, p.anterior.cadastros);
  const tend = p.anterior.cadastros >= MIN_CADASTROS && c >= MIN_CADASTROS ? tendencia(taxa, taxaAnt) : null;
  if (c < MIN_CADASTROS) {
    return { taxa, taxaAnt, tend, status: 'poucos', diagnostico: c === 0 ? 'Nenhum cadastro no período.' : `Só ${c} cadastro${c > 1 ? 's' : ''} no período: pouco para avaliar a conversão — o primeiro ponto é gerar mais oportunidades.` };
  }
  const status = taxaEquipe == null ? 'dentro' : taxa >= taxaEquipe + MARGEM_PADRAO ? 'acima' : taxa <= taxaEquipe - MARGEM_PADRAO ? 'abaixo' : 'dentro';
  const cadastraPouco = media > 0 && c < 0.6 * media;
  const cadastraBem = media > 0 && c >= media;
  let diagnostico;
  if (status === 'abaixo' && cadastraBem) diagnostico = 'Cadastra bem, mas converte pouco: revisar o acompanhamento no kanban (retorno rápido, agendar a experimental, proposta no dia).';
  else if (status === 'abaixo') diagnostico = 'Cadastra pouco e converte pouco: precisa de acompanhamento de perto nas duas pontas.';
  else if (status === 'acima' && cadastraBem) diagnostico = 'Referência da equipe: cadastra bem e converte acima do padrão.';
  else if (status === 'acima') diagnostico = 'Converte muito bem, mas cadastra pouco: com mais oportunidades, vende mais.';
  else if (cadastraPouco) diagnostico = 'Conversão no padrão, mas cadastra pouco: o foco é gerar mais oportunidades.';
  else diagnostico = 'Dentro do padrão da equipe.';
  if (tend?.tipo === 'piorou') diagnostico += ` Caiu ${br(Math.abs(tend.pontos))} pontos em relação ao mês anterior.`;
  if (tend?.tipo === 'melhorou') diagnostico += ` Subiu ${br(tend.pontos)} pontos em relação ao mês anterior.`;
  return { taxa, taxaAnt, tend, status, diagnostico };
}

// Resumo do time: taxa, variação de oportunidades/vendas e uma frase sobre o mês
export function resumoTime(t) {
  const a = t.atual || {}, b = t.anterior || {};
  const taxa = pct(a.vendas || 0, a.oportunidades || 0), taxaAnt = pct(b.vendas || 0, b.oportunidades || 0);
  const entrada = (a.vendas || 0) + (a.outro_mes || 0), entradaAnt = (b.vendas || 0) + (b.outro_mes || 0);
  return {
    taxa, taxaAnt, tend: tendencia(taxa, taxaAnt),
    varOportunidades: variacao(a.oportunidades || 0, b.oportunidades || 0),
    varVendas: variacao(a.vendas || 0, b.vendas || 0),
    entrada, entradaAnt, varEntrada: variacao(entrada, entradaAnt),
  };
}

// Taxa das consultoras (sem os cadastros da IA / sem consultora): é o "padrão" contra o qual cada uma é comparada
export function taxaConsultoras(t, qual = 'atual') {
  const a = t[qual] || {}, ia = t.ia?.[qual] || {};
  return pct((a.vendas || 0) - (ia.vendas || 0), (a.oportunidades || 0) - (ia.oportunidades || 0));
}

// Pessoas do time já avaliadas (some quem não cadastrou nada nem neste mês nem no anterior)
export function avaliarTime(t) {
  const padrao = taxaConsultoras(t);
  const pessoas = (t.pessoas || []).filter((p) => p.atual.cadastros > 0 || p.anterior.cadastros > 0);
  const media = mediaCadastros(pessoas);
  return pessoas.map((p) => ({ ...p, ...avaliar(p, padrao, media) }));
}
