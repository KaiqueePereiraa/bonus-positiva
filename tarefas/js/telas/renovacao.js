// Renovação de contratos — "a vencer" (procurar e marcar) e "venceu e não renovou" (registrar o motivo).
// As listas chegam sozinhas da EVO toda segunda e são divididas entre as consultoras.
import * as dados from '../dados.js?v=20261117104218';
import { esc, dataCurta, vazio, NOMES_CONTROLE } from '../ui.js?v=20261117104218';
import { cabecalhoTarefa, listaContatos, linhaProgresso } from './_comum.js?v=20261117104218';
import { formMotivos } from './nao-fechou.js?v=20261117104218';

const CONTROLES = ['renovacao_vencer', 'renovacao_venceu'];
const AJUDA = {
  renovacao_vencer: 'Contratos que vencem nos próximos dias: chame no WhatsApp, ofereça a renovação e marque quem você procurou. Quem não renovar aparece na lista "venceu" na semana seguinte.',
  renovacao_venceu: 'Contratos que venceram e não foram renovados: pergunte o motivo e registre. Assim a academia sabe o que fazer para trazer de volta.',
};

export async function render(el, ctx, [id]) {
  if (id) return detalhe(el, ctx, id);
  const todas = (await dados.tarefas(ctx.ehAdmin ? { unidade: ctx.unidade || undefined } : { responsavel: ctx.perfil.id }))
    .filter((t) => CONTROLES.includes(t.controle_id));
  if (!todas.length) {
    el.innerHTML = `<div class="cartao">${vazio('As listas de renovação chegam sozinhas da EVO toda segunda de madrugada. Ainda não há listas.')}</div>`;
    return;
  }
  const semana = todas.map((t) => t.periodo_inicio).sort().at(-1);
  const daSemana = todas.filter((t) => t.periodo_inicio === semana);
  if (!ctx.ehAdmin) {
    el.innerHTML = CONTROLES.map((c) => `<div id="bloco-${c}"></div>`).join('');
    for (const c of CONTROLES) {
      const t = daSemana.find((x) => x.controle_id === c);
      const alvo = el.querySelector(`#bloco-${c}`);
      if (!t) { alvo.innerHTML = `<div class="cartao"><h2>${esc(NOMES_CONTROLE[c])}</h2>${vazio('Nada para você nesta semana.')}</div>`; continue; }
      alvo.innerHTML = `${cabecalhoTarefa(t, ctx, { titulo: NOMES_CONTROLE[c] })}<div class="cartao"><p class="dica" style="margin-bottom:12px">${esc(AJUDA[c])}</p><div class="lista"></div></div>`;
      await montarLista(alvo.querySelector('.lista'), ctx, t, true);
    }
    return;
  }
  el.innerHTML = CONTROLES.map((c) => {
    const ts = daSemana.filter((t) => t.controle_id === c);
    const feitos = ts.reduce((s, t) => s + t.feitos, 0), total = ts.reduce((s, t) => s + t.total, 0);
    return `<div class="cartao"><h2>${esc(NOMES_CONTROLE[c])} · semana ${dataCurta(semana)}</h2>
      <p class="dica" style="margin-bottom:10px">${esc(AJUDA[c])}</p>
      ${ts.length ? ts.map((t) => `<a href="#/renovacao/${t.id}" style="text-decoration:none;color:inherit">${linhaProgresso(`${ctx.nomeDe(t.responsavel_id)} · ${ctx.nomeUnidade(t.unidade).replace('Positiva ', '')}`, t.feitos, t.total, t.status)}</a>`).join('')
        + `<p class="dica" style="margin-top:8px">Equipe: ${feitos} de ${total}.</p>` : vazio('Nenhum contrato nesta lista nesta semana.')}</div>`;
  }).join('');
}

async function montarLista(el, ctx, t, editavel) {
  if (t.controle_id === 'renovacao_vencer') return listaContatos(el, ctx, t);
  return formMotivos(el, ctx, t, await dados.itensDaTarefa(t.id), { editavel });
}

async function detalhe(el, ctx, id) {
  const t = await dados.tarefa(id);
  if (!t || !CONTROLES.includes(t.controle_id)) { el.innerHTML = vazio('Lista não encontrada.'); return; }
  el.innerHTML = `<a href="#/renovacao" class="dica">← Renovação</a>
    ${cabecalhoTarefa(t, ctx, { titulo: `${NOMES_CONTROLE[t.controle_id]} — ${ctx.nomeDe(t.responsavel_id)}` })}
    <div class="cartao"><p class="dica" style="margin-bottom:12px">${esc(AJUDA[t.controle_id])}</p><div id="lista"></div></div>`;
  await montarLista(el.querySelector('#lista'), ctx, t, ctx.ehAdmin || t.responsavel_id === ctx.perfil.id);
}
