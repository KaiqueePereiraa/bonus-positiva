// Primeiros passos (trilha do 1º acesso, 27/11/2026): quando o administrador geral de uma academia nova entra e ela ainda não
// está configurada, a Central abre aqui. Cada passo fica salvo (conta_trilha) e dá para voltar de onde parou; tudo continua
// editável depois em Configurações e no Bônus → Configurações. O master também pode entrar na academia e ajudar.
// Banco: migração 401 (trilha_estado, trilha_salvar, trilha_academia, trilha_unidade_salvar/_remover, trilha_ativar).
import * as dados from '../dados.js?v=20261127192203';
import { esc, toast, erro, carregando, confirmar } from '../ui.js?v=20261127192203';
import { montarEditorBonus } from '../../../shared/bonus-config-editor.js?v=20261127192203';

const PASSOS = [
  { id: 'academia', titulo: 'Academia', frase: 'Nome, logo e unidades. Unidades que trabalham juntas formam uma equipe.' },
  { id: 'equipe', titulo: 'Equipe', frase: 'Convide as consultoras e os coordenadores. Cada pessoa recebe um e-mail para criar a senha.' },
  { id: 'evo', titulo: 'EVO', frase: 'Peça as chaves da EVO. Você só registra o pedido: a WasFit coloca as chaves com segurança.' },
  { id: 'listas', titulo: 'Listas automáticas', frase: 'Escolha quais listas a Central monta sozinha com os dados da EVO.' },
  { id: 'bonus', titulo: 'Bônus', frase: 'Valor de cada plano, metas da semana, divisão e extras.' },
  { id: 'kanban', titulo: 'Kanban da WasFit', frase: 'Ligue o kanban da WasFit à Central pelo endereço (webhook) de cada unidade.' },
  { id: 'revisao', titulo: 'Revisão', frase: 'Confira tudo e ative a academia.' },
];
const ROTINAS = [
  ['nao_fechou', 'Por que não fechou?', 'Interessados parados há 5 dias, todo dia útil.'],
  ['risco', 'Risco de abandono', 'Alunos com mais de 15 dias sem vir, toda quarta.'],
  ['renovacao', 'Renovação de contratos', 'A vencer e venceu sem renovar, toda segunda.'],
  ['relacionamento', 'Relacionamento', 'Primeiros 90 dias, quem cancelou e ex-alunos, toda segunda.'],
  ['inadimplencia', 'Inadimplentes', 'Dívida em aberto há mais de 3 dias, toda quinta.'],
  ['assinatura', 'Assinatura do contrato', 'Quem ainda não assinou o contrato, todo dia útil.'],
  ['resultados', 'Resultado dos contatos', 'Confere de madrugada quem pagou, voltou ou se matriculou (não manda mensagem).'],
  ['lembrete_experimental', 'Lembrete da aula experimental', 'Manda WhatsApp de verdade para os interessados (véspera e 2 horas antes). Precisa do número oficial ligado.'],
];
const GRUPOS = ['', 'A', 'B', 'C', 'D', 'E', 'F'];
const nomeGrupo = (g) => (g ? `Equipe ${GRUPOS.indexOf(g)}` : 'Sozinha');
const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

export async function render(el, ctx, params = []) {
  let t = await dados.trilhaEstado();
  if (!t.pode_editar) {
    el.innerHTML = '<div class="cartao"><p>Os primeiros passos da academia são feitos pelo administrador geral.</p></div>';
    return;
  }
  let atual = PASSOS.some((p) => p.id === params[0]) ? params[0] : t.configurada ? 'revisao' : t.passo || 'academia';
  const feito = (id) => (t.feitos || []).includes(id);

  const irPara = (id) => { atual = id; history.replaceState(null, '', `#/trilha/${id}`); desenhar(); window.scrollTo(0, 0); };
  const proximo = () => irPara(PASSOS[Math.min(PASSOS.findIndex((p) => p.id === atual) + 1, PASSOS.length - 1)].id);
  const concluir = async (dadosPasso = {}) => { t = await dados.trilhaSalvar(atual, dadosPasso, true); proximo(); };

  function topo() {
    const i = PASSOS.findIndex((p) => p.id === atual);
    return `<div class="cartao" style="margin-bottom:14px">
      <p style="margin-bottom:10px">${t.configurada ? '✅ <b>Academia ativa.</b> Você pode rever qualquer passo; tudo também fica em Configurações e no Bônus → Configurações.'
        : `Bem-vindo à Wasfit gestão! Em ${PASSOS.length} passos a <b>${esc(t.conta?.nome || 'sua academia')}</b> fica pronta. Pode parar quando quiser: continua daqui.`}</p>
      <div class="linha-acoes" style="flex-wrap:wrap;gap:6px">${PASSOS.map((p, k) => `<button class="btn ${p.id === atual ? 'verde' : 'sec'} peq" data-passo="${p.id}">${feito(p.id) ? '✓ ' : `${k + 1}. `}${esc(p.titulo)}</button>`).join('')}</div>
      <p class="dica" style="margin-top:10px"><b>Passo ${i + 1} de ${PASSOS.length} — ${esc(PASSOS[i].titulo)}.</b> ${esc(PASSOS[i].frase)}</p>
      ${t.configurada ? '' : '<p style="margin-top:8px"><button class="btn sec peq" data-depois="1">Fazer depois</button> <span class="dica">a trilha volta a abrir no próximo acesso</span></p>'}</div>`;
  }
  const rodape = (rotulo = 'Salvar e continuar', pular = true) => `<div class="linha-acoes" style="margin-top:14px">
    <button class="btn verde" data-salvar="1">${rotulo}</button>${pular ? '<button class="btn sec" data-pular="1">Pular por agora</button>' : ''}</div>`;

  // ── 1. Academia ──
  function passoAcademia(box) {
    let linhas = (t.unidades || []).map((u) => ({ id: u.id, nome: u.nome, grupo: u.grupo || '' }));
    if (!linhas.length) linhas = [{ id: null, nome: '', grupo: '' }];
    const removidas = [];
    const desenharUn = () => {
      box.querySelector('#tr-unidades').innerHTML = linhas.map((u, k) => `<tr data-k="${k}">
        <td><input class="ctrl" data-campo="nome" value="${esc(u.nome)}" placeholder="Nome da unidade (ex.: Centro)"></td>
        <td><select class="ctrl" data-campo="grupo">${GRUPOS.map((g) => `<option value="${g}" ${g === u.grupo ? 'selected' : ''}>${nomeGrupo(g)}</option>`).join('')}</select></td>
        <td>${t.configurada ? '' : '<button class="btn sec peq" data-tirar="1">Tirar</button>'}</td></tr>`).join('');
    };
    box.innerHTML = `<div class="cartao">
      <label class="campo">Nome da academia<input class="ctrl" id="tr-nome" value="${esc(t.conta?.nome || '')}" maxlength="80"></label>
      <label class="campo">Logo (endereço https da imagem, fundo claro) <span class="dica">opcional — a WasFit pode colocar para você</span><input class="ctrl" id="tr-logo" value="${esc(/^https:/.test(t.conta?.logo_claro || '') ? t.conta.logo_claro : '')}" placeholder="https://…/logo.png"></label>
      <label class="campo">Logo para o modo escuro <span class="dica">opcional</span><input class="ctrl" id="tr-logo-esc" value="${esc(/^https:/.test(t.conta?.logo_escuro || '') ? t.conta.logo_escuro : '')}" placeholder="https://…/logo-branca.png"></label>
      <h3 style="margin:16px 0 6px">Unidades</h3>
      <p class="dica">Unidades com a mesma equipe dividem as listas entre as consultoras e, no Bônus, têm a meta e o bônus de equipe juntos. Unidade que trabalha sozinha: "Sozinha".</p>
      <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Unidade</th><th>Equipe</th><th></th></tr></thead><tbody id="tr-unidades"></tbody></table></div>
      <button class="btn sec peq" id="tr-mais-un" style="margin-top:8px">+ Unidade</button>
      ${rodape('Salvar e continuar', false)}</div>`;
    desenharUn();
    box.querySelector('#tr-unidades').addEventListener('input', (e) => {
      const tr = e.target.closest('tr'); if (!tr) return;
      linhas[+tr.dataset.k][e.target.dataset.campo] = e.target.value;
    });
    box.querySelector('#tr-unidades').addEventListener('click', (e) => {
      if (!e.target.dataset.tirar) return;
      const k = +e.target.closest('tr').dataset.k;
      if (linhas[k].id) removidas.push(linhas[k].id);
      linhas.splice(k, 1);
      if (!linhas.length) linhas.push({ id: null, nome: '', grupo: '' });
      desenharUn();
    });
    box.querySelector('#tr-mais-un').onclick = () => { linhas.push({ id: null, nome: '', grupo: '' }); desenharUn(); };
    box.querySelector('[data-salvar]').onclick = async (e) => {
      const nome = box.querySelector('#tr-nome').value.trim();
      const validas = linhas.filter((u) => u.nome.trim());
      if (nome.length < 2) return toast('Escreva o nome da academia.', 'erro');
      if (!validas.length) return toast('Cadastre pelo menos uma unidade.', 'erro');
      e.target.disabled = true;
      try {
        await dados.trilhaAcademia(nome, box.querySelector('#tr-logo').value.trim(), box.querySelector('#tr-logo-esc').value.trim());
        for (const id of removidas) await dados.trilhaUnidadeRemover(id);
        for (const u of validas) u.id = await dados.trilhaUnidadeSalvar(u.id, u.nome.trim(), u.grupo || null);
        await concluir({ unidades: validas.length });
      } catch (err) { erro(err); e.target.disabled = false; }
    };
  }

  // ── 2. Equipe ──
  async function passoEquipe(box) {
    const perfis = (await dados.perfis().catch(() => [])).filter((p) => p.ativo);
    const un = t.unidades || [];
    const nomeUn = (id) => un.find((u) => u.id === id)?.nome || '—';
    box.innerHTML = `<div class="cartao">
      <h3 style="margin-bottom:6px">Quem já está na equipe (${perfis.length})</h3>
      ${perfis.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Pessoa</th><th>Papel</th><th>Unidade</th></tr></thead><tbody>
        ${perfis.map((p) => `<tr><td class="nome">${esc(p.nome || p.email)}<span class="sub">${esc(p.email || '')}</span></td><td>${p.super_admin ? 'Admin geral' : p.papel_tarefas === 'admin' ? 'Coordenador' : 'Consultora'}</td><td>${esc(nomeUn(p.unidade))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="dica">Ninguém ainda.</p>'}
      <h3 style="margin:16px 0 6px">Convidar</h3>
      <div class="linha-acoes" style="flex-wrap:wrap;align-items:flex-end">
        <label class="campo">Nome<input class="ctrl" id="cv-nome" placeholder="Nome e sobrenome"></label>
        <label class="campo">E-mail<input class="ctrl" id="cv-email" type="email" placeholder="pessoa@email.com"></label>
        <label class="campo">Papel<select class="ctrl" id="cv-papel"><option value="consultora">Consultora</option><option value="admin">Coordenador</option></select></label>
        <label class="campo">Unidade<select class="ctrl" id="cv-unidade">${un.map((u) => `<option value="${esc(u.id)}">${esc(u.nome)}</option>`).join('')}</select></label>
        <label class="campo">Nome na EVO <span class="dica">como aparece nas vendas</span><input class="ctrl" id="cv-evo" placeholder="opcional"></label>
        <button class="btn verde" id="cv-enviar">Enviar convite</button></div>
      <p class="dica" style="margin-top:8px">O convite chega por e-mail com o link para criar a senha. Para mudar papéis, unidades e a ordem da divisão depois: Configurações → Usuários.</p>
      ${rodape('Continuar', true)}</div>`;
    box.querySelector('#cv-enviar').onclick = async (e) => {
      const nome = box.querySelector('#cv-nome').value.trim(), email = box.querySelector('#cv-email').value.trim();
      const papel = box.querySelector('#cv-papel').value, unidade = box.querySelector('#cv-unidade').value;
      const evo = box.querySelector('#cv-evo').value.trim().toUpperCase();
      if (!nome || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('Preencha o nome e um e-mail válido.', 'erro');
      if (!unidade) return toast('Cadastre as unidades no passo 1 antes de convidar.', 'erro');
      const consultora = papel === 'consultora';
      const ordem = consultora ? Math.max(0, ...perfis.map((p) => p.ordem_rodizio || 0)) + 1 : null;
      const perfil = { nome, unidade, nome_evo: evo || null, acesso_tarefas: true, papel_tarefas: papel, ordem_rodizio: ordem,
        acesso_bonus: true, papel_bonus: consultora ? 'consultant' : 'coordinator', nome_bonus: evo || nome.toUpperCase(), ativo: true,
        ...(consultora ? {} : { unidades_coord: [unidade] }) };
      e.target.disabled = true;
      try { await dados.convidar(email, perfil); toast(`Convite enviado para ${email}.`); await passoEquipe(box); }
      catch (err) { erro(err); e.target.disabled = false; }
    };
    ligarRodape(box, () => concluir({ pessoas: perfis.length }));
  }

  // ── 3. EVO ──
  function passoEvo(box) {
    const ped = t.dados?.evo || {};
    const un = t.unidades || [];
    box.innerHTML = `<div class="cartao">
      <p>Para a Central ler as vendas, os alunos e as listas, cada unidade precisa de uma <b>chave de integração (API) da EVO</b>.
        Peça ao suporte da EVO a chave da integração de cada unidade e marque abaixo. <b>Não coloque a chave aqui:</b> a WasFit recebe o pedido,
        fala com você e coloca as chaves com segurança.</p>
      <div class="tabela-wrap" style="margin-top:12px"><table class="tabela"><thead><tr><th>Unidade</th><th>Nome da filial na EVO</th><th>Já pedi a chave à EVO</th></tr></thead><tbody>
        ${un.map((u) => { const p = (ped.unidades || []).find((x) => x.id === u.id) || {}; return `<tr data-u="${esc(u.id)}"><td class="nome">${esc(u.nome)}</td>
          <td><input class="ctrl" data-campo="filial" value="${esc(p.filial || '')}" placeholder="como aparece na EVO"></td>
          <td><input type="checkbox" data-campo="pedida" ${p.pedida ? 'checked' : ''}></td></tr>`; }).join('')}</tbody></table></div>
      <div class="linha-acoes" style="flex-wrap:wrap;align-items:flex-end;margin-top:10px">
        <label class="campo">Quem a WasFit procura para isso<input class="ctrl" id="ev-contato" value="${esc(ped.contato || '')}" placeholder="nome e WhatsApp"></label>
        <label class="campo">Observação<input class="ctrl" id="ev-obs" value="${esc(ped.obs || '')}" placeholder="opcional"></label></div>
      ${ped.pedido_em ? `<p class="dica" style="margin-top:8px">Pedido registrado em ${esc(ped.pedido_em.split('-').reverse().join('/'))}.</p>` : ''}
      ${rodape('Registrar o pedido e continuar', true)}</div>`;
    ligarRodape(box, () => {
      const unidades = [...box.querySelectorAll('tr[data-u]')].map((tr) => ({ id: tr.dataset.u,
        filial: tr.querySelector('[data-campo="filial"]').value.trim(), pedida: tr.querySelector('[data-campo="pedida"]').checked }));
      return concluir({ pedido_em: hojeSP(), unidades, contato: box.querySelector('#ev-contato').value.trim(), obs: box.querySelector('#ev-obs').value.trim() });
    });
  }

  // ── 4. Listas automáticas ──
  function passoListas(box) {
    const ligadas = t.listas || {};
    box.innerHTML = `<div class="cartao">
      <p class="dica" style="margin-bottom:10px">Elas só começam a rodar quando as chaves da EVO estiverem prontas. Dá para ligar ou desligar quando quiser em Configurações → EVO.</p>
      ${ROTINAS.map(([id, titulo, texto]) => `<label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px">
        <input type="checkbox" data-rotina="${id}" ${ligadas[id] ? 'checked' : ''} style="margin-top:3px">
        <span><b>${esc(titulo)}</b><br><span class="dica">${esc(texto)}</span></span></label>`).join('')}
      ${rodape('Salvar e continuar', true)}</div>`;
    ligarRodape(box, async () => {
      const marcadas = [];
      for (const [id] of ROTINAS) {
        const v = box.querySelector(`[data-rotina="${id}"]`).checked;
        if (v) marcadas.push(id);
        if (!!ligadas[id] !== v) await dados.salvarConfig(`evo_auto_${id}`, v);
      }
      await concluir({ ligadas: marcadas });
    });
  }

  // ── 5. Bônus ──
  async function passoBonus(box) {
    box.innerHTML = `<div class="cartao"><p style="margin-bottom:12px">Monte as regras do Bônus: valor de cada plano (como aparece na EVO), o que conta para a meta,
      a divisão entre quem cadastra e quem converte, as faixas da semana e os extras. ${t.conta?.bonus_ativo ? '' : '<b>O Bônus é ligado pela WasFit</b> depois da ativação; as regras já ficam salvas.'}
      Dá para mudar quando quiser no Bônus → Configurações.</p><div id="tr-bonus">${carregando()}</div>
      <div class="linha-acoes" style="margin-top:14px"><button class="btn sec" data-pular="1">${feito('bonus') ? 'Continuar' : 'Pular por agora'}</button></div></div>`;
    const versoes = await dados.bonusConfigLer(true).catch(() => []);
    montarEditorBonus(box.querySelector('#tr-bonus'), {
      versoes, unidades: t.unidades || [], hoje: hojeSP(), podeSalvar: true,
      salvar: (mes, regras) => dados.bonusConfigSalvar(mes, regras),
      aoSalvar: async (_v, mes) => { toast('Regras do Bônus salvas.'); try { await concluir({ salvo: mes }); } catch (err) { erro(err); } },
    });
    box.querySelector('[data-pular]').onclick = async () => { try { if (feito('bonus')) proximo(); else { t = await dados.trilhaSalvar('bonus', { pulado: true }, false); proximo(); } } catch (err) { erro(err); } };
  }

  // ── 6. Kanban ──
  async function passoKanban(box) {
    const ganchos = await dados.kanbanWebhooks().catch(() => []);
    box.innerHTML = `<div class="cartao">
      <p>Com o kanban ligado, a Central sabe em que etapa está cada contato e há quanto tempo está parado. No app da WasFit, em cada
        <b>etiqueta</b> do kanban, cole o endereço da unidade como webhook e marque <b>"ao marcar"</b> e <b>"ao desmarcar"</b>.</p>
      <div class="tabela-wrap" style="margin-top:12px"><table class="tabela"><thead><tr><th>Unidade</th><th>Endereço (webhook)</th><th></th></tr></thead><tbody>
        ${ganchos.length ? ganchos.map((g) => `<tr><td class="nome">${esc(g.unidade)}${g.equipe ? `<span class="sub">equipe: ${esc(g.equipe)}</span>` : ''}</td>
          <td style="word-break:break-all;font-size:12px">${esc(g.url)}</td><td><button class="btn sec peq" data-copiar="${esc(g.url)}">Copiar</button></td></tr>`).join('')
          : '<tr><td colspan="3" class="dica">Cadastre as unidades no passo 1: cada unidade ganha o endereço dela.</td></tr>'}</tbody></table></div>
      <label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="kb-colado" ${t.dados?.kanban?.colado ? 'checked' : ''}> Já colei os endereços nas etiquetas</label>
      <p class="dica" style="margin-top:6px">Os dias de atrasado e crítico de cada etapa e quem é quem no kanban ficam em Configurações → Comercial e kanban.</p>
      ${rodape('Salvar e continuar', true)}</div>`;
    box.querySelectorAll('[data-copiar]').forEach((b) => { b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copiar); toast('Endereço copiado.'); } catch { toast('Não deu para copiar: selecione e copie o endereço.', 'erro'); } }; });
    ligarRodape(box, () => concluir({ colado: box.querySelector('#kb-colado').checked }));
  }

  // ── 7. Revisão ──
  function passoRevisao(box) {
    const d = t.dados || {};
    const resumo = {
      academia: `${esc(t.conta?.nome || '—')} · ${(t.unidades || []).length} unidade(s): ${(t.unidades || []).map((u) => `${esc(u.nome)}${u.grupo ? ` (${nomeGrupo(u.grupo)})` : ''}`).join(', ') || '—'}`,
      equipe: `${t.equipe?.pessoas || 0} pessoa(s): ${t.equipe?.consultoras || 0} consultora(s) e ${t.equipe?.coordenadores || 0} coordenador(es)`,
      evo: d.evo?.pedido_em ? `pedido registrado em ${esc(d.evo.pedido_em.split('-').reverse().join('/'))} (${(d.evo.unidades || []).filter((u) => u.pedida).length} unidade(s) já pediram a chave)` : 'pedido ainda não registrado',
      listas: `${Object.values(t.listas || {}).filter(Boolean).length} lista(s) automática(s) ligada(s)`,
      bonus: t.tem_bonus_config ? 'regras salvas' : 'regras ainda não salvas',
      kanban: d.kanban?.colado ? 'endereços colados no kanban' : 'endereços ainda não colados',
    };
    box.innerHTML = `<div class="cartao">
      <div class="tabela-wrap"><table class="tabela"><tbody>
        ${PASSOS.filter((p) => p.id !== 'revisao').map((p) => `<tr><td class="nome">${feito(p.id) ? '<span class="selo verde">feito</span>' : '<span class="selo cinza">pendente</span>'} ${esc(p.titulo)}</td>
          <td>${resumo[p.id]}</td><td><button class="btn sec peq" data-passo="${p.id}">Rever</button></td></tr>`).join('')}</tbody></table></div>
      ${t.configurada ? `<p style="margin-top:14px">✅ Academia ativa${t.concluida_em ? ` desde ${esc(new Date(t.concluida_em).toLocaleDateString('pt-BR'))}` : ''}. Para mudar algo: Configurações e Bônus → Configurações.</p>`
        : `<p class="dica" style="margin-top:12px">Ao ativar, a trilha some e a Central abre no Painel do gestor. O que ficou pendente continua em Configurações.</p>
           <div class="linha-acoes" style="margin-top:12px"><button class="btn verde" id="tr-ativar">Ativar a academia</button></div>`}</div>`;
    box.querySelector('#tr-ativar')?.addEventListener('click', async (e) => {
      const pend = PASSOS.filter((p) => p.id !== 'revisao' && !feito(p.id)).map((p) => p.titulo);
      if (pend.length && !(await confirmar('Ativar com passos pendentes?', `Ainda falta: ${pend.join(', ')}. Dá para fazer depois em Configurações. Ativar mesmo assim?`, 'Ativar'))) return;
      e.target.disabled = true;
      try {
        await dados.trilhaAtivar();
        try { sessionStorage.removeItem('trilha_depois'); } catch { /* segue */ }
        toast('Academia ativada!');
        history.replaceState(null, '', '#/painel');
        location.reload();
      } catch (err) { erro(err); e.target.disabled = false; }
    });
  }

  function ligarRodape(box, salvar) {
    const s = box.querySelector('[data-salvar]');
    if (s) s.onclick = async () => { s.disabled = true; try { await salvar(); } catch (err) { erro(err); s.disabled = false; } };
    const p = box.querySelector('[data-pular]');
    if (p) p.onclick = async () => { try { t = await dados.trilhaSalvar(atual, {}, false); proximo(); } catch (err) { erro(err); } };
  }

  async function desenhar() {
    el.innerHTML = `${topo()}<div id="tr-passo">${carregando()}</div>`;
    el.querySelectorAll('[data-passo]').forEach((b) => { b.onclick = () => irPara(b.dataset.passo); });
    el.querySelector('[data-depois]')?.addEventListener('click', () => {
      try { sessionStorage.setItem('trilha_depois', '1'); } catch { /* segue */ }
      location.hash = '#/painel';
    });
    const box = el.querySelector('#tr-passo');
    try {
      await ({ academia: passoAcademia, equipe: passoEquipe, evo: passoEvo, listas: passoListas, bonus: passoBonus, kanban: passoKanban, revisao: passoRevisao })[atual](box);
      box.querySelectorAll('[data-passo]').forEach((b) => { b.onclick = () => irPara(b.dataset.passo); });
    } catch (err) { erro(err); }
  }
  await desenhar();
}
