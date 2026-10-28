// Cálculos de indicadores e insights (puros; testados em tests/analises.test.js).
// tarefa: linha de tarefas_status { controle_id, responsavel_id, prazo, periodo_inicio, status, total, feitos }
// item:   linha de itens (do "Por que não fechou?") com motivo_id, dados, tarefas.periodo_inicio

import { semanaDe } from './regras.js';

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

// ── Insights: só frases verificáveis, com os números, e só com amostra mínima ──
export function gerarInsights({ tarefas, itensNaoFechou, motivos, hoje, minimo = 10, variacaoMinima = 5 }) {
  const lista = [];
  const add = (tipo, texto, base) => lista.push({ tipo, texto, base });

  // 1 e 2 — motivos do último mês com dados vs. o anterior
  const porMes = motivosPorMes(itensNaoFechou, motivos);
  const atual = porMes.at(-1);
  const anterior = porMes.at(-2);
  const totalDe = (m) => m?.motivos.reduce((s, x) => s + x.n, 0) || 0;
  if (atual && totalDe(atual) >= minimo) {
    const top = atual.motivos[0];
    const empatados = atual.motivos.filter((m) => m.n === top.n);
    if (empatados.length > 1) {
      add('comercial', `${empatados.map((m) => `"${m.nome}"`).join(' e ')} empataram como motivos mais registrados em ${nomeMes(atual.mes)}, com ${top.pct}% das justificativas cada.`,
        `${top.n} de ${totalDe(atual)} justificativas cada`);
    } else {
      add('comercial', `"${top.nome}" foi o motivo mais registrado entre os não fechamentos de ${nomeMes(atual.mes)}, representando ${top.pct}% das justificativas.`,
        `${top.n} de ${totalDe(atual)} justificativas`);
    }
    if (anterior && totalDe(anterior) >= minimo) {
      const variacoes = atual.motivos.map((m) => {
        const antes = anterior.motivos.find((x) => x.id === m.id)?.pct || 0;
        return { ...m, antes, diff: m.pct - antes };
      });
      anterior.motivos.filter((m) => !atual.motivos.some((x) => x.id === m.id)).forEach((m) => variacoes.push({ ...m, pct: 0, antes: m.pct, diff: -m.pct }));
      const maior = variacoes.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];
      if (maior && Math.abs(maior.diff) >= variacaoMinima) {
        add('comercial', `Os registros de "${maior.nome}" ${maior.diff > 0 ? 'aumentaram' : 'diminuíram'} de ${maior.antes}% para ${maior.pct}% em relação a ${nomeMes(anterior.mes)}.`,
          `${totalDe(anterior)} justificativas em ${rotuloMes(anterior.mes)} · ${totalDe(atual)} em ${rotuloMes(atual.mes)}`);
      }
    }
    // 3 — cruzamento com "como conheceu"
    const itensAtual = itensNaoFechou.filter((i) => mesRef(i) === atual.mes);
    const cruz = cruzamento(itensAtual, motivos, 'como_conheceu', { minimo: Math.ceil(minimo / 2) }).find((c) => c.pct >= 40);
    if (cruz) add('comercial', `Entre os interessados que chegaram por ${cruz.valor}, ${cruz.pct}% não fecharam por "${cruz.motivo}".`, `${cruz.n} de ${cruz.total} interessados`);
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
