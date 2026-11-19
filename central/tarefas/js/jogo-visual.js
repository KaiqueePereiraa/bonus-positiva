// Peças visuais da gamificação: anel do dia, trilha da semana, estante de conquistas e os efeitos
// (confete, "+1" flutuante, número contando). Sem biblioteca: SVG + CSS (css/jogo.css).
// Quem prefere menos movimento (prefers-reduced-motion) não vê confete nem contagem animada.
import { esc } from './ui.js?v=20261118221345';

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

const ICONE_DIA = { bateu: '✓', 'hoje-ok': '✓', nao: '×', folga: '–', livre: '·', hoje: '', futuro: '' };
const TITULO_DIA = { bateu: 'mínimo batido', 'hoje-ok': 'mínimo batido hoje', nao: 'mínimo não batido', folga: 'folga/falta/atestado', livre: 'sem lista', hoje: 'hoje', futuro: '' };
export const trilhaHtml = (trilha) => `<ol class="trilha" aria-label="Sua semana">${trilha.map((d) =>
  `<li class="${d.estado}" title="${d.nome}: ${TITULO_DIA[d.estado]}"><i>${ICONE_DIA[d.estado]}</i><span>${d.nome}</span></li>`).join('')}</ol>`;

export function conquistasHtml(c) {
  const prox = c.proxima;
  return `<div class="cartao estante">
    <h2>🏆 Conquistas <span class="selo verde">${c.ganhas} de ${c.lista.length}</span></h2>
    ${prox ? `<div class="proxima"><span class="medalha trancada grande">${prox.icone}</span><div><small>Próxima conquista</small><b>${esc(prox.nome)}</b>
      <span>${esc(prox.falta)}</span>${prox.progresso != null ? `<div class="mini-barra"><i data-largura="${Math.round(100 * (prox.progresso || 0))}%"></i></div>` : ''}</div></div>` : '<p class="dica">Você destravou todas! 👑</p>'}
    <ul class="medalhas">${c.lista.map((m, k) => `<li class="${m.ok ? 'ganha' : ''}" style="--k:${k}" title="${esc(m.desc)}${m.ok ? '' : ` — ${esc(m.falta)}`}">
      <span class="medalha ${m.ok ? '' : 'trancada'}">${m.ok ? m.icone : '🔒'}</span><b>${esc(m.nome)}</b><small>${esc(m.desc)}</small></li>`).join('')}</ul></div>`;
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
export function celebrar(titulo, texto, { icone = '🎉', confetes = true } = {}) {
  document.querySelector('.festa')?.remove();
  const f = document.createElement('div');
  f.className = 'festa';
  f.setAttribute('role', 'status');
  f.innerHTML = `<span class="festa-icone">${icone}</span><div><b>${esc(titulo)}</b><span>${esc(texto)}</span></div>`;
  document.body.append(f);
  requestAnimationFrame(() => f.classList.add('visivel'));
  if (confetes) confete();
  setTimeout(() => { f.classList.remove('visivel'); setTimeout(() => f.remove(), 400); }, 4200);
}

// Mínimo batido: festa uma vez por dia (guardado no navegador; sem armazenamento, pode repetir — sem problema).
// quem: id da consultora — a chave é por pessoa (computador da recepção pode ser dividido; coordenador no "ver como")
export function festaMinimoUmaVez(hoje, feitos, minimo, quem = '') {
  const chave = `central_festa_minimo_${quem}`;
  try { if (localStorage.getItem(chave) === hoje) return false; localStorage.setItem(chave, hoje); } catch { /* segue */ }
  celebrar('Mínimo do dia batido!', `${feitos} de ${minimo}. Agora é volta extra — o mínimo é só o piso.`, { icone: '⚡' });
  return true;
}
