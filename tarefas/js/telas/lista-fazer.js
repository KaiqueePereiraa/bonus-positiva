// Lista a fazer — o coordenador sobe uma lista de contatos com a explicação do que fazer; ela é dividida
// igualmente entre as consultoras da unidade e cada uma marca o que já fez (com observação opcional).
// A consultora também pode subir uma lista PRÓPRIA (só dela, sem divisão) para se organizar.
import * as dados from '../dados.js?v=20261116172013';
import { dividirLista, normalizarTelefone, montarMensagem, linkWhatsApp, somarDias } from '../regras.js?v=20261116172013';
import { esc, dataCurta, dataHora, seloStatus, barra, toast, erro, vazio, ehCelular, modal } from '../ui.js?v=20261116172013';
import { lerPlanilha, areaUpload, listaAvisos, cabecalhoTarefa, atualizarCabecalho, linhaProgresso, baixarArquivo, confirmarDesfazer, escolherUnidade } from './_comum.js?v=20261116172013';

const texto = (s) => esc(s).replaceAll('\n', '<br>');
const FAIXA_VERDE = 'background:#F4FAEC;border-color:#D5EDB8;color:var(--dark)';
const fone = (tel) => `(${tel.slice(2, 4)}) ${tel.slice(4, -4)}-${tel.slice(-4)}`;
const aberta = (t) => !t.status.startsWith('concluida');

// Bloco "O que fazer" — a explicação que o coordenador escreveu, sempre visível para a consultora.
const blocoInstrucoes = (l) => (l ? `<div class="faixa" style="${FAIXA_VERDE}"><div><b>O que é esta lista e o que fazer</b>${texto(l.instrucoes)}</div></div>` : '');

// Campos da lista (título, o que fazer, prazo, mensagem) — iguais para o coordenador e para a consultora.
const TEXTOS_ADMIN = {
  instrucoes: 'O que é esta lista e o que as consultoras precisam fazer',
  exemplo: 'Ex.: Lista de alunos que cancelaram nos últimos 3 meses. Entrar em contato, perguntar o motivo e oferecer uma aula gratuita para voltar. Anotar na observação o que a pessoa respondeu.',
};
const TEXTOS_PROPRIA = {
  instrucoes: 'O que você precisa fazer com esta lista',
  exemplo: 'Ex.: Alunos que pararam de vir há 15 dias. Chamar no WhatsApp, perguntar se aconteceu algo e convidar para voltar essa semana.',
};
const formulario = (hoje, t) => `<div style="display:flex;flex-direction:column;gap:14px;margin-bottom:16px">
        <label class="campo">Título da lista<input data-f="titulo" maxlength="80" placeholder="Ex.: Reativar ex-alunos de outubro"></label>
        <label class="campo">${t.instrucoes}
          <textarea data-f="instrucoes" rows="5" placeholder="${t.exemplo}"></textarea></label>
        <div style="display:flex;gap:14px;flex-wrap:wrap">
          <label class="campo" style="min-width:180px">Prazo<input type="date" data-f="prazo" min="${hoje}" value="${somarDias(hoje, 3)}"></label>
          <label class="campo" style="flex:1;min-width:260px">Mensagem de WhatsApp (opcional)
            <textarea data-f="mensagem" rows="2" placeholder="Oi {nome}, tudo bem? Aqui é da Positiva…"></textarea></label>
        </div>
        <p class="dica" style="margin-top:-6px">Na mensagem, {nome} vira o primeiro nome do contato. Sem mensagem, o botão abre o WhatsApp com a conversa em branco.</p>
      </div>`;

export async function render(el, ctx, [tarefaId]) {
  if (tarefaId) return detalhe(el, ctx, tarefaId);
  return ctx.ehAdmin ? painelAdmin(el, ctx) : painelConsultora(el, ctx);
}

// ── Contatos de uma tarefa (consultora e admin) ──
async function listaContatos(el, ctx, tarefa, lista) {
  const itens = await dados.itensDaTarefa(tarefa.id);
  if (!itens.length) { el.innerHTML = vazio('Nenhum contato nesta lista.'); return; }
  const podeMexer = ctx.ehAdmin || tarefa.responsavel_id === ctx.perfil.id;
  const outras = ctx.consultorasDa(tarefa.unidade).filter((c) => c.id !== tarefa.responsavel_id);

  const linha = (i) => {
    const tel = normalizarTelefone(i.celular);
    const extras = Object.entries(i.dados?.extras || {}).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(' · ');
    return `<tr class="${i.feito_em ? 'feito' : ''}" data-id="${i.id}">
      <td class="nome">${esc(i.nome)}${extras ? `<span class="sub">${extras}</span>` : ''}</td>
      <td class="oculta-cel">${tel ? esc(fone(tel)) : '<span class="dica">sem celular</span>'}</td>
      <td style="min-width:210px">${podeMexer
        ? `<input class="ctrl" data-campo="obs" placeholder="Observação (opcional)" value="${esc(i.observacao || '')}" style="width:100%">`
        : esc(i.observacao || '')}
        ${i.feito_em ? `<span class="sub">Feito ${dataHora(i.feito_em)}</span>` : ''}</td>
      <td class="acoes">${!podeMexer ? (i.feito_em ? '<span class="selo verde">Feito</span>' : '<span class="selo cinza">Pendente</span>') : `
        ${tel ? '<button class="btn wa peq" data-acao="wa">WhatsApp</button> ' : ''}
        ${i.feito_em
          ? '<button class="btn sec peq" data-acao="feito">Salvar obs.</button> <button class="btn sec peq" data-acao="desmarcar">Desmarcar</button>'
          : '<button class="btn peq" data-acao="feito">Marcar feito</button>'}
        ${ctx.ehAdmin && !i.feito_em && outras.length ? `<select class="ctrl" data-acao="mover" aria-label="Mover para"><option value="">Mover…</option>${outras.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select>` : ''}`}
      </td></tr>`;
  };

  el.innerHTML = `<div class="tabela-wrap"><table class="tabela responsiva">
    <thead><tr><th>Contato</th><th>Celular</th><th>Observação</th><th></th></tr></thead>
    <tbody>${itens.map(linha).join('')}</tbody></table></div>`;

  // troca só a linha e atualiza o cabeçalho — a página não pula para o topo
  const atualizarLinha = (id, novo) => {
    const idx = itens.findIndex((i) => i.id === id);
    const tr = el.querySelector(`tr[data-id="${id}"]`);
    if (novo) { itens[idx] = novo; tr.outerHTML = linha(novo); } else { itens.splice(idx, 1); tr.remove(); }
    atualizarCabecalho(tarefa, itens);
    ctx.atualizarSino();
  };
  const agir = async (alvo, id, fn, okMsg) => {
    alvo.disabled = true;
    try {
      await fn();
      if (okMsg) toast(okMsg);
      atualizarLinha(id, await dados.item(id).then((i) => (i?.tarefa_id === tarefa.id ? i : null)));
    } catch (e) { erro(e); alvo.disabled = false; }
  };

  el.onclick = (e) => {
    const b = e.target.closest('button[data-acao]');
    if (!b) return;
    const tr = b.closest('tr');
    const id = tr.dataset.id;
    if (b.dataset.acao === 'wa') {
      const i = itens.find((x) => x.id === id);
      // abrir o WhatsApp não marca nada: o contato pode ser por ligação, e quem decide é a consultora
      const url = linkWhatsApp(normalizarTelefone(i.celular), montarMensagem(lista?.mensagem || '', { nome: i.nome }), { celular: ehCelular() });
      window.open(url, 'whatsapp');
    } else if (b.dataset.acao === 'feito') {
      const obs = tr.querySelector('[data-campo="obs"]').value;
      agir(b, id, () => dados.marcarListaItem(id, obs), 'Anotado.');
    } else if (b.dataset.acao === 'desmarcar') agir(b, id, () => dados.desmarcar(id), 'Marcação desfeita.');
  };
  el.onchange = (e) => {
    const s = e.target.closest('select[data-acao="mover"]');
    if (!s || !s.value) return;
    const id = s.closest('tr').dataset.id;
    agir(s, id, () => dados.moverItem(id, s.value), `Contato movido para ${ctx.nomeDe(s.value)}.`);
  };
}

async function detalhe(el, ctx, id) {
  const t = await dados.tarefa(id);
  if (!t) { el.innerHTML = vazio('Tarefa não encontrada.'); return; }
  const lista = (await dados.listasFazer()).find((l) => l.importacao_id === t.importacao_id);
  el.innerHTML = `<a href="#/lista-fazer" class="dica">← Lista a fazer</a>
    ${cabecalhoTarefa(t, ctx, { titulo: `${lista?.titulo || 'Lista a fazer'}${ctx.ehAdmin ? ` — ${ctx.nomeDe(t.responsavel_id)}` : ''}` })}
    ${blocoInstrucoes(lista)}
    <div class="cartao"><h2>Contatos</h2><div id="lista"></div></div>`;
  await listaContatos(el.querySelector('#lista'), ctx, t, lista);
}

// ── Consultora ──
async function painelConsultora(el, ctx) {
  const [tarefas, listas] = await Promise.all([dados.tarefas({ controle: 'lista_fazer', responsavel: ctx.perfil.id }), dados.listasFazer()]);
  const hoje = ctx.hoje();
  const cartao = (t) => {
    const l = listas.find((x) => x.importacao_id === t.importacao_id);
    const propria = l?.criado_por === ctx.perfil.id;
    return `<div class="cartao"><h2>${esc(l?.titulo || 'Lista a fazer')} ${propria ? '<span class="etiqueta">sua lista</span> ' : ''}${seloStatus(t.status, t.prazo_proximo)}
        <span class="mais"><a href="#/lista-fazer/${t.id}">${aberta(t) ? 'Executar' : 'Ver'} →</a></span></h2>
      ${l ? `<p class="dica" style="margin-bottom:12px">${texto(l.instrucoes.length > 220 ? `${l.instrucoes.slice(0, 220)}…` : l.instrucoes)}</p>` : ''}
      <div class="linha-info"><span>Prazo</span><b>${dataCurta(t.prazo)}</b></div>
      <div class="progresso" style="margin-top:10px">${barra(t.feitos, t.total)}</div>
      ${propria && t.feitos === 0 ? `<div class="linha-acoes" style="margin-top:12px"><button class="btn perigo peq" data-acao="desfazer" data-tarefa="${t.id}">Desfazer lista</button></div>` : ''}</div>`;
  };
  const abertas = tarefas.filter(aberta).sort((a, b) => a.prazo.localeCompare(b.prazo));
  const concluidas = tarefas.filter((t) => !aberta(t));
  const nova = ctx.perfil.unidade
    ? `<div class="cartao"><h2>Minha própria lista</h2>
        <p class="dica" style="margin-bottom:14px">Quer organizar um trabalho seu? Suba uma lista de contatos e explique o que quer fazer. Ela fica só com você (não é dividida com as colegas) e aparece aqui para você ir marcando.</p>
        ${formulario(hoje, TEXTOS_PROPRIA)}<div id="upload"></div><div id="previa"></div></div>`
    : '<div class="cartao"><p class="aviso-lista">Seu cadastro está sem unidade, então não dá para subir uma lista. Fale com o coordenador.</p></div>';
  el.innerHTML = `${abertas.map(cartao).join('') || `<div class="cartao"><p class="dica">${tarefas.length ? 'Nenhuma lista pendente. Tudo em dia!' : 'Você ainda não tem nenhuma lista a fazer. Quando o coordenador subir uma, ela aparece aqui com as instruções — e você também pode subir a sua abaixo.'}</p></div>`}
    ${nova}
    ${concluidas.length ? `<h2 style="font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:.6px;margin:8px 0">Concluídas</h2>${concluidas.map(cartao).join('')}` : ''}`;

  el.onclick = async (e) => {
    const b = e.target.closest('button[data-acao="desfazer"]');
    if (!b) return;
    const t = tarefas.find((x) => x.id === b.dataset.tarefa);
    const l = listas.find((x) => x.importacao_id === t?.importacao_id);
    if (!t || !(await confirmarDesfazer({ arquivo_nome: l?.titulo, linhas: t.total }))) return;
    try { await dados.desfazerListaPropria(t.importacao_id); toast('Lista desfeita.'); ctx.atualizarSino(); painelConsultora(el, ctx); } catch (err) { erro(err); }
  };
  if (ctx.perfil.unidade) areaUpload(el.querySelector('#upload'), 'Importar minha lista de contatos', (arquivo) => previa(el, ctx, arquivo, { propria: true }));
}

// ── Coordenador ──
async function painelAdmin(el, ctx) {
  const unidade = ctx.unidade;
  if (!unidade) { escolherUnidade(el, ctx, 'Lista a fazer'); return; }
  const hoje = ctx.hoje();
  const daUnidade = ctx.consultorasDa(unidade);
  const [imports, tarefas, listas] = await Promise.all([
    dados.importacoes('lista_fazer', { unidade, limite: 500 }), dados.tarefas({ controle: 'lista_fazer', unidade }), dados.listasFazer({ unidade })]);

  const historico = imports.map((imp) => {
    const l = listas.find((x) => x.importacao_id === imp.id);
    const ts = tarefas.filter((t) => t.importacao_id === imp.id);
    const feitos = ts.reduce((s, t) => s + t.feitos, 0);
    const total = ts.reduce((s, t) => s + t.total, 0);
    const propria = l?.criado_por && l.criado_por !== ctx.perfil.id;
    return `<div class="cartao" data-imp="${imp.id}"><h2>${esc(l?.titulo || imp.arquivo_nome || 'Lista a fazer')}${propria ? ` <span class="etiqueta">lista própria de ${esc(ctx.nomeDe(l.criado_por))}</span>` : ''} <span class="mais">prazo ${dataCurta(l?.prazo || imp.referencia_fim)}</span></h2>
      ${l ? `<p class="dica" style="margin-bottom:12px">${texto(l.instrucoes)}</p>` : ''}
      ${ts.map((t) => `<a href="#/lista-fazer/${t.id}" style="text-decoration:none;color:inherit">${linhaProgresso(ctx.nomeDe(t.responsavel_id), t.feitos, t.total, t.status)}</a>`).join('')}
      <p class="dica" style="margin-top:8px">Equipe: ${feitos}/${total} contatos feitos${ts.some((t) => t.status === 'atrasada') ? ' · há tarefas atrasadas' : ''}. Clique numa consultora para ver os contatos e mover algum.</p>
      <div class="linha-acoes" style="margin-top:12px">
        ${l ? '<button class="btn sec peq" data-acao="editar">Editar texto</button>' : ''}
        ${imp.arquivo_path ? '<button class="btn sec peq" data-acao="baixar">Baixar planilha original</button>' : ''}
        ${feitos === 0 ? '<button class="btn perigo peq" data-acao="desfazer">Desfazer importação</button>' : ''}
      </div></div>`;
  }).join('');

  el.innerHTML = `
    <div class="cartao"><h2>Nova lista — ${esc(ctx.nomeUnidade(unidade))}</h2>
      ${daUnidade.length ? `<p class="dica" style="margin-bottom:14px">Suba uma lista de contatos e explique o que as consultoras devem fazer. Ela é dividida igualmente entre ${daUnidade.map((c) => esc(c.nome)).join(', ')}.</p>
      ${formulario(hoje, TEXTOS_ADMIN)}
      <div id="upload"></div><div id="previa"></div>`
      : '<p class="aviso-lista">Cadastre as consultoras desta unidade (com ordem do rodízio) em Configurações antes de importar.</p>'}
    </div>
    ${historico || `<div class="cartao"><h2>Listas</h2>${vazio('Nenhuma lista importada nesta unidade ainda.')}</div>`}`;

  // ações do histórico
  el.onclick = async (e) => {
    const b = e.target.closest('button[data-acao]');
    const imp = imports.find((i) => i.id === b?.closest('[data-imp]')?.dataset.imp);
    if (!b || !imp) return;
    const l = listas.find((x) => x.importacao_id === imp.id);
    if (b.dataset.acao === 'baixar') baixarArquivo(imp.arquivo_path);
    else if (b.dataset.acao === 'desfazer') {
      if (!(await confirmarDesfazer(imp))) return;
      try { await dados.desfazerImportacao(imp.id); toast('Importação desfeita.'); ctx.atualizarSino(); painelAdmin(el, ctx); } catch (err) { erro(err); }
    } else if (b.dataset.acao === 'editar' && l) {
      const r = await modal('Editar texto da lista', `<div style="display:flex;flex-direction:column;gap:12px">
        <label class="campo">Título<input id="m-titulo" value="${esc(l.titulo)}" maxlength="80"></label>
        <label class="campo">O que é e o que fazer<textarea id="m-instr" rows="6">${esc(l.instrucoes)}</textarea></label>
        <label class="campo">Mensagem de WhatsApp<textarea id="m-msg" rows="3">${esc(l.mensagem || '')}</textarea></label></div>`,
        { ler: true, acoes: [{ rotulo: 'Cancelar', classe: 'sec', valor: false }, { rotulo: 'Salvar', valor: true }] });
      if (!r?.valor) return;
      const { 'm-titulo': tit, 'm-instr': ins, 'm-msg': msg } = r.campos;
      if (!tit.trim() || !ins.trim()) return toast('Título e instruções são obrigatórios.', 'erro');
      try { await dados.editarListaFazer(l.id, { titulo: tit.trim(), instrucoes: ins.trim(), mensagem: msg.trim() || null }); toast('Texto atualizado.'); painelAdmin(el, ctx); } catch (err) { erro(err); }
    }
  };

  if (!daUnidade.length) return;
  areaUpload(el.querySelector('#upload'), `Importar lista de contatos — ${ctx.nomeUnidade(unidade)}`, (arquivo) => previa(el, ctx, arquivo, { unidade, daUnidade, offset: imports.length }));
}

const lerCampos = (el) => Object.fromEntries([...el.querySelectorAll('[data-f]')].map((c) => [c.dataset.f, c.value.trim()]));

async function previa(el, ctx, arquivo, { unidade, daUnidade, offset, propria = false }) {
  const alvo = el.querySelector('#previa');
  alvo.innerHTML = '<p class="dica" style="margin-top:12px">Lendo planilha…</p>';
  const { registros, avisos, erro: problema } = await lerPlanilha(arquivo, 'lista_fazer');
  if (problema) { alvo.innerHTML = `<p class="aviso-lista" style="margin-top:12px">${esc(problema)}</p>`; return; }

  const contagem = propria ? [registros.length] : dividirLista(registros.length, daUnidade.length, offset);
  const semCelular = registros.filter((r) => !r.celular).length;
  alvo.innerHTML = `<div style="margin-top:16px">
    <h2 style="font-size:14px;margin-bottom:10px">${propria ? `Prévia — ${registros.length} contatos, todos para você` : `Prévia da divisão — ${registros.length} contatos`}</h2>
    ${propria ? '' : daUnidade.map((c, k) => `<div class="linha-info"><b>${esc(c.nome)}</b><span>${contagem[k]} contatos</span></div>`).join('')}
    ${semCelular ? `<p class="dica">${semCelular} contato(s) sem celular válido: a consultora vê o nome, mas sem o botão de WhatsApp.</p>` : ''}
    ${listaAvisos(avisos)}
    <div class="linha-acoes" style="margin-top:16px"><button class="btn verde" id="confirmar">${propria ? 'Confirmar e criar minha lista' : 'Confirmar e distribuir'}</button><button class="btn sec" id="cancelar">Cancelar</button></div></div>`;
  alvo.querySelector('#cancelar').onclick = () => { alvo.innerHTML = ''; };
  alvo.querySelector('#confirmar').onclick = async (e) => {
    const c = lerCampos(el);
    if (!c.titulo) return toast('Dê um título para a lista.', 'erro');
    if (!c.instrucoes) return toast(propria ? 'Escreva o que você precisa fazer com esta lista.' : 'Explique o que é a lista e o que as consultoras precisam fazer.', 'erro');
    if (!c.prazo || c.prazo < ctx.hoje()) return toast('Escolha um prazo a partir de hoje.', 'erro');
    e.target.disabled = true;
    try {
      const caminho = await dados.enviarArquivo('lista_fazer', ctx.perfil.id, arquivo);
      if (propria) {
        await dados.importarListaFazerPropria(c.titulo, c.instrucoes, c.prazo, c.mensagem, caminho, arquivo.name, registros);
        toast('Lista criada. Ela já aparece acima para você marcar.');
        ctx.atualizarSino();
        painelConsultora(el, ctx);
        return;
      }
      await dados.importarListaFazer(unidade, c.titulo, c.instrucoes, c.prazo, c.mensagem, caminho, arquivo.name, registros);
      toast(`Lista dividida entre ${contagem.filter((n) => n > 0).length} consultoras.`);
      ctx.atualizarSino();
      painelAdmin(el, ctx);
    } catch (err) { erro(err); e.target.disabled = false; }
  };
}
