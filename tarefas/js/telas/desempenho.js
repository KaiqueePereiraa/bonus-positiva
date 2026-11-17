// Desempenho — ranking aberto (todas veem todas): mínimo cumprido, dias com a meta batida, contatos e resultados.
// O gestor também vê as justificativas e o diagnóstico (sobrecarga x individual).
import * as dados from '../dados.js?v=20261117133208';
import { esc, dataCurta, vazio } from '../ui.js?v=20261117133208';
import { somarDias, semanaDe } from '../regras.js?v=20261117133208';
import { diagnostico } from '../painel-regras.js?v=20261117133208';

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
  const todas = await dados.desempenho(de, ate);
  const unidade = ctx.ehAdmin ? ctx.unidade : ctx.perfil.unidade;
  const lista = unidade ? todas.filter((c) => c.unidade === unidade) : todas;
  const diag = ctx.ehAdmin ? diagnostico(lista) : null;

  el.innerHTML = `
    <div class="cartao"><div class="linha-acoes">${Object.entries(PERIODOS).map(([k, [r]]) => `<button class="btn ${k === periodo ? '' : 'sec'} peq" data-p="${k}">${r}</button>`).join('')}</div>
      <p class="dica" style="margin-top:8px">${rotulo}: ${dataCurta(de)} a ${dataCurta(ate)}. Mínimo cumprido = contatos feitos ÷ mínimo dos dias trabalhados. Dias de folga, falta ou atestado não contam.</p></div>
    ${diag ? `<div class="faixa ${diag.cor === 'vermelho' ? 'urgente' : ''}" style="display:block"><b>${esc(diag.titulo)}</b>${esc(diag.texto)}</div>` : ''}
    <div class="cartao"><h2>Ranking</h2>
      ${lista.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>#</th><th>Consultora</th><th>Mínimo cumprido</th><th>Dias com meta batida</th><th>Contatos</th><th>Deu resultado</th></tr></thead><tbody>
      ${lista.map((c, i) => `<tr><td>${i + 1}º</td><td class="nome">${esc(c.nome)}<span class="sub">${esc(ctx.nomeUnidade(c.unidade))}</span></td>
        <td>${c.pct == null ? '<span class="dica">—</span>' : `<b>${c.pct}%</b>`}</td>
        <td>${c.dias ? `${c.dias_bateu} de ${c.dias}` : '—'}</td><td>${c.contatos}</td><td>${c.resultados}</td></tr>
        ${ctx.ehAdmin && c.justificativas?.length ? `<tr><td></td><td colspan="5" class="dica">${c.justificativas.map((j) => `<div>📝 ${dataCurta(j.data)} (${j.feitos}/${j.minimo}${j.trabalhou ? '' : ', não trabalhou'}): "${esc(j.texto)}"</div>`).join('')}</td></tr>` : ''}`).join('')}
      </tbody></table></div>` : vazio('Ainda não há dias fechados neste período. O fechamento acontece todo dia útil às 23h55.')}</div>`;
  el.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { periodo = b.dataset.p; render(el, ctx); }));
}
