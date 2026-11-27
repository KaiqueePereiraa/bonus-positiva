// Análises → Professores (27/11/2026, pedido do Kaique): por unidade e professor,
//  • retenção: dos alunos das turmas dele, quantos saíram no mês (cancelou ou venceu sem renovar), comparado com a média da
//    unidade e com o mesmo período do mês anterior; quantos entraram na lista de risco de abandono;
//  • aula experimental: quantos interessados fizeram a experimental com ele e quantos viraram cliente em até 30 dias.
// Turmas vêm da agenda da EVO (lida todo dia; histórico desde 01/08/2026); saídas, da leitura de saldo do mês.
import * as dados from '../dados.js?v=20261127195325';
import { esc, vazio, nomeMesCap, dataCurta } from '../ui.js?v=20261127195325';
import { avaliarUnidade, MIN_ALUNOS, FOLGA } from '../professores-regras.js?v=20261127195325';

let escolhido = null;
const SIT = { perde_mais: ['vermelho', 'Perde mais'], perde_menos: ['verde', 'Segura bem'], na_media: ['azul', 'Na média'], poucos: ['cinza', 'Poucos alunos'] };
const pc = (v) => (v == null ? '—' : `${String(v).replace('.', ',')}%`);
const nomeProf = (n) => String(n || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()).replace(/ (De|Da|Do|Dos|Das|E) /g, (m) => m.toLowerCase());

export async function render(el, ctx) {
  const hoje = ctx.hoje();
  const meses = [];
  for (let k = 0; k < 6; k++) { const d = new Date(`${hoje.slice(0, 7)}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - k); meses.push(d.toISOString().slice(0, 10)); }
  escolhido ||= meses[0];
  const r = await dados.professoresPainel(escolhido);
  const [a, m] = [+r.mes.slice(0, 4), +r.mes.slice(5, 7)];
  const [a2, m2] = [+r.anterior.mes.slice(0, 4), +r.anterior.mes.slice(5, 7)];
  const fechado = r.ate.slice(8, 10) === new Date(Date.UTC(a, m, 0)).toISOString().slice(8, 10);
  const rotuloAnt = fechado ? nomeMesCap(a2, m2) : `${nomeMesCap(a2, m2)} até o dia ${r.anterior.ate.slice(8, 10)}`;
  const antes = new Map((r.antes || []).map((u) => [u.unidade, u]));
  const unidades = (r.atual || []).filter((u) => !ctx.unidade || u.unidade === ctx.unidade).map((u) => avaliarUnidade(u, antes.get(u.unidade)));
  el.innerHTML = `
    <div class="cartao"><div class="linha-acoes"><label class="campo">Mês<select class="ctrl" id="mes">${meses.map((x) => `<option value="${x}" ${x === escolhido ? 'selected' : ''}>${nomeMesCap(+x.slice(0, 4), +x.slice(5, 7))}</option>`).join('')}</select></label></div>
      <p class="dica" style="margin-top:8px">Alunos do professor = quem esteve nas aulas dele nos 30 dias antes do mês e no mês (aluno com dois professores conta para os dois).
        Saíram = cancelaram ou o contrato venceu sem renovar no mês. A comparação é com a média da unidade (folga de ${FOLGA} pontos; só avalia quem tem ${MIN_ALUNOS}+ alunos) e com ${esc(rotuloAnt)}.
        ${r.turmas_lidas_desde ? `Agenda das turmas lida desde ${dataCurta(r.turmas_lidas_desde)} (${r.turmas_dias} dias)` : 'A agenda das turmas está sendo lida agora'} — enquanto o histórico desde agosto não termina de carregar, os meses anteriores podem vir incompletos.</p></div>
    ${unidades.length ? unidades.map((u) => cartaoUnidade(u, ctx, rotuloAnt)).join('') : `<div class="cartao">${vazio('Ainda não há turmas lidas da EVO para este mês. A leitura roda sozinha; volte em algumas horas.')}</div>`}`;
  el.querySelector('#mes').onchange = (e) => { escolhido = e.target.value; render(el, ctx); };
}

function cartaoUnidade(u, ctx, rotuloAnt) {
  const nome = ctx.nomeUnidade(u.unidade).replace('Positiva ', '').replace('Acqua ', '');
  return `<div class="cartao"><h2>${esc(nome)} <span class="selo cinza">${u.alunos} alunos nas turmas · ${u.sairam} saíram · média ${pc(u.media)}</span></h2>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Professor</th><th>Alunos</th><th>Saíram no mês</th><th>% de saída</th><th>${esc(rotuloAnt)}</th><th>Em risco</th><th>Aula experimental</th><th>Situação</th></tr></thead><tbody>
    ${u.linhas.map((p) => { const [cor, rot] = SIT[p.status]; return `<tr><td class="nome">${esc(nomeProf(p.professor))}</td>
      <td>${p.alunos || '—'}</td>
      <td>${p.alunos ? `<b>${p.sairam}</b><span class="sub">${p.cancelaram} cancelaram · ${p.venceram} venceram</span>` : '—'}</td>
      <td><b>${pc(p.taxa)}</b></td>
      <td>${pc(p.taxaAnt)}</td>
      <td>${p.alunos ? p.em_risco : '—'}</td>
      <td>${p.experimentais ? `${p.viraram_cliente} de ${p.experimentais} viraram cliente<span class="sub">${pc(p.conversao)}</span>` : '<span class="dica">nenhuma</span>'}</td>
      <td><span class="selo ${cor}">${rot}</span></td></tr>
      <tr><td colspan="8" class="dica" style="padding-top:0">💡 ${esc(p.leitura)}</td></tr>`; }).join('') || `<tr><td colspan="8">${vazio('Sem professores com turmas lidas neste mês.')}</td></tr>`}
    </tbody></table></div>
    <p class="dica">Aula experimental: cada interessado que agenda entra numa turma, e a turma tem um professor — é assim que a experimental fica com ele. ${u.experimentais ? `Na unidade, ${u.experimentais} no mês e ${pc(u.conversaoUnidade)} viraram cliente.` : 'Nenhuma registrada neste mês ainda.'} Vem da agenda da EVO (o interessado fica inscrito na aula), com histórico desde 01/08/2026.</p></div>`;
}
