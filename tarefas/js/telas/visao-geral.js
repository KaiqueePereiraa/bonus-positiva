// Visão geral — admin: cartões do mês + blocos dos 3 controles; consultora: resumo do que fazer.
import * as dados from '../dados.js?v=20261104135611';
import { semanaDe, mesReferenciaSugerido, prazoNaoFechou } from '../regras.js?v=20261104135611';
import { esc, dataCurta, diaSemana, seloStatus, pct, nomeMesCap, ROTA_CONTROLE, NOMES_CONTROLE } from '../ui.js?v=20261104135611';
import { linhaProgresso } from './_comum.js?v=20261104135611';

export async function render(el, ctx) {
  return ctx.ehAdmin ? admin(el, ctx) : consultora(el, ctx);
}

const numero = (rotulo, valor, cor = '', sub = '') =>
  `<div class="numero ${cor}"><small>${rotulo}</small><b>${valor}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;

async function consultora(el, ctx) {
  const tarefas = await dados.tarefas({ responsavel: ctx.perfil.id });
  const abertas = tarefas.filter((t) => !t.concluida_em && t.total !== undefined)
    .filter((t) => t.status !== 'concluida' && t.status !== 'concluida_atraso')
    .sort((a, b) => a.prazo.localeCompare(b.prazo)).slice(0, 6);
  const urgentes = ctx.avisos().filter((a) => a.nivel !== 'info');
  el.innerHTML = `
    ${urgentes.map((a) => `<div class="faixa ${a.nivel === 'urgente' ? 'urgente' : ''}"><div>${esc(a.texto)} <a href="${a.rota}">Abrir →</a></div></div>`).join('')}
    <div class="cartao"><h2>Próximas tarefas <span class="mais"><a href="#/minhas-tarefas">Ver quadro completo →</a></span></h2>
      ${abertas.length ? abertas.map((t) => `<div class="linha-info"><a href="#/${ROTA_CONTROLE[t.controle_id]}/${t.id}" style="color:inherit;font-weight:700">${NOMES_CONTROLE[t.controle_id]}</a>
        <span>${t.total ? `${t.feitos}/${t.total} · ` : ''}prazo ${diaSemana(t.prazo)} ${dataCurta(t.prazo)} ${seloStatus(t.status, t.prazo_proximo)}</span></div>`).join('')
      : '<p class="dica">Nenhuma tarefa pendente. Tudo em dia!</p>'}
    </div>`;
}

async function admin(el, ctx) {
  const hoje = ctx.hoje();
  const inicioMes = `${hoje.slice(0, 8)}01`;
  const semana = semanaDe(hoje);
  const ref = mesReferenciaSugerido(hoje);
  const refIni = `${ref.ano}-${String(ref.mes).padStart(2, '0')}-01`;
  const unidades = ctx.unidade ? ctx.unidades.filter((u) => u.id === ctx.unidade)
    : (ctx.unidadesAtivas().length ? ctx.unidadesAtivas() : ctx.unidades);
  const [todas, impRisco, impNf] = await Promise.all([
    dados.tarefas({ desde: new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10), unidade: ctx.unidade || undefined }),
    dados.importacoes('risco', { limite: 30, unidade: ctx.unidade || undefined }),
    dados.importacoes('nao_fechou', { limite: 30, unidade: ctx.unidade || undefined })]);

  // cartões: tarefas com prazo no mês corrente até hoje + as abertas atrasadas
  const doPeriodo = todas.filter((t) => t.prazo >= inicioMes && t.prazo <= hoje);
  const concluidas = doPeriodo.filter((t) => t.status.startsWith('concluida')).length;
  const atrasadas = todas.filter((t) => t.status === 'atrasada').length;
  const pendentes = doPeriodo.length - concluidas;

  const blocos = unidades.map((u) => {
    const daUni = todas.filter((t) => t.unidade === u.id);
    const inad = daUni.filter((t) => t.controle_id === 'inadimplencia');
    const proxInad = inad.filter((t) => t.prazo >= hoje).sort((a, b) => a.prazo.localeCompare(b.prazo))[0];
    const ultimaInad = inad.filter((t) => t.concluida_em).sort((a, b) => b.prazo.localeCompare(a.prazo))[0];
    const recentesInad = inad.filter((t) => t.prazo < hoje).sort((a, b) => b.prazo.localeCompare(a.prazo)).slice(0, 3);
    const imR = impRisco.find((i) => i.unidade === u.id && i.referencia_inicio === semana.inicio);
    const risco = imR ? daUni.filter((t) => t.importacao_id === imR.id) : [];
    const rFeitos = risco.reduce((s, t) => s + t.feitos, 0);
    const rTotal = risco.reduce((s, t) => s + t.total, 0);
    const imN = impNf.find((i) => i.unidade === u.id && i.referencia_inicio === refIni);
    const nf = imN ? daUni.filter((t) => t.importacao_id === imN.id) : [];
    const nfFeitos = nf.reduce((s, t) => s + t.feitos, 0);
    return `<h2 style="font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:.6px;margin-top:6px">${esc(u.nome)}</h2>
    <div class="grade">
      <div class="cartao"><h2>Inadimplência <span class="mais"><a href="#/inadimplencia">Abrir →</a></span></h2>
        ${proxInad ? `<div class="linha-info"><span>Próxima data</span><b>${diaSemana(proxInad.prazo)} ${dataCurta(proxInad.prazo)}</b></div>
          <div class="linha-info"><span>Responsável</span><b>${esc(ctx.nomeDe(proxInad.responsavel_id))}</b></div>
          <div class="linha-info"><span>Status</span>${seloStatus(proxInad.status, proxInad.prazo_proximo)}</div>` : '<p class="dica">Rodízio não iniciado.</p>'}
        <div class="linha-info"><span>Contatos na última concluída</span><b>${ultimaInad ? `${ultimaInad.total} (${dataCurta(ultimaInad.prazo)})` : '—'}</b></div>
        ${recentesInad.length ? `<p class="dica" style="margin:12px 0 6px">Histórico recente</p>${recentesInad.map((t) => `<div class="linha-info"><span>${dataCurta(t.prazo)} · ${esc(ctx.nomeDe(t.responsavel_id))}</span>${seloStatus(t.status)}</div>`).join('')}` : ''}
      </div>
      <div class="cartao"><h2>Risco de abandono <span class="mais"><a href="#/risco">Abrir →</a></span></h2>
        ${risco.length ? `<div class="linha-info"><span>Alunos importados (semana ${dataCurta(semana.inicio)})</span><b>${imR.linhas}</b></div>
          <div class="linha-info"><span>Mensagens enviadas</span><b>${rFeitos}</b></div>
          <div class="linha-info"><span>Pendentes</span><b>${rTotal - rFeitos}</b></div>
          <div class="linha-info"><span>Conclusão da equipe</span><b>${pct(rFeitos, rTotal)}%</b></div>
          <div style="margin-top:14px">${risco.map((t) => linhaProgresso(ctx.nomeDe(t.responsavel_id), t.feitos, t.total)).join('')}</div>`
        : '<p class="dica">A lista desta semana ainda não foi importada.</p>'}
      </div>
      <div class="cartao"><h2>Por que não fechou? <span class="mais"><a href="#/nao-fechou">Abrir →</a></span></h2>
        <div class="linha-info"><span>Mês de referência</span><b>${nomeMesCap(ref.ano, ref.mes)}</b></div>
        ${nf.length ? `<div class="linha-info"><span>Interessados importados</span><b>${imN.linhas}</b></div>
          <div class="linha-info"><span>Justificativas preenchidas</span><b>${nfFeitos}</b></div>
          <div class="linha-info"><span>Pendentes</span><b>${imN.linhas - nfFeitos}</b></div>
          <div class="linha-info"><span>Prazo final</span><b>${dataCurta(prazoNaoFechou(ref))}</b></div>
          <div style="margin-top:14px">${nf.map((t) => linhaProgresso(ctx.nomeDe(t.responsavel_id), t.feitos, t.total)).join('')}</div>`
        : '<p class="dica">A lista do mês ainda não foi importada.</p>'}
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `
    ${ctx.avisos().filter((a) => a.nivel !== 'info').map((a) => `<div class="faixa ${a.nivel === 'urgente' ? 'urgente' : ''}"><div>${esc(a.texto)} <a href="${a.rota}">Abrir →</a></div></div>`).join('')}
    <div class="numeros">
      ${numero('Tarefas no mês', doPeriodo.length, 'escuro', 'com prazo até hoje')}
      ${numero('Concluídas', concluidas, 'verde')}
      ${numero('Pendentes', pendentes, 'azul')}
      ${numero('Atrasadas', atrasadas, atrasadas ? 'vermelho' : '', 'em aberto agora')}
      ${numero('Conclusão', `${pct(concluidas, doPeriodo.length)}%`, 'verde')}
    </div>
    ${blocos}`;
}
