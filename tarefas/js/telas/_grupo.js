// Tela de um grupo de listas automáticas da EVO (Renovação, Vendas do dia, Relacionamento).
// Consultora: as listas mais recentes de cada tipo + as anteriores que ainda têm pendência.
// Admin: o progresso de cada consultora na lista mais recente de cada tipo, com link para o detalhe.
// Lista com motivos cadastrados (ex.: "venceu e não renovou", "cancelou") pede o motivo; as demais, "Marcar enviada".
import * as dados from '../dados.js?v=20261126185448';
import { esc, dataCurta, vazio, NOMES_CONTROLE, LISTAS_DIARIAS } from '../ui.js?v=20261126185448';
import { cabecalhoTarefa, listaContatos, linhaProgresso } from './_comum.js?v=20261126185448';
import { formMotivos } from './_motivos.js?v=20261126185448';

const CONCLUIDA = (t) => t.status === 'concluida' || t.status === 'concluida_atraso';
const quando = (t) => (LISTAS_DIARIAS.includes(t.controle_id) ? dataCurta(t.periodo_inicio) : `semana ${dataCurta(t.periodo_inicio)}`);

export function criarTela({ rota, titulo, controles, ajuda, vazioTexto, extraAdmin }) {
  const temMotivo = (ctx, c) => (ctx.motivos || []).some((m) => (m.controle_id || 'nao_fechou') === c);

  async function montarLista(el, ctx, t, editavel) {
    if (!temMotivo(ctx, t.controle_id)) return listaContatos(el, ctx, t);
    return formMotivos(el, ctx, t, await dados.itensDaTarefa(t.id), { editavel });
  }

  async function detalhe(el, ctx, id) {
    const t = await dados.tarefa(id);
    if (!t || !controles.includes(t.controle_id)) { el.innerHTML = vazio('Lista não encontrada.'); return; }
    el.innerHTML = `<a href="#/${rota}" class="dica">← ${esc(titulo)}</a>
      ${cabecalhoTarefa(t, ctx, { titulo: `${NOMES_CONTROLE[t.controle_id]} (${quando(t)}) — ${ctx.nomeDe(t.responsavel_id)}` })}
      <div class="cartao"><p class="dica" style="margin-bottom:12px">${esc(ajuda[t.controle_id])}</p><div id="lista"></div></div>`;
    await montarLista(el.querySelector('#lista'), ctx, t, ctx.ehAdmin || t.responsavel_id === ctx.perfil.id);
  }

  return async function render(el, ctx, [id]) {
    if (id) return detalhe(el, ctx, id);
    const todas = (await dados.tarefas(ctx.ehAdmin ? { unidade: ctx.unidade || undefined } : { responsavel: ctx.perfil.id }))
      .filter((t) => controles.includes(t.controle_id));
    if (!todas.length) {
      el.innerHTML = `<div class="cartao">${vazio(vazioTexto)}</div>`;
      if (ctx.ehAdmin && extraAdmin) await extraAdmin(el, ctx);
      return;
    }
    const ultimaDe = (c) => todas.filter((t) => t.controle_id === c).map((t) => t.periodo_inicio).sort().at(-1);

    if (!ctx.ehAdmin) {
      // unidades em grupo: alunos de outra unidade chegam numa lista à parte, mostrada depois da lista da própria unidade
      const daOutra = (t) => Number(t.unidade !== ctx.perfil.unidade);
      const outraUnidade = (t) => (daOutra(t) ? ` · ${ctx.nomeUnidade(t.unidade).replace('Positiva ', '')}` : '');
      const minhas = controles.flatMap((c) => {
        const ultima = ultimaDe(c);
        return todas.filter((t) => t.controle_id === c && (t.periodo_inicio === ultima || !CONCLUIDA(t)))
          .sort((a, b) => b.periodo_inicio.localeCompare(a.periodo_inicio) || daOutra(a) - daOutra(b));
      });
      el.innerHTML = controles.map((c) => `<div id="bloco-${c}"></div>`).join('');
      for (const c of controles) {
        const alvo = el.querySelector(`#bloco-${c}`);
        const ts = minhas.filter((t) => t.controle_id === c);
        if (!ts.length) { alvo.innerHTML = `<div class="cartao"><h2>${esc(NOMES_CONTROLE[c])}</h2>${vazio('Nada para você agora.')}</div>`; continue; }
        alvo.innerHTML = ts.map((t) => `<div data-t="${t.id}">${cabecalhoTarefa(t, ctx, { titulo: `${NOMES_CONTROLE[c]}${outraUnidade(t)} (${quando(t)})` })}
          <div class="cartao"><p class="dica" style="margin-bottom:12px">${esc(ajuda[c])}</p><div class="lista"></div></div></div>`).join('');
        for (const t of ts) await montarLista(alvo.querySelector(`[data-t="${t.id}"] .lista`), ctx, t, true);
      }
      return;
    }

    el.innerHTML = controles.map((c) => {
      const ultima = ultimaDe(c);
      const ts = todas.filter((t) => t.controle_id === c && t.periodo_inicio === ultima);
      const feitos = ts.reduce((s, t) => s + t.feitos, 0), total = ts.reduce((s, t) => s + t.total, 0);
      return `<div class="cartao"><h2>${esc(NOMES_CONTROLE[c])}${ultima ? ` · ${esc(quando(ts[0]))}` : ''}</h2>
        <p class="dica" style="margin-bottom:10px">${esc(ajuda[c])}</p>
        ${ts.length ? ts.map((t) => `<a href="#/${rota}/${t.id}" style="text-decoration:none;color:inherit">${linhaProgresso(`${ctx.nomeDe(t.responsavel_id)} · ${ctx.nomeUnidade(t.unidade).replace('Positiva ', '')}`, t.feitos, t.total, t.status)}</a>`).join('')
          + `<p class="dica" style="margin-top:8px">Equipe: ${feitos} de ${total}.</p>` : vazio('Ainda não chegou nenhuma lista deste tipo.')}</div>`;
    }).join('');
    if (extraAdmin) await extraAdmin(el, ctx);
  };
}
