// Central de Tarefas — inicialização, menu, rotas e sino.
import { exigirArea, areasDoPerfil, sair } from '../../shared/sessao.js?v=20261117213442';
import * as dados from './dados.js?v=20261117213442';
import { hojeSP } from './regras.js?v=20261117213442';
import { avisosConsultora, avisosAdmin } from './avisos.js?v=20261117213442';
import { esc, erro, carregando, modal, toast, ROTA_CONTROLE } from './ui.js?v=20261117213442';

const ICONES = {
  visao: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  tarefas: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  inad: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  risco: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  nf: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/>',
  escala: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  ind: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
  renov: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  rel_aluno: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  alvo: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  equipe: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  rel: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>',
  conf: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
};

// Rotas. quem: 'admin' | 'consultora' | 'todos'. grupo: onde fica no menu (null = fora do menu, só por link).
// frase: aparece embaixo do título e diz, em uma linha, o que fazer na tela.
// O menu segue os objetivos do Painel: trazer alunos (vendas), manter alunos (retenção) e cobrança.
const GRUPOS = { inicio: '', vendas: 'Trazer alunos', retencao: 'Manter alunos', cobranca: 'Cobrança', extras: 'Extras', acompanhar: 'Acompanhar', ajustes: 'Ajustes' };
const ROTAS = {
  painel: { titulo: 'Painel do gestor', modulo: 'painel', icone: 'visao', quem: 'admin', grupo: 'inicio', frase: 'O que pede sua atenção hoje e como a equipe está agora. Comece pelos cartões coloridos.' },
  'meu-dia': { titulo: 'Meu dia', modulo: 'meu-dia', icone: 'tarefas', quem: 'consultora', grupo: 'inicio', frase: 'O que fazer hoje, na ordem certa. Toque em "Começar" e siga a lista.' },
  'minhas-tarefas': { titulo: 'Todas as minhas tarefas', modulo: 'minhas-tarefas', icone: 'tarefas', quem: 'consultora', grupo: null, frase: 'Todas as suas listas, separadas por situação.' },
  vendas: { titulo: 'Vendas', modulo: 'vendas', icone: 'alvo', quem: 'todos', grupo: 'vendas', frase: 'Experimentais e interessados novos (todo dia) e ex-alunos (toda segunda). Interessado esfria rápido: o contato é hoje.' },
  'nao-fechou': { titulo: 'Por que não fechou?', modulo: 'nao-fechou', icone: 'nf', quem: 'todos', grupo: 'vendas', frase: 'Interessados do mês que não se matricularam. Escolha o motivo de cada um.' },
  risco: { titulo: 'Risco de abandono', modulo: 'risco', icone: 'risco', quem: 'todos', grupo: 'retencao', frase: 'Alunos que pararam de vir. Pergunte o motivo e convide para voltar.' },
  renovacao: { titulo: 'Renovação', modulo: 'renovacao', icone: 'renov', quem: 'todos', grupo: 'retencao', frase: 'Contratos vencendo ou vencidos. Ofereça a renovação ou registre o motivo.' },
  relacionamento: { titulo: 'Relacionamento', modulo: 'relacionamento', icone: 'rel_aluno', quem: 'todos', grupo: 'retencao', frase: 'Alunos novos e quem cancelou. Um contato atencioso faz a pessoa ficar.' },
  inadimplencia: { titulo: 'Inadimplência', modulo: 'inadimplencia', icone: 'inad', quem: 'todos', grupo: 'cobranca', frase: 'Quem está com a mensalidade atrasada. Mande a mensagem pelo botão do WhatsApp.' },
  'lista-fazer': { titulo: 'Lista a fazer', modulo: 'lista-fazer', icone: 'lista', quem: 'todos', grupo: 'extras', frase: 'Listas extras montadas pelo gestor.' },
  // Acompanhar: uma pergunta por tela. Desempenho = as pessoas; Resultados = o que funciona; Relatórios = baixar e o retorno em R$.
  desempenho: { titulo: 'Desempenho', modulo: 'desempenho', icone: 'equipe', quem: 'todos', grupo: 'acompanhar', frase: 'Quem cumpriu o mínimo de contatos, quanto deu resultado e como cada uma está comparada com a equipe.' },
  indicadores: { titulo: 'Resultados', modulo: 'indicadores', icone: 'ind', quem: 'admin', grupo: 'acompanhar', frase: 'O que cada lista trouxe de verdade, os motivos e o que os números dizem.' },
  relatorios: { titulo: 'Relatórios', modulo: 'relatorios', icone: 'rel', quem: 'admin', grupo: 'acompanhar', frase: 'Escolha o período e baixe em PDF, Excel ou CSV.' },
  retorno: { titulo: 'Retorno do mês', modulo: 'retorno', icone: 'rel', quem: 'admin', grupo: null, menu: 'relatorios', frase: 'Quanto a equipe trouxe de volta em R$ com a Central.' },
  // EM PREPARAÇÃO (pedido do usuário, 16/11/2026): só o admin vê a Escala até ele dizer que está 100% pronta.
  // Para abrir para as consultoras: trocar quem para 'todos' e religar o cron (supabase/migrations/021_escala_pausar_lembretes.sql).
  escala: { titulo: 'Escala', modulo: 'escala', icone: 'escala', quem: 'admin', grupo: 'ajustes', frase: 'Quem trabalha em cada fim de semana.' },
  configuracoes: { titulo: 'Configurações', modulo: 'configuracoes', icone: 'conf', quem: 'admin', grupo: 'ajustes', frase: 'Equipe, rodízio, mensagens, WhatsApp e a conexão com a EVO.' },
};
// grupos que são listas de contato (a consultora só vê as listas em que tem algo)
const GRUPOS_LISTAS = ['vendas', 'retencao', 'cobranca', 'extras'];
// telas antigas que foram juntadas a outras (links salvos continuam funcionando)
const REDIRECIONA = { 'visao-geral': null, insights: 'indicadores' };
const podeVer = (r) => r.quem === 'todos' || (r.quem === 'admin') === ehAdmin;

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
  let grupoAtual;
  $('menu').innerHTML = Object.entries(ROTAS).filter(([, r]) => r.grupo && podeVer(r)).map(([rota, r]) => {
    const titulo = r.grupo !== grupoAtual && GRUPOS[r.grupo] ? `<li class="grupo" role="presentation">${esc(GRUPOS[r.grupo])}</li>` : '';
    grupoAtual = r.grupo;
    return `${titulo}<li data-li="${rota}"><a href="#/${rota}" data-rota="${rota}">${icone(r.icone)}<span>${esc(r.titulo)}</span><b class="cont" hidden></b></a></li>`;
  }).join('');
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
      atualizarMenu();
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
  let [rota = '', ...params] = location.hash.replace(/^#\/?/, '').split('/');
  const padrao = ehAdmin ? 'painel' : 'meu-dia';
  if (rota in REDIRECIONA) { location.replace(`#/${REDIRECIONA[rota] || padrao}`); return; }
  const def = ROTAS[rota];
  if (!def || !podeVer(def)) { location.replace(`#/${padrao}`); return; }
  const { titulo, modulo } = def;
  document.querySelectorAll('#menu a').forEach((a) => a.classList.toggle('ativo', a.dataset.rota === rota || a.dataset.rota === def.menu || (rota === 'minhas-tarefas' && a.dataset.rota === 'meu-dia')));
  $('titulo').textContent = titulo;
  $('subtitulo').textContent = def.frase || '';
  document.title = `${titulo} — Central de Tarefas`;
  const el = $('conteudo');
  el.innerHTML = carregando();
  const meu = ++renderAtual;
  try {
    const tela = await import(`./telas/${modulo}.js?v=20261117213442`);
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
let tarefasDoMenu = [];

// Número de contatos pendentes ao lado de cada lista no menu. A consultora só vê as listas em que tem algo.
function atualizarMenu() {
  const hoje = hojeSP();
  const pend = {}, tem = {};
  for (const t of tarefasDoMenu) {
    if (ehAdmin && ctx.unidade && t.unidade !== ctx.unidade) continue;
    const rota = ROTA_CONTROLE[t.controle_id];
    if (!rota) continue;
    tem[rota] = true;
    if (String(t.status).startsWith('concluida') || (t.controle_id === 'experimental_confirmar' && t.prazo < hoje)) continue;
    pend[rota] = (pend[rota] || 0) + Math.max(0, (t.total || 0) - (t.feitos || 0));
  }
  document.querySelectorAll('#menu li[data-li]').forEach((li) => {
    const rota = li.dataset.li;
    const cont = li.querySelector('.cont');
    cont.hidden = !pend[rota];
    cont.textContent = pend[rota] > 99 ? '99+' : pend[rota] || '';
    if (!ehAdmin && GRUPOS_LISTAS.includes(ROTAS[rota].grupo)) li.hidden = !tem[rota] && location.hash !== `#/${rota}`;
  });
  document.querySelectorAll('#menu li.grupo').forEach((g) => {   // título de grupo sem nenhum item visível some
    let n = g.nextElementSibling, algum = false;
    while (n && !n.classList.contains('grupo')) { if (!n.hidden) algum = true; n = n.nextElementSibling; }
    g.hidden = !algum;
  });
}
export async function calcularAvisos() {
  const hoje = hojeSP();
  if (ehAdmin) {
    const desde = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
    const [tarefas, pool] = await Promise.all([dados.tarefas({ desde }), dados.semResponsavelVisiveis()]);
    tarefasDoMenu = tarefas;
    return avisosAdmin({ tarefas, nomeDe: ctx.nomeDe, nomeUnidade: ctx.nomeUnidade, hoje, semResponsavel: pool.length });
  }
  const [tarefas, pool, listas, trocas] = await Promise.all([
    dados.tarefas({ responsavel: perfil.id }), dados.semResponsavelVisiveis().catch(() => []), dados.listasFazer().catch(() => []),
    dados.trocasEscala().catch(() => [])]);
  tarefasDoMenu = tarefas;
  const pedidosTroca = trocas.filter((p) => p.destino_id === perfil.id && p.status === 'pendente' && p.data_origem > hoje && (!p.data_troca || p.data_troca > hoje))
    .map((p) => ({ id: p.id, quem: ctx.nomeDe(p.solicitante_id), data: p.data_origem }));
  return avisosConsultora({ tarefas, semResponsavel: pool.length, hoje, titulos: Object.fromEntries(listas.map((l) => [l.importacao_id, l.titulo])), pedidosTroca });
}

async function atualizarSino() {
  try {
    const [avisos, visto] = await Promise.all([calcularAvisos(), dados.vistoAte(perfil.id)]);
    avisosAtuais = avisos;
    atualizarMenu();
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

// Plano do dia: quem não bateu o mínimo de um dia útil conta o que aconteceu antes de seguir (texto livre;
// "não trabalhei" tira o dia da conta). O gestor recebe no WhatsApp.
async function pedirJustificativas() {
  for (let volta = 0; volta < 10; volta++) {
    const p = await dados.justificativaPendente().catch(() => null);
    if (!p) return;
    const dia = `${p.data.slice(8, 10)}/${p.data.slice(5, 7)}`;
    const r = await modal(`Como foi o dia ${dia}?`, `<p style="margin-bottom:10px">Você fez <b>${p.feitos} de ${p.minimo}</b> contatos do mínimo desse dia. Conta pra gente o que aconteceu — vai para o gestor.</p>
      <textarea class="ctrl" id="just-texto" rows="4" style="width:100%" placeholder="Ex.: muitas matrículas na recepção, reunião, sistema fora…"></textarea>
      <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="just-nao"> Não trabalhei nesse dia (folga, falta ou atestado)</label>`,
      { acoes: [{ rotulo: 'Enviar', valor: 'enviar' }], ler: true });
    if (r.valor !== 'enviar') { toast('Antes de continuar, conte o que aconteceu nesse dia.', 'erro'); continue; }
    try { await dados.justificarDia(p.data, r.campos['just-texto'], r.campos['just-nao']); toast('Obrigado! Enviado ao gestor.'); }
    catch (e) { erro(e); }
  }
}
if (!ehAdmin) await pedirJustificativas();
montarMenu();
ligarSino();
window.addEventListener('hashchange', navegar);
await atualizarSino();   // antes da 1ª tela: o quadro usa os avisos urgentes
await navegar();
