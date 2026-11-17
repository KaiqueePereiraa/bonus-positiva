// Indicadores — cumprimento de prazos, volume por consultora, evolução e motivos de não fechamento.
import { resumo, porConsultora, evolucao, contarMotivos, motivosPorConsultora, motivosPorMes, gruposReais, resultadoDe, resultadosPorConsultora } from '../analises.js?v=20261116221616';
import * as dados from '../dados.js?v=20261116221616';
import { barras, linha } from '../graficos.js?v=20261116221616';
import { esc, vazio } from '../ui.js?v=20261116221616';
import { filtrosPadrao, htmlFiltros, lerFiltros, pessoasDoFiltro, carregar } from './_analise.js?v=20261116221616';

let filtros;

export async function render(el, ctx) {
  filtros ||= filtrosPadrao(ctx);
  el.innerHTML = `<div class="cartao">${htmlFiltros(filtros, ctx)}</div><div id="corpo" style="display:flex;flex-direction:column;gap:22px"></div>`;
  el.querySelector('.filtros').addEventListener('change', (e) => {
    lerFiltros(el, filtros);
    if (e.target.dataset.f === 'unidade') { filtros.consultora = ''; render(el, ctx); return; }  // lista de consultoras muda
    desenhar(el.querySelector('#corpo'), ctx);
  });
  await desenhar(el.querySelector('#corpo'), ctx);
}

const numero = (rotulo, valor, cor = '', sub = '') => `<div class="numero ${cor}"><small>${rotulo}</small><b>${valor}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
const p = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

async function desenhar(el, ctx) {
  el.innerHTML = '<div class="vazio">Calculando…</div>';
  const [{ tarefas, itensNf }, contatosTodos] = await Promise.all([carregar(filtros),
    dados.itensComResultado({ desde: filtros.desde, ate: filtros.ate, unidade: filtros.unidade || undefined }).catch(() => [])]);
  const contatos = contatosTodos.filter((i) => (!filtros.consultora || i.responsavel_id === filtros.consultora) && (!filtros.controle || i.controle_id === filtros.controle));
  const hoje = ctx.hoje();
  const r = resumo(tarefas);
  const pessoas = pessoasDoFiltro(filtros, ctx);
  const linhas = porConsultora(tarefas, pessoas);
  const semanas = evolucao(tarefas, 'semana', hoje).slice(-12);
  const meses = evolucao(tarefas, 'mes', hoje);
  const motivos = contarMotivos(itensNf, ctx.motivos);
  const matriz = motivosPorConsultora(itensNf, ctx.motivos, pessoas);
  const porMes = motivosPorMes(itensNf, ctx.motivos);
  const reais = gruposReais(itensNf.filter((i) => i.motivo_id && i.feito_em), ctx.motivos);
  const res = resultadoDe(contatos);
  const resPessoas = resultadosPorConsultora(contatos, pessoas);
  const reais$ = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const celRes = (x) => (x.contatos ? `<b>${x.decididos ? `${x.taxa}%` : '—'}</b><span class="sub">${x.positivos} de ${x.decididos}${x.aguardando ? ` · ${x.aguardando} aguardando` : ''}</span>` : '<span class="dica">—</span>');

  if (!tarefas.length) { el.innerHTML = `<div class="cartao">${vazio('Nenhuma tarefa no período e filtros escolhidos.')}</div>`; return; }

  el.innerHTML = `
    <div class="numeros">
      ${numero('Atividades geradas', r.total, 'escuro')}
      ${numero('Concluídas', r.concluidas, 'verde', `${r.comAtraso} com atraso`)}
      ${numero('Atrasadas', r.atrasadas, r.atrasadas ? 'vermelho' : '', 'em aberto')}
      ${numero('Cumprimento dos prazos', `${r.cumprimento}%`, 'verde', `${r.noPrazo} de ${r.decididas} vencidas`)}
      ${numero('Itens feitos', `${r.pctItens}%`, 'azul', `${r.feitos} de ${r.itens}`)}
    </div>

    <div class="cartao"><h2>Resultado dos contatos <span class="selo cinza">conferido na EVO</span></h2>
      <p class="dica" style="margin-bottom:12px">Não basta enviar: aqui aparece o que aconteceu depois do contato. Pagou = a dívida saiu da EVO; voltou = entrou na academia depois do contato; matriculou = a oportunidade virou cliente. A taxa conta só os contatos que já têm resultado (inadimplência espera até 30 dias, risco 21, não fechou 35).</p>
      <div class="numeros">
        ${numero('Inadimplência: pagaram', res.inadimplencia.decididos ? `${res.inadimplencia.taxa}%` : '—', 'verde', `${res.inadimplencia.positivos} de ${res.inadimplencia.decididos} · ${reais$(res.inadimplencia.valor)} recuperados`)}
        ${numero('Risco: voltaram', res.risco.decididos ? `${res.risco.taxa}%` : '—', 'azul', `${res.risco.positivos} de ${res.risco.decididos}${res.risco.aguardando ? ` · ${res.risco.aguardando} aguardando` : ''}`)}
        ${numero('Não fechou: matricularam', res.nao_fechou.decididos ? `${res.nao_fechou.taxa}%` : '—', 'escuro', `${res.nao_fechou.positivos} de ${res.nao_fechou.decididos}${res.nao_fechou.aguardando ? ` · ${res.nao_fechou.aguardando} aguardando` : ''}`)}
      </div>
      ${resPessoas.length ? `<div class="tabela-wrap" style="margin-top:12px"><table class="tabela"><thead><tr><th>Consultora</th><th>Inadimplência: pagaram</th><th>R$ recuperado</th><th>Risco: voltaram</th><th>Não fechou: matricularam</th></tr></thead><tbody>
        ${resPessoas.map((l) => `<tr><td class="nome">${esc(l.nome)}</td><td>${celRes(l.inadimplencia)}</td><td>${l.inadimplencia.valor ? reais$(l.inadimplencia.valor) : '—'}</td><td>${celRes(l.risco)}</td><td>${celRes(l.nao_fechou)}</td></tr>`).join('')}
      </tbody></table></div>` : vazio('Os resultados aparecem quando a conferência automática com a EVO estiver ligada (Configurações → EVO → Resultado dos contatos).')}
    </div>

    <div class="cartao"><h2>Por consultora</h2>
      <p class="dica" style="margin-bottom:12px">Volume (quanto cada uma recebeu) e percentual lado a lado — quem recebeu mais não parece mais produtiva só por isso.</p>
      <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Consultora</th><th>Tarefas</th><th>Concluídas</th><th>Atrasadas</th><th>Cumprimento</th>
        <th>Risco: contatos</th><th>Risco: %</th><th>Não fechou: justificativas</th><th>%</th><th>Inadimplência</th></tr></thead><tbody>
        ${linhas.map((l) => `<tr><td class="nome">${esc(l.nome)}</td><td>${l.total}</td><td>${l.concluidas}</td><td>${l.atrasadas}</td><td><b>${l.decididas ? `${l.cumprimento}%` : '—'}</b></td>
          <td>${l.risco.feitos}/${l.risco.itens}</td><td>${p(l.risco.feitos, l.risco.itens)}</td>
          <td>${l.naoFechou.feitos}/${l.naoFechou.itens}</td><td>${p(l.naoFechou.feitos, l.naoFechou.itens)}</td>
          <td>${l.inadimplencia.concluidas}/${l.inadimplencia.total} dias · ${l.inadimplencia.feitos} contatos</td></tr>`).join('')}
      </tbody></table></div>
    </div>

    <div class="grade">
      <div class="cartao"><h2>Cumprimento dos prazos por consultora</h2><div class="grafico"><canvas id="g-consultoras" aria-label="Cumprimento dos prazos por consultora"></canvas></div></div>
      <div class="cartao"><h2>Evolução semanal do cumprimento</h2>${semanas.length > 1 ? '<div class="grafico"><canvas id="g-semanas" aria-label="Evolução semanal"></canvas></div>' : vazio('Precisa de pelo menos 2 semanas vencidas.')}
        ${semanas.length ? `<details style="margin-top:10px"><summary class="dica">Ver em tabela</summary><table class="tabela"><thead><tr><th>Semana</th><th>No prazo</th><th>Com atraso</th><th>Atrasadas</th><th>Cumprimento</th></tr></thead><tbody>
          ${semanas.map((s) => `<tr><td>${s.rotulo}</td><td>${s.noPrazo}</td><td>${s.comAtraso}</td><td>${s.atrasadas}</td><td>${s.cumprimento}%</td></tr>`).join('')}</tbody></table></details>` : ''}
      </div>
    </div>
    ${meses.length > 1 ? `<div class="cartao"><h2>Evolução mensal</h2><div class="tabela-wrap"><table class="tabela"><thead><tr><th>Mês</th><th>Tarefas vencidas</th><th>No prazo</th><th>Com atraso</th><th>Atrasadas</th><th>Cumprimento</th><th>Itens feitos</th></tr></thead><tbody>
      ${meses.map((m) => `<tr><td>${m.rotulo}</td><td>${m.total}</td><td>${m.noPrazo}</td><td>${m.comAtraso}</td><td>${m.atrasadas}</td><td><b>${m.cumprimento}%</b></td><td>${m.pctItens}%</td></tr>`).join('')}</tbody></table></div></div>` : ''}

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

  barras(el.querySelector('#g-consultoras'), linhas.map((l) => l.nome), linhas.map((l) => l.cumprimento), { sufixo: '%', max: 100 });
  if (semanas.length > 1) linha(el.querySelector('#g-semanas'), semanas.map((s) => s.rotulo), semanas.map((s) => s.cumprimento), { sufixo: '%', max: 100 });
  if (motivos.length) barras(el.querySelector('#g-motivos'), motivos.map((m) => m.nome), motivos.map((m) => m.n), { horizontal: true });
}
