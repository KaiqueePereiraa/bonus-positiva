// Desempenho comercial — regras puras (testadas em tests/comercial-regras.test.js).
// Conversão de cada consultora = da CARTEIRA dela no mês (o que ela cadastrou + os contatos da IA que ela assumiu), quantos
// viraram cliente no mesmo mês (não importa quem fechou a venda). Compara com as outras consultoras (dentro / acima / abaixo
// do padrão) e com o mês anterior (melhorou / piorou). A IA não entra nessa comparação: ela só cadastra e manda o pagamento —
// quem agenda e vende são as consultoras; a IA é medida pelo funil da etapa dela (funilIa).

export const MIN_CADASTROS = 5;     // com menos que isso no mês, a % ainda não diz muita coisa
export const MARGEM_PADRAO = 10;    // pontos percentuais acima/abaixo da taxa da equipe para sair do "dentro do padrão"
export const MARGEM_TENDENCIA = 5;  // pontos percentuais para dizer que melhorou ou piorou
export const DIFERENCA_ALERTA = 15; // pontos entre a melhor e a pior conversão de carteira para acender o alerta

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
    return { taxa, taxaAnt, tend, status: 'poucos', diagnostico: c === 0 ? 'Carteira vazia no período.' : `Só ${c} contato${c > 1 ? 's' : ''} na carteira no período: pouco para avaliar a conversão — o primeiro ponto é ter mais oportunidades (cadastrar ou assumir contatos da IA).` };
  }
  const status = taxaEquipe == null ? 'dentro' : taxa >= taxaEquipe + MARGEM_PADRAO ? 'acima' : taxa <= taxaEquipe - MARGEM_PADRAO ? 'abaixo' : 'dentro';
  const cadastraPouco = media > 0 && c < 0.6 * media;
  const cadastraBem = media > 0 && c >= media;
  let diagnostico;
  if (status === 'abaixo' && cadastraBem) diagnostico = 'Carteira cheia, mas converte pouco: revisar o acompanhamento no kanban (retorno rápido, agendar a experimental, proposta no dia).';
  else if (status === 'abaixo') diagnostico = 'Carteira pequena e converte pouco: precisa de acompanhamento de perto nas duas pontas.';
  else if (status === 'acima' && cadastraBem) diagnostico = 'Referência da equipe: carteira cheia e converte acima do padrão.';
  else if (status === 'acima') diagnostico = 'Converte muito bem, mas a carteira é pequena: com mais contatos (cadastrar ou assumir da IA), vende mais.';
  else if (cadastraPouco) diagnostico = 'Conversão no padrão, mas a carteira é pequena: o foco é ter mais oportunidades.';
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

// Taxa das carteiras das consultoras (o que elas cadastraram + os cadastros da IA de que são donas; fica de fora só o que
// a IA cadastrou e ninguém assumiu): é o "padrão" contra o qual cada uma é comparada
export function taxaConsultoras(t, qual = 'atual') {
  const a = t[qual] || {}, sd = t.sem_dono?.[qual] || {};
  return pct((a.vendas || 0) - (sd.vendas || 0), (a.oportunidades || 0) - (sd.oportunidades || 0));
}

// Funil da IA (a etapa dela): cadastros → assumidos por uma consultora → seguiram para a experimental → viraram cliente
// (pela equipe). Cada etapa em % dos cadastros da IA. Não é comparado com a conversão das consultoras.
export function funilIa(t) {
  const lado = (x) => {
    const c = x?.cadastros || 0;
    return { cadastros: c, assumidos: x?.assumidos || 0, semDona: x?.sem_dona || 0, experimental: x?.experimental || 0, clientes: x?.clientes || 0,
      pAssumidos: pct(x?.assumidos || 0, c), pExperimental: pct(x?.experimental || 0, c), pClientes: pct(x?.clientes || 0, c),
      dias: x?.dias_ate_assumir ?? null, noDia: x?.assumidos_no_dia || 0, comData: x?.com_data || 0, peloKanban: x?.pelo_kanban || 0 };
  };
  return { atual: lado(t.funil_ia?.atual), anterior: lado(t.funil_ia?.anterior) };
}

// Alerta da equipe: a melhor e a pior conversão de carteira (só quem tem carteira para avaliar). Ex.: uma com 25 na carteira
// converte 10 (40%) e outra com 20 converte 2 (10%) → diferença de 30 pontos → alerta.
export function alertaCarteiras(avaliadas) {
  const ok = avaliadas.filter((p) => p.status !== 'poucos' && p.taxa != null && p.ativa !== false);
  if (ok.length < 2) return null;
  const ord = [...ok].sort((a, b) => b.taxa - a.taxa);
  const melhor = ord[0], pior = ord[ord.length - 1];
  const gap = Math.round((melhor.taxa - pior.taxa) * 10) / 10;
  if (gap < DIFERENCA_ALERTA) return null;
  const q = (p) => `${br(p.taxa)}% (${p.atual.vendas} de ${p.atual.cadastros})`;
  return { melhor, pior, gap,
    texto: `${pior.nome} converte ${q(pior)} da carteira e ${melhor.nome} ${q(melhor)} — ${br(gap)} pontos de diferença. Os contatos chegam do mesmo jeito; o que muda é o acompanhamento. Vale olhar o kanban de ${pior.nome} (tempo de retorno, contatos atrasados) e o que ${melhor.nome} faz diferente.` };
}

// Pessoas do time já avaliadas (some quem não cadastrou nada nem neste mês nem no anterior)
export function avaliarTime(t) {
  const padrao = taxaConsultoras(t);
  const pessoas = (t.pessoas || []).filter((p) => p.atual.cadastros > 0 || p.anterior.cadastros > 0);
  const media = mediaCadastros(pessoas);
  return pessoas.map((p) => ({ ...p, ...avaliar(p, padrao, media) }));
}
