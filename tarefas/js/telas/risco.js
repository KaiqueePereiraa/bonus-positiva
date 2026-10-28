// Risco de abandono — admin importa e acompanha; consultora marca as mensagens da semana.
import * as dados from '../dados.js';
import { dividir, semanaDe, prazoSemanal } from '../regras.js';
import { esc, dataCurta, seloStatus, toast, erro, vazio } from '../ui.js';
import { lerPlanilha, areaUpload, listaAvisos, cabecalhoTarefa, listaContatos, linhaProgresso, baixarArquivo, confirmarDesfazer, escolherUnidade } from './_comum.js';

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
  const [atual, ...anteriores] = tarefas;
  el.innerHTML = `${cabecalhoTarefa(atual, ctx, { titulo: `Semana ${dataCurta(atual.periodo_inicio)} a ${dataCurta(atual.periodo_fim)}` })}
    <div class="cartao"><h2>Seus alunos</h2><div id="lista"></div></div>
    ${anteriores.length ? `<div class="cartao"><h2>Semanas anteriores</h2>${tabelaHistorico(anteriores, ctx)}</div>` : ''}`;
  await listaContatos(el.querySelector('#lista'), ctx, atual);
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
  const [imports, tarefas] = await Promise.all([dados.importacoes('risco', { unidade }), dados.tarefas({ controle: 'risco', unidade })]);
  const daSemana = imports.find((i) => i.referencia_inicio === semana.inicio);
  const tarefasSemana = daSemana ? tarefas.filter((t) => t.importacao_id === daSemana.id) : [];
  const feitos = tarefasSemana.reduce((s, t) => s + t.feitos, 0);
  const total = tarefasSemana.reduce((s, t) => s + t.total, 0);

  el.innerHTML = `
    <div class="cartao"><h2>${esc(ctx.nomeUnidade(unidade))} · semana ${dataCurta(semana.inicio)} a ${dataCurta(semana.fim)}${daSemana ? ` · ${daSemana.linhas} alunos` : ''}</h2>
      ${daSemana ? `${tarefasSemana.map((t) => `<a href="#/risco/${t.id}" style="text-decoration:none;color:inherit">${linhaProgresso(ctx.nomeDe(t.responsavel_id), t.feitos, t.total, t.status)}</a>`).join('')}
        <p class="dica" style="margin-top:8px">Equipe: ${feitos}/${total} mensagens. Clique numa consultora para ver a lista e mover alunos.</p>
        <div class="linha-acoes" style="margin-top:14px">${daSemana.arquivo_path ? '<button class="btn sec peq" id="baixar">Baixar planilha original</button>' : ''}${feitos === 0 ? '<button class="btn perigo peq" id="desfazer">Desfazer importação</button>' : ''}</div>`
        : `<p class="dica" style="margin-bottom:14px">A lista desta semana da ${esc(ctx.nomeUnidade(unidade))} ainda não foi importada. Ela será dividida entre ${ctx.consultorasDa(unidade).map((c) => esc(c.nome)).join(', ') || 'as consultoras da unidade'}. Prazo: <b>${dataCurta(prazoSemanal(hoje))}</b>.</p><div id="upload"></div><div id="previa"></div>`}
    </div>
    <div class="cartao"><h2>Histórico</h2>${tarefas.length ? tabelaHistorico(tarefas.filter((t) => t.importacao_id !== daSemana?.id), ctx) : vazio('Nenhuma semana importada ainda.')}</div>`;

  if (daSemana) {
    el.querySelector('#baixar')?.addEventListener('click', () => baixarArquivo(daSemana.arquivo_path));
    el.querySelector('#desfazer')?.addEventListener('click', async () => {
      if (!(await confirmarDesfazer(daSemana))) return;
      try { await dados.desfazerImportacao(daSemana.id); toast('Importação desfeita.'); painelAdmin(el, ctx); } catch (e) { erro(e); }
    });
    return;
  }
  areaUpload(el.querySelector('#upload'), `Importar lista de risco de abandono — ${ctx.nomeUnidade(unidade)}`, (arq) => previa(el, ctx, arq, hoje, unidade));
}

async function previa(el, ctx, arquivo, hoje, unidade) {
  const alvo = el.querySelector('#previa');
  alvo.innerHTML = '<p class="dica" style="margin-top:12px">Lendo planilha…</p>';
  const { registros, avisos, erro: problema } = await lerPlanilha(arquivo, 'risco');
  if (problema) { alvo.innerHTML = `<p class="aviso-lista" style="margin-top:12px">${esc(problema)}</p>`; return; }
  const daUnidade = ctx.consultorasDa(unidade);
  if (!daUnidade.length) { alvo.innerHTML = `<p class="aviso-lista">Cadastre as consultoras da ${esc(ctx.nomeUnidade(unidade))} (com ordem do rodízio) em Configurações antes de importar.</p>`; return; }

  // ponteiro lido na hora: desfazer uma importação devolve o ponteiro anterior no banco
  const ponteiro = (await dados.unidades()).find((u) => u.id === unidade).ponteiro_divisao;
  const divisao = dividir(registros.map((r) => ({ evo_id: r.evo_id, consultorEvo: r.dados.consultor_evo })),
    daUnidade.map((c) => ({ id: c.id, nome_evo: c.nome_evo || '' })), ponteiro);
  alvo.innerHTML = `<div style="margin-top:16px">
    <h2 style="font-size:14px;margin-bottom:10px">Prévia da divisão — ${registros.length} alunos</h2>
    ${divisao.resumo.map((r) => `<div class="linha-info"><b>${esc(ctx.nomeDe(r.consultora_id))}</b><span>${r.total} alunos (${r.daEvo} já eram dela no EVO + ${r.recebidos} redistribuídos)</span></div>`).join('')}
    ${listaAvisos(avisos)}
    <div class="linha-acoes" style="margin-top:16px"><button class="btn verde" id="confirmar">Confirmar e distribuir</button><button class="btn sec" id="cancelar">Cancelar</button></div></div>`;
  alvo.querySelector('#cancelar').onclick = () => painelAdmin(el, ctx);
  alvo.querySelector('#confirmar').onclick = async (e) => {
    e.target.disabled = true;
    try {
      const caminho = await dados.enviarArquivo('risco', ctx.perfil.id, arquivo);
      const destino = Object.fromEntries(divisao.atribuicoes.map((a) => [a.evo_id, a.consultora_id]));
      await dados.importarRisco(unidade, hoje, caminho, arquivo.name,
        registros.map((r) => ({ ...r, consultora_id: destino[r.evo_id] })), divisao.proximoPonteiro);
      toast(`Lista importada e dividida entre ${divisao.resumo.filter((r) => r.total).length} consultoras.`);
      ctx.atualizarSino();
      painelAdmin(el, ctx);
    } catch (err) { erro(err); e.target.disabled = false; }
  };
}
