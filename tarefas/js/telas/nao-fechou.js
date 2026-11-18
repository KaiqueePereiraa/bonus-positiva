// Por que não fechou? — admin importa o mês; consultora justifica os seus e pode assumir os sem responsável.
import * as dados from '../dados.js?v=20261118091400';
import { mesReferenciaSugerido, prazoNaoFechou } from '../regras.js?v=20261118091400';
import { esc, dataCurta, dataLonga, nomeMesCap, seloStatus, toast, erro, vazio, confirmar } from '../ui.js?v=20261118091400';
import { cartaoRelatorioDiretoria } from './_relatorio-nf.js?v=20261118091400';

// Excluir interessado (só coordenador): para cadastro duplicado. Pede confirmação; o banco registra quem excluiu.
async function confirmarExclusao(nome) {
  return confirmar('Excluir interessado', `Excluir "${nome}" desta lista? Use para cadastro duplicado. A exclusão fica registrada, mas não dá para desfazer por aqui.`, 'Excluir');
}
import { lerPlanilha, areaUpload, listaAvisos, cabecalhoTarefa, atualizarCabecalho, recarregarNoLugar, linhaProgresso, baixarArquivo, confirmarDesfazer, escolherUnidade } from './_comum.js?v=20261118091400';

const mesDe = (t) => nomeMesCap(+t.periodo_inicio.slice(0, 4), +t.periodo_inicio.slice(5, 7));

export async function render(el, ctx, [tarefaId]) {
  if (tarefaId) return detalhe(el, ctx, tarefaId);
  return ctx.ehAdmin ? painelAdmin(el, ctx) : painelConsultora(el, ctx);
}

// ── Formulário de motivos (consultora e admin) ──
function linhaMotivo(i, ctx, editavel) {
  const d = i.dados || {};
  const info = d.info || [d.contrato, d.vencimento && `venceu/vence ${dataLonga(d.vencimento)}`, d.data_cadastro && `cadastro ${dataLonga(d.data_cadastro)}`, d.interesse, d.como_conheceu && `via ${d.como_conheceu}`, d.idade != null && `${d.idade} anos`].filter(Boolean).join(' · ');
  const motivo = ctx.motivos.find((m) => m.id === i.motivo_id);
  const opcoes = ctx.motivos.filter((m) => (m.controle_id || 'nao_fechou') === i.controle_id && (m.ativo || m.id === i.motivo_id));
  const alerta = d.aluno_mesmo_celular
    ? `<span class="selo laranja" title="Este celular está na ficha de um aluno ativo. Confira se é cadastro duplicado ou um novo aluno da mesma família.">Celular de aluno ativo: ${esc(d.aluno_mesmo_celular)}</span>` : '';
  if (i.resultado === 'matriculou_sem_contato') {
    return `<tr data-id="${i.id}" class="feito"><td class="nome">${esc(i.nome)}<span class="sub">${esc(info || `ID ${i.evo_id}`)}</span></td>
      <td colspan="2"><span class="selo azul" title="Conferido automaticamente na EVO">Já se matriculou</span><span class="sub">antes do contato · EVO</span></td><td class="acoes"></td></tr>`;
  }
  return `<tr data-id="${i.id}" class="${i.feito_em ? 'feito' : ''}">
    <td class="nome">${esc(i.nome)}<span class="sub">${esc(info || `ID ${i.evo_id}`)}</span>${alerta}</td>
    <td style="min-width:220px">${editavel ? `<select class="ctrl" data-campo="motivo" style="width:100%"><option value="">Escolha o motivo…</option>
        ${opcoes.map((m) => `<option value="${m.id}" ${m.id === i.motivo_id ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}</select>
        <input class="ctrl" data-campo="texto" placeholder="Qual foi o motivo?" value="${esc(i.motivo_texto || '')}" style="width:100%;margin-top:6px" ${motivo?.exige_texto ? '' : 'hidden'}>`
      : `${motivo ? esc(motivo.nome) : '<span class="dica">—</span>'}${i.motivo_texto ? `<span class="sub">${esc(i.motivo_texto)}</span>` : ''}`}</td>
    <td style="min-width:180px">${editavel ? `<textarea class="ctrl" data-campo="obs" rows="1" placeholder="Observação (opcional)">${esc(i.observacao || '')}</textarea>` : esc(i.observacao || '')}</td>
    <td class="acoes">${editavel ? `<button class="btn peq ${i.feito_em ? 'sec' : ''}" data-acao="salvar">${i.feito_em ? 'Atualizar' : 'Salvar'}</button>` : ''}
      ${i.feito_em ? '<span class="selo verde">Preenchido</span>' : ''}
      ${ctx.ehAdmin ? '<button class="btn perigo peq" data-acao="excluir" title="Excluir da lista (ex.: cadastro duplicado)">Excluir</button>' : ''}</td></tr>`;
}

// Salvar atualiza só a linha e o cabeçalho (a página não pula para o topo).
export async function formMotivos(el, ctx, tarefa, itens, { editavel, aoContar }) {
  if (!itens.length) { el.innerHTML = vazio('Nenhum interessado aqui.'); return; }
  el.innerHTML = `<div class="tabela-wrap"><table class="tabela responsiva"><thead><tr><th>Interessado</th><th>Motivo</th><th>Observação</th><th></th></tr></thead>
    <tbody>${itens.map((i) => linhaMotivo(i, ctx, editavel)).join('')}</tbody></table></div>`;
  el.onchange = (e) => {
    const s = e.target.closest('[data-campo="motivo"]');
    if (!s) return;
    const m = ctx.motivos.find((x) => x.id === +s.value);
    const texto = s.closest('td').querySelector('[data-campo="texto"]');
    texto.hidden = !m?.exige_texto;
    if (!texto.hidden) texto.focus();
  };
  el.onclick = async (e) => {
    const ex = e.target.closest('[data-acao="excluir"]');
    if (ex) {
      const trEx = ex.closest('tr');
      const id = trEx.dataset.id;
      const alvo = itens.find((i) => i.id === id);
      if (!(await confirmarExclusao(alvo?.nome || 'este interessado'))) return;
      ex.disabled = true;
      try {
        await dados.excluirInteressado(id);
        toast('Interessado excluído.');
        itens.splice(itens.findIndex((i) => i.id === id), 1);
        trEx.remove();
        atualizarCabecalho(tarefa, itens);
        aoContar?.(itens.filter((i) => !i.feito_em).length);
        if (!itens.length) el.innerHTML = vazio('Nenhum interessado aqui.');
        ctx.atualizarSino();
      } catch (err) { erro(err); ex.disabled = false; }
      return;
    }
    const b = e.target.closest('[data-acao="salvar"]');
    if (!b) return;
    const tr = b.closest('tr');
    const motivo = +tr.querySelector('[data-campo="motivo"]').value;
    if (!motivo) return toast('Escolha o motivo antes de salvar.', 'erro');
    b.disabled = true;
    try {
      const id = tr.dataset.id;
      await dados.salvarMotivo(id, motivo, tr.querySelector('[data-campo="texto"]').value, tr.querySelector('[data-campo="obs"]').value);
      toast('Motivo salvo.');
      const novo = await dados.item(id);
      itens[itens.findIndex((i) => i.id === id)] = novo;
      tr.outerHTML = linhaMotivo(novo, ctx, editavel);
      atualizarCabecalho(tarefa, itens);
      aoContar?.(itens.filter((i) => !i.feito_em).length);
      ctx.atualizarSino();
    } catch (err) { erro(err); b.disabled = false; }
  };
}

// ── Consultora ──
async function painelConsultora(el, ctx) {
  const [tarefas, pool] = await Promise.all([dados.tarefas({ controle: 'nao_fechou', responsavel: ctx.perfil.id }), dados.semResponsavelVisiveis()]);
  const atual = tarefas[0];
  el.innerHTML = `${atual ? cabecalhoTarefa(atual, ctx, { titulo: `Referência: ${mesDe(atual)}` }) : ''}
    <div class="cartao">
      <div class="abas" role="tablist">
        <button class="ativo" data-aba="meus">Meus interessados <span class="cont">${atual ? atual.total - atual.feitos : 0} pendentes</span></button>
        ${pool.length ? `<button data-aba="pool">Sem responsável <span class="cont">${pool.length}</span></button>` : ''}
        ${tarefas.length > 1 ? '<button data-aba="anteriores">Meses anteriores</button>' : ''}
      </div>
      <div id="aba"></div>
    </div>`;
  const aba = el.querySelector('#aba');
  const abrir = async (qual) => {
    el.querySelectorAll('[data-aba]').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === qual));
    if (qual === 'meus') {
      if (!atual) { aba.innerHTML = vazio('Você ainda não tem lista neste mês. Quando o administrador importar, ela aparece aqui.'); return; }
      await formMotivos(aba, ctx, atual, await dados.itensDaTarefa(atual.id), {
        editavel: true, aoContar: (n) => { el.querySelector('[data-aba="meus"] .cont').textContent = `${n} pendentes`; } });
    } else if (qual === 'pool') {
      aba.innerHTML = pool.length ? `<p class="dica" style="margin-bottom:12px">Interessados que não estão com nenhuma consultora no EVO. Se foi você que atendeu, clique em "Assumir" — ele passa para a sua lista.</p>
        <div class="tabela-wrap"><table class="tabela responsiva"><thead><tr><th>Interessado</th><th>No EVO</th><th></th></tr></thead><tbody>
        ${pool.map((i) => `<tr data-id="${i.id}"><td class="nome">${esc(i.nome)}<span class="sub">${esc([i.dados?.data_cadastro && dataLonga(i.dados.data_cadastro), i.dados?.interesse].filter(Boolean).join(' · '))}</span></td>
          <td>${esc(i.dados?.consultor_evo || 'sem consultora')}</td><td class="acoes"><button class="btn verde peq" data-acao="assumir">Assumir</button></td></tr>`).join('')}
        </tbody></table></div>` : vazio('Nenhum interessado sem responsável.');
      aba.onclick = async (e) => {
        const b = e.target.closest('[data-acao="assumir"]');
        if (!b) return;
        b.disabled = true;
        const tr = b.closest('tr');
        try {
          await dados.assumir(tr.dataset.id);
          toast('Interessado adicionado à sua lista.');
          tr.remove();
          ctx.atualizarSino();
          // a lista "meus" e o cabeçalho mudam; recarrega sem perder a rolagem, mas continua na aba
          await recarregarNoLugar(async () => { await painelConsultora(el, ctx); await abrirAba(el, 'pool'); });
        } catch (err) { erro(err); tr.remove(); }
      };
    } else {
      aba.innerHTML = `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Mês</th><th>Preenchidos</th><th>Status</th><th></th></tr></thead><tbody>
        ${tarefas.slice(1).map((t) => `<tr><td>${mesDe(t)}</td><td>${t.feitos}/${t.total}</td><td>${seloStatus(t.status)}</td><td class="acoes"><a class="btn sec peq" href="#/nao-fechou/${t.id}">Abrir</a></td></tr>`).join('')}
        </tbody></table></div>`;
    }
  };
  el.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => abrir(b.dataset.aba)));
  el.abrirAba = abrir;
  await abrir('meus');
}

const abrirAba = (el, qual) => el.abrirAba?.(qual);

async function detalhe(el, ctx, id) {
  const t = await dados.tarefa(id);
  if (!t) { el.innerHTML = vazio('Tarefa não encontrada.'); return; }
  el.innerHTML = `<a href="#/nao-fechou" class="dica">← Por que não fechou?</a>
    ${cabecalhoTarefa(t, ctx, { titulo: `${ctx.nomeDe(t.responsavel_id)} — ${mesDe(t)}` })}
    <div class="cartao"><h2>Interessados</h2><div id="lista"></div></div>`;
  const editavel = ctx.ehAdmin || t.responsavel_id === ctx.perfil.id;
  await formMotivos(el.querySelector('#lista'), ctx, t, await dados.itensDaTarefa(id), { editavel });
}

// ── Admin ──
async function painelAdmin(el, ctx) {
  const unidade = ctx.unidade;
  if (!unidade) { escolherUnidade(el, ctx, 'Por que não fechou?'); return; }
  const daUnidade = ctx.consultorasDa(unidade);
  const ref = mesReferenciaSugerido(ctx.hoje());
  const refIni = `${ref.ano}-${String(ref.mes).padStart(2, '0')}-01`;
  const [imports, tarefas] = await Promise.all([dados.importacoes('nao_fechou', { unidade }), dados.tarefas({ controle: 'nao_fechou', unidade })]);
  const doMes = imports.find((i) => i.referencia_inicio === refIni);
  const pool = doMes ? await dados.semResponsavel(doMes.id) : [];
  const tarefasMes = doMes ? tarefas.filter((t) => t.importacao_id === doMes.id) : [];
  const feitos = tarefasMes.reduce((s, t) => s + t.feitos, 0);

  el.innerHTML = `
    <div class="cartao"><h2>${esc(ctx.nomeUnidade(unidade))} · referência ${nomeMesCap(ref.ano, ref.mes)} · prazo ${dataCurta(prazoNaoFechou(ref))}</h2>
      ${doMes ? `${tarefasMes.map((t) => `<a href="#/nao-fechou/${t.id}" style="text-decoration:none;color:inherit">${linhaProgresso(ctx.nomeDe(t.responsavel_id), t.feitos, t.total, t.status)}</a>`).join('')}
        <p class="dica" style="margin-top:8px">${doMes.linhas} interessados importados · ${feitos} motivos preenchidos${pool.length ? ` · ${pool.length} sem responsável` : ''}.</p>
        <div class="linha-acoes" style="margin-top:14px">${doMes.arquivo_path ? '<button class="btn sec peq" id="baixar">Baixar planilha original</button>' : ''}${feitos === 0 ? '<button class="btn perigo peq" id="desfazer">Desfazer importação</button>' : ''}</div>`
        : `<p class="dica" style="margin-bottom:14px">A lista de ${nomeMesCap(ref.ano, ref.mes)} da ${esc(ctx.nomeUnidade(unidade))} ainda não chegou. Ela entra sozinha da EVO no dia 1º, já sem quem é aluno ativo e sem cadastros repetidos, e é dividida entre ${daUnidade.map((c) => esc(c.nome)).join(', ') || 'as consultoras da unidade'}.</p>
           <div class="filtros" style="margin-bottom:14px"><label class="campo">Mês de referência<input type="month" id="mes" value="${ref.ano}-${String(ref.mes).padStart(2, '0')}"></label></div>
           <div id="upload"></div><div id="previa"></div>`}
    </div>
    ${doMes && pool.length ? `<div class="cartao"><h2>Sem responsável <span class="selo cinza">${pool.length}</span></h2>
      ${daUnidade.length ? '<div class="linha-acoes" style="margin-bottom:12px"><button class="btn verde peq" id="dividir">Dividir igualmente entre as consultoras</button><span class="dica">ou atribua um por um abaixo</span></div>' : '<p class="dica" style="margin-bottom:12px">Cadastre as consultoras desta unidade para dividir.</p>'}
      ${pool.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Interessado</th><th>No EVO</th><th>Atribuir a</th><th></th></tr></thead><tbody>
      ${pool.map((i) => `<tr data-id="${i.id}"><td class="nome">${esc(i.nome)}</td><td>${esc(i.dados?.consultor_evo || '—')}</td>
        <td><select class="ctrl" data-acao="atribuir"><option value="">Escolher…</option>${daUnidade.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></td>
        <td class="acoes"><button class="btn perigo peq" data-acao="excluir" title="Excluir da lista (ex.: cadastro duplicado)">Excluir</button></td></tr>`).join('')}
      </tbody></table></div>` : vazio('Todos os interessados têm responsável.')}</div>` : ''}
    <div id="relatorio-diretoria"></div>
    <div class="cartao"><h2>Histórico</h2>${tarefas.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Mês</th><th>Consultora</th><th>Preenchidos</th><th>Status</th><th></th></tr></thead><tbody>
      ${tarefas.map((t) => `<tr><td>${mesDe(t)}</td><td>${esc(ctx.nomeDe(t.responsavel_id))}</td><td>${t.feitos}/${t.total}</td><td>${seloStatus(t.status, t.prazo_proximo)}</td><td class="acoes"><a class="btn sec peq" href="#/nao-fechou/${t.id}">Abrir</a></td></tr>`).join('')}
      </tbody></table></div>` : vazio('Nenhum mês importado ainda.')}</div>`;

  cartaoRelatorioDiretoria(el.querySelector('#relatorio-diretoria'), ctx);

  if (doMes) {
    el.querySelector('#baixar')?.addEventListener('click', () => baixarArquivo(doMes.arquivo_path));
    el.querySelector('#dividir')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      try { const n = await dados.dividirSemResponsavel(doMes.id); toast(`${n} interessado(s) divididos entre as consultoras.`); ctx.atualizarSino(); await recarregarNoLugar(() => painelAdmin(el, ctx)); }
      catch (err) { erro(err); e.target.disabled = false; }
    });
    el.querySelector('#desfazer')?.addEventListener('click', async () => {
      if (!(await confirmarDesfazer(doMes))) return;
      try { await dados.desfazerImportacao(doMes.id); toast('Importação desfeita.'); painelAdmin(el, ctx); } catch (e) { erro(e); }
    });
    el.onclick = async (e) => {
      const ex = e.target.closest('[data-acao="excluir"]');
      if (!ex) return;
      const tr = ex.closest('tr');
      const alvo = pool.find((i) => i.id === tr.dataset.id);
      if (!(await confirmarExclusao(alvo?.nome || 'este interessado'))) return;
      ex.disabled = true;
      try { await dados.excluirInteressado(tr.dataset.id); toast('Interessado excluído.'); ctx.atualizarSino(); await recarregarNoLugar(() => painelAdmin(el, ctx)); }
      catch (err) { erro(err); ex.disabled = false; }
    };
    el.onchange = async (e) => {
      const s = e.target.closest('[data-acao="atribuir"]');
      if (!s?.value) return;
      s.disabled = true;
      try { await dados.moverItem(s.closest('tr').dataset.id, s.value); toast(`Atribuído a ${ctx.nomeDe(s.value)}.`); await recarregarNoLugar(() => painelAdmin(el, ctx)); }
      catch (err) { erro(err); s.disabled = false; }
    };
    return;
  }

  // listas só automáticas: a do mês entra sozinha da EVO todo dia 1º (Configurações → EVO)
  const up = el.querySelector('#upload');
  if (up) up.innerHTML = '<p class="dica">As listas agora chegam sozinhas da EVO — não há mais envio de planilha. A automação fica em <b>Configurações → EVO</b>.</p>';
  el.querySelector('#mes')?.closest('.filtros')?.remove();
}
