// Resultados — o que os contatos trouxeram (conferido na EVO), o que os números dizem (frases automáticas, antes na
// tela "Insights"), cumprimento dos prazos e os motivos do "Por que não fechou?". O resultado de cada consultora e o ranking ficam em Desempenho.
import { resumo, evolucao, contarMotivos, motivosPorConsultora, motivosPorMes, gruposReais, resultadoDe, gerarInsights, POSITIVO } from '../analises.js?v=20261126222023';
import * as dados from '../dados.js?v=20261126222023';
import { linha, barras } from '../graficos.js?v=20261126222023';
import { esc, vazio, NOMES_CONTROLE } from '../ui.js?v=20261126222023';
import { filtrosPadrao, htmlFiltros, lerFiltros, pessoasDoFiltro, carregar, ligarPeriodos } from './_analise.js?v=20261126222023';

let filtros;

export async function render(el, ctx) {
  filtros ||= filtrosPadrao(ctx);
  el.innerHTML = `<div class="cartao">${htmlFiltros(filtros, ctx)}</div><div id="corpo" style="display:flex;flex-direction:column;gap:22px"></div>`;
  el.querySelector('.filtros').addEventListener('change', (e) => {
    lerFiltros(el, filtros);
    if (e.target.dataset.f === 'unidade') { filtros.consultora = ''; render(el, ctx); return; }  // lista de consultoras muda
    render(el, ctx);
  });
  ligarPeriodos(el, filtros, ctx, () => desenhar(el.querySelector('#corpo'), ctx));
  await desenhar(el.querySelector('#corpo'), ctx);
}

const numero = (rotulo, valor, cor = '', sub = '') => `<div class="numero ${cor}"><small>${rotulo}</small><b>${valor}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
const reais$ = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const PALAVRA = { pagou: 'pagaram', voltou: 'voltaram a treinar', matriculou: 'se matricularam', renovou: 'renovaram', assinou: 'assinaram' };

async function desenhar(el, ctx) {
  el.innerHTML = '<div class="esqueleto"><i></i><i></i></div>';
  const [{ tarefas, itensNf }, contatosTodos] = await Promise.all([carregar(filtros, ctx.motivos),
    dados.itensComResultado({ desde: filtros.desde, ate: filtros.ate, unidade: filtros.unidade || undefined }).catch(() => [])]);
  const contatos = contatosTodos.filter((i) => (!filtros.consultora || i.responsavel_id === filtros.consultora) && (!filtros.controle || i.controle_id === filtros.controle));
  const hoje = ctx.hoje();
  const r = resumo(tarefas);
  const pessoas = pessoasDoFiltro(filtros, ctx);
  const semanas = evolucao(tarefas, 'semana', hoje).slice(-12);
  const motivos = contarMotivos(itensNf, ctx.motivos);
  const matriz = motivosPorConsultora(itensNf, ctx.motivos, pessoas);
  const porMes = motivosPorMes(itensNf, ctx.motivos);
  const reais = gruposReais(itensNf.filter((i) => i.motivo_id && i.feito_em), ctx.motivos);
  const res = resultadoDe(contatos);
  const listasRes = Object.keys(POSITIVO).filter((c) => res[c].contatos);
  const frases = gerarInsights({ tarefas, itensNaoFechou: itensNf, motivos: ctx.motivos, hoje });

  if (!tarefas.length && !contatos.length) { el.innerHTML = `<div class="cartao">${vazio('Nada no período escolhido. Tente "Últimos 3 meses".')}</div>`; return; }

  el.innerHTML = `
    ${frases.length ? `<div class="cartao"><h2>O que os números dizem</h2>
      ${frases.map((i) => `<div class="faixa" style="background:#F4FAEC;border-color:#D5EDB8;color:var(--dark);margin-bottom:10px;display:block">
        <b>${esc(i.texto)}</b>${i.acao ? `<span style="display:block;margin-top:4px"><b>O que fazer:</b> ${esc(i.acao)}</span>` : ''}<span class="dica" style="display:block;margin-top:4px">Base: ${esc(i.base)}</span></div>`).join('')}</div>` : ''}

    <div class="cartao"><h2>O que os contatos trouxeram <span class="selo cinza">conferido na EVO</span></h2>
      ${listasRes.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Lista</th><th>Contatos</th><th>Deu certo</th><th>Ainda aguardando</th></tr></thead><tbody>
        ${listasRes.map((c) => { const x = res[c]; return `<tr><td class="nome">${esc(NOMES_CONTROLE[c])}</td><td>${x.contatos}</td>
          <td>${x.decididos ? `<b>${x.taxa}%</b> <span class="sub">${x.positivos} de ${x.decididos} ${PALAVRA[POSITIVO[c]]}${x.valor ? ` · ${reais$(x.valor)}` : ''}</span>` : '<span class="dica">—</span>'}</td>
          <td>${x.aguardando || '—'}</td></tr>`; }).join('')}
      </tbody></table></div>
      <p class="dica" style="margin-top:8px">"Deu certo" conta só quem já tem resultado: a EVO confere de madrugada se a pessoa pagou, voltou a treinar, se matriculou ou renovou.</p>`
        : vazio('Os resultados aparecem conforme a equipe faz contatos e a EVO confere o que aconteceu depois.')}
    </div>

    <p class="dica" style="text-align:center">Resultado de cada consultora e ranking da equipe: <a href="#/analises/equipe">Desempenho →</a> · R$ por consultora: <a href="#/retorno">Retorno do mês →</a></p>

    ${tarefas.length ? `<div class="numeros">
      ${numero('Listas no período', r.total, 'escuro')}
      ${numero('Feitas no prazo', `${r.cumprimento}%`, 'verde', `${r.noPrazo} de ${r.decididas} que já venceram`)}
      ${numero('Atrasadas agora', r.atrasadas, r.atrasadas ? 'vermelho' : '')}
      ${numero('Contatos feitos', `${r.feitos}`, 'azul', `${r.pctItens}% do total`)}
    </div>
    <div class="cartao"><h2>Prazos cumpridos por semana</h2>${semanas.length > 1 ? '<div class="grafico"><canvas id="g-semanas" aria-label="Prazos cumpridos por semana"></canvas></div>' : vazio('Aparece quando houver pelo menos 2 semanas com listas vencidas.')}</div>` : ''}

    ${!filtros.controle || filtros.controle === 'nao_fechou' ? `
    <div class="cartao"><h2>Por que não fechou? — motivos ${motivos.length ? `<span class="selo cinza">${motivos.reduce((s, m) => s + m.n, 0)} justificativas</span>` : ''}</h2>
      ${motivos.length ? `<div class="grade"><div class="grafico" style="height:${Math.max(220, motivos.length * 34)}px"><canvas id="g-motivos" aria-label="Motivos de não fechamento"></canvas></div>
        <table class="tabela"><thead><tr><th>Motivo</th><th>Qtd.</th><th>%</th></tr></thead><tbody>${motivos.map((m) => `<tr><td>${esc(m.nome)}</td><td>${m.n}</td><td>${m.pct}%</td></tr>`).join('')}</tbody></table></div>` : vazio('Nenhuma justificativa preenchida no período.')}
    </div>
    ${reais.length ? `<div class="cartao"><h2>O que aconteceu de fato</h2>
      <p class="dica" style="margin-bottom:12px">Junta o motivo escolhido com o que a consultora escreveu (inclusive em "Outro motivo"), para mostrar a causa real.</p>
      <div class="tabela-wrap"><table class="tabela"><thead><tr><th>O que aconteceu</th><th>Qtd.</th><th>%</th><th>O que fazer</th></tr></thead><tbody>
      ${reais.map((g) => `<tr><td>${esc(g.nome)}${g.deOutro ? `<span class="sub">${g.deOutro} vindos de "Outro motivo"</span>` : ''}</td><td>${g.n}</td><td>${g.pct}%</td><td class="dica">${esc(g.acao || '')}</td></tr>`).join('')}
      </tbody></table></div></div>` : ''}
    ${matriz.linhas.length ? `<div class="cartao"><h2>Motivos por consultora</h2><div class="tabela-wrap"><table class="tabela"><thead><tr><th>Consultora</th>${matriz.motivos.map((m) => `<th>${esc(m.nome)}</th>`).join('')}<th>Total</th></tr></thead><tbody>
      ${matriz.linhas.map((l) => `<tr><td class="nome">${esc(l.nome)}</td>${l.valores.map((v) => `<td>${v || ''}</td>`).join('')}<td><b>${l.total}</b></td></tr>`).join('')}</tbody></table></div></div>` : ''}
    ${porMes.length > 1 ? `<div class="cartao"><h2>Evolução mensal dos motivos (%)</h2><div class="tabela-wrap"><table class="tabela"><thead><tr><th>Motivo</th>${porMes.map((m) => `<th>${m.rotulo}</th>`).join('')}</tr></thead><tbody>
      ${motivos.map((mot) => `<tr><td>${esc(mot.nome)}</td>${porMes.map((m) => `<td>${m.motivos.find((x) => x.id === mot.id)?.pct ?? 0}%</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>` : ''}` : ''}`;

  if (semanas.length > 1) linha(el.querySelector('#g-semanas'), semanas.map((s) => s.rotulo), semanas.map((s) => s.cumprimento), { sufixo: '%', max: 100 });
  if (motivos.length) barras(el.querySelector('#g-motivos'), motivos.map((m) => m.nome), motivos.map((m) => m.n), { horizontal: true });
}
