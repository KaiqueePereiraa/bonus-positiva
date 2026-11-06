// Relatórios — escolhe período, controle e consultoras; mostra na tela e exporta PDF, Excel ou CSV.
import * as dados from '../dados.js?v=20261106191808';
import { resumo, porConsultora, contarMotivos, gerarInsights } from '../analises.js?v=20261106191808';
import { barras, imagem } from '../graficos.js?v=20261106191808';
import { csv, excel, pdf } from '../exportar.js?v=20261106191808';
import { esc, dataLonga, dataHora, STATUS, NOMES_CONTROLE, toast, erro } from '../ui.js?v=20261106191808';
import { filtrosPadrao, htmlFiltros, lerFiltros, pessoasDoFiltro, carregar, periodoTexto } from './_analise.js?v=20261106191808';

let filtros;
const LOGO = new URL('../../../assets/logo-escuro.png', import.meta.url).href;

export async function render(el, ctx) {
  filtros ||= filtrosPadrao(ctx);
  el.innerHTML = `<div class="cartao"><h2>Montar relatório</h2>${htmlFiltros(filtros, ctx, { status: false })}
    <div class="linha-acoes" style="margin-top:16px">
      <button class="btn" data-exp="pdf">Baixar PDF</button><button class="btn sec" data-exp="xlsx">Baixar Excel</button><button class="btn sec" data-exp="csv">Baixar CSV</button>
    </div><p class="dica" style="margin-top:10px">O PDF abre numa janela para imprimir — escolha "Salvar como PDF". Telefones dos alunos não entram nos relatórios.</p></div>
    <div id="previa" style="display:flex;flex-direction:column;gap:22px"></div>`;
  let atual;
  const atualizar = async () => { lerFiltros(el, filtros); atual = await montar(el.querySelector('#previa'), ctx); };
  el.querySelector('.filtros').addEventListener('change', (e) => {
    if (e.target.dataset.f === 'unidade') { lerFiltros(el, filtros); filtros.consultora = ''; render(el, ctx); return; }
    atualizar();
  });
  el.querySelector('.linha-acoes').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-exp]');
    if (!b || !atual) return;
    b.disabled = true;
    try { await exportar(b.dataset.exp, atual, ctx); } catch (err) { erro(err); } finally { b.disabled = false; }
  });
  await atualizar();
}

// Dados + HTML do relatório (o mesmo HTML vai para o PDF).
async function montar(el, ctx) {
  el.innerHTML = '<div class="vazio">Montando relatório…</div>';
  const { tarefas, itensNf } = await carregar(filtros);
  const pessoas = pessoasDoFiltro(filtros, ctx);
  const r = resumo(tarefas);
  const linhas = porConsultora(tarefas, pessoas);
  const motivos = contarMotivos(itensNf, ctx.motivos);
  const insights = gerarInsights({ tarefas, itensNaoFechou: itensNf, motivos: ctx.motivos, hoje: ctx.hoje() });
  const titulo = `Relatório ${filtros.controle ? NOMES_CONTROLE[filtros.controle] : 'geral da equipe'}`;

  const corpo = `
    <h2>Resumo</h2>
    <div class="numeros">
      ${[['Tarefas', r.total], ['Concluídas', r.concluidas], ['Com atraso', r.comAtraso], ['Atrasadas', r.atrasadas], ['Cumprimento', `${r.cumprimento}%`]]
        .map(([k, v]) => `<div class="numero"><small>${k}</small><b>${v}</b></div>`).join('')}
    </div>
    <h2>Desempenho por consultora</h2>
    <table><thead><tr><th>Consultora</th><th>Tarefas</th><th>Concluídas</th><th>Atrasadas</th><th>Cumprimento</th><th>Itens feitos</th></tr></thead><tbody>
      ${linhas.map((l) => `<tr><td>${esc(l.nome)}</td><td>${l.total}</td><td>${l.concluidas}</td><td>${l.atrasadas}</td><td>${l.decididas ? `${l.cumprimento}%` : '—'}</td><td>${l.feitos}/${l.itens} (${l.pctItens}%)</td></tr>`).join('')}
    </tbody></table>
    <h2>Tarefas do período</h2>
    <table><thead><tr><th>Controle</th><th>Unidade</th><th>Consultora</th><th>Período</th><th>Prazo</th><th>Feitos</th><th>Status</th><th>Concluída em</th></tr></thead><tbody>
      ${[...tarefas].sort((a, b) => a.prazo.localeCompare(b.prazo)).map((t) => `<tr><td>${NOMES_CONTROLE[t.controle_id]}</td><td>${esc(ctx.nomeUnidade(t.unidade).replace('Positiva ', ''))}</td><td>${esc(ctx.nomeDe(t.responsavel_id))}</td>
        <td>${dataLonga(t.periodo_inicio)}</td><td>${dataLonga(t.prazo)}</td><td>${t.feitos}/${t.total}</td><td>${STATUS[t.status]?.rotulo}</td><td>${dataHora(t.concluida_em)}</td></tr>`).join('')}
    </tbody></table>
    ${motivos.length ? `<h2>Motivos de não fechamento</h2><div data-grafico="motivos"></div>
      <table><thead><tr><th>Motivo</th><th>Qtd.</th><th>%</th></tr></thead><tbody>${motivos.map((m) => `<tr><td>${esc(m.nome)}</td><td>${m.n}</td><td>${m.pct}%</td></tr>`).join('')}</tbody></table>` : ''}
    ${insights.length ? `<h2>Principais insights</h2>${insights.map((i) => `<div class="insight">${esc(i.texto)}<small>Base: ${esc(i.base)}</small></div>`).join('')}` : ''}`;

  el.innerHTML = `<div class="cartao relatorio"><h2>${esc(titulo)} · ${periodoTexto(filtros, ctx)}</h2>${corpo.replace('<div data-grafico="motivos"></div>',
    `<div class="grafico" style="height:${Math.max(200, motivos.length * 32)}px;margin-bottom:12px"><canvas id="g-rel-motivos"></canvas></div>`)}</div>`;
  el.querySelectorAll('.relatorio table').forEach((t) => { t.classList.add('tabela'); t.outerHTML = `<div class="tabela-wrap">${t.outerHTML}</div>`; });
  if (motivos.length) barras(el.querySelector('#g-rel-motivos'), motivos.map((m) => m.nome), motivos.map((m) => m.n), { horizontal: true });
  return { titulo, corpo, tarefas, itensNf, linhas, motivos, r, el };
}

async function exportar(tipo, a, ctx) {
  const base = `${a.titulo.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}_${filtros.desde}_a_${filtros.ate}`;
  if (tipo === 'pdf') {
    const img = imagem(a.el.querySelector('#g-rel-motivos'));
    pdf(a.titulo, `<header><img src="${LOGO}" alt=""><div><h1>${esc(a.titulo)}</h1><p>Central de Tarefas Positiva · ${periodoTexto(filtros, ctx)}${filtros.consultora ? ` · ${esc(ctx.nomeDe(filtros.consultora))}` : ''}</p></div></header>
      ${a.corpo.replace('<div data-grafico="motivos"></div>', img ? `<img class="grafico" src="${img}" alt="Gráfico de motivos">` : '')}`);
    return;
  }
  const registros = await linhasRegistros(a, ctx);
  if (tipo === 'csv') { csv(`${base}.csv`, registros); toast('CSV gerado.'); return; }
  await excel(`${base}.xlsx`, [
    { nome: 'Resumo', linhas: [['Indicador', 'Valor'], ['Período', periodoTexto(filtros, ctx)], ['Tarefas', a.r.total], ['Concluídas', a.r.concluidas],
      ['Concluídas com atraso', a.r.comAtraso], ['Atrasadas', a.r.atrasadas], ['Cumprimento dos prazos (%)', a.r.cumprimento], ['Itens feitos', a.r.feitos], ['Itens totais', a.r.itens]] },
    { nome: 'Por consultora', linhas: [['Consultora', 'Tarefas', 'Concluídas', 'Com atraso', 'Atrasadas', 'Cumprimento (%)', 'Itens feitos', 'Itens totais', 'Itens feitos (%)'],
      ...a.linhas.map((l) => [l.nome, l.total, l.concluidas, l.comAtraso, l.atrasadas, l.decididas ? l.cumprimento : '', l.feitos, l.itens, l.pctItens])] },
    { nome: 'Tarefas', linhas: [['Controle', 'Unidade', 'Consultora', 'Início', 'Prazo', 'Feitos', 'Total', 'Status', 'Concluída em'],
      ...a.tarefas.map((t) => [NOMES_CONTROLE[t.controle_id], ctx.nomeUnidade(t.unidade), ctx.nomeDe(t.responsavel_id), t.periodo_inicio, t.prazo, t.feitos, t.total, STATUS[t.status]?.rotulo, t.concluida_em ? dataHora(t.concluida_em) : ''])] },
    ...(a.motivos.length ? [{ nome: 'Motivos', linhas: [['Motivo', 'Quantidade', '%'], ...a.motivos.map((m) => [m.nome, m.n, m.pct])] }] : []),
    { nome: 'Registros', linhas: registros },
  ]);
  toast('Excel gerado.');
}

// Um registro por aluno/interessado das tarefas do relatório (sem telefone).
async function linhasRegistros(a, ctx) {
  const ids = new Set(a.tarefas.map((t) => t.id));
  const controles = filtros.controle ? [filtros.controle] : ['inadimplencia', 'risco', 'nao_fechou'];
  const itens = (await Promise.all(controles.map((c) => dados.itensPeriodo({ controle: c, desde: filtros.desde, ate: filtros.ate, unidade: filtros.unidade || undefined }))))
    .flat().filter((i) => ids.has(i.tarefa_id));
  const motivo = (id) => ctx.motivos.find((m) => m.id === id)?.nome || '';
  return [['Controle', 'Unidade', 'Consultora', 'Prazo', 'ID EVO', 'Nome', 'Situação', 'Data da ação', 'Motivo', 'Detalhe do motivo', 'Observação'],
    ...itens.map((i) => [NOMES_CONTROLE[i.controle_id], ctx.nomeUnidade(i.tarefas?.unidade), ctx.nomeDe(i.responsavel_id), i.tarefas?.prazo, i.evo_id, i.nome,
      i.feito_em ? (i.controle_id === 'nao_fechou' ? 'Preenchido' : 'Mensagem enviada') : 'Pendente',
      i.feito_em ? dataHora(i.feito_em) : '', motivo(i.motivo_id), i.motivo_texto || '', i.observacao || ''])];
}
