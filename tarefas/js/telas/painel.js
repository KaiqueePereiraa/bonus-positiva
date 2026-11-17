// Painel do gestor — a tela que o gestor abre todo dia. Mostra só o que importa (gestão por exceção), em frases
// simples, cada uma com "o que fazer". Os números vêm prontos do banco (painel_gestor), sem dados de alunos.
import * as dados from '../dados.js?v=20261117140556';
import { esc, vazio, barra, NOMES_CONTROLE, ROTA_CONTROLE } from '../ui.js?v=20261117140556';
import { somarDias, semanaDe } from '../regras.js?v=20261117140556';

// rotinas novas que começam desligadas e precisam ser simuladas antes de ligar
const ROTINAS_NOVAS = { renovacao: 'Renovação', vendas_dia: 'Vendas do dia', relacionamento: 'Relacionamento' };
import { sinais, atencao, quadrante, reais, mediana } from '../painel-regras.js?v=20261117140556';

export async function render(el, ctx) {
  const hojeIso = ctx.hoje();
  const [p, cfg, tarefas] = await Promise.all([dados.painelGestor(), dados.config().catch(() => ({})),
    dados.tarefas({ desde: somarDias(hojeIso, -21), unidade: ctx.unidade || undefined }).catch(() => [])]);
  const desligadas = Object.entries(ROTINAS_NOVAS).filter(([id]) => cfg[`evo_auto_${id}`] !== true).map(([, nome]) => nome);
  const unidades = (ctx.unidade ? p.unidades.filter((u) => u.id === ctx.unidade) : p.unidades);
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
      ${todas.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Consultora</th><th>Hoje</th><th>Atrasados</th><th>Contatos (30 dias)</th><th>Deu resultado (30 dias)</th></tr></thead><tbody>
        ${todas.map((c) => {
          const cor = !c.minimo ? 'cinza' : c.feitos_hoje >= c.minimo ? 'verde' : c.feitos_hoje * 2 >= c.minimo ? 'laranja' : 'vermelho';
          return `<tr><td class="nome">${esc(c.nome)}<span class="sub">${esc(c.unidade)}</span></td>
            <td><span class="selo ${cor}">${c.minimo ? `${c.feitos_hoje} de ${c.minimo}` : `${c.feitos_hoje} · sem mínimo`}</span></td>
            <td>${c.atrasados ? `<b style="color:var(--danger)">${c.atrasados}</b>` : '—'}</td>
            <td>${c.contatos_30d}</td>
            <td>${c.decididos_30d ? `${Math.round((100 * c.positivos_30d) / c.decididos_30d)}% <span class="sub">${c.positivos_30d} de ${c.decididos_30d}</span>` : '<span class="dica">aguardando</span>'}</td></tr>`;
        }).join('')}</tbody></table></div>` : vazio('Nenhuma consultora cadastrada nas unidades escolhidas.')}
    </div>

    ${listasDaSemana(tarefas, hojeIso)}

    ${quadroEsforco(todas)}

    <div class="grade">
      ${['semana', 'mes'].map((per) => {
        const t = somar(ativas, per);
        const ant = per === 'mes' ? somar(ativas, 'mes_anterior') : null;
        return `<div class="cartao"><h2>${per === 'semana' ? 'Resultados desta semana' : 'Resultados do mês'}</h2>
          <div class="linha-info"><b>💳 Pagaram depois da cobrança</b><span>${t.pagou}${t.valor ? ` · ${reais(t.valor)}` : ''}</span></div>
          <div class="linha-info"><b>🏊 Voltaram a treinar depois do contato</b><span>${t.voltou}</span></div>
          <div class="linha-info"><b>✍️ Viraram matrícula</b><span>${t.matriculou}</span></div>
          <div class="linha-info"><b>🔁 Renovaram o contrato</b><span>${t.renovou}</span></div>
          <div class="linha-info"><b>🤖 Resolveram sozinhos (saíram da lista)</b><span>${t.sozinhos}</span></div>
          ${ant ? `<p class="dica" style="margin-top:8px">Mês anterior: ${ant.pagou} pagaram (${reais(ant.valor)}) · ${ant.voltou} voltaram · ${ant.matriculou} matrículas.</p>` : ''}
        </div>`;
      }).join('')}
    </div>
    <p class="dica" style="text-align:center">Quanto a Central trouxe de volta no mês: <a href="#/retorno">abrir o Retorno do mês →</a></p>`;
}

function somar(unidades, per) {
  const t = { pagou: 0, valor: 0, voltou: 0, matriculou: 0, renovou: 0, sozinhos: 0 };
  for (const u of unidades) for (const k of Object.keys(t)) t[k] += Number(u[per]?.[k]) || 0;
  return t;
}

// Esforço (contatos) × resultado (% que deu certo), comparando cada uma com a mediana da equipe
function quadroEsforco(todas) {
  const comDados = todas.filter((c) => c.decididos_30d >= 5);
  if (comDados.length < 2) return '';   // aparece quando houver pelo menos 2 consultoras com 5+ contatos com resultado
  const medC = mediana(comDados.map((c) => c.contatos_30d));
  const medT = mediana(comDados.map((c) => c.positivos_30d / c.decididos_30d));
  return `<div class="cartao"><h2>Esforço × resultado <span class="selo cinza">últimos 30 dias</span></h2>
    <p class="dica" style="margin-bottom:12px">Comparado com a própria equipe (mediana: ${medC} contatos e ${Math.round(medT * 100)}% de resultado).</p>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Consultora</th><th>Como está</th><th>O que fazer</th></tr></thead><tbody>
    ${comDados.map((c) => { const q = quadrante(c, medC, medT); return `<tr><td class="nome">${esc(c.nome)}<span class="sub">${c.contatos_30d} contatos · ${Math.round(100 * c.positivos_30d / c.decididos_30d)}% de resultado</span></td>
      <td>${q.icone} <b>${esc(q.nome)}</b></td><td class="dica">${esc(q.acao)}</td></tr>`; }).join('')}
    </tbody></table></div></div>`;
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
