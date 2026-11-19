// Vitórias da equipe com 👏 (pedido de 18/11/2026): contatos das colegas da mesma unidade que deram certo nos últimos
// 7 dias (função vitorias_equipe). Colegas e o coordenador aplaudem; a dona vê quem aplaudiu e ganha uma festa quando
// recebe palmas novas. Do aluno aparece só o primeiro nome. Usado no Meu dia (aba "Da equipe") e no Painel do gestor.
import * as dados from '../dados.js?v=20261118230938';
import { esc, toast, erro } from '../ui.js?v=20261118230938';
import { TIPOS_RESULTADO } from '../jogo.js?v=20261118230938';
import { maisUm, celebrar } from '../jogo-visual.js?v=20261118230938';

const capitalizar = (s) => { const t = String(s || '').toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };
const primeiroNome = (s) => String(s || '').trim().split(/\s+/)[0];
export const quandoCurto = (ts) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit' })
  .format(new Date(ts)).replace('.', '');
const nomesPalmas = (p) => p.map((x) => primeiroNome(x.nome)).join(', ');

// Botão de palmas: "👏 Aplaudir" / "👏 3". Desabilitado na vitória da própria pessoa e depois que ela já aplaudiu.
export function botaoPalmas(v, euId, { podeAplaudir = true } = {}) {
  const n = v.palmas.length;
  const ja = v.palmas.some((p) => p.de === euId);
  const minha = v.consultora_id === euId;
  const titulo = n ? `Aplaudiram: ${nomesPalmas(v.palmas)}` : 'Ninguém aplaudiu ainda';
  if (minha || !podeAplaudir) return n ? `<span class="palmas-recebidas" title="${esc(titulo)}">👏 ${n}</span>` : '';
  return `<button type="button" class="btn-palmas ${ja ? 'ja' : ''}" data-aplaudir="${v.item_id}" ${ja ? 'disabled' : ''} title="${esc(titulo)}">
    👏 ${ja ? n : n ? `${n} · Aplaudir` : 'Aplaudir'}</button>`;
}

export function linhaVitoria(v, euId, opcoes = {}) {
  const t = TIPOS_RESULTADO[v.resultado];
  if (!t) return '';
  return `<li class="vitoria"><i>${t.icone}</i>
    <span><b>${esc(capitalizar(v.aluno))}</b> ${t.um}<small>contato de <b>${esc(v.consultora_id === euId ? 'você' : primeiroNome(v.consultora))}</b> · ${quandoCurto(v.quando)}</small></span>
    ${botaoPalmas(v, euId, opcoes)}</li>`;
}

// Lista com as 5 mais recentes e "ver mais"
export function listaVitorias(vits, euId, opcoes = {}) {
  if (!vits.length) return '<p class="dica">Nenhuma vitória da equipe nos últimos 7 dias ainda. Quando um contato der certo, aparece aqui.</p>';
  const [primeiras, resto] = [vits.slice(0, 5), vits.slice(5)];
  return `<ul class="vitorias">${primeiras.map((v) => linhaVitoria(v, euId, opcoes)).join('')}</ul>
    ${resto.length ? `<details class="res-mais"><summary>Ver mais ${resto.length}</summary><ul class="vitorias">${resto.map((v) => linhaVitoria(v, euId, opcoes)).join('')}</ul></details>` : ''}`;
}

// Liga os botões 👏 dentro de `raiz`
export function ligarPalmas(raiz, vits, euId) {
  raiz.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-aplaudir]');
    if (!b || b.disabled) return;
    b.disabled = true;
    try {
      const n = await dados.aplaudir(b.dataset.aplaudir);
      const v = vits.find((x) => x.item_id === b.dataset.aplaudir);
      if (v && !v.palmas.some((p) => p.de === euId)) v.palmas.push({ de: euId, nome: 'você', em: new Date().toISOString() });
      b.classList.add('ja');
      b.textContent = `👏 ${n}`;
      maisUm(b, '👏');
      toast(`Palmas enviadas para ${primeiroNome(v?.consultora)}!`);
    } catch (err) { erro(err); b.disabled = false; }
  });
}

// Festa quando ela recebe palmas novas (desde a última visita) nas próprias vitórias. Uma vez cada, por pessoa.
export function festaPalmasRecebidas(vits, euId) {
  const chave = `central_palmas_vistas_${euId}`;
  let visto = null;
  try { visto = localStorage.getItem(chave); } catch { /* segue */ }
  const recebidas = vits.filter((v) => v.consultora_id === euId).flatMap((v) => v.palmas.map((p) => ({ ...p, aluno: v.aluno })));
  const ultimo = recebidas.reduce((m, p) => (!m || p.em > m ? p.em : m), null);
  if (ultimo) { try { localStorage.setItem(chave, ultimo); } catch { /* segue */ } }
  if (!visto) return;   // primeira vez: só registra (não reprisa palmas antigas)
  const novas = recebidas.filter((p) => p.em > visto);
  if (!novas.length) return;
  const quem = [...new Set(novas.map((p) => primeiroNome(p.nome)))];
  const nomes = quem.length > 2 ? `${quem.slice(0, 2).join(', ')} e mais ${quem.length - 2}` : quem.join(' e ');
  celebrar(`${nomes} ${quem.length > 1 ? 'te aplaudiram' : 'te aplaudiu'}! 👏`,
    novas.length === 1 ? `Pelo resultado com ${capitalizar(novas[0].aluno)}.` : `${novas.length} palmas pelos seus resultados desta semana.`, { icone: '👏' });
}
