// Vitórias da equipe com 👏 (pedido de 18/11/2026): contatos das colegas da mesma unidade que deram certo nos últimos
// 7 dias (função vitorias_equipe), agrupados em UMA linha por colega por dia, com um 👏 só (aplaudir_dia). A dona vê quem
// aplaudiu e ganha uma festa quando recebe palmas novas. Do aluno aparece só o primeiro nome (em "ver quem").
// Usado no Meu dia (aba "Da equipe") e no Painel do gestor.
import * as dados from '../dados.js?v=20261126195951';
import { esc, toast, erro } from '../ui.js?v=20261126195951';
import { TIPOS_RESULTADO } from '../jogo.js?v=20261126195951';
import { maisUm, celebrar } from '../jogo-visual.js?v=20261126195951';

const capitalizar = (s) => { const t = String(s || '').toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };
const primeiroNome = (s) => String(s || '').trim().split(/\s+/)[0];
export const quandoCurto = (ts) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit' })
  .format(new Date(ts)).replace('.', '');
const nomesPalmas = (p) => p.map((x) => primeiroNome(x.nome)).join(', ');

// Agrupa por consultora + dia (a EVO confere uma vez por noite): uma linha e um 👏 por colega por dia (pedido de
// 18/11/2026 — 50 palmas uma a uma era demais). Palmas do grupo = pessoas que aplaudiram algum resultado do dia.
const diaSP = (ts) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(ts));
export function agruparVitorias(vits) {
  const grupos = new Map();
  for (const v of vits) {
    const dia = diaSP(v.quando), chave = `${v.consultora_id}|${dia}`;
    if (!grupos.has(chave)) grupos.set(chave, { chave, consultora_id: v.consultora_id, consultora: v.consultora, dia, quando: v.quando, itens: [], porTipo: {}, palmas: new Map() });
    const g = grupos.get(chave);
    g.itens.push(v);
    g.porTipo[v.resultado] = (g.porTipo[v.resultado] || 0) + 1;
    for (const p of v.palmas) {   // a mesma pessoa conta uma vez por grupo (a data é a da 1ª palma)
      const ja = g.palmas.get(p.de);
      if (!ja || p.em < ja.em) g.palmas.set(p.de, p);
    }
  }
  return [...grupos.values()].map((g) => ({ ...g, palmas: [...g.palmas.values()] })).sort((a, b) => b.dia.localeCompare(a.dia) || b.itens.length - a.itens.length);
}
const quandoDia = (dia) => quandoCurto(`${dia}T15:00:00Z`);
const resumoTipos = (porTipo) => Object.entries(TIPOS_RESULTADO).filter(([k]) => porTipo[k])
  .map(([k, t]) => `${t.icone} ${porTipo[k]} ${porTipo[k] === 1 ? t.um : t.varios}`).join(' · ');

function botaoGrupo(g, euId, podeAplaudir) {
  const n = g.palmas.length, ja = g.palmas.some((p) => p.de === euId), minha = g.consultora_id === euId;
  const titulo = n ? `Aplaudiram: ${nomesPalmas(g.palmas)}` : 'Ninguém aplaudiu ainda';
  if (minha || !podeAplaudir) return n ? `<span class="palmas-recebidas" title="${esc(titulo)}">👏 ${n}</span>` : '';
  return `<button type="button" class="btn-palmas ${ja ? 'ja' : ''}" data-aplaudir-dia="${g.consultora_id}|${g.dia}" ${ja ? 'disabled' : ''} title="${esc(titulo)}">
    👏 ${ja ? n : n ? `${n} · Aplaudir` : 'Aplaudir'}</button>`;
}
function linhaGrupo(g, euId, { podeAplaudir = true } = {}) {
  const total = g.itens.length;
  const nomes = g.itens.map((v) => capitalizar(v.aluno));
  return `<li class="vitoria grupo-vitoria"><i>🎉</i>
    <span><b>${esc(g.consultora_id === euId ? 'Você' : primeiroNome(g.consultora))}</b>: ${total} ${total === 1 ? 'contato deu certo' : 'contatos deram certo'}
      <small>${resumoTipos(g.porTipo)} · ${quandoDia(g.dia)}</small>
      <details class="ver-quem"><summary>ver quem</summary><span>${esc(nomes.join(', '))}</span></details></span>
    ${botaoGrupo(g, euId, podeAplaudir)}</li>`;
}
// Quantos dias de colegas ela ainda não aplaudiu (contador da aba)
export const faltaAplaudir = (vits, euId) => agruparVitorias(vits).filter((g) => g.consultora_id !== euId && !g.palmas.some((p) => p.de === euId)).length;

// Lista agrupada: as 4 mais recentes (colega + dia) e "ver mais"
export function listaVitorias(vits, euId, opcoes = {}) {
  if (!vits.length) return '<p class="dica">Nenhuma vitória da equipe nos últimos 7 dias ainda. Quando um contato der certo, aparece aqui.</p>';
  const gs = agruparVitorias(vits);
  const [primeiras, resto] = [gs.slice(0, 4), gs.slice(4)];
  return `<ul class="vitorias">${primeiras.map((g) => linhaGrupo(g, euId, opcoes)).join('')}</ul>
    ${resto.length ? `<details class="res-mais"><summary>Ver mais ${resto.length}</summary><ul class="vitorias">${resto.map((g) => linhaGrupo(g, euId, opcoes)).join('')}</ul></details>` : ''}`;
}

// Liga os botões 👏 dentro de `raiz`
export function ligarPalmas(raiz, vits, euId) {
  raiz.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-aplaudir-dia]');
    if (!b || b.disabled) return;
    const [consultora, dia] = b.dataset.aplaudirDia.split('|');
    b.disabled = true;
    try {
      const n = await dados.aplaudirDia(consultora, dia);
      for (const v of vits) if (v.consultora_id === consultora && diaSP(v.quando) === dia && !v.palmas.some((p) => p.de === euId)) v.palmas.push({ de: euId, nome: 'você', em: new Date().toISOString() });
      b.classList.add('ja');
      b.textContent = `👏 ${n}`;
      maisUm(b, '👏');
      const nome = primeiroNome(vits.find((v) => v.consultora_id === consultora)?.consultora);
      toast(`Palmas enviadas para ${nome}!`);
      raiz.dispatchEvent(new CustomEvent('aplaudiu', { bubbles: true }));
    } catch (err) { erro(err); b.disabled = false; }
  });
}

// Festa quando ela recebe palmas novas (desde a última visita) nas próprias vitórias. Uma vez cada, por pessoa.
export function festaPalmasRecebidas(vits, euId) {
  const chave = `central_palmas_vistas_${euId}`;
  let visto = null;
  try { visto = localStorage.getItem(chave); } catch { /* segue */ }
  const recebidas = agruparVitorias(vits.filter((v) => v.consultora_id === euId)).flatMap((g) => g.palmas.map((p) => ({ ...p, dia: g.dia, total: g.itens.length })));
  const ultimo = recebidas.reduce((m, p) => (!m || p.em > m ? p.em : m), null);
  if (ultimo) { try { localStorage.setItem(chave, ultimo); } catch { /* segue */ } }
  if (!visto) return;   // primeira vez: só registra (não reprisa palmas antigas)
  const novas = recebidas.filter((p) => p.em > visto);
  if (!novas.length) return;
  const quem = [...new Set(novas.map((p) => primeiroNome(p.nome)))];
  const nomes = quem.length > 2 ? `${quem.slice(0, 2).join(', ')} e mais ${quem.length - 2}` : quem.join(' e ');
  const dias = [...new Set(novas.map((p) => p.dia))];
  celebrar(`${nomes} ${quem.length > 1 ? 'te aplaudiram' : 'te aplaudiu'}! 👏`,
    dias.length === 1 ? (novas[0].total === 1 ? `Pelo contato que deu certo (${quandoDia(dias[0])}).` : `Pelos ${novas[0].total} contatos que deram certo (${quandoDia(dias[0])}).`) : 'Pelos seus resultados desta semana.', { icone: '👏' });
}
