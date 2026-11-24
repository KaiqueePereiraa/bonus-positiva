// Configurações (só admin): usuários, unidades e grupos, feriados, motivos, mensagens e WhatsApp.
import * as dados from '../dados.js?v=20261124194736';
import { normalizarTelefone, diaDaSemana } from '../regras.js?v=20261124194736';
import { esc, dataLonga, dataHora, diaSemana, toast, erro, vazio, modal, confirmar } from '../ui.js?v=20261124194736';

const ABAS = [['usuarios', 'Usuários'], ['rodizio', 'Unidades e grupos'], ['feriados', 'Feriados'], ['motivos', 'Motivos'], ['mensagens', 'Mensagens'], ['whatsapp', 'WhatsApp'], ['evo', 'EVO']];

// coordenador de unidade: só a equipe e as unidades dele (o resto vale para todas e fica com o administrador geral)
const ABAS_COORD = ['usuarios', 'rodizio'];

export async function render(el, ctx, [aba = 'usuarios']) {
  const abas = ctx.ehSuper ? ABAS : ABAS.filter(([id]) => ABAS_COORD.includes(id));
  if (!abas.some(([id]) => id === aba)) aba = 'usuarios';
  el.innerHTML = `<div class="cartao"><div class="abas">${abas.map(([id, r]) => `<button data-aba="${id}" class="${id === aba ? 'ativo' : ''}">${r}</button>`).join('')}</div><div id="aba"></div></div>`;
  el.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/configuracoes/${b.dataset.aba}`; }));
  const alvo = el.querySelector('#aba');
  const fn = { usuarios, rodizio, feriados, motivos, mensagens, whatsapp, evo }[aba] || usuarios;
  await fn(alvo, ctx);
}

// ── Usuários ──
const formPerfil = (p = {}, ctx, { comEmail = false } = {}) => `
  ${comEmail ? '<label class="campo">E-mail da pessoa<input id="email" type="email" placeholder="nome@exemplo.com"></label>' : ''}
  <label class="campo">Nome<input id="nome" value="${esc(p.nome || '')}"></label>
  <label class="campo">Unidade<select id="unidade">${ctx.ehSuper ? '<option value="">—</option>' : ''}${ctx.unidades.map((u) => `<option value="${u.id}" ${u.id === p.unidade ? 'selected' : ''}>${esc(u.nome)}</option>`).join('')}</select></label>
  <label class="campo">Nome no EVO (igual ao relatório)<input id="nome_evo" value="${esc(p.nome_evo || '')}" placeholder="ADRIELLY SANTANA SABINO"></label>
  <label class="campo">WhatsApp (com DDD)<input id="whatsapp" value="${esc(p.whatsapp || '')}" placeholder="27 99999-9999"></label>
  <label class="campo">Central de Tarefas<select id="papel_tarefas"><option value="">Sem acesso</option><option value="consultora" ${p.papel_tarefas === 'consultora' ? 'selected' : ''}>Consultora</option>${ctx.ehSuper ? `<option value="admin" ${p.papel_tarefas === 'admin' ? 'selected' : ''}>Coordenador (administrador)</option>` : ''}</select></label>
  ${ctx.ehSuper && !p.super_admin ? `<fieldset class="campo unidades-coord"><legend>Unidades que coordena <span class="dica">(só vale para coordenador; sem nenhuma marcada ele não vê unidade nenhuma)</span></legend>
    ${ctx.unidades.map((u) => `<label><input type="checkbox" id="coord_${u.id}" ${(p.unidades_coord || []).includes(u.id) ? 'checked' : ''}> ${esc(u.nome.replace('Positiva ', ''))}</label>`).join('')}</fieldset>` : ''}
  <label class="campo">Entra na divisão das listas? Ordem (vazio = fora da divisão)<input id="ordem_rodizio" type="number" min="1" value="${p.ordem_rodizio ?? ''}"></label>
  <label class="campo">Controle de Bônus<select id="papel_bonus"><option value="">Sem acesso</option><option value="consultant" ${p.papel_bonus === 'consultant' ? 'selected' : ''}>Consultor</option>${ctx.ehSuper ? `<option value="coordinator" ${p.papel_bonus === 'coordinator' ? 'selected' : ''}>Coordenador</option>` : ''}</select></label>
  <label class="campo">Nome nas vendas do bônus (igual ao relatório)<input id="nome_bonus" value="${esc(p.nome_bonus || '')}"></label>
  <label class="campo" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="ativo" ${p.ativo !== false ? 'checked' : ''}> Ativo</label>`;

// Campos do formulário → colunas de profiles (null quando vazio). Devolve null se o WhatsApp for inválido.
function camposPerfil(c, ctx) {
  const tel = c.whatsapp.trim() ? normalizarTelefone(c.whatsapp) : null;
  if (c.whatsapp.trim() && !tel) { toast('WhatsApp inválido. Use DDD + número.', 'erro'); return null; }
  if (c.papel_tarefas === 'consultora' && !c.unidade) { toast('Escolha a unidade da consultora.', 'erro'); return null; }
  return {
    nome: c.nome.trim(), unidade: c.unidade || null, nome_evo: c.nome_evo.trim().toUpperCase() || null, whatsapp: tel,
    acesso_tarefas: !!c.papel_tarefas, papel_tarefas: c.papel_tarefas || null,
    ordem_rodizio: c.ordem_rodizio ? +c.ordem_rodizio : null,
    acesso_bonus: !!c.papel_bonus, papel_bonus: c.papel_bonus || null, nome_bonus: c.nome_bonus.trim().toUpperCase() || null,
    ativo: c.ativo,
    // as caixas de unidade só aparecem para o administrador geral
    // (quem deixa de ser coordenador perde as unidades, senão o coordenador da unidade não consegue mais editá-la)
    ...(ctx.ehSuper && ctx.unidades.some((u) => `coord_${u.id}` in c)
      ? { unidades_coord: c.papel_tarefas === 'admin' ? ctx.unidades.filter((u) => c[`coord_${u.id}`]).map((u) => u.id) : [] } : {}),
  };
}

// o coordenador de unidade não edita coordenadores (nem a si mesmo): o banco recusaria sem avisar
const podeEditar = (p, ctx) => ctx.ehSuper || (p.papel_tarefas !== 'admin' && p.papel_bonus !== 'coordinator' && !p.super_admin);
const rotuloCentral = (p, ctx) => {
  if (!p.acesso_tarefas) return '—';
  if (p.papel_tarefas !== 'admin') return `Consultora${p.unidade ? `<span class="sub">${esc(ctx.nomeUnidade(p.unidade).replace('Positiva ', ''))}</span>` : ''}`;
  if (p.super_admin) return 'Admin geral';
  const us = (p.unidades_coord || []).map((u) => ctx.nomeUnidade(u).replace('Positiva ', '')).join(', ');
  return `Coordenador<span class="sub">${us ? esc(us) : 'sem unidade'}</span>`;
};

async function usuarios(el, ctx) {
  const perfis = await dados.perfis();
  el.innerHTML = `<div class="linha-acoes" style="margin-bottom:14px"><button class="btn verde" data-acao="convidar">+ Convidar pessoa</button>
    <span class="dica">A pessoa recebe um e-mail com o link para criar a própria senha.</span></div>
    ${perfis.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Pessoa</th><th>Central</th><th>Bônus</th><th>Divisão</th><th>WhatsApp</th><th></th></tr></thead><tbody>
    ${perfis.map((p) => `<tr data-id="${p.id}"><td class="nome">${esc(p.nome || '(sem nome)')}${p.ativo ? '' : ' <span class="selo vermelho">inativo</span>'}<span class="sub">${esc(p.email || '')}${p.nome_evo ? ` · EVO: ${esc(p.nome_evo)}` : ''}${p.nome_bonus ? ` · Bônus: ${esc(p.nome_bonus)}` : ''}</span></td>
      <td>${rotuloCentral(p, ctx)}</td>
      <td>${p.acesso_bonus ? (p.papel_bonus === 'coordinator' ? 'Coordenador' : 'Consultor') : '—'}</td>
      <td>${p.ordem_rodizio ?? '—'}</td><td>${p.whatsapp ? esc(p.whatsapp) : '—'}</td>
      <td class="acoes"><button class="btn sec peq" data-acao="link" title="Envia um e-mail para a pessoa criar ou trocar a senha">Enviar link de acesso</button> ${podeEditar(p, ctx) ? '<button class="btn sec peq" data-acao="editar">Editar</button>' : ''}</td></tr>`).join('')}</tbody></table></div>` : vazio('Nenhum usuário ainda.')}
    <p class="dica" style="margin-top:12px">O link vence rápido e cada novo envio cancela os anteriores. Se a pessoa não recebeu ou o link venceu, use "Enviar link de acesso" e peça para ela abrir o e-mail MAIS RECENTE (olhe também o spam/lixo eletrônico).</p>`;
  el.onclick = async (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    if (b.dataset.acao === 'convidar') {
      const r = await modal('Convidar pessoa', formPerfil({}, ctx, { comEmail: true }),
        { ler: true, acoes: [{ rotulo: 'Cancelar', classe: 'sec', valor: null }, { rotulo: 'Enviar convite', valor: 'ok' }] });
      if (r?.valor !== 'ok') return;
      const perfil = camposPerfil(r.campos, ctx);
      if (!perfil) return;
      try {
        await dados.convidar(r.campos.email, perfil);
        toast(`Convite enviado para ${r.campos.email.trim()}.`);
        usuarios(el, ctx);
      } catch (err) { erro(err); }
      return;
    }
    const p = perfis.find((x) => x.id === b.closest('tr').dataset.id);
    if (b.dataset.acao === 'link') {
      b.disabled = true;
      try { await dados.enviarLinkAcesso(p.email); toast(`Link de acesso enviado para ${p.email}.`); }
      catch (err) { erro(err); }
      b.disabled = false;
      return;
    }
    const r = await modal(`Editar ${p.nome || p.email}`, formPerfil(p, ctx),
      { ler: true, acoes: [{ rotulo: 'Cancelar', classe: 'sec', valor: null }, { rotulo: 'Salvar', valor: 'ok' }] });
    if (r?.valor !== 'ok') return;
    const campos = camposPerfil(r.campos, ctx);
    if (!campos) return;
    try {
      await dados.atualizarPerfil(p.id, campos);
      toast('Usuário atualizado. Recarregue a página para atualizar menus e listas.');
      usuarios(el, ctx);
    } catch (err) { erro(err); }
  };
}

// ── Unidades e grupos de unidades (a rota continua #/configuracoes/rodizio para links antigos) ──
// Grupo: unidades no mesmo grupo dividem TODAS as listas entre as consultoras do grupo (cada uma fica primeiro com os
// alunos da própria unidade; a sobra completa as da outra). Só o administrador geral muda.
// Grupos disponíveis: um para cada unidade cadastrada (Grupo 1 = 'A', Grupo 2 = 'B'…); unidade nova = grupo novo disponível.
// Para criar um grupo, basta escolher o mesmo número de grupo em duas ou mais unidades.
const gruposPara = (n) => [['', 'Sozinha'], ...Array.from({ length: Math.max(n, 2) }, (_, i) => [String.fromCharCode(65 + i), `Grupo ${i + 1}`])];

async function rodizio(el, ctx) {
  const todasUnidades = await dados.unidades();
  const unidades = todasUnidades.filter((u) => ctx.unidades.some((x) => x.id === u.id));
  const GRUPOS = gruposPara(todasUnidades.length);
  const nomeGrupo = (g) => GRUPOS.find(([id]) => id === (g || ''))?.[1] || g;
  el.innerHTML = `<p class="dica" style="margin-bottom:14px">Todas as listas — inclusive a inadimplência, que chega toda sexta — são divididas por igual entre as consultoras da unidade (ou do grupo). Quem entra na divisão é definido em Usuários.</p>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Unidade</th><th>Consultoras na divisão</th><th>Divide as listas</th>${ctx.ehSuper ? '<th></th>' : ''}</tr></thead><tbody>
    ${unidades.map((u) => `<tr data-u="${u.id}"><td class="nome">${esc(u.nome)}</td>
      <td>${ctx.consultorasDa(u.id).map((c) => esc(c.nome)).join(', ') || '<span class="dica">sem consultoras</span>'}</td>
      <td>${ctx.ehSuper ? `<select class="ctrl" data-campo="grupo">${GRUPOS.map(([id, r]) => `<option value="${id}" ${id === (u.grupo || '') ? 'selected' : ''}>${r}</option>`).join('')}</select>`
        : esc(nomeGrupo(u.grupo))}</td>
      ${ctx.ehSuper ? '<td class="acoes"><button class="btn peq" data-acao="salvar">Salvar</button></td>' : ''}</tr>`).join('')}
    </tbody></table></div>
    <p class="dica" style="margin-top:10px"><b>Divide as listas:</b> unidades no mesmo grupo juntam as consultoras e dividem todas as listas por igual.
      Para criar um grupo, escolha o mesmo número de grupo nas unidades que vão juntar e salve cada uma. Cada consultora recebe primeiro os alunos da própria unidade;
      o que sobrar de uma unidade completa as da outra, numa lista separada que aparece depois. Vale para as listas que chegarem a partir de agora.</p>`;
  el.onclick = async (e) => {
    const b = e.target.closest('[data-acao="salvar"]');
    if (!b) return;
    const tr = b.closest('tr');
    const u = unidades.find((x) => x.id === tr.dataset.u);
    const grupo = tr.querySelector('[data-campo="grupo"]').value;
    if (grupo === (u.grupo || '')) return toast('Nada mudou.');
    try {
      await dados.salvarUnidade(u.id, { grupo: grupo || null });
      toast('Salvo. Recarregue a página para atualizar as listas.');
      rodizio(el, ctx);
    } catch (err) { erro(err); }
  };
}

// ── Feriados ──
async function feriados(el) {
  const lista = await dados.feriados();
  const hoje = new Date().toISOString().slice(0, 10);
  el.innerHTML = `<div class="filtros" style="margin-bottom:16px"><label class="campo">Data<input type="date" id="data"></label>
    <label class="campo">Nome<input id="nome" placeholder="Ex.: Aniversário de Serra"></label>
    <button class="btn" id="add">Adicionar</button></div>
    <p class="dica" style="margin-bottom:12px">Se a sexta da inadimplência ou do risco cair num feriado, o prazo passa para o dia útil anterior.</p>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Data</th><th>Feriado</th><th>Abrangência</th><th></th></tr></thead><tbody>
    ${lista.filter((f) => f.data >= hoje.slice(0, 4) + '-01-01').map((f) => `<tr><td>${dataLonga(f.data)} <span class="dica">${diaSemana(f.data)}</span></td><td>${esc(f.nome)}</td><td>${esc(f.abrangencia)}</td>
      <td class="acoes"><button class="btn perigo peq" data-data="${f.data}">Remover</button></td></tr>`).join('')}</tbody></table></div>`;
  el.querySelector('#add').onclick = async () => {
    const data = el.querySelector('#data').value; const nome = el.querySelector('#nome').value.trim();
    if (!data || !nome) return toast('Informe data e nome.', 'erro');
    try { await dados.salvarFeriado({ data, nome, abrangencia: 'outro' }); toast('Feriado adicionado.'); feriados(el); } catch (err) { erro(err); }
  };
  el.querySelector('tbody').onclick = async (e) => {
    const b = e.target.closest('[data-data]');
    if (!b) return;
    try { await dados.removerFeriado(b.dataset.data); toast('Feriado removido.'); feriados(el); } catch (err) { erro(err); }
  };
}

// ── Motivos ──
// listas que pedem motivo (só aparecem as que já existem no banco)
const LISTAS_MOTIVO = [['nao_fechou', 'Por que não fechou?'], ['renovacao_venceu', 'Renovação: venceu e não renovou'], ['cancelou', 'Cancelou: entrevista de saída']];
let listaMotivo = 'nao_fechou';

async function motivos(el, ctx) {
  const existentes = new Set(Object.keys(ctx.controles || {}));
  const listas = LISTAS_MOTIVO.filter(([id]) => id === 'nao_fechou' || existentes.has(id));
  const lista = (await dados.motivos()).filter((m) => (m.controle_id || 'nao_fechou') === listaMotivo);
  // "Por que não fechou?": cada motivo pode valer para uma etapa só (vazio = as duas)
  const comEtapa = listaMotivo === 'nao_fechou';
  const selEtapa = (v) => (comEtapa ? `<td><select class="ctrl" data-c="etapa">${[['', 'As duas'], ['sem_experimental', 'Não agendou experimental'], ['fez_experimental', 'Fez experimental']]
    .map(([k, n]) => `<option value="${k}" ${(v || '') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></td>` : '');
  el.innerHTML = `${listas.length > 1 ? `<div class="filtros" style="margin-bottom:12px"><label class="campo">Lista<select class="ctrl" id="lista-motivo">
      ${listas.map(([id, nome]) => `<option value="${id}" ${id === listaMotivo ? 'selected' : ''}>${esc(nome)}</option>`).join('')}</select></label></div>` : ''}
    <p class="dica" style="margin-bottom:14px">Motivo não usado mais deve ser <b>desativado</b> (não some dos meses anteriores).${comEtapa ? ' <b>Etapa</b>: em qual pergunta o motivo aparece ("Por que não agendou a experimental?" ou "Por que não fechou depois da experimental?").' : ''} "Exige texto" obriga a consultora a escrever o motivo.</p>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Ordem</th><th>Motivo</th>${comEtapa ? '<th>Etapa</th>' : ''}<th>Exige texto</th><th>Ativo</th><th></th></tr></thead><tbody>
    ${lista.map((m) => `<tr data-id="${m.id}"><td><input class="ctrl" type="number" data-c="ordem" value="${m.ordem}" style="width:70px"></td>
      <td><input class="ctrl" data-c="nome" value="${esc(m.nome)}" style="width:100%"></td>${selEtapa(m.etapa)}
      <td><input type="checkbox" data-c="exige_texto" ${m.exige_texto ? 'checked' : ''}></td>
      <td><input type="checkbox" data-c="ativo" ${m.ativo ? 'checked' : ''}></td>
      <td class="acoes"><button class="btn sec peq" data-acao="salvar">Salvar</button></td></tr>`).join('')}
    <tr data-id=""><td><input class="ctrl" type="number" data-c="ordem" value="${lista.length + 1}" style="width:70px"></td>
      <td><input class="ctrl" data-c="nome" placeholder="Novo motivo" style="width:100%"></td>${selEtapa('')}
      <td><input type="checkbox" data-c="exige_texto"></td><td><input type="checkbox" data-c="ativo" checked></td>
      <td class="acoes"><button class="btn peq" data-acao="salvar">Adicionar</button></td></tr></tbody></table></div>`;
  el.onclick = async (e) => {
    const b = e.target.closest('[data-acao="salvar"]');
    if (!b) return;
    const tr = b.closest('tr');
    const v = (c) => tr.querySelector(`[data-c="${c}"]`);
    const m = { controle_id: listaMotivo, nome: v('nome').value.trim(), ordem: +v('ordem').value || 0, exige_texto: v('exige_texto').checked, ativo: v('ativo').checked };
    if (!m.nome) return toast('Informe o nome do motivo.', 'erro');
    if (comEtapa) m.etapa = v('etapa').value || null;
    if (tr.dataset.id) m.id = +tr.dataset.id;
    try { await dados.salvarMotivoCadastro(m); ctx.motivos = await dados.motivos(); toast('Motivo salvo.'); motivos(el, ctx); } catch (err) { erro(err); }
  };
  el.querySelector('#lista-motivo')?.addEventListener('change', (e) => { listaMotivo = e.target.value; motivos(el, ctx); });
}

// ── Mensagens padrão do WhatsApp (para os alunos) ──
async function mensagens(el, ctx) {
  const c = ctx.controles;
  el.innerHTML = `<p class="dica" style="margin-bottom:14px">Texto que já vem escrito quando a consultora clica em "WhatsApp". Use <b>{nome}</b> para o primeiro nome do aluno. Ela ainda pode editar antes de enviar.</p>
    ${['risco', 'inadimplencia'].map((id) => `<label class="campo" style="margin-bottom:14px">${esc(c[id].nome)}<textarea class="ctrl" rows="4" data-id="${id}">${esc(c[id].config?.mensagem_whatsapp || '')}</textarea></label>`).join('')}
    <button class="btn" id="salvar">Salvar mensagens</button>`;
  el.querySelector('#salvar').onclick = async () => {
    try {
      for (const t of el.querySelectorAll('textarea[data-id]')) {
        const config = { ...(c[t.dataset.id].config || {}), mensagem_whatsapp: t.value.trim() };
        await dados.atualizarControle(t.dataset.id, { config });
        c[t.dataset.id].config = config;
      }
      toast('Mensagens salvas.');
    } catch (err) { erro(err); }
  };
}

// ── WhatsApp (avisos da equipe pelo Wasfit) ──
async function whatsapp(el) {
  const [cfg, envios] = await Promise.all([dados.config(), dados.enviosWhatsapp()]);
  const teste = cfg.whatsapp_modo_teste !== false;
  el.innerHTML = `<div class="faixa ${teste ? '' : 'urgente'}" style="margin-bottom:16px"><div><b>${teste ? 'Modo teste ligado' : 'Envio real ligado'}</b>
    ${teste ? 'Todos os avisos vão só para o WhatsApp do administrador.' : 'Os avisos vão para o WhatsApp de cada pessoa.'}</div></div>
    <div class="linha-acoes"><button class="btn ${teste ? 'verde' : 'sec'}" id="alternar">${teste ? 'Ligar envio real para a equipe' : 'Voltar para o modo teste'}</button>
    <button class="btn sec" id="testar">Enviar mensagem de teste para mim</button></div>
    <p class="dica" style="margin-top:10px">Resumos automáticos em dias úteis: 9h para cada consultora (só se houver algo a fazer) e 18h para o administrador. Ao importar uma lista, cada consultora é avisada na hora.</p>
    <h2 style="margin:22px 0 10px;font-size:14px">Últimos envios</h2>
    ${envios.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Quando</th><th>Tipo</th><th>Para</th><th>Status</th></tr></thead><tbody>
      ${envios.map((e) => `<tr><td>${dataHora(e.criado_em)}</td><td>${esc(e.tipo)}</td><td>${esc(e.telefone)}</td>
        <td><span class="selo ${e.status === 'enviado' ? 'verde' : e.status === 'falhou' ? 'vermelho' : 'cinza'}">${esc(e.status)}</span>${e.detalhe ? `<span class="sub">${esc(e.detalhe)}</span>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : vazio('Nenhum envio ainda.')}`;
  el.querySelector('#alternar').onclick = async () => {
    try { await dados.salvarConfig('whatsapp_modo_teste', !teste); toast('Configuração salva.'); whatsapp(el); } catch (err) { erro(err); }
  };
  el.querySelector('#testar').onclick = async (e) => {
    e.target.disabled = true;
    try { await dados.testarWhatsapp(); toast('Mensagem de teste enviada. Confira seu WhatsApp.'); setTimeout(() => whatsapp(el), 1500); }
    catch (err) { erro(err); e.target.disabled = false; }
  };
}

// ── EVO (conexão privada e rotinas automáticas) ──
const ROTINAS_EVO = [
  { id: 'inadimplencia', titulo: 'Inadimplentes', quando: 'Toda quinta-feira (no dia útil antes da sexta da inadimplência)',
    texto: 'Busca na EVO os clientes ATIVOS com dívida em aberto há MAIS DE 3 DIAS (prazo para a pessoa se ajustar) e sobe a lista na tarefa da inadimplência da sexta. Inativos não aparecem. Se a responsável já subiu a planilha à mão, não mexe.' },
  { id: 'risco', titulo: 'Risco de abandono', quando: 'Toda quarta-feira, 5h10 (prazo na sexta)',
    texto: 'Busca os clientes ativos com mais de 15 dias sem vir, tira quem está registrado (Gympass, benefício colaborador, contrato VIP) e os contratos listados abaixo, e divide entre as consultoras da unidade.' },
  { id: 'nao_fechou', titulo: 'Por que não fechou?', quando: 'De segunda a sexta, 6h da manhã',
    texto: 'Monta a lista do dia com os interessados PARADOS há 5 dias, em duas etapas: quem se cadastrou e não marcou aula experimental, e quem fez a experimental e não se matriculou (na segunda, também os que completaram 5 dias no fim de semana). Tira quem já se matriculou, quem já é aluno (mesmo nome), cadastros repetidos (mesmo celular) e quem já esteve na lista nessa etapa. Fica com quem cadastrou; cada consultora registra o motivo até o próximo dia útil.' },
  { id: 'renovacao', titulo: 'Renovação de contratos', quando: 'Toda segunda-feira',
    texto: 'Monta duas listas: "a vencer" (contratos que vencem na próxima semana — na primeira vez, também nesta) e "venceu e não renovou" (venceram na semana passada). Tira quem já renovou, contratos com categoria (VIP, Colaborador, Wellhub…), registrados e quem está na inadimplência, e divide entre as consultoras.' },
  { id: 'relacionamento', titulo: 'Relacionamento (primeiros 90 dias, cancelou, ex-alunos)', quando: 'Toda segunda-feira, 5h30',
    texto: 'Monta três listas da semana: alunos nas semanas 2, 5, 8 e 12 depois da matrícula (quem veio menos aparece primeiro), quem CANCELOU na semana passada (entrevista de saída com motivo; troca de plano e transferência ficam fora) e EX-ALUNOS cujo contrato terminou há uns 3 ou 6 meses e não voltaram. Tira contratos especiais, registrados e quem já está em outra lista de contato (uma conversa por vez). Prazo na sexta.' },
  { id: 'resultados', titulo: 'Resultado dos contatos', quando: 'Todo dia, de madrugada',
    texto: 'Toda madrugada confere na EVO: quem ainda está esperando contato e JÁ pagou, voltou a treinar ou se matriculou sai da lista sozinho (ninguém manda mensagem à toa). E para quem já recebeu contato, registra se deu certo — aparece em Indicadores, no desempenho e no retorno do mês. Não manda mensagem para ninguém.' },
  { id: 'lembrete_experimental', titulo: 'Lembrete da aula experimental (WhatsApp oficial)', quando: 'De 30 em 30 minutos, das 8h às 20h30',
    texto: 'Manda pelo número oficial da unidade (WasFit, fila 9 - Suporte) dois lembretes para quem marcou aula experimental: na VÉSPERA, a partir das 18h, e umas 2 HORAS ANTES da aula (aulas a partir de 9h30). Cada lembrete sai uma vez só e quem já se matriculou não recebe. Só Laranjeiras e República, que têm webhook. ATENÇÃO: ligada, manda mensagem de verdade para os interessados.' },
];
const ROTULOS_RESUMO = {
  debitos_lidos: 'Débitos lidos na EVO', da_unidade: 'Da unidade', clientes_em_atraso: 'Clientes em atraso', inativos_ignorados: 'Inativos ignorados',
  sem_celular: 'Sem celular', na_lista: 'Na lista', clientes_ativos: 'Clientes ativos', vieram_ultimos_15_dias: 'Vieram nos últimos 15 dias',
  sem_vir: 'Sem vir há mais de 15 dias', excluidos_por_registro: 'Fora: registrados (Gympass/benefício/VIP/não quer contato)', excluidos_em_cobranca: 'Fora: já na lista de inadimplência', excluidos_por_categoria: 'Fora: contrato com categoria na EVO', excluidos_por_contrato: 'Fora: contrato excluído',
  excluidos_gympass_totalpass: 'Fora: Gympass/Totalpass na ficha', suspensos: 'Fora: contrato suspenso/trancado', cadastro_recente: 'Fora: cadastro recente', sem_ultimo_acesso: 'Sem último acesso na EVO',
  prospects_lidos: 'Oportunidades lidas', ja_viraram_cliente: 'Já viraram cliente', ja_aluno_mesmo_nome: 'Fora: já é aluno ativo (mesmo nome)',
  oportunidades_repetidas: 'Fora: oportunidade repetida (mesmo celular)', aluno_mesmo_celular: 'Marcados: celular de aluno ativo', sem_nome: 'Sem nome', mes: 'Mês',
  aguardando_resultado: 'Contatos aguardando resultado', pagou: 'Pagaram', nao_pagou: 'Não pagaram em 5 dias', voltou: 'Voltaram a treinar',
  nao_voltou: 'Não voltaram em 10 dias', matriculou: 'Matricularam', nao_matriculou: 'Não matricularam em 7 dias', valor_recuperado: 'R$ recuperado',
  a_gravar: 'Resultados novos', gravados: 'Gravados', renovou: 'Renovaram', nao_renovou: 'Não renovaram em 7 dias',
  contratos_na_janela: 'Contratos vencendo nas duas semanas', ja_renovaram: 'Fora: já renovaram', especiais: 'Fora: contratos especiais',
  registrados: 'Fora: registrados', em_cobranca: 'Fora: na inadimplência', fora_da_janela: 'Vencem nesta semana (já tiveram contato)',
  a_vencer: 'Lista "a vencer"', venceu_sem_renovar: 'Lista "venceu e não renovou"', excluidos_em_cobranca: 'Fora: já na lista de inadimplência', tirados_da_lista: 'Saíram das listas (já resolveram sozinhos)',
  sessoes_lidas: 'Aulas com experimental abertas', experimentais_confirmar: 'Experimentais para confirmar (EVO)', experimentais_pos: 'Experimentais do último dia útil (EVO)',
  ja_matricularam: 'Fora: já se matricularam', interessados_lidos: 'Interessados cadastrados', interessados_ja_cliente: 'Fora: já viraram cliente',
  interessados_ja_aluno: 'Fora: já é aluno (mesmo nome)', interessados_repetidos: 'Fora: cadastro repetido (mesmo celular)', interessados_na_experimental: 'Fora: já estão na lista da experimental',
  confirmar: 'Lista "confirmar"', pos_aula: 'Lista "pós-aula"', interessados_novos: 'Lista "interessados novos"', janela_confirmar: 'Aulas de', janela_pos: 'Pós-aula das aulas de',
  matriculas_lidas: 'Matrículas lidas (semanas 2, 5, 8 e 12)', cancelamentos_lidos: 'Cancelamentos lidos', contratos_terminados_lidos: 'Contratos terminados há 3/6 meses',
  fora_especiais: 'Fora: contratos especiais', fora_registrados: 'Fora: registrados', fora_em_outra_lista: 'Fora: já em outra lista de contato',
  cancelou_mas_tem_contrato: 'Fora: cancelou mas tem outro contrato (troca de plano)', transferencias_trocas: 'Fora: transferência/troca de contrato',
  ex_aluno_ja_voltou: 'Fora: ex-aluno que já voltou', primeiros_90_dias: 'Lista "primeiros 90 dias"', cancelaram: 'Lista "cancelou"', ex_alunos: 'Lista "ex-alunos"',
  pagou_sem_contato: 'Pagaram antes do contato', voltou_sem_contato: 'Voltaram antes do contato', matriculou_sem_contato: 'Matricularam antes do contato',
};
const SELO_EXEC = { ok: 'verde', ignorado: 'cinza', erro: 'vermelho' };

function blocoResultado(nomeUnidade, r) {
  const resumo = r.resumo || {};
  const linhas = Object.entries(ROTULOS_RESUMO).filter(([k]) => k in resumo).map(([k, rot]) => `<tr><td>${esc(rot)}</td><td style="text-align:right"><b>${esc(String(resumo[k]))}</b></td></tr>`).join('');
  const lista = (rot, obj) => obj && Object.keys(obj).length
    ? `<p class="dica" style="margin-top:6px">${rot}: ${Object.entries(obj).map(([c, n]) => `${esc(c)} (${n})`).join(', ')}</p>` : '';
  const contratos = lista('Categorias excluídas', resumo.categorias_excluidas) + lista('Contratos excluídos pelas palavras', resumo.contratos_excluidos);
  const divisao = Array.isArray(resumo.divisao) ? `<p class="dica" style="margin-top:6px">Divisão entre as consultoras: ${resumo.divisao.join(' / ')}</p>` : '';
  const c = resumo.comparacao;
  const motivos = c ? Object.entries(c.motivos_so_na_manual || {}) : [];
  const comparacao = c ? `<div class="faixa" style="margin-top:10px;display:block">
      <b>Comparação com a lista subida à mão${c.lista_manual ? ` (${esc(dataLonga(String(c.lista_manual).slice(0, 10)))})` : ''}</b>
      <p style="margin:4px 0">Na manual: <b>${c.na_manual}</b> · na automática: <b>${c.na_automatica}</b> · nas duas: <b>${c.em_comum}</b> · só na manual: <b>${c.so_na_manual}</b> · só na automática: <b>${c.so_na_automatica}</b></p>
      ${motivos.length ? `<p style="margin:4px 0">Por que ${c.so_na_manual} da manual ficaram de fora: ${motivos.map(([m, n]) => `${esc(m)} (${n})`).join('; ')}</p>` : ''}
      ${r.exemplos?.so_na_manual?.length ? `<p class="dica" style="margin:4px 0">Só na manual (ex.): ${r.exemplos.so_na_manual.map(esc).join(', ')}</p>` : ''}
      ${r.exemplos?.so_na_automatica?.length ? `<p class="dica" style="margin:4px 0">Só na automática (ex.): ${r.exemplos.so_na_automatica.map(esc).join(', ')}</p>` : ''}</div>` : '';
  return `<div style="border-top:1px solid var(--line);padding:12px 0"><b>${esc(nomeUnidade)}</b> <span class="selo ${SELO_EXEC[r.status] || 'cinza'}">${esc(r.status)}</span>
    <p style="margin:6px 0">${esc(r.mensagem || '')}</p>
    ${linhas ? `<table class="tabela" style="max-width:520px"><tbody>${linhas}</tbody></table>` : ''}${contratos}${divisao}${comparacao}
    ${r.amostra?.length ? `<p class="dica" style="margin-top:6px">Amostra (nome e inicial): ${r.amostra.map(esc).join(', ')}</p>` : ''}</div>`;
}

async function evo(el, ctx) {
  const [cfg, ligadas, execs] = await Promise.all([dados.config(), dados.evoUnidades(), dados.evoExecucoes(25)]);
  const idDe = (u) => ligadas.find((l) => l.unidade === u)?.id_branch ?? '';
  const palavras = Array.isArray(cfg.risco_contratos_excluidos) ? cfg.risco_contratos_excluidos : [];
  const palavrasRenov = Array.isArray(cfg.renovacao_contratos_excluidos) ? cfg.renovacao_contratos_excluidos : [];
  const nomeUni = (id) => ctx.nomeUnidade(id);

  el.innerHTML = `
    <p class="dica" style="margin-bottom:14px">A chave da EVO (DNS e token) fica guardada só no Supabase, em uma função privada: não aparece no site, no GitHub nem para as consultoras, e só o administrador logado (ou o agendador do banco) consegue acioná-la. A Central só <b>lê</b> da EVO.</p>

    <h2 style="font-size:14px;margin:6px 0 10px">1. Conexão de cada unidade</h2>
    <p class="dica" style="margin-bottom:12px">Cada unidade usa a própria chave da EVO, guardada no Supabase em dois segredos:
      <b>EVO_DNS_&lt;UNIDADE&gt;</b> e <b>EVO_TOKEN_&lt;UNIDADE&gt;</b> (Laranjeiras: <b>EVO_DNS</b> e <b>EVO_TOKEN</b>). Nomes certos:
      ${ctx.unidades.map((u) => { const n = u.id === 'laranjeiras' ? ['EVO_DNS', 'EVO_TOKEN'] : [`EVO_DNS_${u.id.toUpperCase()}`, `EVO_TOKEN_${u.id.toUpperCase()}`]; return `${esc(u.nome.replace('Positiva ', ''))}: <b>${n[0]}</b> e <b>${n[1]}</b>`; }).join(' · ')}.</p>
    <div class="linha-acoes"><button class="btn" id="testar-evo">Testar conexão das unidades</button><button class="btn sec" id="achar-filiais">Buscar filiais</button></div>
    <div id="res-conexao" style="margin:12px 0"></div>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Unidade da Central</th><th>Filial na EVO</th><th>Rotinas automáticas</th></tr></thead><tbody>
      ${ctx.unidades.map((u) => { const ativa = u.automacao_ativa !== false; return `<tr><td class="nome">${esc(u.nome)}</td><td>${idDe(u.id) !== '' ? `Filial ${esc(String(idDe(u.id)))} <span class="dica">(descoberta sozinha)</span>` : '<span class="dica">—</span>'}</td>
        <td><span class="selo ${ativa ? 'verde' : 'cinza'}">${ativa ? 'Ligadas' : 'Desligadas'}</span> ${'automacao_ativa' in u ? `<button class="btn ${ativa ? 'perigo' : 'verde'} peq" data-unidade-auto="${u.id}">${ativa ? 'Desligar nesta unidade' : 'Ligar nesta unidade'}</button>` : ''}</td></tr>`; }).join('')}
    </tbody></table></div>
    <p class="dica" style="margin-top:8px">Unidade com rotinas desligadas não recebe nenhuma lista automática da EVO (nem a conferência de resultados), mesmo com a rotina ligada abaixo.</p>
    <p class="dica" style="margin-top:8px">A filial só é usada quando a chave da unidade enxerga mais de uma filial; com chave própria por unidade costuma ficar tudo certo.</p>

    <h2 style="font-size:14px;margin:26px 0 10px">2. Rotinas automáticas</h2>
    <p class="dica" style="margin-bottom:12px">Todas começam <b>desligadas</b>. Primeiro use <b>Simular</b> (só conta, não grava nada) e confira os números com a EVO; depois ligue.</p>
    ${ROTINAS_EVO.map((r) => `<div class="cartao" style="margin-bottom:14px;box-shadow:none;border:1px solid var(--line)" data-rotina="${r.id}">
      <h2 style="margin-bottom:6px">${esc(r.titulo)} <span class="selo ${cfg[`evo_auto_${r.id}`] === true ? 'verde' : 'cinza'}">${cfg[`evo_auto_${r.id}`] === true ? 'Ligada' : 'Desligada'}</span></h2>
      <p class="dica"><b>${esc(r.quando)}.</b> ${esc(r.texto)}</p>
      <div class="linha-acoes" style="margin-top:10px">
        <button class="btn sec peq" data-acao="simular">Simular agora</button>
        <button class="btn peq" data-acao="rodar">Rodar agora (envia a lista)</button>
        <button class="btn ${cfg[`evo_auto_${r.id}`] === true ? 'perigo' : 'verde'} peq" data-acao="alternar">${cfg[`evo_auto_${r.id}`] === true ? 'Desligar automático' : 'Ligar automático'}</button>
      </div><div class="res-rotina"></div></div>`).join('')}

    <h2 style="font-size:14px;margin:26px 0 10px">3. Contratos especiais (ficam fora do risco, da renovação e do relacionamento)</h2>
    <label class="campo" style="max-width:640px">Palavras do nome do contrato, separadas por vírgula
      <input id="palavras" value="${esc(palavras.join(', '))}" placeholder="gympass, totalpass, vip, colaborador"></label>
    <div class="linha-acoes" style="margin-top:8px"><button class="btn sec peq" id="salvar-palavras">Salvar palavras</button></div>
    <p class="dica" style="margin-top:6px">Ficam de fora automaticamente os contratos com categoria na EVO (VIP, Colaborador, Personal, Wellhub, Totalpass, Classpass, Freepass, Locação, Gogood, GuruPass — só \"Nenhuma\" entra). Também sai quem tem contrato com uma dessas palavras, ou foi registrado pela consultora (Gympass/convênios, benefício colaborador, contrato VIP), não entra na lista. A simulação mostra quais contratos foram excluídos.</p>

    <h2 style="font-size:14px;margin:26px 0 10px">4. Contratos que ficam fora só da renovação</h2>
    <label class="campo" style="max-width:640px">Palavras do nome do contrato, separadas por vírgula
      <input id="palavras-renov" value="${esc(palavrasRenov.join(', '))}" placeholder="recorrente"></label>
    <div class="linha-acoes" style="margin-top:8px"><button class="btn sec peq" id="salvar-palavras-renov">Salvar palavras</button></div>
    <p class="dica" style="margin-top:6px">A renovação confere na EVO o <b>contrato de cada aluno</b>:
      contrato com <b>prazo de 12 meses ou mais</b> configurado na EVO <b>sempre entra</b> (acaba e precisa renovar), seja comum, débito com prazo ou Pix recorrente.
      Saem os que não têm fim ou renovam sozinhos mês a mês: <b>recorrência mensal</b> (prazo 0 — ex.: "Natação Anual Recorrente", "PM 12 meses - DCC", que são 12 cobranças que se renovam)
      e <b>renovação automática</b> (prazo 1 mês). Quem sai continua no risco de abandono e no relacionamento, e aparece no Histórico como "Saiu da renovação".
      As palavras acima tiram contratos pelo nome, além disso.</p>

    <h2 style="font-size:14px;margin:26px 0 10px">IA do Claude <span class="selo ${cfg.ia_ativa === true ? 'verde' : 'cinza'}">${cfg.ia_ativa === true ? 'ligada' : 'desligada'}</span></h2>
    <p class="dica" style="max-width:760px">Duas tarefas: <b>classificar o "Outro motivo"</b> (toda madrugada, Haiku) e escrever a <b>leitura do mês</b> que entra no Retorno do dia 1º (Sonnet). Desligada, nada disso roda e a Central funciona normalmente com a escolha da consultora.
      Para ligar: resgate os créditos de API do plano Max (claude.ai → Configurações → Cobrança → API credits) e salve a chave no Supabase como <b>ANTHROPIC_API_KEY</b>.</p>
    <div class="linha-acoes" style="margin-top:8px"><button class="btn ${cfg.ia_ativa === true ? 'sec' : ''} peq" data-acao="ia">${cfg.ia_ativa === true ? 'Desligar IA' : 'Ligar IA'}</button></div>

    <h2 style="font-size:14px;margin:26px 0 10px">4. Últimas execuções</h2>
    ${execs.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Quando</th><th>Rotina</th><th>Unidade</th><th>Origem</th><th>Resultado</th></tr></thead><tbody>
      ${execs.map((e) => `<tr><td>${dataHora(e.criado_em)}</td><td>${esc(e.tipo === 'filiais' ? 'Buscar filiais' : e.tipo === 'bonus' ? 'Bônus automático (vendas do mês)' : e.tipo === 'limpeza' ? 'Limpeza trimestral (arquivos e registros técnicos)' : e.tipo === 'ia_classificar' ? 'IA: classificar o "Outro motivo"' : e.tipo === 'ia_analise_mes' ? 'IA: leitura do mês' : (ROTINAS_EVO.find((r) => r.id === e.tipo)?.titulo || e.tipo))}${e.simulacao ? ' <span class="etiqueta">simulação</span>' : ''}</td>
        <td>${e.unidade ? esc(nomeUni(e.unidade)) : '—'}</td><td>${esc(e.origem)}</td>
        <td><span class="selo ${SELO_EXEC[e.status] || 'cinza'}">${esc(e.status)}</span><span class="sub">${esc(e.erro || e.resumo?.mensagem || (e.tipo === 'ia_classificar' && e.resumo ? `${e.resumo.classificados ?? 0} classificados, ${e.resumo.motivo_novo ?? 0} com sugestão de motivo novo` : ''))}</span></td></tr>`).join('')}</tbody></table></div>`
      : vazio('Nenhuma execução ainda.')}`;

  const rodar = async (fn, alvo, rotulo) => {
    alvo.disabled = true;
    try { return await fn(); } catch (err) { erro(err); return null; } finally { alvo.disabled = false; }
  };

  const mostrarUnidades = (saida, unidades) => {
    saida.innerHTML = unidades.map((x) => {
      const ok = x.status === 'ok';
      const cor = ok ? 'verde' : x.status === 'sem_chave' ? 'cinza' : 'vermelho';
      const rot = ok ? (x.id_branch !== undefined ? `Filial ${x.id_branch ?? 'não definida'}` : 'Conectada') : x.status === 'sem_chave' ? 'Sem chave' : 'Recusada';
      return `<div style="padding:8px 0;border-top:1px solid var(--line)"><b>${esc(nomeUni(x.unidade))}</b> <span class="selo ${cor}">${rot}</span>${x.erro ? `<p class="dica" style="margin-top:4px">${esc(x.erro)}</p>` : ''}</div>`;
    }).join('');
  };
  el.querySelectorAll('[data-unidade-auto]').forEach((b) => b.addEventListener('click', async () => {
    const u = ctx.unidades.find((x) => x.id === b.dataset.unidadeAuto);
    const ligar = u.automacao_ativa === false;
    b.disabled = true;
    try {
      await dados.salvarUnidade(u.id, { automacao_ativa: ligar });
      u.automacao_ativa = ligar;
      toast(`${u.nome}: rotinas automáticas ${ligar ? 'ligadas' : 'desligadas'}.`);
      evo(el, ctx);
    } catch (err) { erro(err); b.disabled = false; }
  }));
  el.querySelector('#testar-evo').onclick = async (e) => {
    const saida = el.querySelector('#res-conexao');
    saida.innerHTML = '<p class="dica">Testando…</p>';
    const r = await rodar(() => dados.testarEvo(), e.target);
    if (r?.unidades) mostrarUnidades(saida, r.unidades); else saida.innerHTML = `<div class="faixa urgente"><div><b>Não foi possível testar</b>${esc(r?.erro || '')}</div></div>`;
  };
  el.querySelector('#achar-filiais').onclick = async (e) => {
    const saida = el.querySelector('#res-conexao');
    saida.innerHTML = '<p class="dica">Buscando filiais…</p>';
    const r = await rodar(() => dados.descobrirFiliaisEvo(), e.target);
    if (r?.unidades) { mostrarUnidades(saida, r.unidades); toast('Filiais atualizadas.'); } else saida.innerHTML = '';
  };

  el.onclick = async (e) => {
    const b = e.target.closest('button[data-acao]');
    if (!b) return;
    if (b.dataset.acao === 'salvar-filial') {
      const tr = b.closest('tr');
      const v = tr.querySelector('[data-c="filial"]').value;
      try { await dados.ligarUnidadeEvo(tr.dataset.u, v ? +v : null); toast('Ligação salva.'); } catch (err) { erro(err); }
      return;
    }
    if (b.dataset.acao === 'ia') {
      const ligar = cfg.ia_ativa !== true;
      if (ligar && !(await confirmar('Ligar a IA', 'Só ligue depois de resgatar os créditos de API do plano Max e salvar a chave ANTHROPIC_API_KEY no Supabase. Sem a chave, a IA não faz nada. Ligar agora?', 'Ligar'))) return;
      try { await dados.salvarConfig('ia_ativa', ligar); toast(ligar ? 'IA ligada.' : 'IA desligada.'); evo(el, ctx); } catch (err) { erro(err); }
      return;
    }
    const cartao = b.closest('[data-rotina]');
    if (!cartao) return;
    const id = cartao.dataset.rotina;
    const saida = cartao.querySelector('.res-rotina');
    if (b.dataset.acao === 'alternar') {
      const ligar = cfg[`evo_auto_${id}`] !== true;
      if (ligar && !(await confirmar('Ligar automático', `A rotina de ${ROTINAS_EVO.find((r) => r.id === id).titulo} passará a rodar sozinha no horário combinado${id === 'resultados' ? '' : id === 'lembrete_experimental' ? ' e os interessados com aula experimental passarão a receber os lembretes pelo número oficial' : ' e as consultoras receberão aviso no WhatsApp quando uma lista nova entrar'}. Já fez a simulação?`, 'Ligar'))) return;
      try { await dados.salvarConfig(`evo_auto_${id}`, ligar); toast(ligar ? 'Rotina ligada.' : 'Rotina desligada.'); evo(el, ctx); } catch (err) { erro(err); }
      return;
    }
    const trocar = b.dataset.acao === 'trocar';
    const real = b.dataset.acao === 'rodar' || trocar;
    if (trocar && !(await confirmar('Trocar pela lista automática', 'A lista de risco desta semana de cada unidade será trocada pela automática da EVO. Quem já recebeu contato continua marcado (com observação e tipo do aluno) e fica com a consultora que fez o contato; quem já foi contatado e não veio na automática continua aparecendo como feito. As consultoras recebem o aviso da lista nova. Continuar?', 'Trocar'))) return;
    if (!trocar && real && !(await confirmar('Rodar agora', 'Isso envia a lista de verdade para as consultoras (e elas recebem o aviso no WhatsApp). Se já houver lista no período, a rotina não repete. Continuar?', 'Rodar agora'))) return;
    saida.innerHTML = '<p class="dica" style="margin-top:10px">Consultando a EVO… pode levar um minuto.</p>';
    const alvos = ctx.unidades.map((u) => ({ unidade: u.id }));
    let html = '';
    for (const l of alvos) {
      const r = await rodar(() => dados.rodarEvo(id, l.unidade, !real, trocar), b);
      html += r?.resultados?.length ? r.resultados.map((x) => blocoResultado(nomeUni(l.unidade), x)).join('')
        : `<div style="border-top:1px solid var(--line);padding:12px 0"><b>${esc(nomeUni(l.unidade))}</b> <span class="selo vermelho">erro</span><p style="margin:6px 0">${esc(r?.erro || 'Não foi possível consultar a EVO.')}</p></div>`;
      saida.innerHTML = `<div style="margin-top:10px">${html}</div>`;
    }
    if (real) { ctx.atualizarSino(); toast('Concluído.'); }
  };

  el.querySelector('#salvar-palavras').onclick = async () => {
    const lista = el.querySelector('#palavras').value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    try { await dados.salvarConfig('risco_contratos_excluidos', lista); toast('Palavras salvas.'); } catch (err) { erro(err); }
  };
  el.querySelector('#salvar-palavras-renov').onclick = async () => {
    const lista = el.querySelector('#palavras-renov').value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    try { await dados.salvarConfig('renovacao_contratos_excluidos', lista); toast('Palavras salvas.'); } catch (err) { erro(err); }
  };
}
