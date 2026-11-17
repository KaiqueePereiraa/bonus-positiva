// Meu dia — o que a consultora precisa fazer hoje: o mínimo de cada lista (o que falta ÷ dias úteis até o prazo).
import * as dados from '../dados.js?v=20261117104218';
import { esc, dataCurta, diaSemana, barra, NOMES_CONTROLE, ROTA_CONTROLE } from '../ui.js?v=20261117104218';

export async function render(el, ctx) {
  const d = await dados.meuDia();
  const minimo = d.listas.reduce((s, l) => s + l.minimo, 0);
  const feitos = d.feitos_hoje;
  const ok = minimo === 0 || feitos >= minimo;
  const sem = d.semana || {};
  el.innerHTML = `
    <div class="cartao"><h2>Olá, ${esc((ctx.perfil.nome || '').split(' ')[0])}! ${ok ? '🎉' : '💪'}</h2>
      ${minimo ? `<p style="font-size:16px;margin:6px 0 10px">Hoje: <b>${feitos} de ${minimo}</b> contatos do mínimo${ok ? ' — meta do dia batida!' : ` — faltam ${minimo - feitos}.`}</p>
        ${barra(Math.min(feitos, minimo), minimo)}` : '<p>Nada pendente nas listas hoje. 🎉</p>'}
      ${sem.dias ? `<p class="dica" style="margin-top:10px">Nesta semana: mínimo batido em ${sem.bateu} de ${sem.dias} dia(s) · ${sem.feitos} contatos de ${sem.minimo} do mínimo.</p>` : ''}
    </div>
    ${d.listas.length ? `<div class="cartao"><h2>Por onde começar</h2>
      <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Lista</th><th>Faltam</th><th>Prazo</th><th>Mínimo hoje</th><th></th></tr></thead><tbody>
      ${d.listas.map((l) => {
        const atrasada = l.prazo < d.hoje;
        return `<tr><td class="nome">${l.nova ? '🆕 ' : ''}${esc(NOMES_CONTROLE[l.controle_id] || l.controle_id)}</td>
          <td>${l.faltam_agora}</td>
          <td>${atrasada ? `<span class="selo vermelho">atrasado desde ${dataCurta(l.prazo)}</span>` : l.prazo === d.hoje ? '<span class="selo laranja">último dia</span>' : `${diaSemana(l.prazo)} ${dataCurta(l.prazo)}`}</td>
          <td><b>${l.minimo}</b></td>
          <td class="acoes"><a class="btn peq" href="#/${ROTA_CONTROLE[l.controle_id]}/${l.tarefa_id}">Abrir</a></td></tr>`;
      }).join('')}</tbody></table></div>
      <p class="dica" style="margin-top:8px">O mínimo é o que falta dividido pelos dias úteis até o prazo. Fazer um pouco por dia rende mais que tudo no último dia.</p></div>` : ''}
    ${d.lista_fazer ? `<div class="cartao"><div class="linha-info"><b>📋 Sua lista a fazer</b><span>${d.lista_fazer} pendente(s) · <a href="#/lista-fazer">abrir</a></span></div></div>` : ''}
    <p class="dica" style="text-align:center"><a href="#/minhas-tarefas">Ver todas as minhas tarefas →</a> · <a href="#/desempenho">Desempenho da equipe →</a></p>`;
}
