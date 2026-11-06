// Filtros e carga de dados compartilhados por Indicadores e Relatórios.
import * as dados from '../dados.js?v=20261106192758';
import { esc, STATUS, NOMES_CONTROLE } from '../ui.js?v=20261106192758';
import { somarDias } from '../regras.js?v=20261106192758';

export function filtrosPadrao(ctx) {
  const hoje = ctx.hoje();
  // padrão: do 1º dia do mês retrasado até hoje (~3 meses)
  return { desde: `${somarDias(`${hoje.slice(0, 8)}01`, -32).slice(0, 8)}01`, ate: hoje, unidade: ctx.unidade || '', consultora: '', controle: '', status: '' };
}

export function htmlFiltros(f, ctx, { status = true } = {}) {
  const opt = (v, r, sel) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${esc(r)}</option>`;
  return `<div class="filtros">
    <label class="campo">De<input type="date" data-f="desde" value="${f.desde}"></label>
    <label class="campo">Até<input type="date" data-f="ate" value="${f.ate}"></label>
    <label class="campo">Unidade<select data-f="unidade">${opt('', 'Todas', f.unidade)}${ctx.unidades.map((u) => opt(u.id, u.nome, f.unidade)).join('')}</select></label>
    <label class="campo">Consultora<select data-f="consultora">${opt('', 'Todas', f.consultora)}${(f.unidade ? ctx.consultorasDa(f.unidade) : ctx.consultoras).map((c) => opt(c.id, c.nome, f.consultora)).join('')}</select></label>
    <label class="campo">Controle<select data-f="controle">${opt('', 'Todos', f.controle)}${Object.entries(NOMES_CONTROLE).map(([id, n]) => opt(id, n, f.controle)).join('')}</select></label>
    ${status ? `<label class="campo">Status<select data-f="status">${opt('', 'Todos', f.status)}${Object.entries(STATUS).map(([id, s]) => opt(id, s.rotulo, f.status)).join('')}</select></label>` : ''}
  </div>`;
}

export function lerFiltros(el, f) {
  el.querySelectorAll('[data-f]').forEach((c) => { f[c.dataset.f] = c.value; });
  return f;
}

// Consultoras que entram nas tabelas: as da unidade escolhida (ou todas) e, se houver, só a escolhida.
export function pessoasDoFiltro(f, ctx) {
  const daUnidade = f.unidade ? ctx.consultorasDa(f.unidade) : ctx.consultoras;
  return f.consultora ? daUnidade.filter((c) => c.id === f.consultora) : daUnidade;
}

// Tarefas (filtradas pelo prazo no período) e itens do "Por que não fechou?" das mesmas tarefas.
export async function carregar(f) {
  const unidade = f.unidade || undefined;
  const [todas, itensNf] = await Promise.all([
    dados.tarefas({ desde: f.desde, ate: f.ate, unidade }),
    f.controle && f.controle !== 'nao_fechou' ? [] : dados.itensPeriodo({ controle: 'nao_fechou', desde: f.desde, ate: f.ate, unidade }),
  ]);
  const tarefas = todas.filter((t) => (!f.consultora || t.responsavel_id === f.consultora)
    && (!f.controle || t.controle_id === f.controle) && (!f.status || t.status === f.status));
  const itens = itensNf.filter((i) => !f.consultora || i.responsavel_id === f.consultora);
  return { tarefas, itensNf: itens };
}

export const periodoTexto = (f, ctx) => (f.unidade && ctx ? `${ctx.nomeUnidade(f.unidade)} · ` : '') + `${f.desde.split('-').reverse().join('/')} a ${f.ate.split('-').reverse().join('/')}`;
