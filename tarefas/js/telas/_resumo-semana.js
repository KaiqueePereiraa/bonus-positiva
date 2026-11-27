// Resumo da semana (27/11/2026, aprovado pelo Kaique): no 1º acesso da semana abre, por cima do Meu dia (consultora) ou
// do Painel (gestor), 4 cartões sobre a semana anterior — o que fica escondido em Análises e quase ninguém vai procurar.
// No 1º acesso do mês (até o dia 7) a versão é a do mês anterior. Depois de visto não reaparece (nem em outro aparelho);
// para rever, o link "📬 Resumo da semana". No "ver como consultora" só abre pelo link e não marca como visto.
// Regras puras em ../resumo-regras.js; novidades em ../novidades.js.
import * as dados from '../dados.js?v=20261127195325';
import { esc, erro, NOMES_CONTROLE } from '../ui.js?v=20261127195325';
import { destaques, voceVsVoce, TIPOS_RESULTADO } from '../jogo.js?v=20261127195325';
import { celebrar } from '../jogo-visual.js?v=20261127195325';
import { agruparVitorias } from './_vitorias.js?v=20261127195325';
import { avaliarUnidade, alertasProfessores } from '../professores-regras.js?v=20261127195325';
import { periodoResumo, unidadesPeriodo, vitoriasPeriodo, vitoriasPorConsultora, novidadesPara, delta } from '../resumo-regras.js?v=20261127195325';
import { tempoEspera } from '../fila-espera-regras.js?v=20261127195325';
import { NOVIDADES } from '../novidades.js?v=20261127195325';
import { somarDias, semanaDe } from '../regras.js?v=20261127195325';

let aberto = false;
const ESTREIA = '2026-11-30';   // abre sozinho a partir da 1ª segunda (antes disso, só pelo link 📬)
const primeiro = (n) => String(n || '').trim().split(/\s+/)[0];
// Primeiro nome; se outra pessoa da lista tem o mesmo primeiro nome, junta o sobrenome (ex.: "Maria Lopes" × "Maria Loussurdo")
const cap = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '');
function nomeCurto(nome, todos) {
  const p = primeiro(nome), partes = String(nome || '').trim().split(/\s+/);
  const dup = (todos || []).some((n) => n && n !== nome && primeiro(n).toLowerCase() === p.toLowerCase());
  return dup && partes.length > 1 ? `${cap(p)} ${cap(partes[1])}` : p;
}
const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const diaTxt = (iso) => `${DIAS_SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()]}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const diasDesde = (de, hoje) => Math.min(45, Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 864e5) + 1);
const linha = (icone, titulo, sub = '', num = '', cls = '') =>
  `<div class="resumo-linha ${cls}"><span class="resumo-ic">${icone}</span><div><b>${titulo}</b>${sub ? `<small>${sub}</small>` : ''}</div>${num ? `<span class="resumo-num">${num}</span>` : ''}</div>`;
const deltaHtml = (agora, antes, suf = '') => { const d = delta(agora, antes, suf); return d ? `<span class="resumo-delta ${d.cor}">${d.texto}</span>` : ''; };

// ctx: o mesmo das telas. forcar: veio do link "rever".
export async function abrirResumo(ctx, { forcar = false } = {}) {
  if (aberto) return;
  const como = dados.vendoComo();
  if (como && !forcar) return;
  if (!forcar && ctx.hoje() < ESTREIA) return;
  const uid = ctx.perfil.id;
  let vistos = [];
  try { vistos = await dados.resumosVistos(uid); } catch (e) { if (!forcar) return; }
  const p = periodoResumo(ctx.hoje(), vistos.map((v) => v.chave), forcar);
  if (!p) return;
  aberto = true;
  try {
    const ultimoVisto = vistos.reduce((m, v) => (!m || v.visto_em > m ? v.visto_em : m), null);
    const cartoes = ctx.ehAdmin ? await cartoesGestor(ctx, p, ultimoVisto) : await cartoesConsultora(ctx, p, ultimoVisto);
    mostrar(ctx, p, cartoes);
    if (!como) dados.marcarResumoVisto(uid, p.chaves).catch((e) => console.error('resumo visto:', e.message));
  } catch (e) {
    aberto = false;
    console.error('resumo da semana:', e);
    if (forcar) erro(e);
  }
}

// ───────── Consultora ─────────
async function cartoesConsultora(ctx, p, ultimoVisto) {
  const uid = ctx.perfil.id, un = ctx.perfil.unidade, hoje = p.hoje;
  const seg = semanaDe(hoje).inicio, dom = somarDias(seg, 6);
  const [lista, antes, vits, tarefas, escala] = await Promise.all([
    dados.desempenho(p.de, p.ate).catch(() => []), dados.desempenho(p.deAnt, p.ateAnt).catch(() => []),
    dados.vitoriasEquipe(diasDesde(p.de, hoje)).catch(() => []), dados.tarefas({ responsavel: uid }).catch(() => []),
    dados.escalaPeriodo(hoje, dom).catch(() => [])]);
  const daUn = un ? lista.filter((c) => c.unidade === un) : lista;

  // 1. Destaques
  const ds = destaques(daUn, antes);
  const souDestaque = ds.some((d) => d.quem.some((c) => c.id === uid));
  const c1 = { icone: '✨', titulo: p.tipo === 'mes' ? 'Destaques do mês' : 'Destaques da semana', festa: souDestaque,
    corpo: `<p class="resumo-sub">${esc(p.rotulo)}${un ? ` · ${esc(ctx.nomeUnidade(un).replace('Positiva ', ''))}` : ''}</p>
      ${ds.length ? ds.map((d) => { const eu = d.quem.some((c) => c.id === uid);
        return linha(d.icone, esc(d.titulo), `${eu ? 'Você' : esc(d.quem.map((c) => nomeCurto(c.nome, lista.map((x) => x.nome))).join(', '))} · ${esc(d.texto)}`, '', eu ? 'eu' : ''); }).join('')
      : '<p>Ainda sem destaques: poucos dias fechados no período.</p>'}
      ${souDestaque ? `<p class="resumo-festa">🎉 Você foi destaque ${p.tipo === 'mes' ? 'do mês' : 'da semana'}!</p>` : ''}` };

  // 2. Você vs você
  const eu = lista.find((c) => c.id === uid), euAntes = antes.find((c) => c.id === uid);
  const vv = voceVsVoce(eu, euAntes);
  const melhorou = eu && euAntes && eu.pct != null && euAntes.pct != null ? eu.pct - euAntes.pct : null;
  const c2 = { icone: '📈', titulo: 'Você vs você',
    corpo: `<p class="resumo-sub">${p.tipo === 'mes' ? 'O mês passado' : 'A semana passada'} comparado com ${esc(p.comparado)}</p>
      ${vv ? vv.map((l) => linha('', esc(l.rotulo), l.antes == null ? 'sem comparação' : `antes ${l.antes}${l.sufixo}`,
        `${l.agora == null ? '—' : `${l.agora}${l.sufixo}`} ${deltaHtml(l.agora, l.antes)}`)).join('')
      : '<p>Sem dias fechados no período (folga, ausência ou sem lista).</p>'}
      ${melhorou != null ? `<p>${melhorou > 0 ? 'Você evoluiu. Continua assim! 💪' : melhorou < 0 ? 'Foi mais devagar que antes. Esta semana é uma nova chance.' : 'Mesmo ritmo de antes. Dá para subir um degrau.'}</p>` : ''}` };

  // 3. Suas vitórias
  const v = vitoriasPeriodo(agruparVitorias(vits), p.de, p.ate, uid);
  const c3 = { icone: '👏', titulo: 'Suas vitórias',
    corpo: v.total ? `${Object.entries(TIPOS_RESULTADO).filter(([k]) => v.porTipo[k]).map(([k, t]) => linha(t.icone, `${v.porTipo[k]} ${v.porTipo[k] === 1 ? t.um : t.varios}`, 'depois do seu contato')).join('')}
      ${linha('👏', v.palmas.length ? `${v.palmas.length} ${v.palmas.length === 1 ? 'pessoa te aplaudiu' : 'pessoas te aplaudiram'}` : 'Ninguém aplaudiu ainda', v.palmas.length ? esc(v.palmas.map(primeiro).join(', ')) : 'as palmas aparecem no Meu dia, em Vitórias da equipe', '', v.palmas.length ? 'eu' : '')}`
      : '<p>Nenhum contato seu deu resultado neste período. Cada mensagem conta: as vitórias aparecem aqui quando o aluno volta, paga ou renova.</p>' };

  // 4. O que vem
  const escalada = (escala || []).filter((e) => e.pessoa_id === uid && e.data >= hoje).map((e) => e.data).sort();
  const prazos = (tarefas || []).filter((t) => !String(t.status).startsWith('concluida') && t.prazo >= hoje && t.prazo <= dom && (t.total || 0) - (t.feitos || 0) > 0)
    .sort((a, b) => a.prazo.localeCompare(b.prazo)).slice(0, 3);
  const novas = novidadesPara(NOVIDADES, 'consultora', ultimoVisto, hoje);
  const c4 = { icone: '📅', titulo: 'O que vem esta semana', fim: true,
    corpo: `${escalada.length ? linha('🗓️', 'Você está na escala', esc(escalada.map(diaTxt).join(' · '))) : ''}
      ${prazos.map((t) => linha('⏰', `${esc(NOMES_CONTROLE[t.controle_id] || 'Lista')} vence ${esc(diaTxt(t.prazo))}`, `faltam ${(t.total || 0) - (t.feitos || 0)} contatos`)).join('')}
      ${!escalada.length && !prazos.length ? '<p>Sem escala e sem prazo vencendo nesta semana. Siga o mínimo do dia.</p>' : ''}
      ${novas.map((n) => linha('🆕', 'Novidade na Central', esc(n.texto), '', 'novidade')).join('')}` };
  return [c1, c2, c3, c4];
}

// ───────── Gestor ─────────
async function cartoesGestor(ctx, p, ultimoVisto) {
  const uid = ctx.perfil.id, un = ctx.unidade, hoje = p.hoje;
  const [lista0, antes0, vits, kb, prof] = await Promise.all([
    dados.desempenho(p.de, p.ate).catch(() => []), dados.desempenho(p.deAnt, p.ateAnt).catch(() => []),
    dados.vitoriasEquipe(diasDesde(p.de, hoje)).catch(() => []), dados.kanbanWasfit().catch(() => null),
    dados.professoresPainel(`${hoje.slice(0, 8)}01`).catch(() => null)]);
  const lista = un ? lista0.filter((c) => c.unidade === un) : lista0;
  const antes = un ? antes0.filter((c) => c.unidade === un) : antes0;
  const nomeUn = (u) => esc(ctx.nomeUnidade(u).replace('Positiva ', '').replace('Acqua ', ''));
  const todosNomes = [...new Set([...lista0.map((c) => c.nome), ...(vits || []).map((x) => x.consultora)])];

  // 1. Destaques da equipe
  const ds = destaques(lista, antes);
  const c1 = { icone: '✨', titulo: p.tipo === 'mes' ? 'Destaques do mês' : 'Destaques da equipe',
    corpo: `<p class="resumo-sub">${esc(p.rotulo)}</p>
      ${ds.length ? ds.map((d) => linha(d.icone, esc(d.titulo), `${esc(d.quem.map((c) => nomeCurto(c.nome, todosNomes)).join(', '))} · ${esc(d.texto)}`)).join('')
      : '<p>Ainda sem destaques: poucos dias fechados no período.</p>'}` };

  // 2. Unidades × período anterior
  const us = unidadesPeriodo(lista, antes);
  const c2 = { icone: '🏢', titulo: `Unidades vs ${p.tipo === 'mes' ? 'mês' : 'semana'} anterior`,
    corpo: us.length ? us.map((u) => linha('🏢', nomeUn(u.unidade),
      `${u.contatos} contatos${u.contatosAnt != null ? ` (antes ${u.contatosAnt})` : ''} · mínimo cumprido ${u.pct ?? '—'}%${u.pctAnt != null ? ` (antes ${u.pctAnt}%)` : ''}`,
      `${u.resultados} deram certo ${deltaHtml(u.resultados, u.resultadosAnt)}`)).join('')
      + '<p class="resumo-sub">"Deram certo" = alunos que voltaram, pagaram, se matricularam ou renovaram depois do contato.</p>'
      : '<p>Sem dias fechados no período.</p>' };

  // 3. O que pede atenção
  const at = [];
  const e = kb?.espera;
  if (e?.aguardando) at.push(linha('⏳', `${e.aguardando} esperando na fila "${esc(e.tag || 'Em espera')}"`, `o mais antigo há ${tempoEspera(e.mais_antigo_min)}`));
  if (e?.mediana_min > 60) at.push(linha('🐢', 'A equipe demora para assumir a fila', `tempo típico: ${tempoEspera(e.mediana_min)} (30 dias)`));
  const antesProf = new Map((prof?.antes || []).map((u) => [u.unidade, u]));
  for (const a of alertasProfessores((prof?.atual || []).filter((u) => !un || u.unidade === un).map((u) => avaliarUnidade(u, antesProf.get(u.unidade))))) {
    at.push(linha('🏊', `Professor ${esc(primeiro(a.professor))}`, `perdeu ${String(a.taxa).replace('.', ',')}% dos alunos no mês (unidade: ${String(a.media).replace('.', ',')}%)`));
  }
  const fracas = lista.filter((c) => c.pct != null && c.dias >= 2 && c.pct < 50);
  if (fracas.length) at.push(linha('📉', 'Abaixo da metade do mínimo', esc(fracas.map((c) => `${nomeCurto(c.nome, todosNomes)} (${c.pct}%)`).join(', '))));
  const novas = novidadesPara(NOVIDADES, 'gestor', ultimoVisto, hoje);
  const c3 = { icone: '⚠️', titulo: 'O que pede atenção',
    corpo: `${at.length ? at.join('') : '<p>Nada pedindo atenção agora. 👏</p>'}${novas.map((n) => linha('🆕', 'Novidade na Central', esc(n.texto), '', 'novidade')).join('')}` };

  // 4. Quem merece seu aplauso
  const v = vitoriasPeriodo(agruparVitorias((vits || []).filter((x) => !un || x.unidade === un)), p.de, p.ate);
  const pessoas = vitoriasPorConsultora(v.grupos, uid).filter((x) => x.consultora_id !== uid).slice(0, 5);   // o próprio gestor não se aplaude
  const c4 = { icone: '👏', titulo: 'Quem merece seu aplauso', fim: true, palmas: true,
    corpo: `<p class="resumo-sub">Reconhecimento do gestor pesa mais que qualquer medalha. Um 👏 vale para todos os dias dela no período.</p>
      ${pessoas.length ? pessoas.map((x) => { const ja = !x.diasParaAplaudir.length;
        const tipos = Object.entries(TIPOS_RESULTADO).filter(([k]) => x.porTipo[k]).map(([k, t]) => `${t.icone} ${x.porTipo[k]} ${x.porTipo[k] === 1 ? t.um : t.varios}`).join(' · ');
        return `<div class="resumo-linha"><span class="resumo-ic">🌟</span><div><b>${esc(nomeCurto(x.consultora, todosNomes))}</b><small>${esc(tipos)}${x.dias.length > 1 ? ` · em ${x.dias.length} dias` : ` · ${esc(diaTxt(x.dias[0]))}`}</small></div>
          <button class="btn ${ja ? 'sec' : ''} peq resumo-num" data-aplaudir="${esc(x.consultora_id)}|${esc(x.diasParaAplaudir.join(','))}" ${ja ? 'disabled' : ''}>${ja ? '👏 Aplaudido' : '👏 Aplaudir'}</button></div>`; }).join('')
      : '<p>Nenhum resultado confirmado no período ainda.</p>'}` };
  return [c1, c2, c3, c4];
}

// ───────── Tela (cartões em sequência, por cima de tudo) ─────────
function mostrar(ctx, p, cartoes) {
  let k = 0;
  const fundo = document.createElement('div');
  fundo.className = 'resumo-fundo';
  fundo.setAttribute('role', 'dialog');
  fundo.setAttribute('aria-modal', 'true');
  fundo.setAttribute('aria-label', p.titulo);
  document.body.appendChild(fundo);
  const anterior = document.activeElement;
  const fechar = () => { document.removeEventListener('keydown', teclas); fundo.remove(); aberto = false; anterior?.focus?.(); };
  const ir = (d) => { if (k + d >= cartoes.length) { fechar(); return; } k = Math.max(0, k + d); desenhar(); };
  const teclas = (ev) => { if (ev.key === 'Escape') fechar(); else if (ev.key === 'ArrowRight') ir(1); else if (ev.key === 'ArrowLeft') ir(-1); };
  document.addEventListener('keydown', teclas);
  const festejados = new Set();
  function desenhar() {
    const c = cartoes[k];
    fundo.innerHTML = `<div class="resumo-card">
      <div class="resumo-barras">${cartoes.map((_, i) => `<span class="${i <= k ? 'feito' : ''}"></span>`).join('')}</div>
      <div class="resumo-topo"><span>${esc(p.titulo)} · ${k + 1} de ${cartoes.length}</span><button class="resumo-x" type="button" aria-label="Fechar">✕</button></div>
      <h2 class="resumo-tit"><span>${c.icone}</span> ${esc(c.titulo)}</h2>
      <div class="resumo-corpo">${c.corpo}</div>
      <div class="resumo-nav"><button class="btn sec" type="button" data-ir="-1" ${k === 0 ? 'style="visibility:hidden"' : ''}>← Voltar</button>
        <button class="btn" type="button" data-ir="1">${c.fim ? (ctx.ehAdmin ? 'Ir para o Painel →' : 'Bora para o dia →') : 'Próximo →'}</button></div></div>`;
    fundo.querySelector('.resumo-x').addEventListener('click', fechar);
    fundo.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => ir(+b.dataset.ir)));
    fundo.querySelectorAll('[data-aplaudir]').forEach((b) => b.addEventListener('click', async () => {
      const [consultora, dias] = b.dataset.aplaudir.split('|');
      b.disabled = true;
      try { for (const dia of dias.split(',').filter(Boolean)) await dados.aplaudirDia(consultora, dia); b.textContent = '👏 Aplaudido'; b.classList.add('sec'); }
      catch (e) { b.disabled = false; erro(e); }
    }));
    fundo.querySelector('[data-ir="1"]').focus();
    if (c.festa && !festejados.has(k)) { festejados.add(k); celebrar('Você foi destaque! 🎉', 'Olha você nos destaques. Continua assim!'); }
  }
  desenhar();
}

// Link para rever (Meu dia e Painel)
export const linkResumo = () => '<p class="dica rever-resumo"><a href="#" data-rever-resumo>📬 Resumo da semana</a></p>';
export function ligarLinkResumo(el, ctx) {
  el.querySelectorAll('[data-rever-resumo]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); abrirResumo(ctx, { forcar: true }); }));
}
