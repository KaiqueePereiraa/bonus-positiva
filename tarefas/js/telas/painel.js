// Painel do gestor — a página única que o gestor abre todo dia (26/11/2026): o que pede ação (listas, comercial e kanban
// juntos, cada item com "o que fazer"), como está o mês por unidade e a equipe numa tabela só (contatos de hoje, carteira
// do mês e kanban). O detalhe de cada assunto fica em Análises (abas Comercial, Kanban, Contatos da equipe, Resultados).
import * as dados from '../dados.js?v=20261127132907';
import { esc, vazio, barra, dataHora, NOMES_CONTROLE, ROTA_CONTROLE } from '../ui.js?v=20261127132907';
import { somarDias, semanaDe } from '../regras.js?v=20261127132907';

// rotinas novas que começam desligadas e precisam ser simuladas antes de ligar
const ROTINAS_NOVAS = { renovacao: 'Renovação', relacionamento: 'Relacionamento' };
import { sinais, atencao, reais } from '../painel-regras.js?v=20261127132907';
import { listaVitorias, ligarPalmas, faltaAplaudir } from './_vitorias.js?v=20261127132907';
import { itensComercial, linhasMes, carteiraDe, kanbanDe, linhasSaldo } from '../painel-comercial.js?v=20261127132907';
import { cartaoAnaliseSemanal } from './_analise-semanal.js?v=20261127132907';

export async function render(el, ctx) {
  const hojeIso = ctx.hoje();
  const seg = semanaDe(hojeIso).inicio;
  const [p, cfg, tarefas, hojeContatos, semana, todasVitorias, com, kb] = await Promise.all([dados.painelGestor(), dados.config().catch(() => ({})),
    dados.tarefas({ desde: somarDias(hojeIso, -21), unidade: ctx.unidade || undefined }).catch(() => []),
    dados.contatosHoje(hojeIso).catch(() => ({})),
    hojeIso > seg ? dados.desempenho(seg, somarDias(hojeIso, -1)).catch(() => []) : Promise.resolve([]),
    dados.vitoriasEquipe(7).catch(() => []),
    dados.desempenhoComercial(`${hojeIso.slice(0, 8)}01`).catch(() => null), dados.kanbanWasfit().catch(() => null)]);
  const analiseSemana = await cartaoAnaliseSemanal(ctx).catch(() => '');
  const ini3 = (() => { const d = new Date(`${hojeIso.slice(0, 7)}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 3); return d.toISOString().slice(0, 10); })();
  const saldo = linhasSaldo(await dados.saldoMes(ini3).catch(() => []), ctx.unidade, hojeIso);   // leitura da IA de segunda (some quando não há)
  const vitorias = ctx.unidade ? todasVitorias.filter((v) => v.unidade === ctx.unidade) : todasVitorias;
  const pendentes = pendentesPorConsultora(tarefas, hojeIso);
  const semanaDe_ = Object.fromEntries(semana.map((c) => [c.id, c]));
  const desligadas = Object.entries(ROTINAS_NOVAS).filter(([id]) => cfg[`evo_auto_${id}`] !== true).map(([, nome]) => nome);
  const ativaDe = (id) => ctx.unidades.find((x) => x.id === id)?.automacao_ativa;
  const unidades = (ctx.unidade ? p.unidades.filter((u) => u.id === ctx.unidade) : p.unidades).map((u) => ({ ...u, automacao_ativa: ativaDe(u.id) }));
  const ativas = unidades.filter((u) => u.consultoras.length);
  const hora = +new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date());
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const lista = [...atencao(p, unidades, hora, desligadas, ctx.ehSuper), ...itensComercial(com, kb, ctx.unidade)];
  const mes = linhasMes(com, ctx.unidade);
  const SIT = { atencao: ['vermelho', '⚠️ Precisa de atenção'], piorando: ['laranja', '▼ Piorando'], melhorando: ['verde', '▲ Melhorando'], estavel: ['azul', '= Estável'] };
  const SEL = { acima: ['verde', 'acima'], dentro: ['azul', 'no padrão'], abaixo: ['vermelho', 'abaixo'], poucos: ['cinza', 'poucos'] };
  const pc = (v) => (v == null ? '—' : `${String(v).replace('.', ',')}%`);
  const cards = sinais(unidades);
  const todas = ativas.flatMap((u) => u.consultoras.map((c) => ({ ...c, unidade: u.nome })));

  el.innerHTML = `
    <h2 style="font-size:18px;font-weight:800">${saudacao}, ${esc((ctx.perfil.nome || '').split(' ')[0])}! <span class="dica" style="font-weight:600">${esc(ctx.unidade ? ctx.nomeUnidade(ctx.unidade) : 'Todas as unidades')}</span></h2>

    <div class="sinais">${cards.map((s) => `<a class="sinal ${s.cor}" href="${s.rota}">
      <small>${esc(s.area)}</small><b>${esc(s.titulo)}</b><p>${esc(s.texto)}</p>${s.acao ? `<span class="acao">O que fazer: ${esc(s.acao)}</span>` : ''}<span class="ir">Ver o andamento da equipe →</span></a>`).join('')}</div>

    <div class="cartao"><h2>Precisa da sua atenção ${lista.length ? `<span class="selo vermelho">${lista.length}</span>` : '<span class="selo verde">tudo em dia</span>'}</h2>
      ${lista.length ? `<ul class="lista-atencao">${lista.map((a) => `<li><b>${esc(a.texto)}</b>${a.acao ? `<span>${esc(a.acao)}</span>` : ''}${a.rota ? ` <a href="${a.rota}">Abrir →</a>` : ''}${a.verComo ? ` <button class="btn sec peq" data-ver-como="${a.verComo}">👁 Ver a tela dela</button>` : ''}</li>`).join('')}</ul>`
        : '<p class="dica">Nada fora do normal agora. 🎉</p>'}</div>

    ${analiseSemana}

    ${mes.length ? `<div class="cartao"><h2>Como está o mês <span class="selo cinza">vs mês anterior até o mesmo dia</span></h2>
      <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Unidade</th><th>Oportunidades</th><th>Vendas</th><th>Conversão</th><th>Situação</th></tr></thead><tbody>
      ${mes.map((u) => { const [cor, rot] = SIT[u.situacao]; return `<tr><td class="nome">${esc(u.nome)}</td>
        <td>${u.atual?.oportunidades ?? 0}<span class="sub">antes ${u.anterior?.oportunidades ?? 0}</span></td>
        <td>${u.atual?.vendas ?? 0}<span class="sub">antes ${u.anterior?.vendas ?? 0}</span></td>
        <td><b>${pc(u.taxa)}</b><span class="sub">antes ${pc(u.taxaAnt)}</span></td>
        <td><span class="selo ${cor}">${rot}</span><span class="sub">${esc(u.diagnostico)}</span></td></tr>`; }).join('')}
      </tbody></table></div>
      <p class="dica" style="margin-top:8px">Venda = cadastrou e virou cliente no mês. Detalhe por consultora, canais e funil da IA: <a href="#/analises/comercial">Análises → Comercial</a></p></div>` : ''}

    ${saldo.length ? quadroSaldo(saldo, ctx) : ''}

    <div class="cartao"><h2>Equipe hoje</h2>
      ${todas.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Consultora</th><th>Hoje</th><th>Pendentes</th><th>Atrasados</th><th>Último contato</th><th>Semana</th><th>Carteira do mês</th><th>Kanban</th><th></th></tr></thead><tbody>
        ${todas.map((c) => {
          const cor = !c.minimo ? 'cinza' : c.feitos_hoje >= c.minimo ? 'verde' : c.feitos_hoje * 2 >= c.minimo ? 'laranja' : 'vermelho';
          const pend = pendentes[c.id] || 0;
          const ult = hojeContatos[c.id]?.ultimo;
          const sem = semanaDe_[c.id];
          return `<tr><td class="nome">${esc(c.nome)}<span class="sub">${esc(c.unidade)}</span></td>
            <td><span class="selo ${cor}">${c.minimo ? `${c.feitos_hoje} de ${c.minimo}` : `${c.feitos_hoje} · sem mínimo`}</span></td>
            <td>${pend ? pend : '<span class="selo azul" title="Não tem nada pendente: tem tempo para uma lista extra">livre</span>'}</td>
            <td>${c.atrasados ? `<b style="color:var(--danger)">${c.atrasados}</b>` : '—'}</td>
            <td>${ult ? dataHora(ult).slice(-5) : '<span class="dica">nenhum hoje</span>'}</td>
            <td>${sem?.pct != null ? `${sem.pct}% <span class="sub">mínimo em ${sem.dias_bateu} de ${sem.dias === 1 ? '1 dia' : `${sem.dias} dias`}</span>` : '<span class="dica">—</span>'}</td>
            ${(() => { const ca = carteiraDe(com, c.nome); return `<td>${ca ? `<b>${pc(ca.taxa)}</b> <span class="selo ${SEL[ca.status][0]}">${SEL[ca.status][1]}</span><span class="sub">${ca.vendas} de ${ca.contatos} viraram cliente</span>` : '<span class="dica">—</span>'}</td>`; })()}
            ${(() => { const k = kanbanDe(kb, c.nome); return `<td>${k ? `${k.critico ? `<span class="selo vermelho">${k.critico} crít.</span> ` : ''}${k.atrasado ? `<span class="selo laranja">${k.atrasado} atras.</span> ` : ''}<span class="sub">${k.contatos} no kanban</span>` : '<span class="dica">—</span>'}</td>`; })()}
            <td class="acoes"><button class="btn sec peq" data-ver-como="${c.id}" title="Ver a Central como ${esc(c.nome)} vê (só para olhar)">👁 Ver tela</button></td></tr>`;
        }).join('')}</tbody></table></div>
        <details class="como-ler"><summary>Como ler esta tabela</summary><p class="dica">Pendentes = contatos em aberto em todas as listas dela. "Livre" = zerou as listas: dá para passar uma Lista a fazer. Semana = mínimo cumprido nos dias já fechados desta semana. Carteira do mês = o que ela cadastrou + o que assumiu da IA, quantos viraram cliente (comparado com a equipe). Kanban = contatos dela na WasFit, críticos e atrasados.</p></details>
          <p class="dica" style="margin-top:8px">Mais detalhes: <a href="#/analises/equipe">Contatos da equipe</a> · <a href="#/analises/comercial">Comercial</a> · <a href="#/analises/kanban">Kanban</a></p>` : vazio('Nenhuma consultora cadastrada nas unidades escolhidas.')}
    </div>

    <div class="cartao" id="vitorias"><h2>🎉 Vitórias da equipe <span class="selo cinza">últimos 7 dias</span>${vitorias.length ? `<span class="selo verde">${vitorias.length} resultados</span>` : ''}${faltaAplaudir(vitorias, ctx.perfil.id) ? `<span class="selo laranja">${faltaAplaudir(vitorias, ctx.perfil.id)} para aplaudir</span>` : ''}</h2>
      <p class="dica" style="margin-bottom:8px">Uma linha por consultora por dia (a EVO confere os resultados de madrugada). Um 👏 vale para todos os resultados do dia dela; ele chega para a consultora como "${esc((ctx.perfil.nome || '').split(' ')[0])} te aplaudiu" — reconhecimento do coordenador pesa mais que qualquer medalha.</p>
      ${listaVitorias(vitorias, ctx.perfil.id)}</div>

    ${listasDaSemana(tarefas, hojeIso)}

    ${(() => { const t = somar(ativas, 'semana'); return `<p class="dica" style="text-align:center">Nesta semana: ${plural(t.pagou, 'pagou', 'pagaram')}${t.valor ? ` (${reais(t.valor)})` : ''} · ${plural(t.voltou, 'voltou', 'voltaram')} a treinar · ${plural(t.matriculou, 'matrícula', 'matrículas')} · ${plural(t.renovou, 'renovação', 'renovações')}.
      <a href="#/analises/resultados">Resultados →</a> · <a href="#/analises/retorno">Retorno em R$ →</a></p>`; })()}`;
  const caixaVit = el.querySelector('#vitorias');
  if (caixaVit) ligarPalmas(caixaVit, vitorias, ctx.perfil.id);
  // "👁 Ver tela": entra no modo ver como consultora (mesma chave do app.js; só nesta aba)
  el.querySelectorAll('[data-ver-como]').forEach((b) => b.addEventListener('click', () => {
    try { sessionStorage.setItem('central_ver_como', b.dataset.verComo); } catch { return; }
    history.replaceState(null, '', '#/meu-dia');
    location.reload();
  }));
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function somar(unidades, per) {
  const t = { pagou: 0, valor: 0, voltou: 0, matriculou: 0, renovou: 0, sozinhos: 0 };
  for (const u of unidades) for (const k of Object.keys(t)) t[k] += Number(u[per]?.[k]) || 0;
  return t;
}

// Contatos em aberto de cada consultora, somando todas as listas abertas (confirmações de aula que já passou não contam)
function pendentesPorConsultora(tarefas, hoje) {
  const por = {};
  for (const t of tarefas) {
    if (String(t.status).startsWith('concluida') || (t.controle_id === 'experimental_confirmar' && t.prazo < hoje)) continue;
    por[t.responsavel_id] = (por[t.responsavel_id] || 0) + Math.max(0, (t.total || 0) - (t.feitos || 0));
  }
  return por;
}

// Andamento de cada lista: as abertas e as que venceram nesta semana, somando todas as consultoras
function listasDaSemana(tarefas, hoje) {
  const seg = semanaDe(hoje).inicio;
  const por = new Map();
  for (const t of tarefas) {
    if (t.controle_id === 'experimental_confirmar' && t.prazo < hoje) continue;   // a aula já passou
    const aberta = !String(t.status).startsWith('concluida');
    if (!aberta && t.prazo < seg) continue;
    const x = por.get(t.controle_id) ?? { feitos: 0, total: 0, atrasadas: 0, prazo: t.prazo };
    x.feitos += t.feitos; x.total += t.total; x.atrasadas += t.status === 'atrasada' ? t.total - t.feitos : 0;
    if (aberta && t.prazo < x.prazo) x.prazo = t.prazo;
    por.set(t.controle_id, x);
  }
  const linhas = [...por].filter(([, x]) => x.total).sort((a, b) => (b[1].total - b[1].feitos) - (a[1].total - a[1].feitos));
  if (!linhas.length) return '';
  return `<div class="cartao"><h2>Listas desta semana</h2>
    <div class="tabela-wrap"><table class="tabela responsiva"><thead><tr><th>Lista</th><th>Andamento da equipe</th><th>Atrasados</th><th></th></tr></thead><tbody>
    ${linhas.map(([c, x]) => `<tr><td class="nome">${esc(NOMES_CONTROLE[c] || c)}<span class="sub">${x.total - x.feitos ? `faltam ${x.total - x.feitos}` : 'tudo feito ✓'}</span></td>
      <td style="min-width:220px"><div class="progresso">${barra(x.feitos, x.total)}</div></td>
      <td class="oculta-cel">${x.atrasadas ? `<b style="color:var(--danger)">${x.atrasadas}</b>` : '—'}</td>
      <td class="acoes"><a class="btn sec peq" href="#/${ROTA_CONTROLE[c]}">Abrir</a></td></tr>`).join('')}
    </tbody></table></div></div>`;
}

// Entradas × saídas de alunos (EVO, pessoas): este mês até hoje e o saldo dos 3 meses fechados
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function quadroSaldo(linhas, ctx) {
  const sinal = (n) => (n == null ? '—' : n > 0 ? `+${n}` : String(n));
  const cor = (n) => (n == null ? '' : n < 0 ? 'vermelho' : n > 0 ? 'verde' : 'cinza');
  const meses = [...new Set(linhas.flatMap((l) => l.antes.map((a) => a.mes)))].sort().reverse().slice(0, 3);
  return `<div class="cartao"><h2>Entradas × saídas de alunos <span class="selo cinza">EVO · pessoas</span></h2>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Unidade</th><th>Entraram este mês</th><th>Saíram este mês</th><th>Saldo do mês</th>${meses.map((m) => `<th>${MESES_CURTOS[+m.slice(5, 7) - 1]}</th>`).join('')}</tr></thead><tbody>
    ${linhas.map((l) => `<tr><td class="nome">${esc(ctx.nomeUnidade(l.unidade).replace('Positiva ', '').replace('Acqua ', ''))}${l.aviso ? `<span class="sub">⚠️ ${esc(l.aviso)}</span>` : ''}</td>
      <td>${l.atual ? `<b>${l.atual.entradas}</b><span class="sub">${l.atual.matriculas} matrículas · ${l.atual.rematriculas} rematrículas</span>` : '—'}</td>
      <td>${l.atual ? `<b>${l.atual.saidas}</b><span class="sub">${l.atual.cancelados} cancelaram · ${l.atual.vencidos} venceram sem renovar</span>` : '—'}</td>
      <td>${l.atual ? `<span class="selo ${cor(l.saldo)}">${sinal(l.saldo)}</span>` : '—'}</td>
      ${meses.map((m) => { const a = l.antes.find((x) => x.mes === m); return `<td>${a ? `<span class="selo ${cor(a.saldo)}">${sinal(a.saldo)}</span><span class="sub">${a.entradas} entraram · ${a.saidas} saíram</span>` : '—'}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div>
    <details class="como-ler"><summary>Como é contado</summary><p class="dica">Conta pessoas, lidas da EVO todo dia cedo. Saiu = cancelou ou o contrato venceu sem renovar e ela não voltou em até 15 dias depois do fim do mês (troca de plano e transferência não contam). Entrou = matrícula ou rematrícula vendida no mês (renovação não conta). Ficam fora Gympass, TotalPass, convênios, diária, Kids, VIP e semelhantes. No mês atual, quem venceu e ainda vai renovar conta como saída até renovar.</p></details></div>`;
}
