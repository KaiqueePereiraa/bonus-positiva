// Peças visuais da gamificação: anel do dia, trilha da semana, estante de conquistas e os efeitos
// (confete, "+1" flutuante, número contando). Sem biblioteca: SVG + CSS (css/jogo.css).
// Quem prefere menos movimento (prefers-reduced-motion) não vê confete nem contagem animada.
import { esc } from './ui.js?v=20261119175044';

const calmo = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Anel: trilha cinza, 1ª volta (mínimo) em verde e a volta extra em branco por cima.
export function anelSvg(a, { tam = 168, traco = 14, centro = '', sub = '' } = {}) {
  const r = (tam - traco) / 2 - 2, c = 2 * Math.PI * r, meio = tam / 2;
  const arco = (pct, cls, atraso = 0) => `<circle class="${cls}" cx="${meio}" cy="${meio}" r="${r}" stroke-width="${traco}"
    stroke-dasharray="${c}" stroke-dashoffset="${c}" data-alvo="${c * (1 - pct / 100)}" style="--atraso:${atraso}ms"/>`;
  return `<div class="anel${a.bateu ? ' bateu' : ''}" style="width:${tam}px;height:${tam}px">
    <svg viewBox="0 0 ${tam} ${tam}" aria-hidden="true">
      <circle class="anel-trilha" cx="${meio}" cy="${meio}" r="${r}" stroke-width="${traco}"/>
      ${arco(a.pct, 'anel-volta')}
      ${a.extraPct || a.voltas ? arco(a.voltas && !a.extraPct ? 100 : a.extraPct, 'anel-extra', 700) : ''}
    </svg>
    <div class="anel-centro">${centro ? `<div class="anel-valor">${centro}</div>` : ''}${sub ? `<small>${sub}</small>` : ''}</div></div>`;
}

// Anel do dia: um anel só, com o progresso até o PRÓXIMO nível (cor do nível). c = circulos(...).
const CORES_CIRCULO = ['#BEF575', '#FFFFFF', '#FF9A3D', '#7FD8F5', '#F5D76E', '#FF9FB2'];
export function aneisSvg(c, { tam = 168, traco = 13, centro = '', sub = '' } = {}) {
  const meio = tam / 2, r = (tam - traco) / 2 - 2, comp = 2 * Math.PI * r;
  const cor = CORES_CIRCULO[Math.min(c.nivel - 1, CORES_CIRCULO.length - 1)];
  return `<div class="anel aneis${c.bateuMinimo ? ' bateu' : ''}" style="width:${tam}px;height:${tam}px">
    <svg viewBox="0 0 ${tam} ${tam}" aria-hidden="true">
      <circle class="anel-trilha" cx="${meio}" cy="${meio}" r="${r}" stroke-width="${traco}"/>
      <circle class="anel-volta" cx="${meio}" cy="${meio}" r="${r}" stroke-width="${traco}" style="stroke:${cor}"
        stroke-dasharray="${comp}" stroke-dashoffset="${comp}" data-alvo="${comp * (1 - c.pct / 100)}"/></svg>
    <div class="anel-centro">${centro ? `<div class="anel-valor">${centro}</div>` : ''}${sub ? `<small>${sub}</small>` : ''}</div></div>`;
}

// Barra dos níveis do dia (mesma linguagem da meta da semana): marcos com nome e número de contatos, até 2 níveis
// além do atual, e o recorde pessoal como marquinho (ou como texto, se estiver mais longe).
export function barraNiveisHtml(c, feitos, recorde = 0) {
  const ate = Math.min(c.niveis.length - 1, (c.proximo ? c.nivel : c.niveis.length) );   // índice do último marco mostrado
  const mostrados = c.niveis.slice(0, ate + 1);
  const max = mostrados[mostrados.length - 1].alvo;
  const pos = (n) => Math.max(0, Math.min(100, (100 * n) / max));
  const recDentro = recorde > 0 && recorde <= max;
  return `<div class="niveis-dia">
    <div class="nd-trilha"><div class="nd-fill" style="width:0" data-largura="${pos(feitos)}%"></div>
      ${mostrados.map((n) => `<i class="${feitos >= n.alvo ? 'ok' : ''}" style="left:${pos(n.alvo)}%"></i>`).join('')}
      ${recDentro ? `<i class="recorde" style="left:${pos(recorde)}%" title="Seu recorde: ${recorde} contatos num dia"></i>` : ''}</div>
    <div class="nd-marcos">${mostrados.map((n, k) => (k < mostrados.length - 4 ? '' : `<span class="${feitos >= n.alvo ? 'ok' : ''} ${k === mostrados.length - 1 ? 'ultimo' : ''} ${k === 0 ? 'primeiro' : ''} ${n === c.proximo ? 'alvo' : ''}" style="left:${pos(n.alvo)}%">
      <em class="nd-nome">${feitos >= n.alvo ? n.icone : ''} ${esc(n.nome)}</em><small>${n.alvo}</small></span>`)).join('')}</div>
    ${recorde > 0 ? `<p class="nd-recorde">🏆 Seu recorde: <b>${recorde}</b> contatos num dia${feitos > recorde ? ' — <b>batido hoje!</b>' : feitos ? ` · faltam ${recorde - feitos + 1} para bater` : ''}</p>` : ''}
  </div>`;
}

// Liga a animação dos anéis e dos números (data-contar) dentro de `raiz`.
export function animar(raiz) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    raiz.querySelectorAll('circle[data-alvo]').forEach((c) => { c.style.strokeDashoffset = c.dataset.alvo; });
    raiz.querySelectorAll('[data-largura]').forEach((b) => { b.style.width = b.dataset.largura; });
  }));
  raiz.querySelectorAll('[data-contar]').forEach((el) => contar(el, +el.dataset.contar));
}

export function contar(el, ate, ms = 900) {
  if (calmo() || ate <= 0) { el.textContent = ate; return; }
  const ini = performance.now();
  const passo = (agora) => {
    const p = Math.min(1, (agora - ini) / ms);
    el.textContent = Math.round(ate * (1 - (1 - p) ** 3));
    if (p < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

const ICONE_DIA = { bateu: '✓', 'hoje-ok': '✓', protegido: '🛡', nao: '×', folga: '–', livre: '·', hoje: '', futuro: '' };
const TITULO_DIA = { bateu: 'mínimo batido', 'hoje-ok': 'mínimo batido hoje', protegido: 'escudo usado: a sequência continuou', nao: 'mínimo não batido', folga: 'folga/falta/atestado', livre: 'sem lista', hoje: 'hoje', futuro: '' };
export const trilhaHtml = (trilha) => `<ol class="trilha" aria-label="Sua semana">${trilha.map((d) =>
  `<li class="${d.estado}" title="${d.nome}: ${TITULO_DIA[d.estado]}"><i>${ICONE_DIA[d.estado]}</i><span>${d.nome}</span></li>`).join('')}</ol>`;

// Estante do mês: uma fileira por tema, com uma medalha COM NOME para cada degrau (Embalada → Semana em chamas →
// Imparável → Lenda da Positiva...). Ganhas ficam coloridas; a próxima de cada tema mostra quanto falta; trancadas em cinza.
// "Em defesa" = a maior do mês passado que ela ainda não reconquistou neste mês.
export function conquistasHtml(c) {
  const prox = c.proxima;
  const proxNome = prox ? prox.medalhas[prox.nivel] : null;
  const fileira = (f, k) => `<li class="familia ${f.emDefesa ? 'em-defesa' : ''}" style="--k:${k}">
    <div class="fam-cab"><b>${f.icone} ${esc(f.nome)}</b><small>${esc(f.unid)}${f.soOuro ? '' : ` · <b>${f.valor}</b> até agora`}</small>
      ${f.emDefesa ? `<span class="selo laranja" title="${esc(f.defesa)}">⏳ defenda "${esc(f.medalhas[f.nivelAntes - 1][1])}"</span>` : ''}
      ${f.vezes ? `<span class="vezes" title="Meses em que ganhou alguma medalha deste tema">🏆 ${f.vezes} ${f.vezes === 1 ? 'mês' : 'meses'}</span>` : ''}</div>
    <ol class="fam-medalhas">${f.medalhas.map(([ic, nome], j) => {
      const ganha = j < f.nivel, proxima = j === f.nivel;
      const cor = f.soOuro ? 3 : f.medalhas.length === 4 ? j + 1 : j + 1;
      return `<li class="${ganha ? 'ganha' : proxima ? 'proxima-med' : ''}" title="${esc(nome)}: ${f.niveis[j]} ${esc(f.medida || '')}">
        <span class="medalha nivel-${ganha ? cor : 0}">${ganha || proxima ? ic : '🔒'}</span>
        <b>${esc(nome)}</b><small>${f.soOuro ? 'no fim do mês' : `${f.niveis[j]} ${esc(f.medida)}`}</small></li>`;
    }).join('<li class="seta" aria-hidden="true">→</li>')}</ol>
    <small class="fam-falta">${esc(f.falta)}</small></li>`;
  return `<div class="cartao estante">
    <h2>🏆 Medalhas de ${esc(c.mes)} <span class="selo verde">${c.ganhas} de ${c.total}</span><span class="selo cinza">renovam todo mês</span></h2>
    <p class="dica" style="margin:-6px 0 14px">Cada medalha vale só no mês. No mês seguinte, conquiste de novo para continuar com ela — senão ela se perde.</p>
    ${c.emDefesa.length ? `<div class="defesa"><b>⏳ Defenda suas medalhas de ${esc(c.mesAntes)}</b>
      <ul>${c.emDefesa.map((m) => `<li>${m.icone} ${esc(m.defesa)}</li>`).join('')}</ul></div>` : ''}
    ${prox && proxNome ? `<div class="proxima"><span class="medalha grande alvo">${proxNome[0]}</span><div><small>Próxima medalha</small><b>${esc(proxNome[1])}</b>
      <span>${esc(prox.falta)}</span><div class="mini-barra"><i data-largura="${Math.round(100 * prox.progresso)}%"></i></div></div></div>` : ''}
    <ul class="familias">${c.lista.map(fileira).join('')}</ul></div>`;
}

// Festa quando ela ganha uma medalha nova no mês (uma vez cada, por pessoa). Na 1ª vez do mês só registra o que já tem.
export function festaMedalhas(c, hoje, quem = '') {
  const chave = `central_medalhas_${quem}_${hoje.slice(0, 7)}`;
  const agora = c.lista.flatMap((f) => f.medalhas.slice(0, f.nivel).map(([ic, nome]) => ({ id: `${f.id}:${nome}`, ic, nome })));
  let vistas = null;
  try { vistas = JSON.parse(localStorage.getItem(chave) || 'null'); } catch { /* segue */ }
  try { localStorage.setItem(chave, JSON.stringify(agora.map((m) => m.id))); } catch { /* segue */ }
  if (!vistas) return;
  for (const m of agora.filter((x) => !vistas.includes(x.id))) celebrar(`Nova medalha: ${m.nome}!`, `${m.ic} Conquistada em ${c.mes}. Ela vale até o fim do mês — e no próximo, é defender!`, { icone: m.ic });
}

// ── Efeitos ──
const CORES = ['#BEF575', '#7FB85A', '#FFFFFF', '#34425C', '#F5D76E'];
export function confete({ n = 90, origem = null } = {}) {
  if (calmo()) return;
  const caixa = document.createElement('div');
  caixa.className = 'confete';
  const ox = origem ? origem.x : innerWidth / 2, oy = origem ? origem.y : innerHeight * 0.35;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    const ang = Math.random() * Math.PI * 2, forca = 120 + Math.random() * 320;
    p.style.cssText = `left:${ox}px;top:${oy}px;background:${CORES[i % CORES.length]};--dx:${Math.cos(ang) * forca}px;--dy:${Math.sin(ang) * forca - 160}px;--r:${Math.random() * 720 - 360}deg;--d:${900 + Math.random() * 700}ms;${i % 3 ? '' : 'border-radius:50%;'}`;
    caixa.append(p);
  }
  document.body.append(caixa);
  setTimeout(() => caixa.remove(), 1800);
}

export function maisUm(alvo, texto = '+1') {
  if (!alvo) return;
  alvo.classList.remove('pulou'); void alvo.offsetWidth; alvo.classList.add('pulou');
  if (calmo()) return;
  const r = alvo.getBoundingClientRect();
  const s = document.createElement('span');
  s.className = 'mais-um';
  s.textContent = texto;
  s.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + scrollY}px`;
  document.body.append(s);
  setTimeout(() => s.remove(), 1100);
}

// Faixa de comemoração que desce do topo (mínimo batido, lista concluída).
// Em fila: se já tem uma comemoração na tela, a próxima espera ela sair (círculo → escudo → resultado, uma de cada vez).
const filaFestas = [];
let festaNaTela = false;
export function celebrar(titulo, texto, opcoes = {}) {
  filaFestas.push([titulo, texto, opcoes]);
  if (!festaNaTela) proximaFesta();
}
function proximaFesta() {
  const item = filaFestas.shift();
  if (!item) { festaNaTela = false; return; }
  festaNaTela = true;
  const [titulo, texto, { icone = '🎉', confetes = true } = {}] = item;
  document.querySelector('.festa')?.remove();
  const f = document.createElement('div');
  f.className = 'festa';
  f.setAttribute('role', 'status');
  f.innerHTML = `<span class="festa-icone">${icone}</span><div><b>${esc(titulo)}</b><span>${esc(texto)}</span></div>`;
  document.body.append(f);
  requestAnimationFrame(() => f.classList.add('visivel'));
  if (confetes) confete();
  setTimeout(() => { f.classList.remove('visivel'); setTimeout(() => { f.remove(); proximaFesta(); }, 450); }, 4200);
}

// Festa quando um círculo fecha: uma vez por círculo por dia (guardado no navegador, por pessoa).
// c = circulos(...). Devolve true se festejou.
export function festaCirculo(hoje, c, quem = '') {
  if (!c || !c.completos) return false;
  const chave = `central_festa_circulo_${quem}`;
  let ja = 0;
  try { const [dia, n] = String(localStorage.getItem(chave) || '').split(':'); if (dia === hoje) ja = +n || 0; } catch { /* segue */ }
  if (c.completos <= ja) return false;
  try { localStorage.setItem(chave, `${hoje}:${c.completos}`); } catch { /* segue */ }
  const n = c.atingido, prox = c.proximo;
  const depois = prox ? `Próximo: ${prox.icone} ${prox.nome} — mais ${prox.alvo - n.alvo} contatos.` : 'Não sobrou ninguém para chamar hoje. Dia completo!';
  if (c.zerou) celebrar('Lista zerada! 🏁', 'Não sobrou ninguém para chamar hoje. Dia completo!', { icone: '🏁' });
  else if (c.completos === 1) celebrar('Mínimo do dia batido!', depois, { icone: '⚡' });
  else celebrar(`${n.nome}! ${n.icone}`, depois, { icone: n.icone });
  return true;
}

// Novo recorde pessoal de contatos num dia: festa uma vez por dia
export function festaRecorde(hoje, feitos, recorde, quem = '') {
  if (!recorde || feitos <= recorde) return;
  const chave = `central_festa_recorde_${quem}`;
  try { if (localStorage.getItem(chave) === hoje) return; localStorage.setItem(chave, hoje); } catch { /* segue */ }
  celebrar('Novo recorde pessoal! 🏆', `${feitos} contatos hoje — o seu recorde era ${recorde}.`, { icone: '🏆' });
}

// ── Sequência: chama, escudos e o caminho dos próximos prêmios ──
export function chipsSequencia(cam) {
  const escudos = Array.from({ length: 2 }, (_, i) => `<i class="${i < cam.escudos ? 'tem' : ''}">🛡️</i>`).join('');
  return `<span class="chip-fogo chama-${cam.chama.id} ${cam.emJogo ? 'em-jogo' : ''}" title="${esc(cam.chama.nome)}: dias úteis seguidos com o mínimo (folga não quebra)">
      <i>🔥</i><b>${cam.atual}</b> ${cam.atual === 1 ? 'dia seguido' : 'dias seguidos'}<em>${esc(cam.chama.nome)}</em></span>
    ${cam.escudos ? '' : '<!-- sem escudo: o caminho já diz quando vem o próximo -->'}<span class="chip-escudos${cam.escudos ? '' : ' vazio'}" title="Escudos: a cada 13 dias seguidos você ganha 1 (guarda até 2). Num dia sem o mínimo, ele salva a sequência sozinho. A justificativa do dia continua valendo.">${escudos}<b>${cam.escudos}</b></span>`;
}
export function caminhoHtml(cam) {
  if (!cam.proximos.length) return '';
  return `<div class="caminho"><small>Próximos prêmios da sequência</small><ol>${cam.proximos.map((p) =>
    `<li class="${p.chama ? `chama-${p.chama}` : 'escudo'}"><i>${p.icone}</i><span><b>${p.falta === 1 ? 'amanhã' : `em ${p.falta} dias`}</b> ${esc(p.premio)}</span></li>`).join('')}</ol></div>`;
}

// Festas dos escudos: ganhou (a cada 13 dias) e usou (salvou a sequência). Uma vez cada, por pessoa.
// Na primeira vez que a pessoa abre (sem registro), só festeja os eventos dos últimos 3 dias.
export function festasDaSequencia(cam, hoje, quem = '') {
  const chave = `central_festa_seq_${quem}`;
  let visto = null;
  try { visto = localStorage.getItem(chave); } catch { /* segue */ }
  // sem registro: só os últimos 3 dias (não reprisa o histórico); depois, só o que for mais novo que o último festejado
  const desde = visto || new Date(Date.parse(`${hoje}T12:00:00Z`) - 4 * 864e5).toISOString().slice(0, 10);
  const novos = cam.eventos.map((e) => ({ ...e, data: e.hoje ? hoje : e.data })).filter((e) => e.data > desde && e.tipo !== 'quebrou');
  for (const e of novos) {
    if (e.tipo === 'ganhou') celebrar('Escudo conquistado! 🛡️', `${e.seq} dias seguidos com o mínimo. Se um dia não der, ele salva sua sequência sozinho.`, { icone: '🛡️' });
    else if (e.tipo === 'usou') celebrar('Seu escudo salvou a sequência!', `Num dia sem o mínimo, o escudo segurou seus ${e.seq} dias seguidos. Bora proteger de novo!`, { icone: '🛡️', confetes: false });
  }
  const ultimo = novos.reduce((m, e) => (e.data > m ? e.data : m), visto || '');
  if (ultimo) { try { localStorage.setItem(chave, ultimo); } catch { /* segue */ } }
  return novos.length > 0;
}
