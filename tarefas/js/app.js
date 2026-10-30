// Central de Tarefas — inicialização, menu, rotas e sino.
import { exigirArea, areasDoPerfil, sair } from '../../shared/sessao.js?v=20261030185834';
import * as dados from './dados.js?v=20261030185834';
import { hojeSP, semanaDe, mesReferenciaSugerido } from './regras.js?v=20261030185834';
import { avisosConsultora, avisosAdmin } from './avisos.js?v=20261030185834';
import { esc, erro, carregando } from './ui.js?v=20261030185834';

const ICONES = {
  visao: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  tarefas: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  inad: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  risco: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  nf: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
  ind: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
  ins: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
  rel: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>',
  conf: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
};

// rota → [título, módulo, ícone, só admin?]
const ROTAS = {
  'visao-geral': ['Visão geral', 'visao-geral', 'visao', false],
  'minhas-tarefas': ['Minhas tarefas', 'minhas-tarefas', 'tarefas', false],
  inadimplencia: ['Inadimplência', 'inadimplencia', 'inad', false],
  risco: ['Risco de abandono', 'risco', 'risco', false],
  'nao-fechou': ['Por que não fechou?', 'nao-fechou', 'nf', false],
  indicadores: ['Indicadores', 'indicadores', 'ind', true],
  insights: ['Insights da Operação', 'insights', 'ins', true],
  relatorios: ['Relatórios', 'relatorios', 'rel', true],
  configuracoes: ['Configurações', 'configuracoes', 'conf', true],
};

const $ = (id) => document.getElementById(id);
const icone = (n) => `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONES[n]}</svg>`;

const perfil = await exigirArea('tarefas');
const ehAdmin = perfil.papel_tarefas === 'admin';

const ctx = {
  perfil,
  ehAdmin,
  hoje: () => hojeSP(),
  equipe: [],
  consultoras: [],
  nomeDe: (id) => ctx.equipe.find((p) => p.id === id)?.nome || '—',
  motivos: [],
  controles: {},
  unidades: [],
  // unidade em foco: a da consultora; para o admin, a escolhida no topo ('' = todas)
  unidade: ehAdmin ? lerUnidadeSalva() : perfil.unidade,
  nomeUnidade: (id) => ctx.unidades.find((u) => u.id === id)?.nome || '—',
  consultorasDa: (unidade) => ctx.consultoras.filter((c) => c.unidade === unidade),
  // unidades que têm consultoras cadastradas (as que de fato rodam a Central)
  unidadesAtivas: () => ctx.unidades.filter((u) => ctx.consultoras.some((c) => c.unidade === u.id)),
  atualizarSino: () => atualizarSino(),
};

function lerUnidadeSalva() {
  try { return localStorage.getItem('central_unidade') || ''; } catch { return ''; }
}

async function carregarBase() {
  const [equipe, motivos, controles, unidades] = await Promise.all([dados.equipe(), dados.motivos(), dados.controles(), dados.unidades()]);
  ctx.equipe = equipe;
  ctx.unidades = unidades;
  // admin lê os perfis completos (nome no EVO para a divisão); consultora só a lista pública da equipe
  const base = ehAdmin ? (await dados.perfis()).filter((p) => p.ativo && p.acesso_tarefas) : equipe;
  ctx.consultoras = base.filter((p) => p.papel_tarefas === 'consultora' && p.ordem_rodizio != null)
    .sort((a, b) => a.ordem_rodizio - b.ordem_rodizio);
  ctx.motivos = motivos;
  ctx.controles = Object.fromEntries(controles.map((c) => [c.id, c]));
  if (ehAdmin) await dados.garantirInadimplencia().catch(() => {}); // o agendador também faz isso de madrugada
}

function montarMenu() {
  const itens = Object.entries(ROTAS).filter(([rota, r]) => (!r[3] || ehAdmin) && !(ehAdmin && rota === 'minhas-tarefas'));
  const corte = itens.findIndex(([, r]) => r[3]);
  $('menu').innerHTML = itens.map(([rota, [titulo, , ic]], i) =>
    `${i === corte ? '<li class="sep" role="separator"></li>' : ''}<li><a href="#/${rota}" data-rota="${rota}">${icone(ic)}<span>${esc(titulo)}</span></a></li>`).join('');
  $('nome-usuario').textContent = perfil.nome || perfil.email;
  $('papel-usuario').textContent = ehAdmin ? 'Administrador' : 'Consultora';
  $('avatar').textContent = (perfil.nome || perfil.email || '?').trim()[0].toUpperCase();
  $('trocar-area').hidden = !areasDoPerfil(perfil).bonus;
  if (ehAdmin) {
    const sel = $('sel-unidade');
    sel.hidden = false;
    sel.innerHTML = `<option value="">Todas as unidades</option>${ctx.unidades.map((u) => `<option value="${u.id}" ${u.id === ctx.unidade ? 'selected' : ''}>${esc(u.nome)}</option>`).join('')}`;
    sel.addEventListener('change', () => {
      ctx.unidade = sel.value;
      try { localStorage.setItem('central_unidade', sel.value); } catch { /* sem armazenamento: vale só nesta visita */ }
      navegar();
    });
  } else if (perfil.unidade) {
    $('papel-usuario').textContent = `Consultora · ${ctx.nomeUnidade(perfil.unidade).replace('Positiva ', '')}`;
  }
  $('sair').addEventListener('click', sair);
  $('btn-menu').addEventListener('click', () => $('app').classList.toggle('menu-aberto'));
  $('lateral').addEventListener('click', (e) => { if (e.target.closest('a')) $('app').classList.remove('menu-aberto'); });
}

let renderAtual = 0;
async function navegar() {
  const [rota = '', ...params] = location.hash.replace(/^#\/?/, '').split('/');
  const padrao = ehAdmin ? 'visao-geral' : 'minhas-tarefas';
  const def = ROTAS[rota];
  if (!def || (def[3] && !ehAdmin)) { location.replace(`#/${padrao}`); return; }
  const [titulo, modulo] = def;
  document.querySelectorAll('#menu a').forEach((a) => a.classList.toggle('ativo', a.dataset.rota === rota));
  $('titulo').textContent = titulo;
  document.title = `${titulo} — Central de Tarefas`;
  const el = $('conteudo');
  el.innerHTML = carregando();
  const meu = ++renderAtual;
  try {
    const tela = await import(`./telas/${modulo}.js?v=20261030185834`);
    if (meu !== renderAtual) return;
    await tela.render(el, ctx, params);
  } catch (e) {
    if (meu !== renderAtual) return;
    el.innerHTML = '<div class="cartao"><p class="dica">Não foi possível carregar esta tela. Atualize a página.</p></div>';
    erro(e);
  }
  window.scrollTo(0, 0);
}

// ── Sino ──
let avisosAtuais = [];
export async function calcularAvisos() {
  const hoje = hojeSP();
  if (ehAdmin) {
    const desde = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
    const ref = mesReferenciaSugerido(hoje);
    const refIni = `${ref.ano}-${String(ref.mes).padStart(2, '0')}-01`;
    const [tarefas, risco, nf, pool] = await Promise.all([
      dados.tarefas({ desde }), dados.importacoes('risco', { limite: 30 }), dados.importacoes('nao_fechou', { limite: 30 }),
      dados.semResponsavelVisiveis()]);
    const horaSP = +new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date());
    const ativas = ctx.unidadesAtivas();
    const nfMes = nf.filter((i) => i.referencia_inicio === refIni).map((i) => i.id);
    return avisosAdmin({
      tarefas, nomeDe: ctx.nomeDe, nomeUnidade: ctx.nomeUnidade, hoje, horaSP,
      semResponsavel: pool.filter((i) => nfMes.includes(i.importacao_id)).length,
      riscoPendente: ativas.filter((u) => !risco.some((i) => i.unidade === u.id && i.referencia_inicio === semanaDe(hoje).inicio)).map((u) => u.nome),
      naoFechouPendente: ativas.filter((u) => !nf.some((i) => i.unidade === u.id && i.referencia_inicio === refIni)).map((u) => u.nome),
    });
  }
  const [tarefas, pool] = await Promise.all([
    dados.tarefas({ responsavel: perfil.id }), dados.semResponsavelVisiveis().catch(() => [])]);
  return avisosConsultora({ tarefas, semResponsavel: pool.length, hoje });
}

async function atualizarSino() {
  try {
    const [avisos, visto] = await Promise.all([calcularAvisos(), dados.vistoAte(perfil.id)]);
    avisosAtuais = avisos;
    const vistoDia = visto ? hojeSP(new Date(visto)) : '0000-00-00';
    const novos = visto ? avisos.filter((a) => a.desde > vistoDia) : avisos;
    $('sino-cont').hidden = novos.length === 0;
    $('sino-cont').textContent = novos.length;
    $('painel-sino').innerHTML = `<h3>Avisos</h3>${avisos.length ? avisos.map((a) =>
      `<a class="aviso ${a.nivel} ${novos.includes(a) ? 'novo' : ''}" href="${a.rota}"><span class="ponto"></span><span>${esc(a.texto)}</span></a>`).join('')
      : '<div class="vazio">Nenhum aviso. Tudo em dia!</div>'}`;
  } catch (e) { console.error(e); }
}
ctx.avisos = () => avisosAtuais;

function ligarSino() {
  const painel = $('painel-sino');
  $('sino').addEventListener('click', async (e) => {
    e.stopPropagation();
    painel.hidden = !painel.hidden;
    $('sino').setAttribute('aria-expanded', String(!painel.hidden));
    if (!painel.hidden) { await dados.marcarAvisosVistos(perfil.id).catch(() => {}); $('sino-cont').hidden = true; }
  });
  document.addEventListener('click', (e) => { if (!painel.hidden && !painel.contains(e.target)) painel.hidden = true; });
  painel.addEventListener('click', (e) => { if (e.target.closest('a')) painel.hidden = true; });
}

try {
  await carregarBase();
} catch (e) { erro(e); }
montarMenu();
ligarSino();
window.addEventListener('hashchange', navegar);
await atualizarSino();   // antes da 1ª tela: o quadro usa os avisos urgentes
await navegar();
