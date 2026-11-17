// Cálculos de indicadores e insights (puros; testados em tests/analises.test.js).
// tarefa: linha de tarefas_status { controle_id, responsavel_id, prazo, periodo_inicio, status, total, feitos }
// item:   linha de itens (do "Por que não fechou?") com motivo_id, dados, tarefas.periodo_inicio

import { semanaDe } from './regras.js?v=20261116225256';

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const rotuloMes = (aaaamm) => `${MESES[+aaaamm.slice(5, 7) - 1]}/${aaaamm.slice(2, 4)}`;
const nomeMes = (aaaamm) => `${['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][+aaaamm.slice(5, 7) - 1]}`;

// Cumprimento = concluídas no prazo ÷ tarefas já "decididas" (concluídas + atrasadas).
// Tarefas ainda dentro do prazo não entram — não dá para dizer se foram cumpridas.
export function resumo(tarefas) {
  const c = { total: tarefas.length, noPrazo: 0, comAtraso: 0, atrasadas: 0, abertas: 0, itens: 0, feitos: 0 };
  for (const t of tarefas) {
    if (t.status === 'concluida') c.noPrazo++;
    else if (t.status === 'concluida_atraso') c.comAtraso++;
    else if (t.status === 'atrasada') c.atrasadas++;
    else c.abertas++;
    c.itens += t.total;
    c.feitos += t.feitos;
  }
  c.concluidas = c.noPrazo + c.comAtraso;
  c.decididas = c.concluidas + c.atrasadas;
  c.cumprimento = pct(c.noPrazo, c.decididas);
  c.pctItens = pct(c.feitos, c.itens);
  return c;
}

// Volume (quantos itens recebeu) e percentuais lado a lado — sem ranking por volume.
export function porConsultora(tarefas, consultoras) {
  return consultoras.map((p) => {
    const minhas = tarefas.filter((t) => t.responsavel_id === p.id);
    const r = resumo(minhas);
    const ctrl = (id) => resumo(minhas.filter((t) => t.controle_id === id));
    return { id: p.id, nome: p.nome, ...r, risco: ctrl('risco'), naoFechou: ctrl('nao_fechou'), inadimplencia: ctrl('inadimplencia') };
  });
}

// Agrupa tarefas já vencidas por semana (segunda) ou mês do prazo.
export function evolucao(tarefas, por = 'semana', hoje) {
  const grupos = new Map();
  for (const t of tarefas.filter((x) => x.prazo <= hoje)) {
    const chave = por === 'semana' ? semanaDe(t.prazo).inicio : t.prazo.slice(0, 7);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(t);
  }
  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([chave, ts]) => {
    const r = resumo(ts);
    return { chave, rotulo: por === 'semana' ? `${chave.slice(8, 10)}/${chave.slice(5, 7)}` : rotuloMes(chave), ...r };
  });
}

// ── Motivos do "Por que não fechou?" ──
const preenchidos = (itens) => itens.filter((i) => i.motivo_id && i.feito_em);
const mesRef = (i) => (i.tarefas?.periodo_inicio || i.periodo_inicio || '').slice(0, 7);

export function contarMotivos(itens, motivos) {
  const validos = preenchidos(itens);
  const n = new Map();
  validos.forEach((i) => n.set(i.motivo_id, (n.get(i.motivo_id) || 0) + 1));
  return [...n.entries()].map(([id, qtd]) => ({ id, nome: motivos.find((m) => m.id === id)?.nome || '—', n: qtd, pct: pct(qtd, validos.length) }))
    .sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome));
}

// Linhas = consultoras, colunas = motivos (contagem).
export function motivosPorConsultora(itens, motivos, consultoras) {
  const validos = preenchidos(itens);
  const usados = contarMotivos(validos, motivos);
  return {
    motivos: usados,
    linhas: consultoras.map((c) => {
      const meus = validos.filter((i) => i.responsavel_id === c.id);
      return { nome: c.nome, total: meus.length, valores: usados.map((m) => meus.filter((i) => i.motivo_id === m.id).length) };
    }).filter((l) => l.total > 0),
  };
}

export function motivosPorMes(itens, motivos) {
  const validos = preenchidos(itens);
  const meses = [...new Set(validos.map(mesRef))].filter(Boolean).sort();
  return meses.map((m) => ({ mes: m, rotulo: rotuloMes(m), motivos: contarMotivos(validos.filter((i) => mesRef(i) === m), motivos) }));
}

// Para cada valor de um campo (ex.: como_conheceu), o motivo mais comum.
export function cruzamento(itens, motivos, campo, { minimo = 5 } = {}) {
  const validos = preenchidos(itens).filter((i) => i.dados?.[campo]);
  const valores = [...new Set(validos.map((i) => i.dados[campo]))];
  return valores.map((v) => {
    const grupo = validos.filter((i) => i.dados[campo] === v);
    const top = contarMotivos(grupo, motivos)[0];
    return { valor: v, total: grupo.length, motivo: top?.nome, n: top?.n || 0, pct: top ? pct(top.n, grupo.length) : 0 };
  }).filter((x) => x.total >= minimo).sort((a, b) => b.pct - a.pct || b.total - a.total);
}

// ── Resultado dos contatos (conferido na EVO) ──
// Taxa = positivos ÷ contatos que já têm resultado; os que ainda estão na janela aparecem como "aguardando".
const POSITIVO = { inadimplencia: 'pagou', risco: 'voltou', nao_fechou: 'matriculou' };
export function resultadoDe(itens) {
  const r = {};
  for (const c of Object.keys(POSITIVO)) {
    const meus = itens.filter((i) => i.controle_id === c && i.feito_em && !String(i.resultado || '').endsWith('_sem_contato'));
    const decididos = meus.filter((i) => i.resultado);
    const positivos = decididos.filter((i) => i.resultado === POSITIVO[c]);
    r[c] = { contatos: meus.length, decididos: decididos.length, positivos: positivos.length, aguardando: meus.length - decididos.length,
      taxa: pct(positivos.length, decididos.length), valor: Math.round(positivos.reduce((s, i) => s + (Number(i.resultado_valor) || 0), 0) * 100) / 100 };
  }
  return r;
}
export const resultadosPorConsultora = (itens, consultoras) =>
  consultoras.map((p) => ({ id: p.id, nome: p.nome, ...resultadoDe(itens.filter((i) => i.responsavel_id === p.id)) }))
    .filter((l) => Object.keys(POSITIVO).some((c) => l[c].contatos));

// ── O que aconteceu de fato: junta o motivo escolhido com o que a consultora escreveu ──
export const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// ordem importa: o primeiro grupo que casar vence
export const GRUPOS_REAIS = [
  { id: 'ja_aluno', nome: 'Já é aluno / cadastro duplicado', acao: 'Corrigir os cadastros feitos pela IA de atendimento (aluno x responsável) e excluir duplicados antes de montar a lista.',
    motivo: /ja e aluno|duplicad/, texto: /ja e alun|cadastr\w* dupl|duplicad|ja fechou|ja tem (um )?cadastro|o aluno e o filh|filh[oa] que fez|aula e d[oa] filh|ex.?colaborador/ },
  { id: 'saude', nome: 'Saúde / liberação médica', acao: 'Combinar o retorno para depois da consulta e mandar a lista de exames aceitos.',
    motivo: /medic|saude/, texto: /cardiolog|medic|saude|atestado|lesao|cirurg|gravid/ },
  { id: 'convenio', nome: 'Gympass / convênio', acao: 'Explicar como o Gympass/Wellhub e os convênios funcionam na unidade e oferecer o plano aceito.',
    motivo: /gympass|convenio/, texto: /gympass|wellhub|totalpass|convenio/ },
  { id: 'sem_resposta', nome: 'Parou de responder', acao: 'Fazer uma sequência de retomada: nova mensagem em 2 e em 7 dias, com horário de experimental já sugerido.',
    motivo: /nao respondeu|parou de responder/, texto: /respond|retornou|resposta|visualiz/ },
  { id: 'experimental', nome: 'Ainda não fez a experimental', acao: 'Confirmar a experimental no dia anterior e reagendar na mesma semana quem faltou.',
    motivo: /experimental/, texto: /experimental|agend|aula/ },
  { id: 'preco', nome: 'Preço / pagamento', acao: 'Revisar a oferta: condição de pagamento, plano mais longo ou matrícula promocional.',
    motivo: /preco|pagamento/, texto: /caro|preco|valor|pagament|dinheiro|parcel/ },
  { id: 'concorrente', nome: 'Concorrente / atendimento', acao: 'Ligar para entender o que a outra academia ofereceu e revisar o atendimento.',
    motivo: /concorrente/, texto: /concorr|outra (academia|escola)|atendid|atendimento/ },
  { id: 'horario', nome: 'Horário / vaga', acao: 'Mostrar as turmas com vaga e abrir lista de espera para o horário pedido.',
    motivo: /horario|vaga/, texto: /horario|vaga|turma/ },
  { id: 'depois', nome: 'Vai decidir depois', acao: 'Marcar a data combinada e retomar o contato nela.',
    motivo: /decidir depois/, texto: /depois|pensando|vendo|mes que vem|janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/ },
  { id: 'sem_info', nome: 'Sem informação', acao: 'Registrar a conversa no cadastro; sem histórico não dá para recuperar a venda.',
    motivo: /^$/, texto: /nao encontrei|achar a conversa|sem informac|nao fala o motivo/ },
];

export function grupoReal(item, motivos) {
  const nome = semAcento(motivos.find((m) => m.id === item.motivo_id)?.nome);
  const texto = semAcento(`${item.motivo_texto || ''} ${item.observacao || ''}`);
  const ehOutro = !nome || /^outro/.test(nome);
  if (!ehOutro) {
    const g = GRUPOS_REAIS.find((x) => x.motivo.test(nome));
    if (g) return { ...g, deOutro: false };
  }
  const g = GRUPOS_REAIS.find((x) => x.texto.test(texto));
  return g ? { ...g, deOutro: ehOutro } : { id: 'outros', nome: 'Outros', acao: '', deOutro: ehOutro };
}

export function gruposReais(itens, motivos) {
  const n = new Map();
  for (const i of itens) {
    const g = grupoReal(i, motivos);
    const atual = n.get(g.id) || { id: g.id, nome: g.nome, acao: g.acao, n: 0, deOutro: 0 };
    atual.n++;
    if (g.deOutro) atual.deOutro++;
    n.set(g.id, atual);
  }
  return [...n.values()].map((x) => ({ ...x, pct: pct(x.n, itens.length) })).sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome));
}

// ── Insights: só frases verificáveis, com os números, e só com amostra mínima ──
export function gerarInsights({ tarefas, itensNaoFechou, motivos, hoje, minimo = 10, variacaoMinima = 5 }) {
  const lista = [];
  const add = (tipo, texto, base, acao) => lista.push({ tipo, texto, base, ...(acao ? { acao } : {}) });

  // 1, 2 e 3 — o que aconteceu de fato (motivo + texto livre), venda perdida de verdade, "Outro" alto
  const comMotivo = preenchidos(itensNaoFechou);
  const mesesNf = [...new Set(comMotivo.map(mesRef))].filter(Boolean).sort();
  const mesAtual = mesesNf.at(-1);
  const doMes = comMotivo.filter((i) => mesRef(i) === mesAtual);
  if (mesAtual && doMes.length >= minimo) {
    const g = gruposReais(doMes, motivos);
    const naoPerdida = g.find((x) => x.id === 'ja_aluno');
    if (naoPerdida && naoPerdida.pct >= 10) {
      add('comercial', `${naoPerdida.pct}% dos registros de ${nomeMes(mesAtual)} não eram venda perdida: a pessoa já é aluna ou o cadastro estava duplicado/no nome do responsável.`,
        `${naoPerdida.n} de ${doMes.length} registros (motivo + texto escrito)`, naoPerdida.acao);
    }
    const perdidas = g.filter((x) => x.id !== 'ja_aluno' && x.id !== 'outros');
    const totalPerdidas = doMes.length - (naoPerdida?.n || 0);
    for (const x of perdidas.slice(0, 2)) {
      const p2 = pct(x.n, totalPerdidas);
      if (x.n < 3 || p2 < 15) continue;
      add('comercial', `Entre as vendas perdidas de ${nomeMes(mesAtual)}, ${p2}% foram por "${x.nome}".`,
        `${x.n} de ${totalPerdidas} vendas perdidas${x.deOutro ? ` · ${x.deOutro} identificadas pelo texto de "Outro motivo"` : ''}`, x.acao);
    }
    const outro = motivos.filter((m) => /^outro/i.test(semAcento(m.nome))).map((m) => m.id);
    const deOutro = doMes.filter((i) => outro.includes(i.motivo_id));
    if (deOutro.length && pct(deOutro.length, doMes.length) > 15) {
      const temas = gruposReais(deOutro, motivos).filter((x) => x.id !== 'outros').slice(0, 3);
      if (temas.length) {
        add('comercial', `${pct(deOutro.length, doMes.length)}% dos registros usaram "Outro motivo". Os textos falam principalmente de: ${temas.map((t) => `${t.nome} (${t.n})`).join(', ')}.`,
          `${deOutro.length} de ${doMes.length} registros`, 'Use os motivos novos da lista para esses casos — assim a análise fica automática.');
      }
    }
    // variação do principal motivo real contra o mês anterior
    const mesAnt = mesesNf.at(-2);
    const doAnt = comMotivo.filter((i) => mesRef(i) === mesAnt);
    if (mesAnt && doAnt.length >= minimo && perdidas[0]) {
      const antes = gruposReais(doAnt, motivos).find((x) => x.id === perdidas[0].id)?.pct || 0;
      const agora = perdidas[0].pct;
      if (Math.abs(agora - antes) >= variacaoMinima) {
        add('comercial', `"${perdidas[0].nome}" ${agora > antes ? 'subiu' : 'caiu'} de ${antes}% para ${agora}% dos registros em relação a ${nomeMes(mesAnt)}.`,
          `${doAnt.length} registros em ${rotuloMes(mesAnt)} · ${doMes.length} em ${rotuloMes(mesAtual)}`);
      }
    }
    // canal de chegada com um problema dominante
    const porCanal = new Map();
    for (const i of doMes.filter((x) => x.dados?.como_conheceu)) {
      const k = i.dados.como_conheceu;
      if (!porCanal.has(k)) porCanal.set(k, []);
      porCanal.get(k).push(i);
    }
    const canais = [...porCanal.entries()].filter(([, l]) => l.length >= Math.ceil(minimo / 2))
      .map(([canal, l]) => ({ canal, total: l.length, top: gruposReais(l, motivos).filter((x) => x.id !== 'outros')[0] }))
      .filter((c) => c.top && c.top.pct >= 40).sort((a, b) => b.top.pct - a.top.pct);
    if (canais[0]) add('comercial', `Entre os interessados que chegaram por ${canais[0].canal}, ${canais[0].top.pct}% ficaram em "${canais[0].top.nome}".`,
      `${canais[0].top.n} de ${canais[0].total} interessados`, canais[0].top.acao);
  }

  // 4 — risco de abandono da última semana encerrada
  const riscoVencido = tarefas.filter((t) => t.controle_id === 'risco' && t.prazo < hoje);
  const ultimaSemana = riscoVencido.map((t) => t.periodo_inicio).sort().at(-1);
  if (ultimaSemana) {
    const daSemana = riscoVencido.filter((t) => t.periodo_inicio === ultimaSemana);
    const r = resumo(daSemana);
    if (r.itens >= minimo) {
      add('produtividade', `A equipe enviou ${r.pctItens}% das mensagens de risco de abandono na semana de ${ultimaSemana.slice(8, 10)}/${ultimaSemana.slice(5, 7)}.`,
        `${r.feitos} de ${r.itens} alunos · ${r.noPrazo} de ${daSemana.length} consultoras concluíram no prazo`);
    }
  }

  // 5 — atrasos nos últimos 30 dias
  const limite = new Date(new Date(`${hoje}T12:00:00Z`).getTime() - 30 * 864e5).toISOString().slice(0, 10);
  const recentes = tarefas.filter((t) => t.prazo >= limite && t.prazo < hoje);
  if (recentes.length >= 3) {
    const r = resumo(recentes);
    add('prazos', r.comAtraso + r.atrasadas === 0
      ? 'Nos últimos 30 dias, todas as tarefas vencidas foram concluídas dentro do prazo.'
      : `Nos últimos 30 dias, ${r.comAtraso} tarefa(s) foram concluídas após o prazo e ${r.atrasadas} continuam atrasadas.`,
      `${recentes.length} tarefas com prazo no período`);
  }

  // 6 — cumprimento: mês atual vs. anterior
  const meses = evolucao(tarefas, 'mes', hoje);
  const [mAnt, mAtu] = meses.slice(-2);
  if (mAnt && mAtu && mAnt.decididas >= 5 && mAtu.decididas >= 5 && Math.abs(mAtu.cumprimento - mAnt.cumprimento) >= variacaoMinima) {
    add('prazos', `O cumprimento dos prazos ${mAtu.cumprimento > mAnt.cumprimento ? 'subiu' : 'caiu'} de ${mAnt.cumprimento}% em ${nomeMes(mAnt.chave)} para ${mAtu.cumprimento}% em ${nomeMes(mAtu.chave)}.`,
      `${mAnt.decididas} e ${mAtu.decididas} tarefas vencidas`);
  }
  return lista;
}
