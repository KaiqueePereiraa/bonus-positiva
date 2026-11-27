// Desempenho comercial — o "coordenador comercial": conversão da carteira de cada consultora (o que ela cadastrou + os
// contatos da IA que ela assumiu; não importa quem fechou), comparada entre as consultoras e com o mês anterior; o funil da
// IA à parte (a IA só cadastra e manda o pagamento — não é comparada com as meninas); números do time e as semanas do mês.
// Regra do antigo Dashboard Positiva: venda = cadastrou e converteu no mesmo mês. Dados lidos da EVO todo dia (evo-desempenho).
import * as dados from '../dados.js?v=20261127195208';
import { esc, vazio, nomeMesCap, dataCurta, dataHora } from '../ui.js?v=20261127195208';
import { pct, resumoTime, avaliarTime, variacao, taxaConsultoras, funilIa, alertaCarteiras, avaliarUnidades, avaliarCanais, MIN_CANAL, MIN_CADASTROS } from '../comercial-regras.js?v=20261127195208';

let escolhido = null;

const num = (v) => (v == null ? '—' : String(v).replace('.', ','));
const pctTxt = (v) => (v == null ? '—' : `${num(v)}%`);
function seta(atual, anterior, { pontos = false, invertido = false, unidade = null } = {}) {
  if (atual == null || anterior == null) return '';
  const d = pontos ? Math.round((atual - anterior) * 10) / 10 : variacao(atual, anterior);
  if (d == null || d === 0) return '<span class="dica">= igual</span>';
  const bom = invertido ? d < 0 : d > 0;
  return `<span style="color:${bom ? 'var(--texto-sucesso)' : 'var(--texto-perigo)'};font-weight:800">${d > 0 ? '▲' : '▼'} ${num(Math.abs(d))}${unidade || (pontos ? ' pts' : '%')}</span>`;
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
  const prof = null;   // 27/11/2026: experimentais por professor foram para Análises → Professores
  const [a, m] = [+r.mes.slice(0, 4), +r.mes.slice(5, 7)];
  const [aa, ma] = [+r.anterior.mes.slice(0, 4), +r.anterior.mes.slice(5, 7)];
  const rotuloAnt = r.fechado ? nomeMesCap(aa, ma) : `${nomeMesCap(aa, ma)} até o dia ${r.anterior.corte.slice(8, 10)}`;
  const times = (ctx.unidade && r.admin) ? r.times.filter((t) => t.unidades.includes(ctx.unidade)) : r.times;

  el.innerHTML = `
    <div class="cartao"><div class="linha-acoes">
      <label class="campo">Mês<select class="ctrl" id="mes">${meses.map((x) => `<option value="${x}" ${x === escolhido ? 'selected' : ''}>${nomeMesCap(+x.slice(0, 4), +x.slice(5, 7))}</option>`).join('')}</select></label></div>
      <p class="dica" style="margin-top:8px">Conversão da consultora = da carteira dela no mês (o que ela cadastrou + os contatos da IA que ela assumiu), quantos viraram cliente no mesmo mês — não importa quem fechou a venda.
      Quem cadastrou no mês e fechou depois aparece como "conversão futura". Não contam: contratos Gympass, diária, convidado, permuta, Kids e VIP, nem quem chegou por Gympass, TotalPass ou convênio ("Como conheceu" — lista em Configurações → Comercial e kanban).
      ${r.fechado ? '' : `Mês em andamento: a comparação é com ${esc(rotuloAnt)}.`}
      ${r.sincronizado_em ? `Dados da EVO atualizados em ${esc(dataHora(r.sincronizado_em))}.` : ''}</p></div>
    ${times.length ? times.map((t) => time(t, r, ctx, rotuloAnt, prof?.times?.find((x) => x.id === t.id))).join('') : `<div class="cartao">${vazio('Ainda não há cadastros lidos da EVO para este mês.')}</div>`}`;

  el.querySelector('#mes').onchange = (e) => { escolhido = e.target.value; render(el, ctx); };
}

function time(t, r, ctx, rotuloAnt, prof) {
  // Filtro de unidade (revisão 26/11, decisão do Kaique): os números da empresa obedecem à unidade escolhida; consultoras,
  // canais, funil da IA e semanas continuam da equipe junta (as meninas atendem nas unidades unidas), com aviso na tela.
  const daUnidade = ctx.unidade && t.por_unidade?.length > 1 ? t.por_unidade.find((u) => u.id === ctx.unidade) : null;
  const base = daUnidade ? { ...t, atual: daUnidade.atual, anterior: daUnidade.anterior } : t;
  const a = base.atual || {}, b = base.anterior || {};
  const s = resumoTime(base);
  const pessoas = avaliarTime(t);
  const padrao = taxaConsultoras(t);
  const fi = funilIa(daUnidade?.funil_ia ? { ...t, funil_ia: daUnidade.funil_ia } : t);   // funil da unidade escolhida (146)
  const alerta = r.admin ? alertaCarteiras(pessoas) : null;
  const eu = !r.admin ? pessoas.find((p) => p.eu) : null;
  const curto = (n) => String(n).replace('Positiva ', '').replace('Acqua ', '');
  // com uma unidade escolhida, canais e funil da IA são da unidade e ficam antes do bloco da equipe
  const canaisHtml = r.admin && (daUnidade?.canais ?? t.canais)?.length ? quadroCanais(daUnidade?.canais ?? t.canais, rotuloAnt) : '';
  const funilHtml = quadroFunilIa(fi, rotuloAnt);
  return `<div class="cartao">
    <h2>${esc(daUnidade ? curto(daUnidade.nome) : t.nome)}</h2>
    ${daUnidade ? `<p class="aviso-equipe">Números da empresa, canais e funil da IA: só ${esc(curto(daUnidade.nome))}. Consultoras e semanas: <b>equipe ${esc(t.nome)}</b> — as consultoras atendem nas unidades unidas.</p>` : ''}
    <div class="numeros" style="margin:12px 0">
      <div class="numero azul"><small>Oportunidades</small><b>${a.oportunidades ?? 0}</b><span>${seta(a.oportunidades, b.oportunidades)} vs ${b.oportunidades ?? 0}</span></div>
      <div class="numero verde"><small>Vendas no mês</small><b>${a.vendas ?? 0}</b><span>${seta(a.vendas, b.vendas)} vs ${b.vendas ?? 0}</span></div>
      <div class="numero escuro"><small>Conversão</small><b>${pctTxt(s.taxa)}</b><span>${seta(s.taxa, s.taxaAnt, { pontos: true })} vs ${pctTxt(s.taxaAnt)}</span></div>
      <div class="numero"><small>Vendas de outro mês</small><b>${a.outro_mes ?? 0}</b><span>cadastrou antes, fechou agora</span></div>
      <div class="numero"><small>Entrada (vendas + outro mês)</small><b>${s.entrada}</b><span>${seta(s.entrada, s.entradaAnt)} vs ${s.entradaAnt}</span></div>
      <div class="numero"><small>Tempo médio de fechamento</small><b>${a.tempo_medio == null ? '—' : `${num(a.tempo_medio)} d`}</b><span>${b.tempo_medio == null ? '' : `${seta(a.tempo_medio, b.tempo_medio, { pontos: true, invertido: true, unidade: ' d' })} vs ${num(b.tempo_medio)} d`}</span></div>
    </div>
    <p class="dica">Comparação com ${esc(rotuloAnt)}.${r.fechado && a.futuras ? ` ${a.futuras === 1 ? '1 cadastro deste mês fechou' : `${a.futuras} cadastros deste mês fecharam`} no mês seguinte (conversões futuras).` : ''}</p>
    ${r.admin && t.por_unidade?.length > 1 ? porUnidade(t, rotuloAnt) : ''}
    ${daUnidade ? `${canaisHtml}${funilHtml}<h3 class="titulo-equipe">Equipe ${esc(t.nome)}</h3>` : ''}
    ${alerta ? `<div class="faixa urgente" style="display:block;margin:12px 0"><b>⚠️ Conversão muito diferente entre as consultoras</b><div style="margin-top:4px">${esc(alerta.texto)}</div></div>` : ''}
    ${eu ? quadroEu(eu, padrao) : ''}
    ${r.admin ? tabelaPessoas(pessoas, padrao) : ''}
    ${daUnidade ? '' : `${canaisHtml}${funilHtml}`}
    ${r.admin ? '<p class="dica" style="margin-top:14px">Aula experimental e retenção por professor: <a href="#/analises/professores">Análises → Professores →</a></p>' : ''}
    ${semanas(t)}
  </div>`;
}

// Funil da IA: a etapa dela (cadastrar e mandar o pagamento) e o que a equipe fez com esses contatos. Sem comparar com as meninas.
function quadroFunilIa(fi, rotuloAnt) {
  const x = fi.atual, y = fi.anterior;
  if (!x.cadastros && !y.cadastros) return '';
  const etapa = (rot, n, p, pAnt, sub) => `<div class="numero"><small>${rot}</small><b>${n}</b><span>${p == null ? '' : `${num(p)}% dos cadastros`}${pAnt == null ? '' : ` · antes ${num(pAnt)}%`}${sub ? `<br>${sub}` : ''}</span></div>`;
  return `<h3 style="margin:18px 0 8px">🤖 Funil da IA — a etapa dela</h3>
    <p class="dica" style="margin-bottom:8px">A IA pega os dados, faz o cadastro e manda o pagamento; quem agenda a experimental e vende são as consultoras.
      Por isso a IA não é comparada com elas: as vendas desses contatos contam na carteira de quem assumiu.</p>
    <div class="numeros" style="margin:0 0 8px">
      <div class="numero azul"><small>Cadastros da IA</small><b>${x.cadastros}</b><span>${seta(x.cadastros, y.cadastros)} vs ${y.cadastros}</span></div>
      ${etapa('Assumidos por uma consultora', x.assumidos, x.pAssumidos, y.pAssumidos, x.semDona ? `<b style="color:var(--texto-perigo)">${x.semDona} sem dona</b>` : 'todos com dona')}
      ${etapa('Seguiram para a experimental', x.experimental, x.pExperimental, y.pExperimental)}
      ${etapa('Viraram cliente (pela equipe)', x.clientes, x.pClientes, y.pClientes)}
      <div class="numero"><small>Tempo até alguém assumir</small><b>${x.dias == null ? '—' : `${num(x.dias)} d`}</b><span>${x.comData ? `${x.noDia} de ${x.comData} no mesmo dia ou no seguinte` : 'sem data ainda'}${y.dias == null ? '' : ` · antes ${num(y.dias)} d`}</span></div>
    </div>
    <p class="dica">"Antes" = ${esc(rotuloAnt)}. Dona do contato da IA: quem mexeu nele no kanban da WasFit perto do cadastro; se não houver, quem vendeu a experimental; depois, quem fechou a venda; por último, quem recebeu o contato nas listas da Central.${x.peloKanban ? ` ${x.peloKanban} assumido(s) pelo kanban.` : ''}${x.semDona ? ` Contatos sem dona não entram na carteira de ninguém — vale distribuir.` : ''}</p>`;
}

// De onde vêm e o que converte mais ("Como conheceu" da EVO), só o gestor. No mês e nos últimos 3 meses (amostra maior).
function quadroCanais(lista, rotuloAnt) {
  const { canais, frase } = avaliarCanais(lista);
  const selo = (c) => (c.selo === 'melhor' ? '<span class="selo verde">▲ Converte mais</span>' : c.selo === 'pior' ? '<span class="selo laranja">▼ Converte menos</span>' : '');
  return `<h3 style="margin:18px 0 8px">De onde vêm e o que converte mais ("Como conheceu")</h3>
    ${frase ? `<p style="margin:0 0 8px">💡 ${esc(frase)}</p>` : ''}
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Como conheceu</th><th>Oportunidades no mês</th><th>Vendas no mês</th><th>Conversão no mês</th><th>Últimos 3 meses</th><th></th></tr></thead><tbody>
    ${canais.map((c) => `<tr${c.ia ? ' style="opacity:.75"' : ''}><td class="nome">${esc(c.canal)}</td>
      <td>${c.oportunidades}${c.parte != null ? `<span class="sub">${num(c.parte)}% do total</span>` : ''}</td>
      <td>${c.vendas}</td>
      <td><b>${pctTxt(c.taxa)}</b>${c.oportunidades_ant ? `<span class="sub">antes ${pctTxt(c.taxaAnt)}</span>` : ''}</td>
      <td>${c.oportunidades_3m} oport. · ${c.vendas_3m} vendas · <b>${pctTxt(c.taxa3)}</b></td>
      <td>${c.ia ? '<span class="dica">fora do ranking</span>' : selo(c)}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="dica">Grafias parecidas são juntadas (AMIGO, Amigo e AMIGO/FAMILIAR viram "Amigo / família"). Gympass, TotalPass e convênios não entram.
      O ranking usa os últimos 3 meses (cadastrou nos 3 meses e virou cliente até hoje), só com canais de ${MIN_CANAL}+ oportunidades.
      Os cadastros da IA ficam à parte: ela não registra o "Como conheceu". "Antes" = ${esc(rotuloAnt)}.</p>`;
}

// Unidades separadas (só o gestor): números da empresa de cada unidade, qual melhora, qual piora, qual precisa de atenção.
// A conversão das consultoras continua junta logo abaixo (elas atendem nas unidades unidas).
const SIT = { atencao: ['vermelho', '⚠️ Precisa de atenção'], piorando: ['laranja', '▼ Piorando'], melhorando: ['verde', '▲ Melhorando'], estavel: ['azul', '= Estável'] };
function porUnidade(t, rotuloAnt) {
  const us = avaliarUnidades(t.por_unidade);
  const linha = (u) => {
    const a = u.atual || {}, b = u.anterior || {};
    const [cor, rot] = SIT[u.situacao];
    return `<tr><td class="nome">${esc(String(u.nome).replace('Positiva ', '').replace('Acqua ', ''))}</td>
      <td>${a.oportunidades ?? 0}<span class="sub">${seta(a.oportunidades, b.oportunidades)} vs ${b.oportunidades ?? 0}</span></td>
      <td>${a.vendas ?? 0}<span class="sub">${seta(a.vendas, b.vendas)} vs ${b.vendas ?? 0}</span></td>
      <td><b>${pctTxt(u.taxa)}</b><span class="sub">${seta(u.taxa, u.taxaAnt, { pontos: true })} vs ${pctTxt(u.taxaAnt)}</span></td>
      <td>${a.outro_mes ?? 0}</td>
      <td>${u.entrada}<span class="sub">${seta(u.entrada, u.entradaAnt)} vs ${u.entradaAnt}</span></td>
      <td><span class="selo ${cor}">${rot}</span></td></tr>
      <tr><td colspan="7" class="dica" style="padding-top:0">💡 ${esc(u.diagnostico)}</td></tr>`;
  };
  return `<h3 style="margin:18px 0 8px">Por unidade — qual melhora, qual piora</h3>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Unidade</th><th>Oportunidades</th><th>Vendas no mês</th><th>Conversão</th><th>Vendas de outro mês</th><th>Entrada</th><th>Situação</th></tr></thead><tbody>
      ${us.map(linha).join('')}
    </tbody></table></div>
    <p class="dica">Cada unidade com os próprios cadastros (onde a oportunidade foi cadastrada na EVO), comparada com ${esc(rotuloAnt)}. A conversão das consultoras, abaixo, é da equipe junta.</p>`;
}

function quadroEu(p, padrao) {
  const [cor, rot] = SELO[p.status];
  return `<div class="faixa" style="display:block;margin:12px 0;background:#F4F7FB;border-color:#D8E1EC;color:var(--navy)">
    <b>Sua carteira: ${p.atual.cadastros === 1 ? '1 contato' : `${p.atual.cadastros} contatos`} — ${p.atual.cadastros - (p.atual.da_ia || 0)} que você cadastrou${p.atual.da_ia ? ` + ${p.atual.da_ia} da IA que você assumiu` : ''} · ${p.atual.vendas} viraram cliente — ${pctTxt(p.taxa)}</b>
    Consultoras da equipe: ${pctTxt(padrao)} · Seu mês anterior: ${pctTxt(p.taxaAnt)} ${p.tend ? `(${TEND[p.tend.tipo]})` : ''} · <span class="selo ${cor}">${rot}</span>
    <div style="margin-top:6px">${esc(p.diagnostico)}</div></div>`;
}

function tabelaPessoas(todas, padrao) {
  if (!todas.length) return vazio('Nenhum cadastro na carteira das consultoras neste mês.');
  // quem não tem carteira neste mês (ou saiu da equipe) fica recolhido embaixo — não some, só não disputa atenção
  const pessoas = todas.filter((p) => p.ativa !== false && p.atual.cadastros > 0);
  const outras = todas.filter((p) => !pessoas.includes(p));
  const cab = '<thead><tr><th>Consultora</th><th>Cadastrou</th><th>Assumiu da IA</th><th>Carteira</th><th>Viraram cliente</th><th>Conversão da carteira</th><th>Mês anterior</th><th>Tempo médio</th><th>Situação</th></tr></thead>';
  return `<h3 style="margin:18px 0 8px">Consultoras — conversão da carteira de cada uma</h3>
    <div class="tabela-wrap"><table class="tabela">${cab}<tbody>${linhasPessoas(pessoas)}</tbody></table></div>
    ${outras.length ? `<details class="como-ler"><summary>Sem carteira neste mês ou fora da equipe (${outras.length})</summary>
      <div class="tabela-wrap"><table class="tabela">${cab}<tbody>${linhasPessoas(outras)}</tbody></table></div></details>` : ''}
    <p class="dica">Carteira = o que ela cadastrou + os contatos da IA que ela assumiu. Padrão = conversão das carteiras de todas juntas (${pctTxt(padrao)}), com 10 pontos de folga para cima ou para baixo. Com menos de ${MIN_CADASTROS} cadastros no mês a % ainda não é avaliada.</p>`;
}

function linhasPessoas(pessoas) {
  return `${pessoas.map((p) => {
      const [cor, rot] = SELO[p.status];
      return `<tr><td class="nome">${esc(p.nome)}${p.ativa ? '' : '<span class="sub">fora da equipe</span>'}</td>
        <td>${p.atual.cadastros - (p.atual.da_ia || 0)}</td><td>${p.atual.da_ia || 0}${p.atual.da_ia ? `<span class="sub">${p.atual.da_ia_vendas} ${p.atual.da_ia_vendas === 1 ? 'virou' : 'viraram'} cliente</span>` : ''}</td>
        <td><b>${p.atual.cadastros}</b></td><td>${p.atual.vendas}${p.atual.futuras ? `<span class="sub">+${p.atual.futuras} depois</span>` : ''}</td>
        <td><b>${pctTxt(p.taxa)}</b></td>
        <td>${pctTxt(p.taxaAnt)}${p.tend ? `<span class="sub">${TEND[p.tend.tipo]}</span>` : ''}</td>
        <td>${p.atual.tempo_medio == null ? '—' : `${num(p.atual.tempo_medio)} d`}</td>
        <td><span class="selo ${cor}">${rot}</span></td></tr>
        <tr><td colspan="9" class="dica" style="padding-top:0">💡 ${esc(p.diagnostico)}</td></tr>`;
    }).join('')}`;
}

// Aulas experimentais por professor: quantos interessados fizeram a experimental com ele e quantos viraram cliente (até 30 dias)
function professores(p) {
  if (!p.professores?.length) return p.lido_desde ? '' : '<p class="dica">Experimentais por professor: carregando a agenda da EVO.</p>';
  return `<h3 style="margin:18px 0 8px">Experimentais por professor</h3>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Professor</th><th>Experimentais</th><th>Viraram cliente</th><th>Conversão</th><th>Mês anterior</th><th>Dias até fechar</th></tr></thead><tbody>
    ${p.professores.map((x) => {
      const taxa = pct(x.convertidas, x.experimentais), ant = x.anterior ? pct(x.anterior.convertidas, x.anterior.experimentais) : null;
      return `<tr><td class="nome">${esc(x.nome)}</td><td>${x.experimentais}</td><td>${x.convertidas}</td><td><b>${pctTxt(taxa)}</b></td>
        <td>${x.anterior ? `${x.anterior.experimentais} exp. · ${pctTxt(ant)}` : '—'}</td><td>${x.dias_ate_fechar == null ? '—' : `${num(x.dias_ate_fechar)} d`}</td></tr>`;
    }).join('')}
    </tbody></table></div>
    <p class="dica">Experimental = interessado inscrito numa aula experimental da agenda da EVO; virou cliente = matrícula em até 30 dias depois da aula. Agenda lida desde ${dataCurta(p.lido_desde)}.</p>`;
}

function semanas(t) {
  if (!t.semanas?.length) return '';
  const ant = t.semanas_anterior || [];
  return `<h3 style="margin:18px 0 8px">Semanas do mês</h3>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Semana</th><th>Oportunidades</th><th>Vendas</th><th>Conversão</th><th>Mesmos dias do mês anterior</th></tr></thead><tbody>
    ${t.semanas.map((w) => {
      const x = ant.find((y) => y.n === w.n);
      return `<tr><td>${w.n}ª · ${dataCurta(w.ini)} a ${dataCurta(w.fim)}</td><td>${w.oportunidades}</td><td>${w.vendas}</td><td><b>${pctTxt(pct(w.vendas, w.oportunidades))}</b></td>
        <td>${x ? `${dataCurta(x.ini)} a ${dataCurta(x.fim)}: ${x.oportunidades} oport. · ${x.vendas} vendas · <b>${pctTxt(pct(x.vendas, x.oportunidades))}</b>` : '—'}</td></tr>`;
    }).join('')}
    </tbody></table></div>`;
}
