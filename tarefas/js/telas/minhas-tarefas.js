// Quadro da consultora: Atrasadas · Para fazer · Em andamento · Concluídas (o que está atrasado vem primeiro).
import * as dados from '../dados.js?v=20261126190714';
import { colunaQuadro, somarDias } from '../regras.js?v=20261126190714';
import { esc, dataCurta, diaSemana, seloStatus, barra, STATUS, NOMES_CONTROLE, ROTA_CONTROLE, LISTAS_DIARIAS } from '../ui.js?v=20261126190714';

const COLUNAS = [['atrasadas', 'Atrasadas'], ['para_fazer', 'Para fazer'], ['em_andamento', 'Em andamento'], ['concluidas', 'Concluídas']];

export const titulo = (t, listas = []) => (t.controle_id === 'lista_fazer'
  ? listas.find((l) => l.importacao_id === t.importacao_id)?.titulo || NOMES_CONTROLE.lista_fazer
  : t.controle_id === 'inadimplencia' || LISTAS_DIARIAS.includes(t.controle_id) ? `${NOMES_CONTROLE[t.controle_id]} — ${dataCurta(t.prazo)}`
  : `${NOMES_CONTROLE[t.controle_id] || t.controle_id} — semana ${dataCurta(t.periodo_inicio)}`);

export async function render(el, ctx) {
  const hoje = ctx.hoje();
  const limite = new Date(Date.now() - 35 * 864e5).toISOString().slice(0, 10);
  const [todas, listas] = await Promise.all([dados.tarefas({ responsavel: ctx.perfil.id }), dados.listasFazer().catch(() => [])]);
  const tarefas = todas
    // concluídas antigas e inadimplências de semanas futuras não poluem o quadro
    .filter((t) => (colunaQuadro(t.status) !== 'concluidas' || t.prazo >= limite)
      && !(t.controle_id === 'inadimplencia' && t.status === 'nao_iniciada' && t.prazo > somarDias(hoje, 7)));

  const porColuna = Object.fromEntries(COLUNAS.map(([c]) => [c, []]));
  tarefas.forEach((t) => porColuna[colunaQuadro(t.status)].push(t));
  porColuna.para_fazer.sort((a, b) => a.prazo.localeCompare(b.prazo));
  porColuna.em_andamento.sort((a, b) => a.prazo.localeCompare(b.prazo));

  el.innerHTML = `
    <a href="#/meu-dia" class="dica">← Meu dia</a>
    <div class="quadro">${COLUNAS.map(([c, rotulo]) => `<section class="coluna ${c}"><h3>${rotulo}<span>${porColuna[c].length}</span></h3>
      ${porColuna[c].map((t) => {
        const cor = t.prazo_proximo && c !== 'concluidas' ? 'laranja' : STATUS[t.status]?.cor;
        return `<a class="cartao-tarefa ${cor}" href="#/${ROTA_CONTROLE[t.controle_id]}/${t.id}">
          <b>${esc(titulo(t, listas))}</b>
          <div class="meta">Prazo ${diaSemana(t.prazo)} ${dataCurta(t.prazo)} ${seloStatus(t.status, t.prazo_proximo)}</div>
          ${t.total ? `<div class="progresso">${barra(t.feitos, t.total)}</div>` : '<div class="meta">A lista chega sozinha da EVO</div>'}
          <span class="ir">${c === 'concluidas' ? 'Ver' : 'Executar'} →</span></a>`;
      }).join('') || '<p class="dica" style="padding:6px">Nada aqui.</p>'}</section>`).join('')}
    </div>`;
}
