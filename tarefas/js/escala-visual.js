// Escala — marcação HTML do calendário (funções puras, sem banco). Usado pela tela Escala.
import { esc, nomeMesCap } from './ui.js?v=20261116174037';
import { corPessoa, agruparPorMes } from './escala.js?v=20261116174037';

const SEM = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dow = (d) => new Date(`${d}T12:00:00Z`).getUTCDay();
const numDia = (d) => +d.slice(8, 10);
const mes3 = (d) => MES3[+d.slice(5, 7) - 1];

// Pílula colorida com o nome; "você" ganha um anel verde e uma etiqueta.
export function chipPessoa(p, eu = null) {
  const c = corPessoa(p.nome);
  const sou = !!(eu && p.id && p.id === eu);
  return `<span class="esc-chip${sou ? ' eu' : ''}" style="--cp-bg:${c.bg};--cp-fg:${c.fg};--cp-bd:${c.bd}">${esc(p.nome)}${sou ? '<i>você</i>' : ''}</span>`;
}

export const chipsDoDia = (pessoas, eu = null) =>
  (pessoas.length ? pessoas.map((p) => chipPessoa(p, eu)).join('') : '<span class="esc-vazio">ninguém escalado</span>');

function tituloBloco(b) {
  if (b.tipo === 'feriado') return `Feriado · ${esc(b.dias[0].feriado || '')}`;
  const [a, z] = b.dias;
  return a.data.slice(5, 7) === z.data.slice(5, 7)
    ? `${numDia(a.data)}–${numDia(z.data)} ${mes3(a.data)}`
    : `${numDia(a.data)} ${mes3(a.data)} – ${numDia(z.data)} ${mes3(z.data)}`;
}

function colunaDia(d, bloco, { hoje, eu, ehAdmin }) {
  const euTrabalho = d.pessoas.some((p) => p.id === eu);
  const acoes = [];
  if (!ehAdmin && euTrabalho && d.data > hoje) acoes.push(`<button class="btn sec peq" data-acao="pedir" data-data="${d.data}">Pedir troca</button>`);
  if (ehAdmin && d.data >= hoje) acoes.push(`<button class="btn sec peq" data-acao="editar" data-data="${d.data}">Editar</button>`);
  const fer = bloco.tipo === 'fds' && d.feriado ? `<span class="etiqueta">${esc(d.feriado)}</span>` : '';
  return `<div class="esc-dia${d.data === hoje ? ' hoje' : ''}${d.data < hoje ? ' passado' : ''}">
    <div class="esc-dia-topo"><span class="esc-sem">${SEM[dow(d.data)]}</span><span class="esc-num">${numDia(d.data)}</span>${fer}
    </div>
    <div class="esc-chips">${chipsDoDia(d.pessoas, eu)}</div>
    ${acoes.length ? `<div class="esc-acoes">${acoes.join('')}</div>` : ''}</div>`;
}

export function cartaoBloco(b, { hoje, eu, ehAdmin, destaque = false }) {
  const euNoBloco = b.dias.some((d) => d.data >= hoje && d.pessoas.some((p) => p.id === eu));
  const estaSemana = b.tipo === 'fds' && b.dias.some((d) => d.data === hoje);
  const selos = [
    destaque ? `<span class="selo azul">${estaSemana ? 'Este fim de semana' : 'Próximo fim de semana'}</span>` : '',
    euNoBloco ? '<span class="selo verde">Você trabalha</span>' : '',
  ].join('');
  return `<article class="esc-card${b.tipo === 'feriado' ? ' feriado' : ''}${destaque ? ' destaque' : ''}${euNoBloco ? ' meu' : ''}">
    <header class="esc-topo"><b>${tituloBloco(b)}</b><span class="esc-selos">${selos}</span></header>
    <div class="esc-dias">${b.dias.map((d) => colunaDia(d, b, { hoje, eu, ehAdmin })).join('')}</div></article>`;
}

// Legenda: cada pessoa que aparece nas próximas datas, com a cor dela (a cor nunca é a única pista: o nome está escrito).
export function legendaHtml(blocos, { hoje, eu }) {
  const vistos = new Map();
  for (const b of blocos) for (const d of b.dias) if (d.data >= hoje) for (const p of d.pessoas) vistos.set(p.id || `n:${p.nome.toLowerCase()}`, p);
  return [...vistos.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((p) => chipPessoa(p, eu)).join('');
}

// Cartões agrupados por mês; o primeiro fim de semana que ainda não acabou ganha destaque.
export function calendarioHtml(blocos, { hoje, eu, ehAdmin }) {
  const futuros = blocos.filter((b) => b.dias.some((d) => d.data >= hoje));
  const prox = futuros.find((b) => b.tipo === 'fds');
  return agruparPorMes(futuros).map((g) => `<section class="esc-mes"><h3>${esc(nomeMesCap(g.ano, g.mes).replace('/', ' '))}</h3>
    <div class="esc-cards">${g.blocos.map((b) => cartaoBloco(b, { hoje, eu, ehAdmin, destaque: b === prox })).join('')}</div></section>`).join('');
}
