// Inadimplência — rodízio semanal; a lista chega sozinha da EVO e a responsável marca quem recebeu mensagem.
import * as dados from '../dados.js?v=20261119002831';
import { esc, dataCurta, diaSemana, seloStatus, toast, erro, vazio, modal } from '../ui.js?v=20261119002831';
import { cabecalhoTarefa, listaContatos, baixarArquivo } from './_comum.js?v=20261119002831';

export async function render(el, ctx, [tarefaId]) {
  if (tarefaId) return detalhe(el, ctx, tarefaId);
  const tarefas = await dados.tarefas({ controle: 'inadimplencia', ...(ctx.ehAdmin ? { unidade: ctx.unidade || undefined } : { responsavel: ctx.perfil.id }) });
  const varias = ctx.ehAdmin && !ctx.unidade;   // admin vendo todas as unidades: mostra a coluna Unidade
  const uni = (t) => (varias ? `<td>${esc(ctx.nomeUnidade(t.unidade).replace('Positiva ', ''))}</td>` : '');
  const thUni = varias ? '<th>Unidade</th>' : '';
  const hoje = ctx.hoje();
  const proximas = tarefas.filter((t) => t.prazo >= hoje).sort((a, b) => a.prazo.localeCompare(b.prazo));
  const passadas = tarefas.filter((t) => t.prazo < hoje);

  if (!tarefas.length) {
    el.innerHTML = `<div class="cartao">${vazio(ctx.ehAdmin
      ? `O rodízio${ctx.unidade ? ` da ${ctx.nomeUnidade(ctx.unidade)}` : ''} ainda não começou. Defina a primeira sexta em Configurações → Rodízio.`
      : 'Você ainda não tem dias de inadimplência marcados.')}</div>`;
    return;
  }

  el.innerHTML = `
    <div class="cartao"><h2>${ctx.ehAdmin ? 'Próximas sextas' : 'Suas próximas datas'}</h2>
      ${proximas.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Data</th>${thUni}${ctx.ehAdmin ? '<th>Responsável</th>' : ''}<th>Contatos</th><th>Status</th><th></th></tr></thead><tbody>
      ${proximas.map((t) => `<tr data-id="${t.id}"><td><b>${dataCurta(t.prazo)}</b> <span class="dica">${diaSemana(t.prazo)}</span></td>${uni(t)}
        ${ctx.ehAdmin ? `<td>${esc(ctx.nomeDe(t.responsavel_id))}${t.trocada_em ? ' <span class="etiqueta">troca</span>' : ''}</td>` : ''}
        <td>${t.total ? `${t.feitos}/${t.total}` : '—'}</td><td>${seloStatus(t.status, t.prazo_proximo)}</td>
        <td class="acoes">${ctx.ehAdmin && !t.concluida_em ? '<button class="btn sec peq" data-acao="trocar">Trocar plantão</button> ' : ''}<a class="btn peq" href="#/inadimplencia/${t.id}">Abrir</a></td></tr>`).join('')}
      </tbody></table></div>` : vazio('Nenhuma data futura.')}
      <p class="dica" style="margin-top:10px">${(ctx.ehAdmin ? (ctx.unidade ? ctx.unidades.filter((u) => u.id === ctx.unidade) : ctx.unidadesAtivas()) : ctx.unidades.filter((u) => u.id === ctx.perfil.unidade))
        .map((u) => `Rodízio ${esc(u.nome.replace('Positiva ', ''))}: ${ctx.consultorasDa(u.id).map((c) => esc(c.nome)).join(' → ') || '—'}`).join(' · ')}. Sexta-feira com feriado passa para o dia útil anterior.</p>
    </div>
    ${passadas.length ? `<div class="cartao"><h2>Histórico</h2><div class="tabela-wrap"><table class="tabela"><thead><tr><th>Data</th>${thUni}${ctx.ehAdmin ? '<th>Responsável</th>' : ''}<th>Contatos</th><th>Status</th><th></th></tr></thead><tbody>
      ${passadas.map((t) => `<tr><td>${dataCurta(t.prazo)}</td>${uni(t)}${ctx.ehAdmin ? `<td>${esc(ctx.nomeDe(t.responsavel_id))}</td>` : ''}
        <td>${t.total ? `${t.feitos}/${t.total}` : 'lista a caminho'}</td><td>${seloStatus(t.status)}</td>
        <td class="acoes"><a class="btn sec peq" href="#/inadimplencia/${t.id}">Abrir</a></td></tr>`).join('')}
    </tbody></table></div></div>` : ''}`;

  el.onclick = async (e) => {
    const b = e.target.closest('[data-acao="trocar"]');
    if (!b) return;
    const t = tarefas.find((x) => x.id === b.closest('tr').dataset.id);
    const opcoes = ctx.consultorasDa(t.unidade).filter((c) => c.id !== t.responsavel_id);
    if (!opcoes.length) { toast('Não há outra consultora nesta unidade para assumir o plantão.', 'erro'); return; }
    const r = await modal(`Trocar plantão de ${dataCurta(t.prazo)}`,
      `<p>Hoje está com <b>${esc(ctx.nomeDe(t.responsavel_id))}</b>. A troca vale só para esta data; o rodízio das próximas não muda.</p>
       <label class="campo">Nova responsável<select id="nova">${opcoes.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></label>`,
      { ler: true, acoes: [{ rotulo: 'Cancelar', classe: 'sec', valor: null }, { rotulo: 'Trocar', valor: 'ok' }] });
    if (r?.valor !== 'ok') return;
    const nova = r.campos.nova;
    try { await dados.trocarPlantao(t.id, nova); toast(`Plantão de ${dataCurta(t.prazo)} agora é de ${ctx.nomeDe(nova)}.`); render(el, ctx, []); }
    catch (err) { erro(err); }
  };
}

async function detalhe(el, ctx, id) {
  const t = await dados.tarefa(id);
  if (!t) { el.innerHTML = vazio('Tarefa não encontrada.'); return; }

  const imp = t.importacao_id ? (await dados.importacoes('inadimplencia', { limite: 50 })).find((i) => i.id === t.importacao_id) : null;

  el.innerHTML = `<a href="#/inadimplencia" class="dica">← Inadimplência</a>
    ${cabecalhoTarefa(t, ctx, {
      titulo: `Inadimplência — ${diaSemana(t.prazo)} ${dataCurta(t.prazo)}${ctx.ehAdmin ? ` · ${ctx.nomeUnidade(t.unidade)}` : ''}`,
      extra: imp ? `<div class="linha-acoes" style="margin-top:14px"><span class="dica">Lista: <b>${esc(imp.arquivo_nome || '—')}</b> (${imp.linhas} linhas)</span>
        ${imp.arquivo_path ? '<button class="btn sec peq" id="baixar">Baixar original</button>' : ''}
        </div>` : '',
    })}
    <div class="cartao" id="corpo"></div>`;

  const corpo = el.querySelector('#corpo');
  el.querySelector('#baixar')?.addEventListener('click', () => baixarArquivo(imp.arquivo_path));

  // as listas chegam sozinhas da EVO na véspera (quem está há mais de 3 dias com saldo em aberto)
  if (!t.total) {
    corpo.innerHTML = vazio('A lista desta data entra sozinha da EVO no dia útil anterior, de madrugada. Não é preciso enviar planilha.');
    return;
  }
  corpo.innerHTML = '<h2>Inadimplentes</h2><div id="lista"></div>';
  await listaContatos(corpo.querySelector('#lista'), ctx, t);
}
