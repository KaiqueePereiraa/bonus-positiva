// Relatório do "Por que não fechou?" para apresentar à diretoria (cálculo puro; testado em tests/relatorio-nf.test.js).
// itens: linhas de `itens` (controle nao_fechou) — inclui quem ainda não tem consultora.
// importacoes: linhas de `importacoes` { id, unidade, referencia_inicio } das listas escolhidas.
import { contarMotivos, cruzamento, gerarInsights } from './analises.js?v=20261106191808';

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const nomeMesRef = (iso) => (iso ? `${MESES[+iso.slice(5, 7) - 1][0].toUpperCase()}${MESES[+iso.slice(5, 7) - 1].slice(1)}/${iso.slice(0, 4)}` : '—');

const FAIXAS = [['Até 12 anos', 0, 12], ['13 a 17 anos', 13, 17], ['18 a 39 anos', 18, 39], ['40 a 59 anos', 40, 59], ['60 anos ou mais', 60, 200]];
export function faixaIdade(idade) {
  if (idade == null || !Number.isFinite(+idade)) return 'Sem idade informada';
  return FAIXAS.find(([, de, ate]) => idade >= de && idade <= ate)?.[0] || 'Sem idade informada';
}

const preenchido = (i) => !!(i.motivo_id && i.feito_em);

// Um grupo de interessados: quantos são, quantos têm motivo e qual o motivo mais comum.
function resumoGrupo(rotulo, grupo, motivos) {
  const comMotivo = grupo.filter(preenchido);
  const top = contarMotivos(comMotivo, motivos)[0];
  return { rotulo, total: grupo.length, preenchidos: comMotivo.length, pctPreenchido: pct(comMotivo.length, grupo.length),
    motivo: top?.nome || '—', n: top?.n || 0, pctMotivo: top ? pct(top.n, comMotivo.length) : 0 };
}

function agrupar(itens, chave, motivos, { ordem } = {}) {
  const mapa = new Map();
  for (const i of itens) {
    const k = chave(i);
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(i);
  }
  const linhas = [...mapa.entries()].map(([k, g]) => resumoGrupo(k, g, motivos));
  return ordem ? linhas.sort(ordem) : linhas.sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo));
}

export function montarRelatorioNF({ itens, motivos, importacoes, nomeDe = (id) => id, nomeUnidade = (id) => id, hoje }) {
  const imp = new Map(importacoes.map((i) => [i.id, i]));
  const todos = itens.map((i) => {
    const m = imp.get(i.importacao_id);
    return { ...i, unidade: m?.unidade || '', periodo_inicio: m?.referencia_inicio || '' };
  });
  const comMotivo = todos.filter(preenchido);
  const total = todos.length;
  const resumo = { total, preenchidos: comMotivo.length, pendentes: total - comMotivo.length, pctPreenchido: pct(comMotivo.length, total) };
  const lista = contarMotivos(todos, motivos);

  const porUnidade = agrupar(todos, (i) => nomeUnidade(i.unidade) || 'Sem unidade', motivos);
  const porConsultora = agrupar(todos, (i) => (i.responsavel_id ? nomeDe(i.responsavel_id) : 'Sem responsável'), motivos);
  const porOrigem = agrupar(todos, (i) => i.dados?.como_conheceu || 'Não informado', motivos);
  const porInteresse = agrupar(todos, (i) => i.dados?.interesse || 'Não informado', motivos);
  const ordemFaixa = (a, b) => [...FAIXAS.map((f) => f[0]), 'Sem idade informada'].indexOf(a.rotulo) - [...FAIXAS.map((f) => f[0]), 'Sem idade informada'].indexOf(b.rotulo);
  const porFaixa = agrupar(todos, (i) => faixaIdade(i.dados?.idade), motivos, { ordem: ordemFaixa });
  const porMes = agrupar(todos, (i) => i.periodo_inicio || 'Sem mês', motivos, { ordem: (a, b) => a.rotulo.localeCompare(b.rotulo) })
    .map((l) => ({ ...l, rotulo: nomeMesRef(l.rotulo) }));

  // Insights: as frases de motivos do painel de Insights + resumos deste relatório. Só com amostra mínima.
  const insights = gerarInsights({ tarefas: [], itensNaoFechou: todos, motivos, hoje, minimo: 10 })
    .map((i) => ({ texto: i.texto, base: i.base }));
  if (comMotivo.length >= 10 && lista.length >= 3) {
    const top3 = lista.slice(0, 3);
    const soma = top3.reduce((s, m) => s + m.n, 0);
    insights.push({ texto: `Três motivos concentram ${pct(soma, comMotivo.length)}% das justificativas: ${top3.map((m) => `"${m.nome}"`).join(', ')}.`, base: `${soma} de ${comMotivo.length} justificativas` });
  }
  const origem = cruzamento(todos, motivos, 'como_conheceu', { minimo: 5 }).find((c) => c.pct >= 40);
  if (origem && !insights.some((i) => i.texto.includes(origem.valor))) {
    insights.push({ texto: `Entre os interessados que chegaram por ${origem.valor}, ${origem.pct}% não fecharam por "${origem.motivo}".`, base: `${origem.n} de ${origem.total} interessados` });
  }
  if (resumo.pendentes > 0) {
    insights.push({ texto: `${resumo.pendentes} interessado(s) ainda estão sem motivo preenchido (${pct(resumo.pendentes, total)}% do total).`, base: `${total} interessados no período` });
  }

  return { resumo, motivos: lista, porUnidade, porConsultora, porOrigem, porInteresse, porFaixa, porMes, insights, itens: todos };
}

// Uma linha por interessado (sem telefone): para a aba "Interessados" do Excel.
export const CABECALHO_INTERESSADOS = ['Unidade', 'Mês de referência', 'Consultora', 'Nome', 'ID EVO', 'Data de cadastro', 'Idade', 'Como conheceu', 'Interesse', 'Consultora no EVO', 'Situação', 'Motivo', 'Detalhe do motivo', 'Observação'];

export function linhasInteressados(itens, { motivos, nomeDe, nomeUnidade }) {
  const nomeMotivo = (id) => motivos.find((m) => m.id === id)?.nome || '';
  const dataBR = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');
  return [...itens]
    .sort((a, b) => (a.unidade || '').localeCompare(b.unidade || '') || (a.periodo_inicio || '').localeCompare(b.periodo_inicio || '') || (a.nome || '').localeCompare(b.nome || ''))
    .map((i) => [nomeUnidade(i.unidade), nomeMesRef(i.periodo_inicio), i.responsavel_id ? nomeDe(i.responsavel_id) : 'Sem responsável', i.nome, i.evo_id,
      dataBR(i.dados?.data_cadastro), i.dados?.idade ?? '', i.dados?.como_conheceu || '', i.dados?.interesse || '', i.dados?.consultor_evo || '',
      preenchido(i) ? 'Motivo preenchido' : 'Pendente', nomeMotivo(i.motivo_id), i.motivo_texto || '', i.observacao || '']);
}
