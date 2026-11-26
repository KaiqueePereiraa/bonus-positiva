// Central de Tarefas — inicialização, menu, rotas e sino.
import { exigirArea, areasDoPerfil, sair } from '../../shared/sessao.js?v=20261126163211';
import * as dados from './dados.js?v=20261126163211';
import { hojeSP } from './regras.js?v=20261126163211';
import { avisosConsultora, avisosAdmin } from './avisos.js?v=20261126163211';
import { esc, erro, carregando, modal, toast, ROTA_CONTROLE } from './ui.js?v=20261126163211';
import { circulos, disponivelDe, caminhoSequencia, recordeDoDia } from './jogo.js?v=20261126163211';
import { resumoSemana } from './bonus-meta.js?v=20261126163211';
import { aneisSvg, animar, maisUm, festaCirculo, celebrar, festasDaSequencia, festaRecorde } from './jogo-visual.js?v=20261126163211';

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
  hist: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
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
  vendas: { titulo: 'Vendas', modulo: 'vendas', icone: 'alvo', quem: 'todos', grupo: 'vendas', frase: 'Assinatura do contrato (todo dia útil) e ex-alunos que saíram há uns 3 ou 6 meses (toda segunda).' },
  'nao-fechou': { titulo: 'Por que não fechou?', modulo: 'nao-fechou', icone: 'nf', quem: 'todos', grupo: 'vendas', frase: 'Interessados parados há 5 dias (sem experimental ou fez e não fechou), todo dia útil. Fale com cada um e escolha o motivo.' },
  risco: { titulo: 'Risco de abandono', modulo: 'risco', icone: 'risco', quem: 'todos', grupo: 'retencao', frase: 'Alunos que pararam de vir. Pergunte o motivo e convide para voltar.' },
  renovacao: { titulo: 'Renovação', modulo: 'renovacao', icone: 'renov', quem: 'todos', grupo: 'retencao', frase: 'Contratos vencendo ou vencidos. Ofereça a renovação ou registre o motivo.' },
  relacionamento: { titulo: 'Relacionamento', modulo: 'relacionamento', icone: 'rel_aluno', quem: 'todos', grupo: 'retencao', frase: 'Alunos novos e quem cancelou. Um contato atencioso faz a pessoa ficar.' },
  inadimplencia: { titulo: 'Inadimplência', modulo: 'inadimplencia', icone: 'inad', quem: 'todos', grupo: 'cobranca', frase: 'Quem está com a mensalidade atrasada. Mande a mensagem pelo botão do WhatsApp.' },
  'lista-fazer': { titulo: 'Lista a fazer', modulo: 'lista-fazer', icone: 'lista', quem: 'todos', grupo: 'extras', frase: 'Listas extras montadas pelo gestor.' },
  // Acompanhar: uma pergunta por tela. Desempenho = as pessoas; Resultados = o que funciona; Relatórios = baixar e o retorno em R$.
  desempenho: { titulo: 'Desempenho', modulo: 'desempenho', icone: 'equipe', quem: 'todos', grupo: 'acompanhar', frase: 'Quem cumpriu o mínimo de contatos, quanto deu resultado e como cada uma está comparada com a equipe.' },
  comercial: { titulo: 'Desempenho comercial', modulo: 'comercial', icone: 'alvo', quem: 'todos', grupo: 'acompanhar', frase: 'Dos cadastros que cada consultora fez, quantos viraram cliente — comparado com a equipe e com o mês anterior.' },
  kanban: { titulo: 'Kanban da WasFit', modulo: 'kanban', icone: 'lista', quem: 'todos', grupo: 'acompanhar', frase: 'Os contatos do kanban da WasFit pelo tempo sem nenhuma ação: normal, atrasado e crítico.' },
  indicadores: { titulo: 'Resultados', modulo: 'indicadores', icone: 'ind', quem: 'admin', grupo: 'acompanhar', frase: 'O que cada lista trouxe de verdade, os motivos e o que os números dizem.' },
  relatorios: { titulo: 'Relatórios', modulo: 'relatorios', icone: 'rel', quem: 'admin', grupo: 'acompanhar', frase: 'Escolha o período e baixe em PDF, Excel ou CSV.' },
  retorno: { titulo: 'Retorno do mês', modulo: 'retorno', icone: 'rel', quem: 'admin', grupo: null, menu: 'relatorios', frase: 'Quanto a equipe trouxe de volta em R$ com a Central.' },
  // EM PREPARAÇÃO (pedido do usuário, 16/11/2026): só o admin vê a Escala até ele dizer que está 100% pronta.
  // Para abrir para as consultoras: trocar quem para 'todos' e religar o cron (supabase/migrations/021_escala_pausar_lembretes.sql).
  escala: { titulo: 'Escala', modulo: 'escala', icone: 'escala', quem: 'admin', grupo: 'ajustes', frase: 'Quem trabalha em cada fim de semana.' },
  historico: { titulo: 'Histórico', modulo: 'historico', icone: 'hist', quem: 'admin', grupo: 'ajustes', frase: 'Tudo o que foi feito na plataforma: quem fez, quando e o quê.' },
  configuracoes: { titulo: 'Configurações', modulo: 'configuracoes', icone: 'conf', quem: 'admin', grupo: 'ajustes', frase: 'Equipe, unidades e grupos, mensagens, WhatsApp e a conexão com a EVO.' },
};
// grupos que são listas de contato (a consultora só vê as listas em que tem algo)
const GRUPOS_LISTAS = ['vendas', 'retencao', 'cobranca', 'extras'];
// telas antigas que foram juntadas a outras (links salvos continuam funcionando)
const REDIRECIONA = { 'visao-geral': null, insights: 'indicadores' };
// quem: 'super' = só o administrador geral (configurações que valem para todas as unidades)
const podeVer = (r) => r.quem === 'todos' || (r.quem === 'super' ? ehAdmin && souSuper : (r.quem === 'admin') === ehAdmin);

const $ = (id) => document.getElementById(id);
const icone = (n) => `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONES[n]}</svg>`;

const perfilReal = await exigirArea('tarefas');
const souAdmin = perfilReal.papel_tarefas === 'admin';
// Super admin vê e configura tudo; os demais coordenadores só as unidades marcadas no perfil (o banco também confere).
const souSuper = souAdmin && !!perfilReal.super_admin;
let minhasUnidades = perfilReal.unidades_coord || [];   // + as do mesmo grupo (lidas do banco em carregarBase)
// "Ver como consultora": o coordenador escolhe uma consultora e a Central vira a tela dela (só para olhar; dados.js
// recusa salvar e o WhatsApp não abre). Guardado só nesta aba (sessionStorage): fechou a aba, volta a ser coordenador.
const CHAVE_VER_COMO = 'central_ver_como';
const lerVerComo = () => { try { return sessionStorage.getItem(CHAVE_VER_COMO); } catch { return null; } };
const verComoId = souAdmin ? lerVerComo() : null;
const ehAdmin = souAdmin && !verComoId;
let perfil = perfilReal;

const ctx = {
  perfil,
  ehAdmin,
  ehSuper: souSuper,
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
  // unidades no mesmo grupo dividem as listas: para passar aluno / trocar plantão vale qualquer consultora do grupo
  consultorasDoGrupo: (unidade) => {
    const g = ctx.unidades.find((u) => u.id === unidade)?.grupo;
    return ctx.consultoras.filter((c) => c.unidade === unidade || (g && ctx.unidades.find((u) => u.id === c.unidade)?.grupo === g));
  },
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
  // coordenador de unidade: a Central inteira (seletor, painéis, listas) só conhece as unidades dele
  if (souAdmin && !souSuper) minhasUnidades = (await dados.minhasUnidadesCoord().catch(() => null)) || minhasUnidades;
  ctx.unidades = souAdmin && !souSuper ? unidades.filter((u) => minhasUnidades.includes(u.id)) : unidades;
  if (ehAdmin && !souSuper && ctx.unidade && !minhasUnidades.includes(ctx.unidade)) ctx.unidade = '';
  if (ehAdmin && !souSuper && ctx.unidades.length === 1) ctx.unidade = ctx.unidades[0].id;
  // admin lê os perfis completos (nome no EVO para a divisão); consultora só a lista pública da equipe
  const base = souAdmin ? (await dados.perfis()).filter((p) => p.ativo && p.acesso_tarefas) : equipe;
  ctx.consultoras = base.filter((p) => p.papel_tarefas === 'consultora' && p.ordem_rodizio != null)
    .sort((a, b) => a.ordem_rodizio - b.ordem_rodizio);
  ctx.motivos = motivos;
  if (verComoId) {   // troca o perfil pelo da consultora escolhida
    const alvo = base.find((p) => p.id === verComoId && p.papel_tarefas === 'consultora');
    if (!alvo) { sairDoVerComo(); return; }
    perfil = alvo; ctx.perfil = alvo; ctx.unidade = alvo.unidade;
    dados.verComo(alvo.id);
  }
  ctx.controles = Object.fromEntries(controles.map((c) => [c.id, c]));
  if (ehAdmin) await dados.garantirInadimplencia().catch(() => {}); // o agendador também faz isso de madrugada
}

function sairDoVerComo() {
  try { sessionStorage.removeItem(CHAVE_VER_COMO); } catch { /* segue */ }
  history.replaceState(null, '', '#/painel');   // sem disparar a troca de tela antes de recarregar
  location.reload();
}

async function escolherConsultora() {
  const porUnidade = ctx.unidadesAtivas().map((u) => `<optgroup label="${esc(u.nome)}">${ctx.consultorasDa(u.id)
    .map((c) => `<option value="${c.id}" ${c.id === verComoId ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</optgroup>`).join('');
  const r = await modal('Ver a Central como consultora', `<p>Escolha uma consultora: a Central mostra exatamente a tela dela, com os dados dela de hoje
      (Meu dia, listas, desempenho).</p>
    <p class="aviso-so-olhar">👁 É só para olhar: <b>nada é salvo</b> e o botão do <b>WhatsApp não abre</b> (para não mandar mensagem a aluno).</p>
    <label class="campo">Consultora<select id="ver-como-sel">${porUnidade}</select></label>`,
  { acoes: [{ rotulo: 'Cancelar', classe: 'sec', valor: null }, { rotulo: 'Ver como ela →', classe: 'verde', valor: 'ok' }], ler: true });
  const id = r?.valor === 'ok' && r.campos['ver-como-sel'];
  if (!id) return;
  try { sessionStorage.setItem(CHAVE_VER_COMO, id); } catch { toast('Este navegador não deixou guardar a escolha.', 'erro'); return; }
  history.replaceState(null, '', '#/meu-dia');
  location.reload();
}

// Botão no topo (ao lado do sino) e, no modo "ver como", a faixa no topo com Trocar / Voltar.
// 23/11/2026: só no topo — o do pé do menu saiu (pedido do Kaique: não repetir o botão).
function ligarVerComo() {
  if (!verComoId) {
    const t = document.createElement('button');
    t.type = 'button'; t.className = 'btn-topo-ver-como'; t.title = 'Ver a Central como uma consultora vê (só para olhar)';
    t.innerHTML = '👁 <span>Ver como consultora</span>';
    t.addEventListener('click', escolherConsultora);
    $('sino').before(t);
    return;
  }
  document.body.classList.add('modo-ver-como');
  const f = document.createElement('div');
  f.className = 'faixa-ver-como';
  f.innerHTML = `<span>👁 Vendo como <b>${esc(perfil.nome)}</b> · consultora ${esc(ctx.nomeUnidade(perfil.unidade).replace('Positiva ', ''))}.
      <small>Só para olhar: nada é salvo e o WhatsApp não abre.</small></span>
    <span class="fvc-acoes"><button type="button" data-a="efeitos">✨ Ver comemorações</button><button type="button" data-a="trocar">Trocar</button><button type="button" data-a="sair">Voltar a ser coordenador</button></span>`;
  f.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'trocar') escolherConsultora();
    else if (a === 'sair') sairDoVerComo();
    else if (a === 'efeitos') mostrarComemoracoes();
  });
  document.querySelector('.principal').prepend(f);
}

// Mostra, sem salvar nada, as comemorações que a consultora vê (contato marcado, mínimo batido, resultado)
function mostrarComemoracoes() {
  maisUm($('hud').hidden ? $('titulo') : $('hud'));
  celebrar('Pegando fogo! 🔥', 'Exemplo: assim aparece quando ela sobe de nível no dia. Próximo: ✈️ Voando — mais 4 contatos.', { icone: '🔥' });
  celebrar('Escudo conquistado! 🛡️', 'Exemplo: 13 dias seguidos com o mínimo. Se um dia não der, ele salva a sequência sozinho.', { icone: '🛡️' });
  celebrar('Seu contato deu resultado!', 'Exemplo: Maria voltou a treinar depois da sua mensagem.', { icone: '🌟' });
}

function montarMenu() {
  let grupoAtual;
  $('menu').innerHTML = Object.entries(ROTAS).filter(([, r]) => r.grupo && podeVer(r)).map(([rota, r]) => {
    const titulo = r.grupo !== grupoAtual && GRUPOS[r.grupo] ? `<li class="grupo" role="presentation">${esc(GRUPOS[r.grupo])}</li>` : '';
    grupoAtual = r.grupo;
    return `${titulo}<li data-li="${rota}"><a href="#/${rota}" data-rota="${rota}">${icone(r.icone)}<span>${esc(r.titulo)}</span><b class="cont" hidden></b></a></li>`;
  }).join('');
  $('nome-usuario').textContent = perfil.nome || perfil.email;
  $('papel-usuario').textContent = !ehAdmin ? 'Consultora' : souSuper ? 'Administrador geral'
    : `Coordenador · ${ctx.unidades.map((u) => u.nome.replace('Positiva ', '')).join(', ') || 'sem unidade'}`;
  $('avatar').textContent = (perfil.nome || perfil.email || '?').trim()[0].toUpperCase();
  $('trocar-area').hidden = !areasDoPerfil(perfilReal).bonus;
  if (souAdmin) ligarVerComo();
  if (ehAdmin) {
    const sel = $('sel-unidade');
    sel.hidden = false;
    const todas = souSuper ? '<option value="">Todas as unidades</option>'
      : ctx.unidades.length > 1 ? '<option value="">Todas as minhas unidades</option>' : '';
    sel.innerHTML = `${todas}${ctx.unidades.map((u) => `<option value="${u.id}" ${u.id === ctx.unidade ? 'selected' : ''}>${esc(u.nome)}</option>`).join('')}`;
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
  document.body.dataset.rota = rota;   // o placar do topo some no Meu dia (lá o placar é grande)
  $('titulo').textContent = titulo;
  $('subtitulo').textContent = def.frase || '';
  document.title = `${titulo} — Central de Tarefas`;
  const el = $('conteudo');
  el.innerHTML = carregando();
  const meu = ++renderAtual;
  try {
    const tela = await import(`./telas/${modulo}.js?v=20261126163211`);
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

// Plano do dia: quem não bateu o mínimo de um dia útil conta o que aconteceu ANTES de usar a plataforma (pedido de
// 18/11/2026: obrigatório). A janela não fecha com Esc nem clicando fora, e o menu e as telas só aparecem depois de
// justificar todos os dias pendentes. "Não trabalhei" tira o dia da conta. O gestor recebe no WhatsApp.
async function pedirJustificativas() {
  let anterior = null, aviso = '';
  for (;;) {
    let p;
    try { p = await dados.justificativaPendente(); } catch { return; }   // sem conexão: não prende a consultora
    if (!p) return;
    if (anterior === p.data && !aviso) return;   // salvou mas o dia continua pendente: não trava a tela por erro do sistema
    const dia = `${p.data.slice(8, 10)}/${p.data.slice(5, 7)}`;
    const r = await modal(`Antes de começar: como foi o dia ${dia}?`, `<p style="margin-bottom:10px">Você fez <b>${p.feitos} de ${p.minimo}</b> contatos do mínimo desse dia.
        Para continuar usando a Central, conte o que aconteceu — vai para o gestor.</p>
      ${aviso ? `<p class="faixa urgente" style="margin-bottom:10px">${esc(aviso)}</p>` : ''}
      <textarea class="ctrl" id="just-texto" rows="4" style="width:100%" placeholder="Ex.: muitas matrículas na recepção, reunião, sistema fora…"></textarea>
      <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="just-nao"> Não trabalhei nesse dia (folga, falta ou atestado)</label>`,
      { acoes: [{ rotulo: 'Enviar e continuar', valor: 'enviar' }], ler: true, travado: true });
    const texto = String(r.campos['just-texto'] || '').trim();
    if (texto.length < 10) { aviso = 'Escreva pelo menos uma frase curta (10 letras ou mais).'; continue; }
    try {
      await dados.justificarDia(p.data, texto, r.campos['just-nao']);
      toast('Obrigado! Enviado ao gestor.');
      anterior = p.data; aviso = '';
    } catch (e) { aviso = e?.message || 'Não foi possível enviar. Tente de novo.'; }
  }
}
// ── Placar do topo (consultora): anel do mínimo de hoje + sequência 🔥, em todas as telas ──
// Atualiza a cada contato marcado (evento central:contato, disparado por atualizarCabecalho) e comemora o mínimo.
let diasFechados = null, ultimoFeitos = null, metaSemana, recordeHist;   // meta: lida 1x (a EVO atualiza de madrugada)
async function atualizarHud(animarMudanca = false) {
  const el = $('hud');
  try {
    if (!diasFechados) diasFechados = await dados.meusDias(perfil.id).catch(() => []);
    if (metaSemana === undefined) metaSemana = perfil.acesso_bonus && perfil.unidade ? await dados.minhaMetaSemana().catch(() => null) : null;
    const d = await dados.meuDia();
    if (recordeHist === undefined) recordeHist = await dados.meuRecordeDia(perfil.id, d.hoje).catch(() => 0);
    const minimo = d.listas.reduce((s, l) => s + l.minimo, 0), feitos = d.feitos_hoje;
    if (!minimo && !feitos) { el.hidden = true; return; }
    const c = circulos(feitos, minimo, disponivelDe(d), d.listas);   // níveis = frações do pendente (1/3, metade, 3/4, tudo)
    const seq = caminhoSequencia(diasFechados, minimo ? { feitos, minimo } : null);
    el.hidden = false;
    el.className = `hud${c?.bateuMinimo ? ' bateu' : ''}`;
    el.title = c ? `Hoje: ${feitos} contatos · ${c.zerou ? 'lista zerada' : !c.bateuMinimo ? `faltam ${c.falta} para o mínimo` : `${c.atingido.nome} · faltam ${c.falta} para ${c.proximo.nome}`} · ${seq.atual} dia(s) seguidos` : '';
    el.innerHTML = `${c ? aneisSvg(c, { tam: 38, traco: 4 }) : ''}<span class="hud-num"><b>${feitos}</b>/${c ? c.alvo : '–'}</span>${c?.atingido && c.completos > 1 ? `<span class="hud-circ" title="${c.atingido.nome}">${c.atingido.icone}</span>` : ''}${seq.atual ? `<span class="hud-fogo chama-${seq.chama.id}">🔥${seq.atual}</span>` : ''}${seq.escudos ? `<span class="hud-escudo">🛡️${seq.escudos > 1 ? seq.escudos : ''}</span>` : ''}${hudMeta(d.hoje)}`;
    animar(el);
    if (animarMudanca && ultimoFeitos != null && feitos > ultimoFeitos) maisUm(el, `+${feitos - ultimoFeitos}`);
    if (ultimoFeitos != null && feitos > ultimoFeitos) { festaCirculo(d.hoje, c, perfil.id); festaRecorde(d.hoje, feitos, Math.max(recordeDoDia(diasFechados), recordeHist || 0), perfil.id); festasDaSequencia(seq, d.hoje, perfil.id); }   // subiu de nível / recorde / escudo
    ultimoFeitos = feitos;
  } catch (e) { console.error(e); }
}
// "🎯 1/2": contratos da semana / próxima faixa do Bônus (ou ✓ na Super meta) — a meta à vista enquanto ela trabalha nas listas
function hudMeta(hoje) {
  if (!metaSemana?.publicado_em) return '';
  const r = resumoSemana(metaSemana.vendas || [], hoje, perfil.unidade, metaSemana.regua);
  const alvo = r.proxima ? r.feitos + r.proxima.faltam : null;
  return `<span class="hud-meta" title="Meta da semana: ${r.feitos} ${r.feitos === 1 ? 'contrato' : 'contratos'}${r.proxima ? ` · faltam ${r.proxima.faltam} para ${r.proxima.nome}` : ` · ${r.topo} batida!`}">🎯 <b>${r.feitos}</b>${alvo ? `/${alvo}` : ' 🏆'}</span>`;
}
let hudTimer;
if (!ehAdmin) window.addEventListener('central:contato', () => { clearTimeout(hudTimer); hudTimer = setTimeout(() => atualizarHud(true), 500); });

if (!souAdmin) await pedirJustificativas();
if (!ehAdmin) atualizarHud();
montarMenu();
ligarSino();
window.addEventListener('hashchange', navegar);
await atualizarSino();   // antes da 1ª tela: o quadro usa os avisos urgentes
await navegar();
