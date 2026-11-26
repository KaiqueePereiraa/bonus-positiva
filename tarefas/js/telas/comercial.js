// Desempenho comercial — o "coordenador comercial": conversão dos cadastros de cada consultora (crédito de quem cadastrou,
// não importa quem fechou), comparada com a equipe e com o mês anterior; números do time e as 4 semanas do mês.
// Regra do antigo Dashboard Positiva: venda = cadastrou e converteu no mesmo mês. Dados lidos da EVO todo dia (evo-desempenho).
import * as dados from '../dados.js?v=20261126154150';
import { esc, vazio, nomeMesCap, dataCurta, dataHora } from '../ui.js?v=20261126154150';
import { pct, resumoTime, avaliarTime, variacao, taxaConsultoras, placarIa, MIN_CADASTROS } from '../comercial-regras.js?v=20261126154150';

let escolhido = null;

const num = (v) => (v == null ? '—' : String(v).replace('.', ','));
const pctTxt = (v) => (v == null ? '—' : `${num(v)}%`);
function seta(atual, anterior, { pontos = false, invertido = false, unidade = null } = {}) {
  if (atual == null || anterior == null) return '';
  const d = pontos ? Math.round((atual - anterior) * 10) / 10 : variacao(atual, anterior);
  if (d == null || d === 0) return '<span class="dica">= igual</span>';
  const bom = invertido ? d < 0 : d > 0;
  return `<span style="color:${bom ? '#3F7A1F' : '#B42318'};font-weight:800">${d > 0 ? '▲' : '▼'} ${num(Math.abs(d))}${unidade || (pontos ? ' pts' : '%')}</span>`;
}
const SELO = { acima: ['verde', 'Acima do padrão'], dentro: ['azul', 'Dentro do padrão'], abaixo: ['vermelho', 'Abaixo do padrão'], poucos: ['cinza', 'Poucos cadastros'] };
const TEND = { melhorou: '▲ melhorou', piorou: '▼ piorou', estavel: '= estável' };

export async function render(el, ctx) {
  const hoje = ctx.hoje();
  const meses = [];
  for (let k = 0; k < 12; k++) {
    const d = new Date(`${hoje.slice(0, 7)}-01T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - k);
    meses.push(d.toISOString().slice(0, 10));
  }
  escolhido ||= meses[0];
  const r = await dados.desempenhoComercial(escolhido);
  const [a, m] = [+r.mes.slice(0, 4), +r.mes.slice(5, 7)];
  const [aa, ma] = [+r.anterior.mes.slice(0, 4), +r.anterior.mes.slice(5, 7)];
  const rotuloAnt = r.fechado ? nomeMesCap(aa, ma) : `${nomeMesCap(aa, ma)} até o dia ${r.anterior.corte.slice(8, 10)}`;
  const times = (ctx.unidade && r.admin) ? r.times.filter((t) => t.unidades.includes(ctx.unidade)) : r.times;

  el.innerHTML = `
    <div class="cartao"><div class="linha-acoes">
      <label class="campo">Mês<select class="ctrl" id="mes">${meses.map((x) => `<option value="${x}" ${x === escolhido ? 'selected' : ''}>${nomeMesCap(+x.slice(0, 4), +x.slice(5, 7))}</option>`).join('')}</select></label></div>
      <p class="dica" style="margin-top:8px">Conversão = dos cadastros de oportunidade que a consultora fez no mês, quantos viraram cliente no mesmo mês — não importa quem fechou a venda.
      Quem cadastrou no mês e fechou depois aparece como "conversão futura". Gympass, diária, convidado, permuta, Kids e VIP não contam.
      ${r.fechado ? '' : `Mês em andamento: a comparação é com ${esc(rotuloAnt)}.`}
      ${r.sincronizado_em ? `Dados da EVO atualizados em ${esc(dataHora(r.sincronizado_em))}.` : ''}</p></div>
    ${times.length ? times.map((t) => time(t, r, ctx, rotuloAnt)).join('') : `<div class="cartao">${vazio('Ainda não há cadastros lidos da EVO para este mês.')}</div>`}`;

  el.querySelector('#mes').onchange = (e) => { escolhido = e.target.value; render(el, ctx); };
}

function time(t, r, ctx, rotuloAnt) {
  const a = t.atual || {}, b = t.anterior || {};
  const s = resumoTime(t);
  const pessoas = avaliarTime(t);
  const padrao = taxaConsultoras(t);
  const pl = placarIa(t);
  const eu = !r.admin ? pessoas.find((p) => p.eu) : null;
  return `<div class="cartao">
    <h2>${esc(t.nome)}</h2>
    <div class="numeros" style="margin:12px 0">
      <div class="numero azul"><small>Oportunidades</small><b>${a.oportunidades ?? 0}</b><span>${seta(a.oportunidades, b.oportunidades)} vs ${b.oportunidades ?? 0}</span></div>
      <div class="numero verde"><small>Vendas no mês</small><b>${a.vendas ?? 0}</b><span>${seta(a.vendas, b.vendas)} vs ${b.vendas ?? 0}</span></div>
      <div class="numero escuro"><small>Conversão</small><b>${pctTxt(s.taxa)}</b><span>${seta(s.taxa, s.taxaAnt, { pontos: true })} vs ${pctTxt(s.taxaAnt)}</span></div>
      <div class="numero"><small>Vendas de outro mês</small><b>${a.outro_mes ?? 0}</b><span>cadastrou antes, fechou agora</span></div>
      <div class="numero"><small>Entrada (vendas + outro mês)</small><b>${s.entrada}</b><span>${seta(s.entrada, s.entradaAnt)} vs ${s.entradaAnt}</span></div>
      <div class="numero"><small>Tempo médio de fechamento</small><b>${a.tempo_medio == null ? '—' : `${num(a.tempo_medio)} d`}</b><span>${b.tempo_medio == null ? '' : `${seta(a.tempo_medio, b.tempo_medio, { pontos: true, invertido: true, unidade: ' d' })} vs ${num(b.tempo_medio)} d`}</span></div>
    </div>
    <p class="dica">Comparação com ${esc(rotuloAnt)}.${r.fechado && a.futuras ? ` ${a.futuras} cadastro(s) deste mês fecharam no mês seguinte (conversões futuras).` : ''}</p>
    ${quadroIa(pl)}
    ${eu ? quadroEu(eu, padrao) : ''}
    ${r.admin ? tabelaPessoas(pessoas, padrao, pl) : ''}
    ${semanas(t)}
  </div>`;
}

// Placar IA × consultoras: quem cadastrou (a IA ou as meninas) e quanto virou cliente
function quadroIa(pl) {
  if (!pl.ia.cadastros && !pl.iaAnt.cadastros) return '';
  const linha = (rot, x, ant) => `<tr><td class="nome">${rot}</td><td>${x.cadastros}</td><td>${x.vendas}</td><td><b>${pctTxt(x.taxa)}</b></td>
    <td>${ant.cadastros} cad. · ${pctTxt(ant.taxa)} ${seta(x.taxa, ant.taxa, { pontos: true })}</td></tr>`;
  return `<h3 style="margin:18px 0 8px">🤖 IA × consultoras — quem cadastrou e quanto virou cliente</h3>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Quem cadastrou</th><th>Cadastros</th><th>Viraram cliente</th><th>Conversão</th><th>Mês anterior</th></tr></thead><tbody>
    ${linha('IA (atendimento automático)', pl.ia, pl.iaAnt)}${linha('Consultoras', pl.consultoras, pl.consultorasAnt)}
    </tbody></table></div>
    <p class="dica">Cada cadastro da IA ganha uma dona para a carteira: quem vendeu a aula experimental; se não teve, quem fechou a venda; se não teve, quem recebeu o interessado nas listas da Central.${pl.semDono ? ` ${pl.semDono} cadastro(s) da IA ainda sem dona.` : ''}</p>`;
}

function quadroEu(p, padrao) {
  const [cor, rot] = SELO[p.status];
  return `<div class="faixa" style="display:block;margin:12px 0;background:#F4F7FB;border-color:#D8E1EC;color:var(--navy)">
    <b>Sua carteira: ${p.atual.cadastros} cadastro(s)${p.atual.da_ia ? ` (${p.atual.da_ia} vindos da IA)` : ''}, ${p.atual.vendas} viraram cliente — ${pctTxt(p.taxa)}</b>
    Consultoras da equipe: ${pctTxt(padrao)} · Seu mês anterior: ${pctTxt(p.taxaAnt)} ${p.tend ? `(${TEND[p.tend.tipo]})` : ''} · <span class="selo ${cor}">${rot}</span>
    <div style="margin-top:6px">${esc(p.diagnostico)}</div></div>`;
}

function tabelaPessoas(pessoas, padrao, pl) {
  if (!pessoas.length) return vazio('Nenhum cadastro na carteira das consultoras neste mês.');
  return `<h3 style="margin:18px 0 8px">Consultoras — conversão da carteira de cada uma</h3>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Consultora</th><th>Cadastrou</th><th>Da IA</th><th>Carteira</th><th>Viraram cliente</th><th>Conversão</th><th>Mês anterior</th><th>Tempo médio</th><th>Situação</th></tr></thead><tbody>
    ${pessoas.map((p) => {
      const [cor, rot] = SELO[p.status];
      return `<tr><td class="nome">${esc(p.nome)}${p.ativa ? '' : '<span class="sub">fora da equipe</span>'}</td>
        <td>${p.atual.cadastros - (p.atual.da_ia || 0)}</td><td>${p.atual.da_ia || 0}${p.atual.da_ia ? `<span class="sub">${p.atual.da_ia_vendas} ${p.atual.da_ia_vendas === 1 ? 'virou' : 'viraram'} cliente</span>` : ''}</td>
        <td><b>${p.atual.cadastros}</b></td><td>${p.atual.vendas}${p.atual.futuras ? `<span class="sub">+${p.atual.futuras} depois</span>` : ''}</td>
        <td><b>${pctTxt(p.taxa)}</b></td>
        <td>${pctTxt(p.taxaAnt)}${p.tend ? `<span class="sub">${TEND[p.tend.tipo]}</span>` : ''}</td>
        <td>${p.atual.tempo_medio == null ? '—' : `${num(p.atual.tempo_medio)} d`}</td>
        <td><span class="selo ${cor}">${rot}</span></td></tr>
        <tr><td colspan="9" class="dica" style="padding-top:0">💡 ${esc(p.diagnostico)}</td></tr>`;
    }).join('')}
    </tbody></table></div>
    <p class="dica">Carteira = o que ela cadastrou + os cadastros da IA de que ela é dona. Padrão = conversão das carteiras juntas (${pctTxt(padrao)}), com 10 pontos de folga para cima ou para baixo. Com menos de ${MIN_CADASTROS} cadastros no mês a % ainda não é avaliada.</p>`;
}

function semanas(t) {
  if (!t.semanas?.length) return '';
  const ant = t.semanas_anterior || [];
  return `<h3 style="margin:18px 0 8px">Semanas do mês</h3>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Semana</th><th>Oportunidades</th><th>Vendas</th><th>Conversão</th><th>Mesma semana do mês anterior</th></tr></thead><tbody>
    ${t.semanas.map((w) => {
      const x = ant.find((y) => y.n === w.n);
      return `<tr><td>${w.n}ª · ${dataCurta(w.ini)} a ${dataCurta(w.fim)}</td><td>${w.oportunidades}</td><td>${w.vendas}</td><td><b>${pctTxt(pct(w.vendas, w.oportunidades))}</b></td>
        <td>${x ? `${x.oportunidades} oport. · ${x.vendas} vendas · ${pctTxt(pct(x.vendas, x.oportunidades))}` : '—'}</td></tr>`;
    }).join('')}
    </tbody></table></div>`;
}
