// Kanban da WasFit espelhado — só para o gestor monitorar e cobrar (não opera o kanban).
// Cada etiqueta marcada/desmarcada na WasFit chega por webhook (função wasfit-etiquetas). Por contato: coluna atual, há quanto
// tempo está nela, quem mexeu por último (a dona), e há quanto tempo ninguém muda nada ("parado").
import * as dados from '../dados.js?v=20261126161713';
import { esc, vazio } from '../ui.js?v=20261126161713';

let parado = 3;
const dias = (n) => (n <= 0 ? 'hoje' : n === 1 ? '1 dia' : `${n} dias`);

export async function render(el, ctx) {
  const r = await dados.kanbanWasfit(parado);
  const colunas = r.colunas || [];
  el.innerHTML = `
    <div class="cartao"><div class="linha-acoes">
      <label class="campo">Parado há pelo menos<select class="ctrl" id="parado">${[1, 2, 3, 5, 7, 10].map((d) => `<option value="${d}" ${d === parado ? 'selected' : ''}>${d} dia${d > 1 ? 's' : ''}</option>`).join('')}</select></label></div>
      <p class="dica" style="margin-top:8px">Espelho do kanban da WasFit: cada etiqueta marcada ou desmarcada chega aqui na hora. A dona do contato é quem mexeu
      nas etiquetas dele por último. "Parado" = nenhuma mudança de etiqueta no período escolhido. ${r.eventos_7d} movimento(s) nos últimos 7 dias.</p></div>
    ${!r.contatos ? `<div class="cartao">${vazio('Ainda não chegou nenhum contato com etiqueta do kanban. Confira se as etiquetas da WasFit têm o webhook desta plataforma, com "Disparar ao marcar" e "ao desmarcar" ligados.')}</div>` : `
    <div class="numeros" style="margin:0 0 14px">
      <div class="numero azul"><small>Contatos no kanban</small><b>${r.contatos}</b><span>com etiqueta de coluna</span></div>
      <div class="numero ${r.parados.length ? 'vermelho' : 'verde'}"><small>Parados</small><b>${r.parados.length}</b><span>sem mudança há ${dias(parado)} ou mais</span></div>
      ${colunas.slice(0, 4).map((c) => `<div class="numero"><small>${esc(c.coluna)}</small><b>${c.contatos}</b><span>contatos</span></div>`).join('')}
    </div>
    <div class="cartao"><h2>Por consultora</h2>
      <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Dona</th><th>Contatos</th><th>Parados</th><th>Movimentos (7 dias)</th>${colunas.map((c) => `<th>${esc(c.coluna)}</th>`).join('')}</tr></thead><tbody>
      ${r.pessoas.map((p) => `<tr><td class="nome">${esc(p.dona)}</td><td>${p.contatos}</td>
        <td>${p.parados ? `<span class="selo vermelho">${p.parados}</span>` : '0'}</td><td>${p.movimentos_7d}</td>
        ${colunas.map((c) => `<td>${(p.por_coluna || {})[c.coluna] || '—'}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div></div>
    <div class="cartao"><h2>Parados — para cobrar</h2>
      ${r.parados.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Contato</th><th>Coluna</th><th>Na coluna há</th><th>Sem mudança há</th><th>Dona</th></tr></thead><tbody>
        ${r.parados.map((x) => `<tr><td class="nome">${esc(x.contato || '—')}<span class="sub">${esc(x.numero || '')}</span></td><td>${esc(x.coluna)}</td>
          <td>${dias(x.dias_na_coluna)}</td><td><b>${dias(x.dias_sem_mudanca)}</b></td><td>${esc(x.dona)}</td></tr>`).join('')}
      </tbody></table></div>` : vazio('Nenhum contato parado nesse período. 👏')}</div>`}`;
  el.querySelector('#parado').onchange = (e) => { parado = +e.target.value; render(el, ctx); };
}
