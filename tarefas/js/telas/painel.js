// Painel do gestor — a tela que o gestor abre todo dia. Mostra só o que importa (gestão por exceção), em frases
// simples, cada uma com "o que fazer". Os números vêm prontos do banco (painel_gestor), sem dados de alunos.
import * as dados from '../dados.js?v=20261117105912';
import { esc, vazio } from '../ui.js?v=20261117105912';
import { sinais, atencao, quadrante, reais, mediana } from '../painel-regras.js?v=20261117105912';

export async function render(el, ctx) {
  const p = await dados.painelGestor();
  const unidades = (ctx.unidade ? p.unidades.filter((u) => u.id === ctx.unidade) : p.unidades);
  const ativas = unidades.filter((u) => u.consultoras.length);
  const hora = +new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date());
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const lista = atencao(p, unidades, hora);
  const cards = sinais(unidades);
  const todas = ativas.flatMap((u) => u.consultoras.map((c) => ({ ...c, unidade: u.nome })));

  el.innerHTML = `
    <div class="cartao"><h2 style="margin-bottom:4px">${saudacao}, ${esc((ctx.perfil.nome || '').split(' ')[0])}. Aqui está o que importa hoje.</h2>
      <p class="dica">${esc(ctx.unidade ? ctx.nomeUnidade(ctx.unidade) : 'Todas as unidades')} — troque no seletor do topo. Tudo abaixo é calculado sozinho com os dados da EVO e da Central.</p></div>

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

    ${quadroEsforco(todas)}

    <div class="grade">
      ${['semana', 'mes'].map((per) => {
        const t = somar(ativas, per);
        const ant = per === 'mes' ? somar(ativas, 'mes_anterior') : null;
        return `<div class="cartao"><h2>${per === 'semana' ? 'Resultados desta semana' : 'Resultados do mês'}</h2>
          <div class="linha-info"><b>💳 Pagaram depois da cobrança</b><span>${t.pagou}${t.valor ? ` · ${reais(t.valor)}` : ''}</span></div>
          <div class="linha-info"><b>🏊 Voltaram a treinar depois do contato</b><span>${t.voltou}</span></div>
          <div class="linha-info"><b>✍️ Viraram matrícula</b><span>${t.matriculou}</span></div>
          <div class="linha-info"><b>🤖 Resolveram sozinhos (saíram da lista)</b><span>${t.sozinhos}</span></div>
          ${ant ? `<p class="dica" style="margin-top:8px">Mês anterior: ${ant.pagou} pagaram (${reais(ant.valor)}) · ${ant.voltou} voltaram · ${ant.matriculou} matrículas.</p>` : ''}
        </div>`;
      }).join('')}
    </div>
    <p class="dica" style="text-align:center">Quanto a Central trouxe de volta no mês: <a href="#/retorno">abrir o Retorno do mês →</a></p>`;
}

function somar(unidades, per) {
  const t = { pagou: 0, valor: 0, voltou: 0, matriculou: 0, sozinhos: 0 };
  for (const u of unidades) for (const k of Object.keys(t)) t[k] += Number(u[per]?.[k]) || 0;
  return t;
}

// Esforço (contatos) × resultado (% que deu certo), comparando cada uma com a mediana da equipe
function quadroEsforco(todas) {
  const comDados = todas.filter((c) => c.decididos_30d >= 5);
  if (comDados.length < 2) {
    return `<div class="cartao"><h2>Esforço × resultado</h2><p class="dica">Aparece quando pelo menos duas consultoras tiverem 5 ou mais contatos com resultado conferido na EVO (cerca de 3 semanas depois de ligar a conferência automática).</p></div>`;
  }
  const medC = mediana(comDados.map((c) => c.contatos_30d));
  const medT = mediana(comDados.map((c) => c.positivos_30d / c.decididos_30d));
  return `<div class="cartao"><h2>Esforço × resultado <span class="selo cinza">últimos 30 dias</span></h2>
    <p class="dica" style="margin-bottom:12px">Comparado com a própria equipe (mediana: ${medC} contatos e ${Math.round(medT * 100)}% de resultado).</p>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Consultora</th><th>Como está</th><th>O que fazer</th></tr></thead><tbody>
    ${comDados.map((c) => { const q = quadrante(c, medC, medT); return `<tr><td class="nome">${esc(c.nome)}<span class="sub">${c.contatos_30d} contatos · ${Math.round(100 * c.positivos_30d / c.decididos_30d)}% de resultado</span></td>
      <td>${q.icone} <b>${esc(q.nome)}</b></td><td class="dica">${esc(q.acao)}</td></tr>`; }).join('')}
    </tbody></table></div></div>`;
}
