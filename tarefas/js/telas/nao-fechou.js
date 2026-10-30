// Por que não fechou? — admin importa o mês; consultora justifica os seus e pode assumir os sem responsável.
import * as dados from '../dados.js?v=20261030185834';
import { mesReferenciaSugerido, prazoNaoFechou } from '../regras.js?v=20261030185834';
import { esc, dataCurta, dataLonga, nomeMesCap, seloStatus, toast, erro, vazio } from '../ui.js?v=20261030185834';
import { lerPlanilha, areaUpload, listaAvisos, cabecalhoTarefa, atualizarCabecalho, recarregarNoLugar, linhaProgresso, baixarArquivo, confirmarDesfazer, escolherUnidade } from './_comum.js?v=20261030185834';

const mesDe = (t) => nomeMesCap(+t.periodo_inicio.slice(0, 4), +t.periodo_inicio.slice(5, 7));

export async function render(el, ctx, [tarefaId]) {
  if (tarefaId) return detalhe(el, ctx, tarefaId);
  return ctx.ehAdmin ? painelAdmin(el, ctx) : painelConsultora(el, ctx);
}

// ── Formulário de motivos (consultora e admin) ──
function linhaMotivo(i, ctx, editavel) {
  const d = i.dados || {};
  const info = [d.data_cadastro && `cadastro ${dataLonga(d.data_cadastro)}`, d.interesse, d.como_conheceu && `via ${d.como_conheceu}`, d.idade != null && `${d.idade} anos`].filter(Boolean).join(' · ');
  const motivo = ctx.motivos.find((m) => m.id === i.motivo_id);
  const opcoes = ctx.motivos.filter((m) => m.ativo || m.id === i.motivo_id);
  return `<tr data-id="${i.id}" class="${i.feito_em ? 'feito' : ''}">
    <td class="nome">${esc(i.nome)}<span class="sub">${esc(info || `ID ${i.evo_id}`)}</span></td>
    <td style="min-width:220px">${editavel ? `<select class="ctrl" data-campo="motivo" style="width:100%"><option value="">Escolha o motivo…</option>
        ${opcoes.map((m) => `<option value="${m.id}" ${m.id === i.motivo_id ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}</select>
        <input class="ctrl" data-campo="texto" placeholder="Qual foi o motivo?" value="${esc(i.motivo_texto || '')}" style="width:100%;margin-top:6px" ${motivo?.exige_texto ? '' : 'hidden'}>`
      : `${motivo ? esc(motivo.nome) : '<span class="dica">—</span>'}${i.motivo_texto ? `<span class="sub">${esc(i.motivo_texto)}</span>` : ''}`}</td>
    <td style="min-width:180px">${editavel ? `<textarea class="ctrl" data-campo="obs" rows="1" placeholder="Observação (opcional)">${esc(i.observacao || '')}</textarea>` : esc(i.observacao || '')}</td>
    <td class="acoes">${editavel ? `<button class="btn peq ${i.feito_em ? 'sec' : ''}" data-acao="salvar">${i.feito_em ? 'Atualizar' : 'Salvar'}</button>` : ''}
      ${i.feito_em ? '<span class="selo verde">Preenchido</span>' : ''}</td></tr>`;
}

// Salvar atualiza só a linha e o cabeçalho (a página não pula para o topo).
async function formMotivos(el, ctx, tarefa, itens, { editavel, aoContar }) {
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
        <button data-aba="pool">Sem responsável <span class="cont">${pool.length}</span></button>
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
        <p class="dica" style="margin-top:8px">${doMes.linhas} interessados importados · ${feitos} motivos preenchidos · ${pool.length} sem responsável.</p>
        <div class="linha-acoes" style="margin-top:14px">${doMes.arquivo_path ? '<button class="btn sec peq" id="baixar">Baixar planilha original</button>' : ''}${feitos === 0 ? '<button class="btn perigo peq" id="desfazer">Desfazer importação</button>' : ''}</div>`
        : `<p class="dica" style="margin-bottom:14px">Envie o export de interessados da ${esc(ctx.nomeUnidade(unidade))} de ${nomeMesCap(ref.ano, ref.mes)}. O sistema separa pela coluna "Consultor"; quem não estiver com ${daUnidade.map((c) => esc(c.nome)).join(', ') || 'as consultoras da unidade'} vai para "Sem responsável".</p>
           <div class="filtros" style="margin-bottom:14px"><label class="campo">Mês de referência<input type="month" id="mes" value="${ref.ano}-${String(ref.mes).padStart(2, '0')}"></label></div>
           <div id="upload"></div><div id="previa"></div>`}
    </div>
    ${doMes ? `<div class="cartao"><h2>Sem responsável <span class="selo cinza">${pool.length}</span></h2>${pool.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Interessado</th><th>No EVO</th><th>Atribuir a</th></tr></thead><tbody>
      ${pool.map((i) => `<tr data-id="${i.id}"><td class="nome">${esc(i.nome)}</td><td>${esc(i.dados?.consultor_evo || '—')}</td>
        <td><select class="ctrl" data-acao="atribuir"><option value="">Escolher…</option>${daUnidade.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></td></tr>`).join('')}
      </tbody></table></div>` : vazio('Todos os interessados têm responsável.')}</div>` : ''}
    <div class="cartao"><h2>Histórico</h2>${tarefas.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Mês</th><th>Consultora</th><th>Preenchidos</th><th>Status</th><th></th></tr></thead><tbody>
      ${tarefas.map((t) => `<tr><td>${mesDe(t)}</td><td>${esc(ctx.nomeDe(t.responsavel_id))}</td><td>${t.feitos}/${t.total}</td><td>${seloStatus(t.status, t.prazo_proximo)}</td><td class="acoes"><a class="btn sec peq" href="#/nao-fechou/${t.id}">Abrir</a></td></tr>`).join('')}
      </tbody></table></div>` : vazio('Nenhum mês importado ainda.')}</div>`;

  if (doMes) {
    el.querySelector('#baixar')?.addEventListener('click', () => baixarArquivo(doMes.arquivo_path));
    el.querySelector('#desfazer')?.addEventListener('click', async () => {
      if (!(await confirmarDesfazer(doMes))) return;
      try { await dados.desfazerImportacao(doMes.id); toast('Importação desfeita.'); painelAdmin(el, ctx); } catch (e) { erro(e); }
    });
    el.onchange = async (e) => {
      const s = e.target.closest('[data-acao="atribuir"]');
      if (!s?.value) return;
      s.disabled = true;
      try { await dados.moverItem(s.closest('tr').dataset.id, s.value); toast(`Atribuído a ${ctx.nomeDe(s.value)}.`); await recarregarNoLugar(() => painelAdmin(el, ctx)); }
      catch (err) { erro(err); s.disabled = false; }
    };
    return;
  }

  areaUpload(el.querySelector('#upload'), `Importar interessados não convertidos — ${ctx.nomeUnidade(unidade)}`, async (arquivo) => {
    const alvo = el.querySelector('#previa');
    const [ano, mes] = el.querySelector('#mes').value.split('-').map(Number);
    alvo.innerHTML = '<p class="dica" style="margin-top:12px">Lendo planilha…</p>';
    const { registros, avisos, erro: problema } = await lerPlanilha(arquivo, 'nao_fechou');
    if (problema) { alvo.innerHTML = `<p class="aviso-lista" style="margin-top:12px">${esc(problema)}</p>`; return; }
    const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
    const porConsultora = daUnidade.map((c) => ({ nome: c.nome, n: registros.filter((r) => norm(r.dados.consultor_evo) === norm(c.nome_evo)).length }));
    const semResp = registros.length - porConsultora.reduce((s, c) => s + c.n, 0);
    const dia = +ctx.hoje().slice(8, 10);
    alvo.innerHTML = `<div style="margin-top:16px"><h2 style="font-size:14px;margin-bottom:10px">Prévia — ${registros.length} interessados de ${nomeMesCap(ano, mes)}</h2>
      ${porConsultora.map((c) => `<div class="linha-info"><b>${esc(c.nome)}</b><span>${c.n}</span></div>`).join('')}
      <div class="linha-info"><b>Sem responsável</b><span>${semResp}</span></div>
      ${dia > 5 ? `<p class="aviso-lista">Atenção: o prazo é ${dataCurta(prazoNaoFechou({ ano, mes }))} — as consultoras terão pouco tempo.</p>` : ''}
      ${listaAvisos(avisos)}
      <div class="linha-acoes" style="margin-top:16px"><button class="btn verde" id="confirmar">Confirmar importação</button><button class="btn sec" id="cancelar">Cancelar</button></div></div>`;
    alvo.querySelector('#cancelar').onclick = () => painelAdmin(el, ctx);
    alvo.querySelector('#confirmar').onclick = async (e) => {
      e.target.disabled = true;
      try {
        const caminho = await dados.enviarArquivo('nao_fechou', ctx.perfil.id, arquivo);
        await dados.importarNaoFechou(unidade, ano, mes, caminho, arquivo.name, registros);
        toast('Lista importada e separada por consultora.');
        ctx.atualizarSino();
        painelAdmin(el, ctx);
      } catch (err) { erro(err); e.target.disabled = false; }
    };
  });
}
