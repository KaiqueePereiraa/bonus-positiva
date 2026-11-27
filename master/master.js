// Painel master da WasFit (26/11/2026): todas as academias do sistema — cadastradas, ativas e inativas, saúde (licença e
// uso), receita mensal — com "Entrar" e "Editar". Só o master admin (o banco recusa os outros com "Só o master admin.").
import { sb, carregarPerfil, sair } from '../shared/sessao.js?v=20261126232913';
import { saude, resumo, filtrar, FILTROS, haQuanto, reais } from './master-regras.js?v=20261126232913';
import { seloLicenca } from '../tarefas/js/conta-regras.js?v=20261126232913';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = (v, um, varios) => `${v} ${v === 1 ? um : varios}`;
const SAUDE = { verde: 'Saudável', amarelo: 'Atenção', vermelho: 'Em risco', inativa: 'Inativa' };
let contas = [];
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
      <td><span class="saude ${s.nivel}">${SAUDE[s.nivel]}</span><span class="sub" title="${esc(s.motivos.join(' · '))}">${esc(s.motivos[0])}</span></td>
      <td>${c.plano ? esc(c.plano) : '<span class="dica">—</span>'}<span class="sub">${Number(c.valor_mensal) > 0 ? `${reais(c.valor_mensal)}/mês` : 'sem valor'}</span></td>
      <td>${sl ? `<span class="selo ${sl.cor}" title="${esc(sl.dica)}">${esc(sl.texto)}</span>` : '<span class="dica">sem data</span>'}</td>
      <td>${n(c.unidades || 0, 'unidade', 'unidades')}<span class="sub">${n(c.usuarios || 0, 'usuário', 'usuários')} · ${n(c.consultoras || 0, 'consultora', 'consultoras')}</span></td>
      <td><b>${(c.contatos_7d || 0).toLocaleString('pt-BR')}</b> <span class="dica">em 7 dias</span><span class="sub">${(c.contatos_30d || 0).toLocaleString('pt-BR')} em 30 dias</span></td>
      <td>${haQuanto(c.ultimo_login, agora)}</td>
      <td class="acoes"><button class="btn ${c.atual ? '' : 'sec'}" data-entrar="${esc(c.id)}">${c.atual ? 'Continuar' : 'Entrar'}</button><button class="btn sec" data-editar="${esc(c.id)}">Editar</button></td></tr>`;
  }).join('') || `<tr><td colspan="8" class="vazio">Nenhuma academia neste filtro.</td></tr>`;
}

async function carregar() {
  const { data, error } = await sb.rpc('master_painel');
  if (error) throw error;
  contas = data?.contas || [];
  const agora = Date.now();
  numeros(resumo(contas, agora));
  filtros(agora);
  linhas(agora);
  $('atualizado').textContent = `Atualizado ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${n(contas.length, 'academia', 'academias')} no sistema`;
  $('conteudo').setAttribute('aria-busy', 'false');
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
