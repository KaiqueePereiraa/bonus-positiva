// Desempenho — ranking aberto (todas veem todas): mínimo cumprido, dias com a meta batida, contatos e resultados.
// O gestor também vê as justificativas, o diagnóstico (sobrecarga x individual) e o quadro esforço × resultado
// dos últimos 30 dias (cada consultora comparada com a mediana da equipe).
import * as dados from '../dados.js?v=20261118222102';
import { esc, dataCurta, vazio, NOMES_CONTROLE } from '../ui.js?v=20261118222102';
import { somarDias, semanaDe } from '../regras.js?v=20261118222102';
import { diagnostico, quadrante, mediana, resumoAtividade } from '../painel-regras.js?v=20261118222102';
import { destaques, voceVsVoce } from '../jogo.js?v=20261118222102';
import { animar } from '../jogo-visual.js?v=20261118222102';

let periodo = 'semana_passada';

export async function render(el, ctx) {
  const hoje = ctx.hoje();
  const seg = semanaDe(hoje).inicio;
  const PERIODOS = {
    esta_semana: ['Esta semana', seg, hoje],
    semana_passada: ['Semana passada', somarDias(seg, -7), somarDias(seg, -1)],
    mes: ['Este mês', `${hoje.slice(0, 8)}01`, hoje],
  };
  const [rotulo, de, ate] = PERIODOS[periodo];
  const [deAnt, ateAnt] = periodoAnterior(periodo, de, ate);
  const [todas, painel, antes] = await Promise.all([dados.desempenho(de, ate), ctx.ehAdmin ? dados.painelGestor().catch(() => null) : null,
    dados.desempenho(deAnt, ateAnt).catch(() => [])]);
  const unidade = ctx.ehAdmin ? ctx.unidade : ctx.perfil.unidade;
  const lista = unidade ? todas.filter((c) => c.unidade === unidade) : todas;
  const diag = ctx.ehAdmin ? diagnostico(lista) : null;

  el.innerHTML = `
    <div class="cartao"><div class="linha-acoes">${Object.entries(PERIODOS).map(([k, [r]]) => `<button class="btn ${k === periodo ? '' : 'sec'} peq" data-p="${k}">${r}</button>`).join('')}</div>
      <p class="dica" style="margin-top:8px">${rotulo}: ${dataCurta(de)} a ${dataCurta(ate)}. Mínimo cumprido = contatos feitos ÷ mínimo dos dias trabalhados. Dias de folga, falta ou atestado não contam.</p></div>
    ${diag ? `<div class="faixa ${diag.cor === 'vermelho' ? 'urgente' : ''}" style="display:block"><b>${esc(diag.titulo)}</b>${esc(diag.texto)}</div>` : ''}
    ${quadroDestaques(lista, antes, ctx)}
    ${ctx.ehAdmin ? '' : quadroVoce(lista.find((c) => c.id === ctx.perfil.id), antes.find((c) => c.id === ctx.perfil.id), deAnt, ateAnt)}
    <div class="cartao"><h2>Ranking</h2>
      ${lista.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>#</th><th>Consultora</th><th>Mínimo cumprido</th><th>Dias com meta batida</th><th>Contatos</th><th>Deu resultado</th></tr></thead><tbody>
      ${lista.map((c, i) => `<tr class="${c.id === ctx.perfil.id ? 'eu' : ''}"><td>${i + 1}º</td><td class="nome">${esc(c.nome)}<span class="sub">${esc(ctx.nomeUnidade(c.unidade))}</span></td>
        <td>${c.pct == null ? '<span class="dica">—</span>' : `<b>${c.pct}%</b>`}</td>
        <td>${c.dias ? `${c.dias_bateu} de ${c.dias}` : '—'}</td><td>${c.contatos}</td><td>${c.resultados}</td></tr>
        ${ctx.ehAdmin && c.justificativas?.length ? `<tr><td></td><td colspan="5" class="dica">${c.justificativas.map((j) => { const a = resumoAtividade(j.atividade, NOMES_CONTROLE); return `<div style="margin-bottom:8px">📝 ${dataCurta(j.data)} (${j.feitos}/${j.minimo} do mínimo${j.trabalhou ? '' : ', não trabalhou'}): "${esc(j.texto)}"
          ${j.atividade ? `<div style="margin-left:22px">🔎 O que fez nesse dia: ${esc(a.texto)}${a.alerta ? `<div style="color:#B42318;font-weight:700">⚠️ ${esc(a.alerta)}</div>` : ''}</div>` : ''}</div>`; }).join('')}</td></tr>` : ''}`).join('')}
      </tbody></table></div>` : vazio('Ainda não há dias fechados neste período. O fechamento acontece todo dia útil às 23h55.')}</div>
    ${painel ? quadroEsforco(painel, unidade) : ''}`;
  animar(el);
  el.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { periodo = b.dataset.p; render(el, ctx); }));
}

// Período anterior de mesmo tamanho (para "quem mais evoluiu" e "você contra você mesma")
function periodoAnterior(periodo, de, ate) {
  if (periodo !== 'mes') return [somarDias(de, -7), somarDias(ate, -7)];
  const [a, m] = de.split('-').map(Number);
  const ini = m === 1 ? `${a - 1}-12-01` : `${a}-${String(m - 1).padStart(2, '0')}-01`;
  const ultimoDia = new Date(Date.UTC(+ini.slice(0, 4), +ini.slice(5, 7), 0)).getUTCDate();
  return [ini, `${ini.slice(0, 8)}${String(Math.min(+ate.slice(8, 10), ultimoDia)).padStart(2, '0')}`];
}

// Destaques: uma categoria para cada jeito de ir bem (no lugar de pódio, que deixa sempre alguém de fora)
function quadroDestaques(lista, antes, ctx) {
  const ds = destaques(lista, antes);
  if (!ds.length) return '';
  const nome = (c) => `${esc((c.nome || '').split(' ')[0])}${c.id === ctx.perfil.id ? ' <i>(você)</i>' : ''}`;
  return `<div class="cartao"><h2>✨ Destaques do período</h2>
    <div class="destaques">${ds.map((d, k) => `<div class="destaque ${d.quem.some((c) => c.id === ctx.perfil.id) ? 'eu' : ''}" style="--k:${k}">
      <span class="destaque-icone">${d.icone}</span><small>${esc(d.titulo)}</small>
      <b>${d.quem.map(nome).join(' e ')}</b><span>${esc(d.texto)}</span></div>`).join('')}</div>
    <p class="dica" style="margin-top:10px">Cada destaque mede uma coisa diferente: constância, evolução e resultado. A evolução compara com o período anterior de mesmo tamanho.</p></div>`;
}

// Você contra você mesma: o período escolhido comparado com o anterior
function quadroVoce(eu, antes, deAnt, ateAnt) {
  const linhas = voceVsVoce(eu, antes);
  const temDados = (c) => c && (c.dias > 0 || c.resultados > 0);
  if (!linhas || (!temDados(eu) && !temDados(antes))) return '';   // sem dias fechados nos dois períodos: nada a comparar
  const seta = (l) => (l.delta == null ? '<span class="dica">—</span>' : l.delta > 0 ? `<em class="sobe">▲ ${l.delta}${l.sufixo ? ' pontos' : ''}</em>` : l.delta < 0 ? `<em class="desce">▼ ${-l.delta}${l.sufixo ? ' pontos' : ''}</em>` : '<em class="igual">= igual</em>');
  return `<div class="cartao voce"><h2>🪞 Você contra você mesma <span class="selo cinza">antes: ${dataCurta(deAnt)} a ${dataCurta(ateAnt)}</span></h2>
    <div class="voce-grade">${linhas.map((l) => `<div><small>${esc(l.rotulo)}</small><b>${l.agora == null ? '—' : `${l.agora}${l.sufixo}`}</b>${seta(l)}</div>`).join('')}</div>
    <p class="dica" style="margin-top:10px">A única comparação que importa de verdade: com você mesma no período anterior.</p></div>`;
}

// Esforço (contatos) × resultado (% que deu certo) nos últimos 30 dias, comparando cada uma com a mediana da equipe
function quadroEsforco(p, unidade) {
  const todas = p.unidades.filter((u) => !unidade || u.id === unidade).flatMap((u) => u.consultoras);
  const comDados = todas.filter((c) => c.decididos_30d >= 5);
  if (comDados.length < 2) return '';   // aparece quando houver pelo menos 2 consultoras com 5+ contatos com resultado
  const medC = mediana(comDados.map((c) => c.contatos_30d));
  const medT = mediana(comDados.map((c) => c.positivos_30d / c.decididos_30d));
  return `<div class="cartao"><h2>Esforço × resultado <span class="selo cinza">últimos 30 dias</span></h2>
    <p class="dica" style="margin-bottom:12px">Comparado com a própria equipe (mediana: ${medC} contatos e ${Math.round(medT * 100)}% de resultado).</p>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Consultora</th><th>Como está</th><th>O que fazer</th></tr></thead><tbody>
    ${comDados.map((c) => { const q = quadrante(c, medC, medT); return `<tr><td class="nome">${esc(c.nome)}<span class="sub">${c.contatos_30d} contatos · ${Math.round(100 * c.positivos_30d / c.decididos_30d)}% de resultado</span></td>
      <td>${q.icone} <b>${esc(q.nome)}</b></td><td class="dica">${esc(q.acao)}</td></tr>`; }).join('')}
    </tbody></table></div></div>`;
}
