// Painel do gestor — a tela que o gestor abre todo dia. Mostra só o que acontece HOJE e pede ação (gestão por
// exceção), em frases simples, cada uma com "o que fazer". Comparações de 30 dias ficam em Desempenho; o que cada
// lista trouxe fica em Resultados; o retorno em R$, em Relatórios → Retorno do mês.
import * as dados from '../dados.js?v=20261118223121';
import { esc, vazio, barra, dataHora, NOMES_CONTROLE, ROTA_CONTROLE } from '../ui.js?v=20261118223121';
import { somarDias, semanaDe } from '../regras.js?v=20261118223121';

// rotinas novas que começam desligadas e precisam ser simuladas antes de ligar
const ROTINAS_NOVAS = { renovacao: 'Renovação', relacionamento: 'Relacionamento' };
import { sinais, atencao, reais } from '../painel-regras.js?v=20261118223121';

export async function render(el, ctx) {
  const hojeIso = ctx.hoje();
  const seg = semanaDe(hojeIso).inicio;
  const [p, cfg, tarefas, hojeContatos, semana] = await Promise.all([dados.painelGestor(), dados.config().catch(() => ({})),
    dados.tarefas({ desde: somarDias(hojeIso, -21), unidade: ctx.unidade || undefined }).catch(() => []),
    dados.contatosHoje(hojeIso).catch(() => ({})),
    hojeIso > seg ? dados.desempenho(seg, somarDias(hojeIso, -1)).catch(() => []) : Promise.resolve([])]);
  const pendentes = pendentesPorConsultora(tarefas, hojeIso);
  const semanaDe_ = Object.fromEntries(semana.map((c) => [c.id, c]));
  const desligadas = Object.entries(ROTINAS_NOVAS).filter(([id]) => cfg[`evo_auto_${id}`] !== true).map(([, nome]) => nome);
  const ativaDe = (id) => ctx.unidades.find((x) => x.id === id)?.automacao_ativa;
  const unidades = (ctx.unidade ? p.unidades.filter((u) => u.id === ctx.unidade) : p.unidades).map((u) => ({ ...u, automacao_ativa: ativaDe(u.id) }));
  const ativas = unidades.filter((u) => u.consultoras.length);
  const hora = +new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date());
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const lista = atencao(p, unidades, hora, desligadas);
  const cards = sinais(unidades);
  const todas = ativas.flatMap((u) => u.consultoras.map((c) => ({ ...c, unidade: u.nome })));

  el.innerHTML = `
    <h2 style="font-size:18px;font-weight:800">${saudacao}, ${esc((ctx.perfil.nome || '').split(' ')[0])}! <span class="dica" style="font-weight:600">${esc(ctx.unidade ? ctx.nomeUnidade(ctx.unidade) : 'Todas as unidades')}</span></h2>

    <div class="sinais">${cards.map((s) => `<div class="sinal ${s.cor}">
      <small>${esc(s.area)}</small><b>${esc(s.titulo)}</b><p>${esc(s.texto)}</p>${s.acao ? `<span class="acao">O que fazer: ${esc(s.acao)}</span>` : ''}</div>`).join('')}</div>

    <div class="cartao"><h2>Precisa da sua atenção ${lista.length ? `<span class="selo vermelho">${lista.length}</span>` : '<span class="selo verde">tudo em dia</span>'}</h2>
      ${lista.length ? `<ul class="lista-atencao">${lista.map((a) => `<li><b>${esc(a.texto)}</b>${a.acao ? `<span>${esc(a.acao)}</span>` : ''}${a.rota ? ` <a href="${a.rota}">Abrir →</a>` : ''}</li>`).join('')}</ul>`
        : '<p class="dica">Nada fora do normal agora. 🎉</p>'}</div>

    <div class="cartao"><h2>Equipe hoje</h2>
      ${todas.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Consultora</th><th>Hoje</th><th>Pendentes</th><th>Atrasados</th><th>Último contato</th><th>Semana</th></tr></thead><tbody>
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
            <td>${sem?.pct != null ? `${sem.pct}% <span class="sub">meta em ${sem.dias_bateu} de ${sem.dias} dia(s)</span>` : '<span class="dica">—</span>'}</td></tr>`;
        }).join('')}</tbody></table></div>
        <p class="dica" style="margin-top:8px">Pendentes = contatos em aberto em todas as listas dela. "Livre" = zerou as listas: dá para passar uma Lista a fazer. Semana = mínimo cumprido nos dias já fechados desta semana. Comparação de 30 dias: <a href="#/desempenho">Desempenho →</a></p>` : vazio('Nenhuma consultora cadastrada nas unidades escolhidas.')}
    </div>

    ${listasDaSemana(tarefas, hojeIso)}

    ${(() => { const t = somar(ativas, 'semana'); return `<p class="dica" style="text-align:center">Nesta semana: ${t.pagou} pagaram${t.valor ? ` (${reais(t.valor)})` : ''} · ${t.voltou} voltaram a treinar · ${t.matriculou} matrículas · ${t.renovou} renovações.
      <a href="#/indicadores">Resultados →</a> · <a href="#/retorno">Retorno do mês →</a></p>`; })()}`;
}

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
