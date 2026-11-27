// Painel master da WasFit (26/11/2026): todas as academias do sistema — cadastradas, ativas e inativas, saúde (licença e
// uso), receita mensal — com "Entrar" e "Editar". Só o master admin (o banco recusa os outros com "Só o master admin.").
import { sb, carregarPerfil, sair } from '../shared/sessao.js?v=20261127195208';
import { saude, resumo, filtrar, FILTROS, haQuanto, reais, linhasHistorico } from './master-regras.js?v=20261127195208';
import { seloLicenca } from '../tarefas/js/conta-regras.js?v=20261127195208';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = (v, um, varios) => `${v} ${v === 1 ? um : varios}`;
const SAUDE = { verde: 'Saudável', amarelo: 'Atenção', vermelho: 'Em risco', inativa: 'Inativa' };
let contas = [];
let trilhas = new Map();   // conta_id → passo da trilha do 1º acesso (master_trilhas)
let filtro = 'todas';

const logoDe = (c) => {
  const escuro = document.documentElement.dataset.tema === 'escuro';
  const l = escuro ? (c.logo_claro || c.logo_escuro) : (c.logo_escuro || c.logo_claro);
  return l ? (/^https?:/.test(l) ? l : `../${l}`) : null;
};

function numeros(r) {
  const card = (rot, val, sub, cor = '') => `<div class="numero ${cor}"><small>${rot}</small><b>${val}</b><span>${sub}</span></div>`;
  $('numeros').innerHTML = [
    card('Academias cadastradas', r.total, `${n(r.unidades, 'unidade', 'unidades')} · ${n(r.usuarios, 'usuário ativo', 'usuários ativos')}`),
    card('Ativas', r.ativas, r.inativas ? `${n(r.inativas, 'inativa', 'inativas')}` : 'nenhuma inativa', 'verde'),
    card('Em uso nesta semana', r.emUso, r.paradas ? `${n(r.paradas, 'parada', 'paradas')} (sem contatos em 7 dias)` : `${r.contatos7d.toLocaleString('pt-BR')} contatos em 7 dias`),
    card('Precisam de atenção', r.emRisco, r.emRisco ? 'licença, uso ou acesso' : 'tudo em dia', r.emRisco ? 'laranja' : ''),
    card('Licença', r.licencaVencida + r.licencaVencendo, `${r.licencaVencida} vencida${r.licencaVencida === 1 ? '' : 's'} · ${r.licencaVencendo} vencendo${r.semLicenca ? ` · ${r.semLicenca} sem data` : ''}`, r.licencaVencida ? 'vermelho' : r.licencaVencendo ? 'laranja' : ''),
    card('Receita mensal', reais(r.receitaMensal), r.semValor ? `${n(r.semValor, 'academia', 'academias')} sem valor cadastrado` : 'academias ativas'),
  ].join('');
}

function filtros(agora) {
  $('filtros').innerHTML = FILTROS.map(([id, rot]) => `<button type="button" role="tab" aria-selected="${id === filtro}" data-f="${id}" class="${id === filtro ? 'ativo' : ''}">${rot} <span class="cont">${filtrar(contas, id, agora).length}</span></button>`).join('');
}

function linhas(agora) {
  const lista = filtrar(contas, filtro, agora);
  $('linhas').innerHTML = lista.map((c) => {
    const s = saude(c, agora);
    const sl = seloLicenca(c.dias_licenca, c.licenca_vence);
    const logo = logoDe(c);
    return `<tr class="${c.ativa === false ? 'inativa' : ''}">
      <td class="nome">${logo ? `<img src="${esc(logo)}" alt="">` : `<span class="sem-logo">${esc((c.nome || '?').slice(0, 1))}</span>`}
        <div><b>${esc(c.nome)}</b><span class="sub">${c.casa ? 'sua academia' : `desde ${new Date(c.criado_em).toLocaleDateString('pt-BR')}`}${c.atual ? ' · você está aqui' : ''}</span></div></td>
      <td>${c.apagada_em ? '<span class="saude inativa">Apagada</span>' : c.encerrada_em ? `<span class="saude vermelho">Encerrada</span><span class="sub">apaga em ${new Date(`${c.apagar_em}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>`
        : `<span class="saude ${s.nivel}">${SAUDE[s.nivel]}</span><span class="sub" title="${esc(s.motivos.join(' · '))}">${esc(s.motivos[0])}</span>`}</td>
      <td>${c.plano ? esc(c.plano) : '<span class="dica">—</span>'}<span class="sub">${Number(c.valor_mensal) > 0 ? `${reais(c.valor_mensal)}/mês` : 'sem valor'}</span>${c.cobranca_aberta ? `<span class="sub" style="color:${c.cobranca_aberta.status === 'vencida' ? 'var(--texto-perigo)' : 'inherit'}">${c.cobranca_aberta.status === 'vencida' ? 'cobrança vencida' : 'cobrança aberta'} · ${reais(c.cobranca_aberta.valor)}</span>` : ''}${c.bloqueio_motivo ? `<span class="sub" style="color:var(--texto-perigo)">bloqueada: ${esc(c.bloqueio_motivo)}</span>` : ''}</td>
      <td>${sl ? `<span class="selo ${sl.cor}" title="${esc(sl.dica)}">${esc(sl.texto)}</span>` : '<span class="dica">sem data</span>'}</td>
      <td>${configHtml(trilhas.get(c.id))}</td>
      <td>${n(c.unidades || 0, 'unidade', 'unidades')}<span class="sub">${n(c.usuarios || 0, 'usuário', 'usuários')} · ${n(c.consultoras || 0, 'consultora', 'consultoras')}</span></td>
      <td><b>${(c.contatos_7d || 0).toLocaleString('pt-BR')}</b> <span class="dica">em 7 dias</span><span class="sub">${(c.contatos_30d || 0).toLocaleString('pt-BR')} em 30 dias</span></td>
      <td>${haQuanto(c.ultimo_login, agora)}</td>
      <td class="acoes"><button class="btn ${c.atual ? '' : 'sec'}" data-entrar="${esc(c.id)}">${c.atual ? 'Continuar' : 'Entrar'}</button><button class="btn sec" data-editar="${esc(c.id)}">Editar</button></td></tr>`;
  }).join('') || `<tr><td colspan="9" class="vazio">Nenhuma academia neste filtro.</td></tr>`;
}

// Trilha do 1º acesso: configurada, ou "passo X de 7" (+ pedido de chave da EVO, que a WasFit coloca)
const PASSOS = { academia: 'academia', equipe: 'equipe', evo: 'EVO', listas: 'listas', bonus: 'Bônus', kanban: 'kanban', revisao: 'revisão' };
function configHtml(t) {
  if (!t) return '<span class="dica">—</span>';
  if (t.configurada) return '<span class="saude verde">Configurada</span>';
  const pe = t.pedido_evo ? '<span class="sub">⚠️ pediu as chaves da EVO</span>' : '';
  if (!t.n_feitos) return `<span class="saude amarelo">Não começou</span><span class="sub">trilha do 1º acesso</span>${pe}`;
  return `<span class="saude amarelo">Passo ${t.n_feitos + 1} de ${t.n_passos}</span><span class="sub">em: ${esc(PASSOS[t.passo] || t.passo || '—')}</span>${pe}`;
}

async function historico() {
  const corpo = $('hist-linhas');
  const { data, error } = await sb.rpc('master_historico', { p_meses: +$('hist-meses').value || 12 });
  if (error) { corpo.innerHTML = `<tr><td colspan="7" class="vazio">Não deu para carregar o histórico: ${esc(error.message)}</td></tr>`; return; }
  const sinal = (v) => (v > 0 ? `+${v}` : `${v}`);
  corpo.innerHTML = linhasHistorico(data).map((m) => `<tr>
      <td><b>${m.rotulo}</b>${m.estimado ? ' <span class="dica" title="Calculado pela situação de hoje">*</span>' : ''}</td>
      <td>${m.novas}</td>
      <td>${m.encerradas}${m.reabertas ? `<span class="sub">${n(m.reabertas, 'reaberta', 'reabertas')}</span>` : ''}</td>
      <td class="${m.saldo > 0 ? 'pos' : m.saldo < 0 ? 'neg' : ''}">${sinal(m.saldo)}</td>
      <td>${m.ativas}</td>
      <td><div class="barra-receita"><span style="width:${m.barra}%"></span></div><b>${reais(m.receita)}</b>${m.variacao ? `<span class="sub ${m.variacao > 0 ? 'pos' : 'neg'}">${m.variacao > 0 ? '+' : '−'}${reais(Math.abs(m.variacao))} no mês</span>` : ''}</td>
      <td>${reais(m.recebido)}</td></tr>`).join('') || '<tr><td colspan="7" class="vazio">Sem meses para mostrar.</td></tr>';
}

async function carregar() {
  const [{ data, error }, tr] = await Promise.all([sb.rpc('master_painel'), sb.rpc('master_trilhas')]);
  if (error) throw error;
  contas = data?.contas || [];
  trilhas = new Map(((tr && !tr.error && tr.data) || []).map((t) => [t.conta_id, t]));
  const agora = Date.now();
  numeros(resumo(contas, agora));
  filtros(agora);
  linhas(agora);
  $('atualizado').textContent = `Atualizado ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${n(contas.length, 'academia', 'academias')} no sistema`;
  $('conteudo').setAttribute('aria-busy', 'false');
  historico();
}

async function entrar(c, b) {
  b.disabled = true;
  try {
    if (!c.atual) {
      const { error } = await sb.rpc('master_entrar_conta', { p_conta: c.id });
      if (error) throw error;
      try { localStorage.removeItem('central_unidade'); } catch { /* sem armazenamento */ }   // a unidade era da outra academia
    }
    try { sessionStorage.setItem('wasfit_academia_escolhida', '1'); } catch { /* sem armazenamento */ }
    location.href = '../index.html';
  } catch (e) { b.disabled = false; $('msg').textContent = e?.message || 'Não foi possível entrar nesta academia.'; }
}

function editar(c) {
  const d = $('editar');
  $('ed-titulo').textContent = `Editar ${c.nome}`;
  $('ed-ativa').value = String(c.ativa !== false);
  $('ed-plano').value = c.plano || '';
  $('ed-valor').value = c.valor_mensal ?? '';
  $('ed-vence').value = c.licenca_vence || '';
  cobrancaHtml(c);
  // LGPD: cópia de tudo e encerramento (a academia fica inativa; os dados são apagados sozinhos 30 dias depois)
  const dm = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '');
  $('ed-encerrar').innerHTML = c.casa ? '' : `<h3 class="sub-titulo">Encerrar academia</h3>
    <p class="dica">${c.encerrada_em ? `Encerrada. Os dados serão apagados em <b>${dm(c.apagar_em)}</b>. Até lá, dá para baixar tudo ou reabrir.`
      : 'A academia fica inativa e tem 30 dias para receber a cópia dos dados; depois tudo é apagado sozinho (pessoas, listas, cadastros e kanban).'}</p>
    <div class="linha"><button class="btn sec" type="button" data-acao="exportar">Baixar todos os dados</button>
      ${c.encerrada_em ? '<button class="btn sec" type="button" data-acao="reabrir">Reabrir academia</button>' : '<button class="btn perigo" type="button" data-acao="encerrar">Encerrar academia</button>'}</div>`;
  $('ed-encerrar').onclick = async (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    b.disabled = true;
    try {
      if (b.dataset.acao === 'exportar') {
        const { data, error } = await sb.rpc('master_exportar_conta', { p_conta: c.id });
        if (error) throw error;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        a.download = `wasfit-gestao-${c.slug || 'academia'}-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      } else {
        const encerrar = b.dataset.acao === 'encerrar';
        if (encerrar && prompt(`Para encerrar "${c.nome}", digite ENCERRAR. Os dados serão apagados em 30 dias.`) !== 'ENCERRAR') return;
        const { error } = await sb.rpc('master_encerrar_conta', { p_conta: c.id, p_encerrar: encerrar });
        if (error) throw error;
        $('editar').close('cancelar');
        await carregar();
      }
    } catch (err) { $('msg').textContent = err?.message || 'Não foi possível.'; }
    finally { b.disabled = false; }
  };
  d.onclose = async () => {
    if (d.returnValue !== 'salvar') return;
    const valor = $('ed-valor').value === '' ? null : Number($('ed-valor').value);
    const { error } = await sb.rpc('master_conta_salvar', { p_conta: c.id, p_ativa: $('ed-ativa').value === 'true', p_plano: $('ed-plano').value,
      p_licenca_vence: $('ed-vence').value || null, p_valor_mensal: valor });
    if (error) { $('msg').textContent = error.message; return; }
    $('msg').textContent = '';
    await carregar();
  };
  d.showModal();
}

// ── início ──
const perfil = await carregarPerfil().catch(() => null);
if (!perfil) location.replace('../index.html');
else {
  $('quem').textContent = perfil.email;
  try { await carregar(); }
  catch (e) {
    if (/master admin/i.test(e?.message || '')) location.replace('../index.html');   // não é o master: volta para o login
    else { $('atualizado').textContent = ''; $('msg').textContent = 'Não foi possível carregar as academias. Atualize a página.'; }
  }
}
$('filtros').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; filtro = b.dataset.f; const agora = Date.now(); filtros(agora); linhas(agora); });
$('linhas').addEventListener('click', (e) => {
  const bE = e.target.closest('[data-entrar]'), bD = e.target.closest('[data-editar]');
  if (bE) entrar(contas.find((c) => c.id === bE.dataset.entrar), bE);
  if (bD) editar(contas.find((c) => c.id === bD.dataset.editar));
});
// Achar a academia pelo e-mail (suporte: "o gestor X pediu ajuda")
$('busca').addEventListener('submit', async (e) => {
  e.preventDefault();
  const termo = $('busca-email').value.trim();
  if (termo.length < 3) { $('busca-res').innerHTML = '<li class="dica">Digite pelo menos 3 letras do e-mail.</li>'; return; }
  const { data, error } = await sb.rpc('master_buscar_email', { p_email: termo });
  if (error) { $('busca-res').innerHTML = `<li class="dica">${esc(error.message)}</li>`; return; }
  $('busca-res').innerHTML = (data || []).map((x) => `<li><span><b>${esc(x.pessoa || x.email)}</b> · ${esc(x.email)} <span class="dica">${esc(x.papel)}${x.ativo ? '' : ' · inativo'}</span></span>
    <span><span class="dica">${esc(x.conta)}</span> <button class="btn sec" type="button" data-entrar="${esc(x.conta_id)}">Entrar</button></span></li>`).join('')
    || '<li class="dica">Ninguém com esse e-mail.</li>';
});
$('busca-res').addEventListener('click', (e) => { const b = e.target.closest('[data-entrar]'); if (b) entrar(contas.find((c) => c.id === b.dataset.entrar) || { id: b.dataset.entrar }, b); });
$('sair').addEventListener('click', () => { try { sessionStorage.removeItem('wasfit_academia_escolhida'); } catch { /* */ } sair(); });
$('tema').addEventListener('click', () => {
  const escuro = document.documentElement.dataset.tema !== 'escuro';
  if (escuro) document.documentElement.dataset.tema = 'escuro'; else delete document.documentElement.dataset.tema;
  try { localStorage.setItem('wasfit_tema', escuro ? 'escuro' : 'claro'); } catch { /* sem armazenamento */ }
  linhas(Date.now());   // logos trocam com o tema
});

// ── Nova academia: cria a conta, convida o gestor (admin geral) e volta para a academia de casa ──
$('nova').addEventListener('click', () => { $('nova-form').reset(); $('nv-msg').textContent = ''; $('dlg-nova').showModal(); });
$('nova-form').addEventListener('submit', async (e) => {
  const botao = e.submitter;
  if (botao?.value !== 'criar') return;   // Cancelar fecha normalmente
  e.preventDefault();
  const nome = $('nv-nome').value.trim(), gnome = $('nv-gnome').value.trim(), gemail = $('nv-gemail').value.trim().toLowerCase();
  if (!nome || !gnome || !/^\S+@\S+\.\S+$/.test(gemail)) { $('nv-msg').textContent = 'Preencha o nome da academia, o nome e o e-mail do gestor.'; return; }
  const casa = contas.find((c) => c.casa);
  botao.disabled = true; $('nv-msg').textContent = 'Criando…';
  try {
    const valor = $('nv-valor').value === '' ? null : Number($('nv-valor').value);
    const { data: id, error: e1 } = await sb.rpc('master_criar_conta', { p_nome: nome, p_plano: $('nv-plano').value, p_valor_mensal: valor, p_licenca_vence: $('nv-vence').value || null });
    if (e1) throw e1;
    const { error: e2 } = await sb.rpc('master_entrar_conta', { p_conta: id });   // o convite entra na academia ativa do master
    if (e2) throw e2;
    try {
      const redirectTo = new URL('../index.html', location.href).href;
      const { data: conv, error: e3 } = await sb.functions.invoke('convidar-usuario', { body: { email: gemail, redirectTo,
        perfil: { nome: gnome, acesso_tarefas: true, papel_tarefas: 'admin', ativo: true } } });
      if (e3 || conv?.erro) throw new Error(conv?.erro || (await e3?.context?.json?.().catch(() => null))?.erro || e3?.message || 'Não foi possível convidar.');
      const { error: e4 } = await sb.rpc('master_definir_admin_geral', { p_usuario: conv.id });
      if (e4) throw e4;
    } finally {
      if (casa) await sb.rpc('master_entrar_conta', { p_conta: casa.id });   // volta para a sua academia
    }
    $('dlg-nova').close();
    $('msg').textContent = '';
    await carregar();
    alert(`Academia "${nome}" criada. O convite foi para ${gemail}: no 1º acesso, ${gnome.split(' ')[0]} faz a trilha de configuração.`);
  } catch (err) {
    $('nv-msg').textContent = `Não deu certo: ${err?.message || err}. Se a academia já foi criada, ela aparece na lista — use "Entrar" para convidar o gestor por Configurações → Usuários.`;
    await carregar().catch(() => {});
  } finally { botao.disabled = false; }
});

// ── Cobrança (Asaas ainda não conectado: o master cria a cobrança e marca como paga; paga = licença +1 mês e desbloqueia) ──
const ST_COB = { pendente: ['amarelo', 'Pendente'], vencida: ['vermelho', 'Vencida'], paga: ['verde', 'Paga'], cancelada: ['inativa', 'Cancelada'] };
async function cobrancaHtml(c) {
  const box = $('ed-cobranca');
  box.innerHTML = '<p class="dica">Carregando cobranças…</p>';
  const { data: lista, error } = await sb.rpc('master_cobrancas', { p_conta: c.id });
  const dm = (d) => new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  const mesQue = (() => { const d = new Date(); d.setUTCDate(1); return d.toISOString().slice(0, 7); })();
  box.innerHTML = `<h3 class="sub-titulo">Cobrança ${c.casa ? '<span class="dica">(sua academia não é cobrada nem bloqueada)</span>' : ''}</h3>
    <p class="dica">O Asaas ainda não está conectado: crie a cobrança aqui e marque como paga quando o dinheiro entrar. Paga = licença vai um mês adiante e a academia é desbloqueada.
      Vencida há mais que a tolerância = academia bloqueada (vê "Acesso suspenso").</p>
    <div class="dupla"><label class="campo">Dia do vencimento<input id="cb-dia" type="number" min="1" max="28" value="${c.dia_vencimento ?? 10}"></label>
      <label class="campo">Tolerância (dias)<input id="cb-tol" type="number" min="0" max="60" value="${c.dias_tolerancia ?? 10}"></label></div>
    <label class="campo checkbox"><input id="cb-auto" type="checkbox" ${c.cobranca_automatica ? 'checked' : ''}> Gerar a cobrança do mês seguinte sozinha (10 dias antes)</label>
    <div class="linha"><button class="btn sec" type="button" data-cob="salvar-regra">Salvar regra</button>
      <label class="campo" style="flex-direction:row;align-items:center;gap:6px">Mês<input id="cb-mes" type="month" value="${mesQue}"></label>
      <button class="btn sec" type="button" data-cob="nova">Nova cobrança</button></div>
    ${error ? `<p class="msg">${esc(error.message)}</p>` : (lista || []).length ? `<ul class="cob-lista">${lista.map((b) => {
      const [cor, rot] = ST_COB[b.status] || ['', b.status];
      return `<li><span><b>${esc(b.referencia.slice(5, 7))}/${esc(b.referencia.slice(0, 4))}</b> · ${reais(b.valor)} · vence ${dm(b.vencimento)}${b.pago_em ? ` · paga em ${dm(b.pago_em)}` : ''}</span>
        <span><span class="saude ${cor}">${rot}</span>${b.status === 'paga' || b.status === 'cancelada' ? '' : ` <button class="btn sec" type="button" data-cob="paga" data-id="${b.id}">Marcar paga</button> <button class="btn sec" type="button" data-cob="cancelada" data-id="${b.id}">Cancelar</button>`}</span></li>`;
    }).join('')}</ul>` : '<p class="dica">Nenhuma cobrança ainda.</p>'}`;
  box.onclick = async (e) => {
    const b = e.target.closest('[data-cob]');
    if (!b) return;
    b.disabled = true;
    try {
      let r;
      if (b.dataset.cob === 'salvar-regra') r = await sb.rpc('master_conta_cobranca', { p_conta: c.id, p_dia: +$('cb-dia').value || 10, p_tolerancia: +$('cb-tol').value || 0, p_automatica: $('cb-auto').checked });
      else if (b.dataset.cob === 'nova') r = await sb.rpc('master_cobranca_criar', { p_conta: c.id, p_referencia: `${$('cb-mes').value}-01` });
      else r = await sb.rpc('master_cobranca_status', { p_id: b.dataset.id, p_status: b.dataset.cob });
      if (r.error) throw r.error;
      await carregar();
      const atual = contas.find((x) => x.id === c.id) || c;
      Object.assign(c, atual);
      await cobrancaHtml(c);
    } catch (err) { $('msg').textContent = err?.message || 'Não foi possível.'; b.disabled = false; }
  };
}

$('hist-meses').addEventListener('change', () => historico());
