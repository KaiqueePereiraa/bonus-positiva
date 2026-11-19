// Meu dia — a tela inicial da consultora: o que fazer hoje, na ordem certa. Um botão grande "Começar" abre a lista
// mais urgente; o mínimo de cada lista é o que falta ÷ dias úteis até o prazo. Para quem entra pela primeira vez,
// um guia de 4 passos (some depois de "Entendi").
import * as dados from '../dados.js?v=20261118222102';
import { esc, dataCurta, diaSemana, barra, NOMES_CONTROLE, ROTA_CONTROLE } from '../ui.js?v=20261118222102';
import { resumoSemana, painelMeta } from '../bonus-meta.js?v=20261118222102';
import { pendentesAtePrazo, recadoMinimo } from '../regras.js?v=20261118222102';
import { titulo as tituloTarefa } from './minhas-tarefas.js?v=20261118222102';
import { anel, sequencia, trilhaSemana, conquistas, fraseDoDia, resumoResultados, fraseResultado, TIPOS_RESULTADO } from '../jogo.js?v=20261118222102';
import { anelSvg, animar, trilhaHtml, conquistasHtml, festaMinimoUmaVez, celebrar } from '../jogo-visual.js?v=20261118222102';

// por pessoa: o computador da recepção pode ser dividido, e o coordenador usa o "ver como consultora"
const chaveResultados = (id) => `central_resultados_visto_${id}`;
const lerVisto = (id) => { try { return localStorage.getItem(chaveResultados(id)); } catch { return null; } };

const CHAVE_GUIA = 'central_guia_meu_dia';
const guiaVisto = () => { try { return localStorage.getItem(CHAVE_GUIA) === '1'; } catch { return true; } };

export async function render(el, ctx) {
  // meta da semana do Bônus (só um resumo; o detalhe fica na área do Bônus)
  const temBonus = ctx.perfil.acesso_bonus && ctx.perfil.unidade;
  const [d, meta, tarefas, listasFazer, dias] = await Promise.all([dados.meuDia(), temBonus ? dados.minhaMetaSemana().catch(() => null) : null,
    dados.tarefas({ responsavel: ctx.perfil.id }).catch(() => []), dados.listasFazer().catch(() => []),
    dados.meusDias(ctx.perfil.id).catch(() => [])]);
  // contatos dela hoje em cada lista (sem conexão/permissão: as missões mostram só o que falta)
  const [porLista, meusRes] = await Promise.all([dados.meusFeitosHojePorLista(ctx.perfil.id, d.hoje).catch(() => null),
    dados.meusResultados(ctx.perfil.id).catch(() => null)]);
  // contatos dela que deram certo: quadro dos últimos 7 dias + festa para os novos desde a última visita
  const res = meusRes ? resumoResultados(meusRes, d.hoje, lerVisto(ctx.perfil.id)) : null;
  // tudo o que ela ainda tem para fazer, em todas as listas (inclusive a Lista a fazer), até cada prazo
  const pendentes = pendentesAtePrazo(tarefas, d.hoje);
  const faltamTotal = pendentes.reduce((s, t) => s + (t.total - t.feitos), 0);
  const recado = recadoMinimo(d.hoje);   // A e D se revezam, um por dia
  // nome da lista: a Lista a fazer aparece pelo título que o coordenador deu (ex.: "Oportunidades Experimentais")
  const nomeLista = (l) => (l.controle_id === 'lista_fazer'
    ? tituloTarefa(tarefas.find((t) => t.id === l.tarefa_id) || { controle_id: 'lista_fazer' }, listasFazer)
    : NOMES_CONTROLE[l.controle_id] || l.controle_id);
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

  // placar do dia: anel (1ª volta = mínimo, depois volta extra), sequência de dias e trilha da semana
  const hojeInfo = minimo ? { feitos, minimo } : null;
  const a = anel(feitos, minimo);
  const seq = sequencia(dias, hojeInfo);
  const trilha = trilhaSemana(dias, d.hoje, hojeInfo);
  const premios = conquistas(dias, hojeInfo, d.hoje, res?.total || 0);
  const nome = esc((ctx.perfil.nome || '').split(' ')[0]);

  el.innerHTML = `
    ${urgentes.map((a) => `<div class="faixa ${a.nivel === 'urgente' ? 'urgente' : ''}"><div>${esc(a.texto)} <a href="${a.rota}">Abrir →</a></div></div>`).join('')}

    ${cartaoMeta(meta, d.hoje, ctx.perfil.unidade)}

    ${guiaVisto() ? '' : `<div class="cartao guia"><h2>Primeira vez aqui? É simples</h2>
      <ol>
        <li>Toque no botão verde <b>Começar</b>: ele abre a lista mais urgente.</li>
        <li>Em cada pessoa, toque em <b>WhatsApp</b>: a mensagem já vai pronta e o contato fica marcado sozinho.</li>
        <li>Faça pelo menos o <b>mínimo do dia</b> (o anel abaixo). Se não der, no dia seguinte a Central pergunta o que aconteceu.</li>
        <li>Mantenha a <b>sequência 🔥</b>: cada dia útil com o mínimo batido soma um dia. Folga não quebra.</li>
      </ol>
      <div class="linha-acoes" style="margin-top:12px"><button class="btn sec peq" id="guia-ok">Entendi</button></div></div>`}

    <section class="cartao placar ${a.bateu ? 'bateu' : ''}">
      <div class="placar-anel">${minimo
        ? anelSvg(a, { centro: `<b data-contar="${feitos}">0</b><span>/${minimo}</span>`, sub: a.bateu ? (a.extra ? `+${a.extra} extra` : 'mínimo batido') : 'mínimo do dia' })
        : anelSvg({ pct: 100, bateu: true, extraPct: 0, voltas: 0 }, { centro: '<b>✓</b>', sub: 'nada pendente' })}</div>
      <div class="placar-info">
        <small class="placar-ola">Olá, ${nome}! ${ok ? '🎉' : '💪'}</small>
        ${minimo ? `<h2 class="placar-titulo">${a.bateu ? 'Mínimo batido!' : `Faltam <em>${a.falta}</em> para o mínimo`}</h2>
          <p class="placar-frase">Hoje: <b>${feitos} de ${minimo}</b> contatos do mínimo. ${esc(fraseDoDia(a, seq, d.hoje))}</p>
          <p class="placar-recado">${esc(recado.frase)}</p>`
        : '<h2 class="placar-titulo">Nada pendente hoje</h2><p class="placar-frase">Bom trabalho! 🎉 Aproveite para adiantar o que tiver prazo mais à frente.</p>'}
        <div class="placar-chips">
          <span class="chip-fogo ${seq.atual ? 'aceso' : ''} ${seq.emJogo ? 'em-jogo' : ''}" title="Dias úteis seguidos com o mínimo batido (folga não quebra)">
            <i>🔥</i><b>${seq.atual}</b> ${seq.atual === 1 ? 'dia seguido' : 'dias seguidos'}</span>
          ${seq.recorde > 1 ? `<span class="chip-recorde">recorde: <b>${seq.recorde}</b></span>` : ''}
          ${sem.dias ? `<span class="chip-recorde">semana: <b>${sem.bateu} de ${sem.dias}</b> dias batidos</span>` : ''}
        </div>
        ${trilhaHtml(trilha)}
        ${primeira ? `<a class="btn verde grande btn-comecar" href="#/${ROTA_CONTROLE[primeira.controle_id]}/${primeira.tarefa_id}"><span>${a.bateu ? 'Volta extra' : feitos ? 'Continuar' : 'Começar'}: ${esc(nomeLista(primeira))}</span><i>→</i></a>` : ''}
      </div>
    </section>

    ${quadroResultados(res)}

    ${listas.length ? `<div class="cartao"><h2>🎯 Missões de hoje <span class="selo verde">${esc(recado.selo)}</span></h2>
      <div class="missoes">${listas.map((l, k) => {
        const atrasada = l.prazo < d.hoje;
        const hojeNela = porLista ? porLista[l.tarefa_id] || 0 : null;
        const cumpriu = l.faltam_agora === 0 || (hojeNela != null && l.minimo > 0 && hojeNela >= l.minimo);
        const pctM = cumpriu ? 100 : hojeNela != null && l.minimo ? Math.min(100, Math.round((100 * hojeNela) / l.minimo)) : 0;
        const prazo = atrasada ? `<span class="selo vermelho">atrasada desde ${dataCurta(l.prazo)}</span>` : l.prazo === d.hoje ? '<span class="selo laranja">último dia hoje</span>' : `<span class="selo cinza">até ${diaSemana(l.prazo)} ${dataCurta(l.prazo)}</span>`;
        return `<a class="missao ${cumpriu ? 'cumprida' : ''} ${atrasada ? 'atrasada' : ''}" style="--k:${k}" href="#/${ROTA_CONTROLE[l.controle_id]}/${l.tarefa_id}">
          <div class="missao-topo">${l.nova ? '<span class="selo azul">nova</span>' : ''}${prazo}</div>
          <b class="missao-nome">${esc(nomeLista(l))}</b>
          <div class="missao-num"><span>${hojeNela == null ? `mínimo hoje: <b>${l.minimo}</b>` : `<b>${Math.min(hojeNela, l.minimo)}</b>/${l.minimo} hoje${hojeNela > l.minimo ? ` <em>+${hojeNela - l.minimo}</em>` : ''}`}</span><span>faltam ${l.faltam_agora} na lista</span></div>
          <div class="mini-barra"><i data-largura="${pctM}%"></i></div>
          <span class="missao-ir">${cumpriu ? '✓ Missão cumprida' : 'Abrir →'}</span></a>`;
      }).join('')}</div>
      <p class="dica" style="margin-top:12px">O mínimo de hoje é o que falta dividido pelos dias úteis até o prazo. Um pouco por dia rende mais que tudo no último dia.</p></div>` : ''}

    ${conquistasHtml(premios)}

    ${pendentes.length ? `<div class="cartao"><h2>🗂️ Todas as minhas tarefas <span class="selo cinza">${faltamTotal} ${faltamTotal === 1 ? 'contato' : 'contatos'} no total</span></h2>
      <p class="dica" style="margin:-6px 0 10px">Não é tudo para hoje: é o que falta em cada lista até o prazo dela. Para hoje, siga o <b>mínimo do dia</b> acima.</p>
      <div class="tabela-wrap"><table class="tabela responsiva"><thead><tr><th>Lista</th><th>Faltam</th><th>Prazo</th><th></th></tr></thead><tbody>
      ${pendentes.map((t) => {
        const atrasada = t.prazo < d.hoje;
        const prazo = atrasada ? `<span class="selo vermelho">atrasada desde ${dataCurta(t.prazo)}</span>` : t.prazo === d.hoje ? '<span class="selo laranja">último dia hoje</span>' : `até ${diaSemana(t.prazo)} ${dataCurta(t.prazo)}`;
        return `<tr><td class="nome">${esc(tituloTarefa(t, listasFazer))}
            <span class="sub">${prazo} · ${t.feitos} de ${t.total} feitos</span><div style="margin-top:6px;max-width:260px">${barra(t.feitos, t.total, { rotulo: false })}</div></td>
          <td><b>${t.total - t.feitos}</b> <span class="dica">faltam</span></td>
          <td class="oculta-cel">${atrasada ? 'atrasada' : `${diaSemana(t.prazo)} ${dataCurta(t.prazo)}`}</td>
          <td class="acoes"><a class="btn sec peq" href="#/${ROTA_CONTROLE[t.controle_id]}/${t.id}">Abrir</a></td></tr>`;
      }).join('')}</tbody></table></div>
</div>` : ''}
    <p class="dica" style="text-align:center"><a href="#/minhas-tarefas">Ver todas as minhas tarefas →</a></p>`;

  animar(el);
  // comemoração do mínimo uma vez por dia (se ela bateu numa lista, a festa já aconteceu lá)
  const festejouMinimo = minimo && a.bateu ? festaMinimoUmaVez(d.hoje, feitos, minimo, ctx.perfil.id) : false;
  const festa = res && fraseResultado(res.novos);
  if (res?.ultimo) { try { localStorage.setItem(chaveResultados(ctx.perfil.id), res.ultimo); } catch { /* sem armazenamento */ } }
  if (festa) setTimeout(() => celebrar(festa.titulo, festa.texto, { icone: '🌟' }), festejouMinimo ? 4600 : 400);

  el.querySelector('#guia-ok')?.addEventListener('click', () => {
    try { localStorage.setItem(CHAVE_GUIA, '1'); } catch { /* sem armazenamento */ }
    el.querySelector('.guia').remove();
  });
}

// "Deu resultado!": os contatos dela que viraram aluno de volta, pagamento, matrícula ou renovação (últimos 7 dias).
// É o que dá sentido ao trabalho — por isso a festa maior é aqui, e não no toque do WhatsApp.
// A EVO manda nomes em MAIÚSCULAS: "MARIA DA SILVA" vira "Maria da Silva"
const MINUSCULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
const nomeBonito = (n) => (n && n === n.toUpperCase()
  ? n.toLowerCase().split(/\s+/).map((p, k) => (k && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ') : n || '');

function quadroResultados(r) {
  if (!r) return '';
  const tipos = Object.entries(TIPOS_RESULTADO).filter(([k]) => r.porTipo[k]);
  const novo = new Set(r.novos);
  const quando = (ts) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(ts)).replace('.', '');
  return `<div class="cartao resultados ${r.semana ? '' : 'vazio-res'}">
    <h2>🌟 Deu resultado! <span class="selo cinza">últimos 7 dias</span>${r.total ? `<span class="mais">${r.total} desde o começo</span>` : ''}</h2>
    ${r.semana ? `<div class="res-topo"><b class="res-num" data-contar="${r.semana}">${r.semana}</b>
        <span>${r.semana === 1 ? 'contato seu deu certo' : 'contatos seus deram certo'} nesta semana</span></div>
      <div class="res-tipos">${tipos.map(([k, t], j) => `<span class="res-tipo" style="--k:${j}"><i>${t.icone}</i><b>${r.porTipo[k]}</b> ${r.porTipo[k] === 1 ? t.um : t.varios}</span>`).join('')}</div>
      <ul class="res-lista">${r.recentes.map((i, j) => `<li style="--k:${j}" class="${novo.has(i) ? 'novo' : ''}"><i>${TIPOS_RESULTADO[i.resultado].icone}</i>
        <span><b>${esc(nomeBonito(i.nome))}</b> ${TIPOS_RESULTADO[i.resultado].um}</span>${novo.has(i) ? '<em>novo</em>' : ''}<small>${quando(i.quando)}</small></li>`).join('')}</ul>`
    : `<p class="dica">Quando um contato seu fizer o aluno voltar a treinar, pagar ou se matricular, ele aparece aqui. A EVO confere toda madrugada.</p>`}
  </div>`;
}

// Meta da semana do Bônus, em destaque no topo: contratos "de meta" dela na semana (mês dividido em 4, como no Bônus),
// com a barra até a Super meta e os marcos de cada faixa. Os números vêm da EVO de madrugada.
export function cartaoMeta(meta, hoje, unidade) {
  if (!meta || !meta.publicado_em) return '';
  const r = resumoSemana(meta.vendas || [], hoje, unidade);
  const p = painelMeta(r, hoje, unidade);
  const ultimo = p.marcos.length - 1;
  return `<div class="cartao meta-semana ${r.proxima ? '' : 'super'}">
    <div class="ms-topo"><span>🎯&nbsp; Meta da semana ${r.semana}</span><span>${dataCurta(r.ini)} a ${dataCurta(r.fim)}</span></div>
    <div class="ms-numero"><b data-contar="${r.feitos}">${r.feitos}</b><span>${r.feitos === 1 ? 'contrato' : 'contratos'}</span>
      <span class="ms-faixa ${r.faixa === 'Abaixo do básico' ? '' : 'ok'}">${esc(r.faixa)}</span></div>
    <div class="ms-trilha" role="progressbar" aria-valuenow="${r.feitos}" aria-valuemin="0" aria-valuemax="${p.topo}" aria-label="Contratos da semana">
      <div class="ms-fill" style="width:0" data-largura="${p.pct}%"></div>
      ${p.marcos.map((m) => `<i class="${m.atingido ? 'ok' : ''}" style="left:${m.pos}%"></i>`).join('')}</div>
    <div class="ms-marcos">${p.marcos.map((m, k) => `<span class="${m.atingido ? 'ok' : ''}" style="left:${m.pos}%;${k === ultimo ? 'transform:translateX(-100%);text-align:right' : ''}">${m.atingido ? '✓ ' : ''}${esc(m.nome)}<small>${m.n}</small></span>`).join('')}</div>
    <p class="ms-frase">${esc(p.frase)}</p>
    <p class="ms-nota">Contam matrícula, rematrícula e venda completa. Atualiza de madrugada pela EVO: a venda de hoje aparece amanhã. <a href="../bonus/index.html">Ver detalhes no Bônus →</a></p>
  </div>`;
}
