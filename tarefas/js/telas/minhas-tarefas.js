// Quadro da consultora: Para fazer · Em andamento · Concluídas · Atrasadas.
import * as dados from '../dados.js?v=20261106191808';
import { colunaQuadro, somarDias } from '../regras.js?v=20261106191808';
import { esc, dataCurta, diaSemana, seloStatus, barra, STATUS, NOMES_CONTROLE, ROTA_CONTROLE, nomeMesCap } from '../ui.js?v=20261106191808';

const COLUNAS = [['para_fazer', 'Para fazer'], ['em_andamento', 'Em andamento'], ['concluidas', 'Concluídas'], ['atrasadas', 'Atrasadas']];

const titulo = (t) => (t.controle_id === 'nao_fechou'
  ? `${NOMES_CONTROLE.nao_fechou} — ${nomeMesCap(+t.periodo_inicio.slice(0, 4), +t.periodo_inicio.slice(5, 7))}`
  : t.controle_id === 'risco' ? `${NOMES_CONTROLE.risco} — semana ${dataCurta(t.periodo_inicio)}` : `${NOMES_CONTROLE.inadimplencia} — ${dataCurta(t.prazo)}`);

export async function render(el, ctx) {
  const hoje = ctx.hoje();
  const limite = new Date(Date.now() - 35 * 864e5).toISOString().slice(0, 10);
  const tarefas = (await dados.tarefas({ responsavel: ctx.perfil.id }))
    // concluídas antigas e inadimplências de semanas futuras não poluem o quadro
    .filter((t) => (colunaQuadro(t.status) !== 'concluidas' || t.prazo >= limite)
      && !(t.controle_id === 'inadimplencia' && t.status === 'nao_iniciada' && t.prazo > somarDias(hoje, 7)));

  const urgentes = ctx.avisos().filter((a) => a.nivel === 'urgente');
  const porColuna = Object.fromEntries(COLUNAS.map(([c]) => [c, []]));
  tarefas.forEach((t) => porColuna[colunaQuadro(t.status)].push(t));
  porColuna.para_fazer.sort((a, b) => a.prazo.localeCompare(b.prazo));
  porColuna.em_andamento.sort((a, b) => a.prazo.localeCompare(b.prazo));

  el.innerHTML = `
    ${urgentes.map((a) => `<div class="faixa urgente"><div><b>Atenção, ${esc(ctx.perfil.nome?.split(' ')[0] || '')}!</b>${esc(a.texto)} <a href="${a.rota}">Abrir →</a></div></div>`).join('')}
    <div class="quadro">${COLUNAS.map(([c, rotulo]) => `<section class="coluna ${c}"><h3>${rotulo}<span>${porColuna[c].length}</span></h3>
      ${porColuna[c].map((t) => {
        const cor = t.prazo_proximo && c !== 'concluidas' ? 'laranja' : STATUS[t.status]?.cor;
        return `<a class="cartao-tarefa ${cor}" href="#/${ROTA_CONTROLE[t.controle_id]}/${t.id}">
          <b>${esc(titulo(t))}</b>
          <div class="meta">Prazo ${diaSemana(t.prazo)} ${dataCurta(t.prazo)} ${seloStatus(t.status, t.prazo_proximo)}</div>
          ${t.total ? `<div class="progresso">${barra(t.feitos, t.total)}</div>` : '<div class="meta">Planilha ainda não enviada</div>'}
          <span class="ir">${c === 'concluidas' ? 'Ver' : 'Executar'} →</span></a>`;
      }).join('') || '<p class="dica" style="padding:6px">Nada aqui.</p>'}</section>`).join('')}
    </div>`;
}
