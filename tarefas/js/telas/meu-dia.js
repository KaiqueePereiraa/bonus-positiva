// Meu dia — a tela inicial da consultora: o que fazer hoje, na ordem certa. Um botão grande "Começar" abre a lista
// mais urgente; o mínimo de cada lista é o que falta ÷ dias úteis até o prazo. Para quem entra pela primeira vez,
// um guia de 3 passos (some depois de "Entendi").
import * as dados from '../dados.js?v=20261117214149';
import { esc, dataCurta, diaSemana, barra, NOMES_CONTROLE, ROTA_CONTROLE } from '../ui.js?v=20261117214149';
import { resumoSemana } from '../bonus-meta.js?v=20261117214149';

const CHAVE_GUIA = 'central_guia_meu_dia';
const guiaVisto = () => { try { return localStorage.getItem(CHAVE_GUIA) === '1'; } catch { return true; } };

export async function render(el, ctx) {
  // meta da semana do Bônus (só um resumo; o detalhe fica na área do Bônus)
  const temBonus = ctx.perfil.acesso_bonus && ctx.perfil.unidade;
  const [d, meta] = await Promise.all([dados.meuDia(), temBonus ? dados.minhaMetaSemana().catch(() => null) : null]);
  const minimo = d.listas.reduce((s, l) => s + l.minimo, 0);
  const feitos = d.feitos_hoje;
  const ok = minimo === 0 || feitos >= minimo;
  const sem = d.semana || {};
  // ordem: atrasadas, depois as que vencem hoje, depois as novas, depois pelo prazo
  const peso = (l) => (l.prazo < d.hoje ? 0 : l.prazo === d.hoje ? 1 : l.nova ? 2 : 3);
  const listas = [...d.listas].sort((a, b) => peso(a) - peso(b) || a.prazo.localeCompare(b.prazo));
  const primeira = listas.find((l) => l.faltam_agora > 0);
  // avisos que não são das listas (estas já aparecem abaixo): pedido de troca de escala e interessados sem responsável
  const urgentes = ctx.avisos().filter((a) => a.nivel !== 'info' && (a.id.startsWith('escala-') || a.id === 'nf-pool'));

  el.innerHTML = `
    ${urgentes.map((a) => `<div class="faixa ${a.nivel === 'urgente' ? 'urgente' : ''}"><div>${esc(a.texto)} <a href="${a.rota}">Abrir →</a></div></div>`).join('')}

    ${guiaVisto() ? '' : `<div class="cartao guia"><h2>Primeira vez aqui? É simples</h2>
      <ol>
        <li>Toque no botão verde <b>Começar</b>: ele abre a lista mais urgente.</li>
        <li>Em cada pessoa, toque em <b>WhatsApp</b>: a mensagem já vai pronta e o contato fica marcado sozinho.</li>
        <li>Faça pelo menos o <b>mínimo do dia</b> (o número abaixo). Se não der, no dia seguinte a Central pergunta o que aconteceu.</li>
      </ol>
      <div class="linha-acoes" style="margin-top:12px"><button class="btn sec peq" id="guia-ok">Entendi</button></div></div>`}

    <div class="cartao"><h2>Olá, ${esc((ctx.perfil.nome || '').split(' ')[0])}! ${ok ? '🎉' : '💪'}</h2>
      ${minimo ? `<p style="font-size:17px;margin:6px 0 10px">Hoje: <b>${feitos} de ${minimo}</b> contatos${ok ? ' — meta do dia batida!' : ` — faltam <b>${minimo - feitos}</b>.`}</p>
        ${barra(Math.min(feitos, minimo), minimo)}` : '<p style="font-size:16px">Nada pendente hoje. Bom trabalho! 🎉</p>'}
      ${primeira ? `<div style="margin-top:16px"><a class="btn verde grande" href="#/${ROTA_CONTROLE[primeira.controle_id]}/${primeira.tarefa_id}">Começar: ${esc(NOMES_CONTROLE[primeira.controle_id] || '')} →</a></div>` : ''}
      ${sem.dias ? `<p class="dica" style="margin-top:12px">Nesta semana: mínimo batido em ${sem.bateu} de ${sem.dias} dia(s).</p>` : ''}
    </div>

    ${cartaoMeta(meta, d.hoje, ctx.perfil.unidade)}

    ${listas.length ? `<div class="cartao"><h2>Suas listas de hoje</h2>
      <div class="tabela-wrap"><table class="tabela responsiva"><thead><tr><th>Lista</th><th>Faltam</th><th>Prazo</th><th>Hoje, no mínimo</th><th></th></tr></thead><tbody>
      ${listas.map((l) => {
        const atrasada = l.prazo < d.hoje;
        return `<tr><td class="nome">${l.nova ? '🆕 ' : ''}${esc(NOMES_CONTROLE[l.controle_id] || l.controle_id)}
            <span class="sub">${atrasada ? `<span class="selo vermelho">atrasada desde ${dataCurta(l.prazo)}</span>` : l.prazo === d.hoje ? '<span class="selo laranja">último dia hoje</span>' : `prazo ${diaSemana(l.prazo)} ${dataCurta(l.prazo)}`} · faltam ${l.faltam_agora}</span></td>
          <td class="oculta-cel">${l.faltam_agora}</td>
          <td class="oculta-cel">${atrasada ? 'atrasada' : l.prazo === d.hoje ? 'hoje' : `${diaSemana(l.prazo)} ${dataCurta(l.prazo)}`}</td>
          <td class="oculta-cel"><b>${l.minimo}</b></td>
          <td class="acoes"><a class="btn peq" href="#/${ROTA_CONTROLE[l.controle_id]}/${l.tarefa_id}">Abrir</a></td></tr>`;
      }).join('')}</tbody></table></div>
      <p class="dica" style="margin-top:8px">O mínimo de hoje é o que falta dividido pelos dias úteis até o prazo. Um pouco por dia rende mais que tudo no último dia.</p></div>` : ''}

    ${d.lista_fazer ? `<div class="cartao"><div class="linha-info"><b>📋 Lista a fazer</b><span>${d.lista_fazer} pendente(s) · <a href="#/lista-fazer">abrir</a></span></div></div>` : ''}
    <p class="dica" style="text-align:center"><a href="#/minhas-tarefas">Ver todas as minhas tarefas →</a></p>`;

  el.querySelector('#guia-ok')?.addEventListener('click', () => {
    try { localStorage.setItem(CHAVE_GUIA, '1'); } catch { /* sem armazenamento */ }
    el.querySelector('.guia').remove();
  });
}

// Resumo da meta da semana do Bônus: contratos "de meta" dela na semana (mês dividido em 4, como no Bônus)
function cartaoMeta(meta, hoje, unidade) {
  if (!meta || !meta.publicado_em) return '';
  const r = resumoSemana(meta.vendas || [], hoje, unidade);
  const cor = r.faixa === 'Abaixo do básico' ? 'laranja' : 'verde';
  return `<div class="cartao"><div class="linha-info"><b>🎯 Meta da semana ${r.semana} (${dataCurta(r.ini)} a ${dataCurta(r.fim)})</b>
      <span><span class="selo ${cor}">${r.feitos} ${r.feitos === 1 ? 'contrato' : 'contratos'} · ${esc(r.faixa)}</span></span></div>
    <p class="dica" style="margin-top:6px">${r.proxima ? `Faltam <b>${r.proxima.faltam}</b> para ${esc(r.proxima.nome === 'Básico' ? 'o Básico' : `a ${r.proxima.nome}`)}.` : 'Super meta batida! 🎉'}
      Atualizado de madrugada pela EVO. <a href="../bonus/index.html">Ver detalhes no Bônus →</a></p></div>`;
}
