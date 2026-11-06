// Configurações (só admin): usuários, rodízio, feriados, motivos, mensagens e WhatsApp.
import * as dados from '../dados.js?v=20261106183309';
import { normalizarTelefone, diaDaSemana } from '../regras.js?v=20261106183309';
import { esc, dataLonga, dataHora, diaSemana, toast, erro, vazio, modal } from '../ui.js?v=20261106183309';

const ABAS = [['usuarios', 'Usuários'], ['rodizio', 'Rodízio'], ['feriados', 'Feriados'], ['motivos', 'Motivos'], ['mensagens', 'Mensagens'], ['whatsapp', 'WhatsApp']];

export async function render(el, ctx, [aba = 'usuarios']) {
  el.innerHTML = `<div class="cartao"><div class="abas">${ABAS.map(([id, r]) => `<button data-aba="${id}" class="${id === aba ? 'ativo' : ''}">${r}</button>`).join('')}</div><div id="aba"></div></div>`;
  el.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/configuracoes/${b.dataset.aba}`; }));
  const alvo = el.querySelector('#aba');
  const fn = { usuarios, rodizio, feriados, motivos, mensagens, whatsapp }[aba] || usuarios;
  await fn(alvo, ctx);
}

// ── Usuários ──
const formPerfil = (p = {}, ctx, { comEmail = false } = {}) => `
  ${comEmail ? '<label class="campo">E-mail da pessoa<input id="email" type="email" placeholder="nome@exemplo.com"></label>' : ''}
  <label class="campo">Nome<input id="nome" value="${esc(p.nome || '')}"></label>
  <label class="campo">Unidade<select id="unidade"><option value="">—</option>${ctx.unidades.map((u) => `<option value="${u.id}" ${u.id === p.unidade ? 'selected' : ''}>${esc(u.nome)}</option>`).join('')}</select></label>
  <label class="campo">Nome no EVO (igual ao relatório)<input id="nome_evo" value="${esc(p.nome_evo || '')}" placeholder="ADRIELLY SANTANA SABINO"></label>
  <label class="campo">WhatsApp (com DDD)<input id="whatsapp" value="${esc(p.whatsapp || '')}" placeholder="27 99999-9999"></label>
  <label class="campo">Central de Tarefas<select id="papel_tarefas"><option value="">Sem acesso</option><option value="consultora" ${p.papel_tarefas === 'consultora' ? 'selected' : ''}>Consultora</option><option value="admin" ${p.papel_tarefas === 'admin' ? 'selected' : ''}>Administrador</option></select></label>
  <label class="campo">Ordem no rodízio/divisão da unidade (vazio = fora)<input id="ordem_rodizio" type="number" min="1" value="${p.ordem_rodizio ?? ''}"></label>
  <label class="campo">Controle de Bônus<select id="papel_bonus"><option value="">Sem acesso</option><option value="consultant" ${p.papel_bonus === 'consultant' ? 'selected' : ''}>Consultor</option><option value="coordinator" ${p.papel_bonus === 'coordinator' ? 'selected' : ''}>Coordenador</option></select></label>
  <label class="campo">Nome nas vendas do bônus (igual ao relatório)<input id="nome_bonus" value="${esc(p.nome_bonus || '')}"></label>
  <label class="campo" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="ativo" ${p.ativo !== false ? 'checked' : ''}> Ativo</label>`;

// Campos do formulário → colunas de profiles (null quando vazio). Devolve null se o WhatsApp for inválido.
function camposPerfil(c) {
  const tel = c.whatsapp.trim() ? normalizarTelefone(c.whatsapp) : null;
  if (c.whatsapp.trim() && !tel) { toast('WhatsApp inválido. Use DDD + número.', 'erro'); return null; }
  if (c.papel_tarefas === 'consultora' && !c.unidade) { toast('Escolha a unidade da consultora.', 'erro'); return null; }
  return {
    nome: c.nome.trim(), unidade: c.unidade || null, nome_evo: c.nome_evo.trim().toUpperCase() || null, whatsapp: tel,
    acesso_tarefas: !!c.papel_tarefas, papel_tarefas: c.papel_tarefas || null,
    ordem_rodizio: c.ordem_rodizio ? +c.ordem_rodizio : null,
    acesso_bonus: !!c.papel_bonus, papel_bonus: c.papel_bonus || null, nome_bonus: c.nome_bonus.trim().toUpperCase() || null,
    ativo: c.ativo,
  };
}

async function usuarios(el, ctx) {
  const perfis = await dados.perfis();
  el.innerHTML = `<div class="linha-acoes" style="margin-bottom:14px"><button class="btn verde" data-acao="convidar">+ Convidar pessoa</button>
    <span class="dica">A pessoa recebe um e-mail com o link para criar a própria senha.</span></div>
    ${perfis.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Pessoa</th><th>Central</th><th>Bônus</th><th>Rodízio</th><th>WhatsApp</th><th></th></tr></thead><tbody>
    ${perfis.map((p) => `<tr data-id="${p.id}"><td class="nome">${esc(p.nome || '(sem nome)')}${p.ativo ? '' : ' <span class="selo vermelho">inativo</span>'}<span class="sub">${esc(p.email || '')}${p.nome_evo ? ` · EVO: ${esc(p.nome_evo)}` : ''}${p.nome_bonus ? ` · Bônus: ${esc(p.nome_bonus)}` : ''}</span></td>
      <td>${p.acesso_tarefas ? (p.papel_tarefas === 'admin' ? 'Admin' : `Consultora${p.unidade ? `<span class="sub">${esc(ctx.nomeUnidade(p.unidade).replace('Positiva ', ''))}</span>` : ''}`) : '—'}</td>
      <td>${p.acesso_bonus ? (p.papel_bonus === 'coordinator' ? 'Coordenador' : 'Consultor') : '—'}</td>
      <td>${p.ordem_rodizio ?? '—'}</td><td>${p.whatsapp ? esc(p.whatsapp) : '—'}</td>
      <td class="acoes"><button class="btn sec peq" data-acao="link" title="Envia um e-mail para a pessoa criar ou trocar a senha">Enviar link de acesso</button> <button class="btn sec peq" data-acao="editar">Editar</button></td></tr>`).join('')}</tbody></table></div>` : vazio('Nenhum usuário ainda.')}
    <p class="dica" style="margin-top:12px">O link vence rápido e cada novo envio cancela os anteriores. Se a pessoa não recebeu ou o link venceu, use "Enviar link de acesso" e peça para ela abrir o e-mail MAIS RECENTE (olhe também o spam/lixo eletrônico).</p>`;
  el.onclick = async (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    if (b.dataset.acao === 'convidar') {
      const r = await modal('Convidar pessoa', formPerfil({}, ctx, { comEmail: true }),
        { ler: true, acoes: [{ rotulo: 'Cancelar', classe: 'sec', valor: null }, { rotulo: 'Enviar convite', valor: 'ok' }] });
      if (r?.valor !== 'ok') return;
      const perfil = camposPerfil(r.campos);
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
    const campos = camposPerfil(r.campos);
    if (!campos) return;
    try {
      await dados.atualizarPerfil(p.id, campos);
      toast('Usuário atualizado. Recarregue a página para atualizar menus e listas.');
      usuarios(el, ctx);
    } catch (err) { erro(err); }
  };
}

// ── Rodízio (um por unidade) ──
async function rodizio(el, ctx) {
  const unidades = await dados.unidades();
  el.innerHTML = `<p class="dica" style="margin-bottom:14px">Cada unidade tem o próprio rodízio da inadimplência, na ordem definida em Usuários. Mudar a data só afeta semanas ainda não criadas.</p>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Unidade</th><th>Ordem</th><th>Primeira sexta</th><th></th></tr></thead><tbody>
    ${unidades.map((u) => `<tr data-u="${u.id}"><td class="nome">${esc(u.nome)}</td>
      <td>${ctx.consultorasDa(u.id).map((c) => esc(c.nome)).join(' → ') || '<span class="dica">sem consultoras</span>'}</td>
      <td><input class="ctrl" type="date" value="${u.inadimplencia_inicio || ''}"></td>
      <td class="acoes"><button class="btn peq" data-acao="salvar">Salvar</button></td></tr>`).join('')}
    </tbody></table></div>`;
  el.onclick = async (e) => {
    const b = e.target.closest('[data-acao="salvar"]');
    if (!b) return;
    const tr = b.closest('tr');
    const v = tr.querySelector('input').value;
    if (!v || diaDaSemana(v) !== 5) return toast('Escolha uma sexta-feira.', 'erro');
    try {
      await dados.salvarUnidade(tr.dataset.u, { inadimplencia_inicio: v });
      const n = await dados.garantirInadimplencia();
      toast(`Rodízio salvo. ${n} tarefa(s) criada(s).`);
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
async function motivos(el, ctx) {
  const lista = await dados.motivos();
  el.innerHTML = `<p class="dica" style="margin-bottom:14px">Motivo não usado mais deve ser <b>desativado</b> (não some dos meses anteriores). "Exige texto" obriga a consultora a escrever o motivo.</p>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Ordem</th><th>Motivo</th><th>Exige texto</th><th>Ativo</th><th></th></tr></thead><tbody>
    ${lista.map((m) => `<tr data-id="${m.id}"><td><input class="ctrl" type="number" data-c="ordem" value="${m.ordem}" style="width:70px"></td>
      <td><input class="ctrl" data-c="nome" value="${esc(m.nome)}" style="width:100%"></td>
      <td><input type="checkbox" data-c="exige_texto" ${m.exige_texto ? 'checked' : ''}></td>
      <td><input type="checkbox" data-c="ativo" ${m.ativo ? 'checked' : ''}></td>
      <td class="acoes"><button class="btn sec peq" data-acao="salvar">Salvar</button></td></tr>`).join('')}
    <tr data-id=""><td><input class="ctrl" type="number" data-c="ordem" value="${lista.length + 1}" style="width:70px"></td>
      <td><input class="ctrl" data-c="nome" placeholder="Novo motivo" style="width:100%"></td>
      <td><input type="checkbox" data-c="exige_texto"></td><td><input type="checkbox" data-c="ativo" checked></td>
      <td class="acoes"><button class="btn peq" data-acao="salvar">Adicionar</button></td></tr></tbody></table></div>`;
  el.onclick = async (e) => {
    const b = e.target.closest('[data-acao="salvar"]');
    if (!b) return;
    const tr = b.closest('tr');
    const v = (c) => tr.querySelector(`[data-c="${c}"]`);
    const m = { nome: v('nome').value.trim(), ordem: +v('ordem').value || 0, exige_texto: v('exige_texto').checked, ativo: v('ativo').checked };
    if (!m.nome) return toast('Informe o nome do motivo.', 'erro');
    if (tr.dataset.id) m.id = +tr.dataset.id;
    try { await dados.salvarMotivoCadastro(m); ctx.motivos = await dados.motivos(); toast('Motivo salvo.'); motivos(el, ctx); } catch (err) { erro(err); }
  };
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
