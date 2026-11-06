// Cartão "Relatório para a diretoria" do "Por que não fechou?" (só admin): escolhe mês e unidade e baixa
//  • Excel completo: resumo, motivos, por unidade/consultora/origem/interesse/faixa etária, insights e TODOS os interessados;
//  • PDF executivo: números, gráfico de motivos, tabelas e insights.
// Telefones nunca entram.
import * as dados from '../dados.js?v=20261106194830';
import { montarRelatorioNF, linhasInteressados, CABECALHO_INTERESSADOS, nomeMesRef } from '../relatorio-nf.js?v=20261106194830';
import { barras, imagem } from '../graficos.js?v=20261106194830';
import { excel, pdf } from '../exportar.js?v=20261106194830';
import { esc, toast, erro } from '../ui.js?v=20261106194830';

const LOGO = new URL('../../../assets/logo-escuro.png', import.meta.url).href;
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function cartaoRelatorioDiretoria(el, ctx) {
  if (!el) return;
  let imports;
  try { imports = await dados.importacoes('nao_fechou', { limite: 100 }); } catch (e) { erro(e); return; }
  if (!imports.length) { el.innerHTML = ''; return; }

  const meses = [...new Set(imports.map((i) => i.referencia_inicio))].sort().reverse();
  const unidades = ctx.unidades.filter((u) => imports.some((i) => i.unidade === u.id));
  const opt = (v, r, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(r)}</option>`;
  el.innerHTML = `<div class="cartao"><h2>Relatório para a diretoria</h2>
    <p class="dica" style="margin-bottom:14px">Baixe os motivos de não fechamento para apresentar. O <b>Excel</b> traz tudo (todos os interessados com o motivo, resumo, quebras por unidade, consultora, origem e idade, e os insights). O <b>PDF</b> é a versão executiva, com gráfico. Telefones não entram.</p>
    <div class="filtros" style="margin-bottom:12px">
      <label class="campo">Mês<select data-r="mes">${opt('', 'Todos os meses', meses[0])}${meses.map((m) => opt(m, nomeMesRef(m), meses[0])).join('')}</select></label>
      <label class="campo">Unidade<select data-r="unidade">${opt('', 'Todas as unidades', '')}${unidades.map((u) => opt(u.id, u.nome, '')).join('')}</select></label>
    </div>
    <p class="dica" id="rel-info" style="margin-bottom:12px"></p>
    <div class="linha-acoes"><button class="btn" data-r-exp="xlsx">Baixar Excel</button><button class="btn sec" data-r-exp="pdf">Baixar PDF</button></div></div>`;

  const escolha = () => ({ mes: el.querySelector('[data-r="mes"]').value, unidade: el.querySelector('[data-r="unidade"]').value });
  const selecionadas = () => { const f = escolha(); return imports.filter((i) => (!f.mes || i.referencia_inicio === f.mes) && (!f.unidade || i.unidade === f.unidade)); };
  const info = () => {
    const sel = selecionadas();
    el.querySelector('#rel-info').textContent = sel.length
      ? `${sel.reduce((s, i) => s + i.linhas, 0)} interessados em ${sel.length} lista(s) importada(s).`
      : 'Nenhuma lista importada com essa combinação.';
  };
  info();
  el.addEventListener('change', (e) => { if (e.target.dataset.r) info(); });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-r-exp]');
    if (!b) return;
    const sel = selecionadas();
    if (!sel.length) return toast('Nenhuma lista importada com essa combinação.', 'erro');
    b.disabled = true;
    try {
      const itens = await dados.itensDasImportacoes(sel.map((i) => i.id));
      const rel = montarRelatorioNF({ itens, motivos: ctx.motivos, importacoes: sel, nomeDe: ctx.nomeDe, nomeUnidade: ctx.nomeUnidade, hoje: ctx.hoje() });
      const f = escolha();
      const quando = f.mes ? nomeMesRef(f.mes) : 'Todos os meses';
      const onde = f.unidade ? ctx.nomeUnidade(f.unidade) : 'Todas as unidades';
      const base = `por-que-nao-fechou_${f.mes ? f.mes.slice(0, 7) : 'todos-os-meses'}_${f.unidade || 'todas-as-unidades'}`;
      if (b.dataset.rExp === 'pdf') baixarPdf(rel, { quando, onde });
      else { await baixarExcel(rel, ctx, { quando, onde, base }); toast('Excel gerado.'); }
    } catch (err) { erro(err); } finally { b.disabled = false; }
  });
}

// Tabela "grupo → total, com motivo, % e motivo mais comum" usada em várias abas.
const CAB_GRUPO = (titulo) => [titulo, 'Interessados', 'Com motivo', 'Preenchido (%)', 'Motivo mais comum', 'Qtd.', '% dos preenchidos'];
const linhaGrupo = (l) => [l.rotulo, l.total, l.preenchidos, l.pctPreenchido, l.motivo, l.n, l.pctMotivo];

async function baixarExcel(rel, ctx, { quando, onde, base }) {
  const r = rel.resumo;
  const top = rel.motivos[0];
  await excel(`${base}.xlsx`, [
    { nome: 'Resumo', linhas: [['Indicador', 'Valor'], ['Período', quando], ['Unidade', onde], ['Interessados que não fecharam', r.total], ['Com motivo preenchido', r.preenchidos],
      ['Sem motivo ainda', r.pendentes], ['Preenchimento (%)', r.pctPreenchido], ['Motivo mais comum', top ? top.nome : '—'], ['Qtd. do motivo mais comum', top ? top.n : ''],
      ['% do motivo mais comum', top ? top.pct : '']] },
    { nome: 'Motivos', linhas: [['Motivo', 'Quantidade', '% dos preenchidos'], ...rel.motivos.map((m) => [m.nome, m.n, m.pct])] },
    { nome: 'Por mês', linhas: [CAB_GRUPO('Mês'), ...rel.porMes.map(linhaGrupo)] },
    { nome: 'Por unidade', linhas: [CAB_GRUPO('Unidade'), ...rel.porUnidade.map(linhaGrupo)] },
    { nome: 'Por consultora', linhas: [CAB_GRUPO('Consultora'), ...rel.porConsultora.map(linhaGrupo)] },
    { nome: 'Como conheceu', linhas: [CAB_GRUPO('Como conheceu'), ...rel.porOrigem.map(linhaGrupo)] },
    { nome: 'Interesse', linhas: [CAB_GRUPO('Interesse'), ...rel.porInteresse.map(linhaGrupo)] },
    { nome: 'Faixa etária', linhas: [CAB_GRUPO('Faixa etária'), ...rel.porFaixa.map(linhaGrupo)] },
    { nome: 'Insights', linhas: [['Insight', 'Base'], ...(rel.insights.length ? rel.insights.map((i) => [i.texto, i.base]) : [['Ainda não há dados suficientes para gerar insights (mínimo de 10 justificativas).', '']])] },
    { nome: 'Interessados', linhas: [CABECALHO_INTERESSADOS, ...linhasInteressados(rel.itens, ctx)] },
  ]);
}

// Gráfico de motivos desenhado fora da tela só para virar imagem no PDF.
function imagemMotivos(motivos) {
  if (!motivos.length || !window.Chart) return '';
  const caixa = document.createElement('div');
  caixa.style.cssText = `position:fixed;left:-10000px;top:0;width:760px;height:${Math.max(200, motivos.length * 34)}px`;
  const canvas = document.createElement('canvas');
  caixa.append(canvas);
  document.body.append(caixa);
  try {
    const g = barras(canvas, motivos.map((m) => m.nome), motivos.map((m) => m.n), { horizontal: true });
    const img = imagem(canvas);
    g.destroy();
    return img;
  } finally { caixa.remove(); }
}

function baixarPdf(rel, { quando, onde }) {
  const r = rel.resumo;
  const top = rel.motivos[0];
  const tabela = (titulo, cab, linhas) => (linhas.length
    ? `<h2>${esc(titulo)}</h2><table><thead><tr>${cab.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${linhas.map((l) => `<tr>${l.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '');
  const grupo = (titulo, rot, lista) => tabela(titulo, [rot, 'Interessados', 'Com motivo', 'Preenchido', 'Motivo mais comum'],
    lista.map((l) => [l.rotulo, l.total, l.preenchidos, `${l.pctPreenchido}%`, l.n ? `${l.motivo} (${l.pctMotivo}%)` : '—']));
  const img = imagemMotivos(rel.motivos);
  const numeros = [['Não fecharam', r.total], ['Com motivo', r.preenchidos], ['Preenchimento', `${r.pctPreenchido}%`], ['Sem motivo', r.pendentes], ['Motivo mais comum', top ? `${top.pct}%` : '—']];
  pdf('Por que não fechou?', `<header><img src="${LOGO}" alt=""><div><h1>Por que não fechou?</h1><p>Positiva · ${esc(onde)} · ${esc(quando)}</p></div></header>
    <h2>Resumo</h2><div class="numeros">${numeros.map(([k, v]) => `<div class="numero"><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div>
    ${top ? `<p style="margin-top:8px;color:#788192">Motivo mais comum: <b style="color:#212B37">${esc(top.nome)}</b> (${top.n} de ${r.preenchidos} justificativas).</p>` : ''}
    ${rel.motivos.length ? `<h2>Motivos de não fechamento</h2>${img ? `<img class="grafico" src="${img}" alt="Gráfico de motivos">` : ''}
      <table><thead><tr><th>Motivo</th><th>Qtd.</th><th>%</th></tr></thead><tbody>${rel.motivos.map((m) => `<tr><td>${esc(m.nome)}</td><td>${m.n}</td><td>${m.pct}%</td></tr>`).join('')}</tbody></table>` : ''}
    ${rel.insights.length ? `<h2>Principais insights</h2>${rel.insights.map((i) => `<div class="insight">${esc(i.texto)}<small>Base: ${esc(i.base)}</small></div>`).join('')}` : ''}
    ${rel.porMes.length > 1 ? grupo('Por mês', 'Mês', rel.porMes) : ''}
    ${rel.porUnidade.length > 1 ? grupo('Por unidade', 'Unidade', rel.porUnidade) : ''}
    ${grupo('Por consultora', 'Consultora', rel.porConsultora)}
    ${grupo('Por origem do contato', 'Como conheceu', rel.porOrigem.slice(0, 12))}
    ${grupo('Por faixa etária', 'Faixa etária', rel.porFaixa)}
    <p style="margin-top:14px;color:#788192">A lista completa, com o motivo de cada interessado, está na planilha Excel.</p>`);
}
