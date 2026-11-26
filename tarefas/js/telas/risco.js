// Risco de abandono — a lista chega sozinha da EVO toda quarta (prazo na sexta); o admin acompanha e a consultora marca as mensagens.
import * as dados from '../dados.js?v=20261126154102';
import { semanaDe, prazoSemanal, CLASSES_RISCO } from '../regras.js?v=20261126154102';
import { esc, dataCurta, dataLonga, seloStatus, toast, erro, vazio, confirmar } from '../ui.js?v=20261126154102';
import { cabecalhoTarefa, listaContatos, linhaProgresso, baixarArquivo, escolherUnidade } from './_comum.js?v=20261126154102';

export async function render(el, ctx, [tarefaId]) {
  if (tarefaId) return detalhe(el, ctx, tarefaId);
  return ctx.ehAdmin ? painelAdmin(el, ctx) : painelConsultora(el, ctx);
}

async function detalhe(el, ctx, id) {
  const t = await dados.tarefa(id);
  if (!t) { el.innerHTML = vazio('Tarefa não encontrada.'); return; }
  el.innerHTML = `<a href="#/risco" class="dica">← Risco de abandono</a>
    ${cabecalhoTarefa(t, ctx, { titulo: `Risco de abandono — ${ctx.nomeDe(t.responsavel_id)} · semana ${dataCurta(t.periodo_inicio)} a ${dataCurta(t.periodo_fim)}` })}
    <div class="cartao"><h2>Alunos</h2><div id="lista"></div></div>`;
  await listaContatos(el.querySelector('#lista'), ctx, t);
}

async function painelConsultora(el, ctx) {
  const tarefas = await dados.tarefas({ controle: 'risco', responsavel: ctx.perfil.id });
  if (!tarefas.length) { el.innerHTML = `<div class="cartao">${vazio('Você ainda não tem lista de risco de abandono. Quando o administrador importar a lista da semana, ela aparece aqui.')}</div>`; return; }
  // unidades em grupo: a semana pode ter uma lista da própria unidade e outra com alunos da outra unidade (vem depois)
  const semanaAtual = tarefas[0].periodo_inicio;
  const daOutra = (t) => Number(t.unidade !== ctx.perfil.unidade);
  const atuais = tarefas.filter((t) => t.periodo_inicio === semanaAtual).sort((a, b) => daOutra(a) - daOutra(b));
  const anteriores = tarefas.filter((t) => t.periodo_inicio !== semanaAtual);
  el.innerHTML = `${atuais.map((t) => `<div data-t="${t.id}">${cabecalhoTarefa(t, ctx, { titulo: `Semana ${dataCurta(t.periodo_inicio)} a ${dataCurta(t.periodo_fim)}${daOutra(t) ? ` · alunos da ${ctx.nomeUnidade(t.unidade).replace('Positiva ', '')}` : ''}` })}
    <div class="cartao"><h2>${daOutra(t) ? `Alunos da ${esc(ctx.nomeUnidade(t.unidade).replace('Positiva ', ''))}` : 'Seus alunos'}</h2><div class="lista"></div></div></div>`).join('')}
    ${anteriores.length ? `<div class="cartao"><h2>Semanas anteriores</h2>${tabelaHistorico(anteriores, ctx)}</div>` : ''}`;
  for (const t of atuais) await listaContatos(el.querySelector(`[data-t="${t.id}"] .lista`), ctx, t);
}

const tabelaHistorico = (tarefas, ctx) => `<div class="tabela-wrap"><table class="tabela">
  <thead><tr><th>Semana</th>${ctx.ehAdmin ? '<th>Consultora</th>' : ''}<th>Enviadas</th><th>Status</th><th></th></tr></thead>
  <tbody>${tarefas.map((t) => `<tr><td>${dataCurta(t.periodo_inicio)} a ${dataCurta(t.periodo_fim)}</td>
    ${ctx.ehAdmin ? `<td>${esc(ctx.nomeDe(t.responsavel_id))}</td>` : ''}
    <td>${t.feitos}/${t.total}</td><td>${seloStatus(t.status, t.prazo_proximo)}</td>
    <td class="acoes"><a class="btn sec peq" href="#/risco/${t.id}">Abrir</a></td></tr>`).join('')}</tbody></table></div>`;

async function painelAdmin(el, ctx) {
  const unidade = ctx.unidade;
  if (!unidade) { escolherUnidade(el, ctx, 'Risco de abandono'); return; }
  const hoje = ctx.hoje();
  const semana = semanaDe(hoje);
  const [imports, tarefas, excecoes] = await Promise.all([dados.importacoes('risco', { unidade }), dados.tarefas({ controle: 'risco', unidade }), dados.riscoExcecoes(unidade)]);
  const daSemana = imports.find((i) => i.referencia_inicio === semana.inicio);
  const tarefasSemana = daSemana ? tarefas.filter((t) => t.importacao_id === daSemana.id) : [];
  const feitos = tarefasSemana.reduce((s, t) => s + t.feitos, 0);
  const total = tarefasSemana.reduce((s, t) => s + t.total, 0);

  el.innerHTML = `
    <div class="cartao"><h2>${esc(ctx.nomeUnidade(unidade))} · semana ${dataCurta(semana.inicio)} a ${dataCurta(semana.fim)}${daSemana ? ` · ${daSemana.linhas} alunos` : ''}</h2>
      ${daSemana ? `${tarefasSemana.map((t) => `<a href="#/risco/${t.id}" style="text-decoration:none;color:inherit">${linhaProgresso(ctx.nomeDe(t.responsavel_id), t.feitos, t.total, t.status)}</a>`).join('')}
        <p class="dica" style="margin-top:8px">Equipe: ${feitos}/${total} mensagens. Clique numa consultora para ver a lista e mover alunos.</p>
        <div class="linha-acoes" style="margin-top:14px">${daSemana.arquivo_path ? '<button class="btn sec peq" id="baixar">Baixar planilha original</button>' : ''}</div>`
        : `<p class="dica" style="margin-bottom:14px">A lista desta semana da ${esc(ctx.nomeUnidade(unidade))} ainda não chegou. Ela entra sozinha da EVO toda quarta de madrugada (já sem quem pagou ou voltou no começo da semana) e é dividida entre ${ctx.consultorasDoGrupo(unidade).map((c) => esc(c.nome)).join(', ') || 'as consultoras da unidade'}. Prazo: <b>${dataCurta(prazoSemanal(hoje))}</b>.</p>${'<p class="dica">As listas agora chegam sozinhas da EVO — não há mais envio de planilha. A automação fica em <b>Configurações → EVO</b>.</p>'}`}
    </div>
    <div class="cartao"><h2>Histórico</h2>${tarefas.length ? tabelaHistorico(tarefas.filter((t) => t.importacao_id !== daSemana?.id), ctx) : vazio('Nenhuma semana importada ainda.')}</div>
    <div class="cartao" id="excecoes"><h2>Fora da lista de risco (${excecoes.length})</h2>
      <p class="dica" style="margin-bottom:12px">Alunos que a consultora registrou como Gympass/convênios, benefício colaborador, contrato VIP ou que não quer mais contato. Eles são retirados automaticamente das próximas listas importadas. Remova um registro se o aluno voltar a precisar de contato.</p>
      ${excecoes.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Aluno</th><th>Tipo</th><th>Observação</th><th>Registrado</th><th></th></tr></thead><tbody>
        ${excecoes.map((x) => `<tr data-id="${x.id}"><td class="nome">${esc(x.nome)}<span class="sub">ID ${esc(x.evo_id)}</span></td><td>${esc(CLASSES_RISCO[x.classe] || x.classe)}</td>
          <td>${esc(x.observacao || '')}</td><td>${dataLonga(x.criado_em.slice(0, 10))}${x.criado_por ? `<span class="sub">${esc(ctx.nomeDe(x.criado_por))}</span>` : ''}</td>
          <td class="acoes"><button class="btn sec peq" data-acao="remover-excecao">Remover</button></td></tr>`).join('')}</tbody></table></div>`
        : vazio('Nenhum aluno registrado ainda.')}</div>`;

  el.querySelector('#excecoes')?.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-acao="remover-excecao"]');
    if (!b) return;
    const x = excecoes.find((r) => r.id === b.closest('tr').dataset.id);
    if (!x || !(await confirmar('Remover registro', `Tirar ${x.nome} do registro? Ele volta a aparecer nas próximas listas de risco de abandono.`, 'Remover'))) return;
    try { await dados.removerExcecaoRisco(x.id); toast('Registro removido.'); painelAdmin(el, ctx); } catch (err) { erro(err); }
  });

  if (daSemana) el.querySelector('#baixar')?.addEventListener('click', () => baixarArquivo(daSemana.arquivo_path));
}
