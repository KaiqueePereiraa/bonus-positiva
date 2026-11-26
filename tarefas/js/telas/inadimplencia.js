// Inadimplência — toda sexta a lista chega sozinha da EVO e é DIVIDIDA por igual entre as consultoras da unidade
// (ou do grupo de unidades). Cada uma marca quem recebeu mensagem. Não há mais revezamento/plantão.
import * as dados from '../dados.js?v=20261126172941';
import { esc, dataCurta, diaSemana, seloStatus, vazio } from '../ui.js?v=20261126172941';
import { cabecalhoTarefa, listaContatos, baixarArquivo, linhaProgresso } from './_comum.js?v=20261126172941';

export async function render(el, ctx, [tarefaId]) {
  if (tarefaId) return detalhe(el, ctx, tarefaId);
  const todas = await dados.tarefas({ controle: 'inadimplencia', ...(ctx.ehAdmin ? { unidade: ctx.unidade || undefined } : { responsavel: ctx.perfil.id }) });
  const hoje = ctx.hoje();
  const curto = (u) => ctx.nomeUnidade(u).replace('Positiva ', '');
  const equipe = (u) => ctx.consultorasDoGrupo(u).map((c) => esc(c.nome)).join(', ') || '—';
  const comLista = todas.filter((t) => t.total > 0);

  if (!ctx.ehAdmin) {
    const minhas = comLista.sort((a, b) => b.prazo.localeCompare(a.prazo) || Number(a.unidade !== ctx.perfil.unidade) - Number(b.unidade !== ctx.perfil.unidade));
    const outra = minhas.some((t) => t.unidade !== ctx.perfil.unidade);
    el.innerHTML = `<div class="cartao"><h2>Suas listas de inadimplência</h2>
      <p class="dica" style="margin-bottom:12px">Toda sexta a lista de inadimplentes chega sozinha e é dividida entre ${equipe(ctx.perfil.unidade)}.</p>
      ${minhas.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Data</th>${outra ? '<th>Unidade</th>' : ''}<th>Contatos</th><th>Status</th><th></th></tr></thead><tbody>
        ${minhas.map((t) => `<tr><td><b>${dataCurta(t.prazo)}</b> <span class="dica">${diaSemana(t.prazo)}</span></td>${outra ? `<td>${esc(curto(t.unidade))}</td>` : ''}
          <td>${t.feitos}/${t.total}</td><td>${seloStatus(t.status, t.prazo_proximo)}</td>
          <td class="acoes"><a class="btn ${t.prazo >= hoje ? '' : 'sec'} peq" href="#/inadimplencia/${t.id}">Abrir</a></td></tr>`).join('')}
        </tbody></table></div>` : vazio('Você ainda não recebeu lista de inadimplência.')}</div>`;
    return;
  }

  // coordenador: uma linha por data e unidade; antes de chegar, mostra entre quem será dividida
  const chave = (t) => `${t.prazo}|${t.unidade}`;
  const grupos = [...new Map(todas.map((t) => [chave(t), { prazo: t.prazo, unidade: t.unidade }])).values()];
  const bloco = (g) => {
    const ts = comLista.filter((t) => chave(t) === chave(g));
    const feitos = ts.reduce((s, t) => s + t.feitos, 0), total = ts.reduce((s, t) => s + t.total, 0);
    return `<div style="padding:10px 0;border-top:1px solid var(--line)">
      <b>${dataCurta(g.prazo)}</b> <span class="dica">${diaSemana(g.prazo)} · ${esc(curto(g.unidade))}${total ? ` · equipe ${feitos}/${total}` : ''}</span>
      ${ts.length ? ts.map((t) => `<a href="#/inadimplencia/${t.id}" style="text-decoration:none;color:inherit">${linhaProgresso(ctx.nomeDe(t.responsavel_id), t.feitos, t.total, t.status)}</a>`).join('')
        : `<p class="dica" style="margin-top:4px">${g.prazo >= hoje ? `A lista chega sozinha da EVO e é dividida entre ${equipe(g.unidade)}.` : 'Sem lista nesta data.'}</p>`}</div>`;
  };
  const proximas = grupos.filter((g) => g.prazo >= hoje).sort((a, b) => a.prazo.localeCompare(b.prazo) || a.unidade.localeCompare(b.unidade));
  const passadas = grupos.filter((g) => g.prazo < hoje).sort((a, b) => b.prazo.localeCompare(a.prazo) || a.unidade.localeCompare(b.unidade));
  if (!grupos.length) {
    el.innerHTML = `<div class="cartao">${vazio(`A inadimplência${ctx.unidade ? ` da ${ctx.nomeUnidade(ctx.unidade)}` : ''} ainda não começou. Ela chega sozinha toda sexta quando a automação da EVO da unidade estiver ligada.`)}</div>`;
    return;
  }
  el.innerHTML = `<div class="cartao"><h2>Próximas sextas</h2>${proximas.length ? proximas.map(bloco).join('') : vazio('Nenhuma data futura.')}
      <p class="dica" style="margin-top:10px">A lista é dividida por igual entre as consultoras da unidade (ou do grupo de unidades). Sexta-feira com feriado passa para o dia útil anterior.</p></div>
    ${passadas.length ? `<div class="cartao"><h2>Histórico</h2>${passadas.map(bloco).join('')}</div>` : ''}`;
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
