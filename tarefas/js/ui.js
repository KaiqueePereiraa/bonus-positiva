// Pequenos utilitários de interface da Central (sem framework).

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// 'AAAA-MM-DD' -> '30/10'
export const dataCurta = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '—');
export const dataLonga = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '—');
export const diaSemana = (d) => DIAS[new Date(`${d}T12:00:00Z`).getUTCDay()];
export const nomeMes = (ano, mes) => `${MESES[mes - 1]}/${ano}`;
export const nomeMesCap = (ano, mes) => { const s = nomeMes(ano, mes); return s[0].toUpperCase() + s.slice(1); };

export function dataHora(ts) {
  if (!ts) return '—';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
}

export const pct = (feitos, total) => (total > 0 ? Math.round((feitos / total) * 100) : 0);

export const STATUS = {
  nao_iniciada: { rotulo: 'Não iniciada', cor: 'cinza' },
  em_andamento: { rotulo: 'Em andamento', cor: 'azul' },
  concluida: { rotulo: 'Concluída', cor: 'verde' },
  concluida_atraso: { rotulo: 'Concluída com atraso', cor: 'verde-aviso' },
  atrasada: { rotulo: 'Atrasada', cor: 'vermelho' },
};

export function seloStatus(status, prazoProximo = false) {
  if (prazoProximo && (status === 'nao_iniciada' || status === 'em_andamento')) {
    return '<span class="selo laranja">Vence hoje</span>';
  }
  const s = STATUS[status] || { rotulo: status, cor: 'cinza' };
  return `<span class="selo ${s.cor}">${esc(s.rotulo)}</span>`;
}

export function barra(feitos, total, { rotulo = true } = {}) {
  const p = pct(feitos, total);
  return `<div class="barra" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100">
    <div class="barra-fill" style="width:${p}%"></div></div>${rotulo ? `<span class="barra-num">${feitos}/${total} · ${p}%</span>` : ''}`;
}

export const NOMES_CONTROLE = { inadimplencia: 'Inadimplência', risco: 'Risco de abandono', nao_fechou: 'Por que não fechou?' };
export const ROTA_CONTROLE = { inadimplencia: 'inadimplencia', risco: 'risco', nao_fechou: 'nao-fechou' };

// ── Avisos rápidos ──
let toastTimer;
export function toast(texto, tipo = 'ok') {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.append(el); }
  el.textContent = texto;
  el.className = `toast ${tipo} visivel`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visivel'), tipo === 'erro' ? 6000 : 3000);
}

// Mostra a mensagem de erro do banco (que já vem em português) ou uma genérica.
export function erro(e) {
  console.error(e);
  const m = e?.message || '';
  const emPortugues = /[ãõçáéíóúâêô]/i.test(m);  // mensagens das funções do banco e da validação
  toast(emPortugues ? m : 'Algo deu errado. Tente de novo.', 'erro');
}

// ── Janela modal simples ──
// Com { ler: true } resolve { valor, campos } — campos = valores dos inputs/selects pelo id.
export function modal(titulo, corpoHtml, { acoes = [], ler = false } = {}) {
  return new Promise((resolve) => {
    const fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    fundo.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
      <h2 id="modal-titulo">${esc(titulo)}</h2>
      <div class="modal-corpo">${corpoHtml}</div>
      <div class="modal-acoes">${acoes.map((a, i) => `<button class="btn ${a.classe || ''}" data-i="${i}">${esc(a.rotulo)}</button>`).join('')}</div>
    </div>`;
    const fechar = (valor) => {
      const campos = Object.fromEntries([...fundo.querySelectorAll('[id]')].filter((c) => 'value' in c)
        .map((c) => [c.id, c.type === 'checkbox' ? c.checked : c.value]));
      fundo.remove(); document.removeEventListener('keydown', tecla);
      resolve(ler ? { valor, campos } : valor);
    };
    const tecla = (e) => { if (e.key === 'Escape') fechar(null); };
    fundo.addEventListener('click', (e) => {
      if (e.target === fundo) return fechar(null);
      const b = e.target.closest('[data-i]');
      if (b) fechar(acoes[b.dataset.i].valor ?? acoes[b.dataset.i].rotulo);
    });
    document.addEventListener('keydown', tecla);
    document.body.append(fundo);
    (fundo.querySelector('input,select,textarea') || fundo.querySelector('.btn'))?.focus();
  });
}

export const confirmar = (titulo, texto, rotuloOk = 'Confirmar') =>
  modal(titulo, `<p>${esc(texto)}</p>`, { acoes: [{ rotulo: 'Cancelar', classe: 'sec', valor: false }, { rotulo: rotuloOk, valor: true }] });

export const vazio = (texto) => `<div class="vazio">${esc(texto)}</div>`;
export const carregando = () => '<div class="vazio">Carregando…</div>';

export const ehCelular = () => matchMedia('(max-width: 760px)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
