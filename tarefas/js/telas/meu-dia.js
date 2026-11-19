// Meu dia — a tela inicial da consultora: o que fazer hoje, na ordem certa. No celular, a 1ª tela responde "o que eu
// faço agora?" com um botão só (abre a lista mais urgente; se as de hoje acabaram, a de prazo mais perto). Abaixo: as
// listas de hoje e o que vem depois, os resultados e, por último, sequência e medalhas. Guia de 3 passos na 1ª vez.
import * as dados from '../dados.js?v=20261118225708';
import { esc, dataCurta, diaSemana, NOMES_CONTROLE, ROTA_CONTROLE } from '../ui.js?v=20261118225708';
import { resumoSemana, painelMeta } from '../bonus-meta.js?v=20261118225708';
import { pendentesAtePrazo, recadoMinimo } from '../regras.js?v=20261118225708';
import { titulo as tituloTarefa } from './minhas-tarefas.js?v=20261118225708';
import { circulos, disponivelDe, caminhoSequencia, trilhaSemana, conquistasDoMes, fraseDoDia, resumoResultados, fraseResultado, TIPOS_RESULTADO } from '../jogo.js?v=20261118225708';
import { aneisSvg, animar, trilhaHtml, conquistasHtml, festaCirculo, celebrar, chipsSequencia, caminhoHtml, festasDaSequencia } from '../jogo-visual.js?v=20261118225708';

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
  const recado = recadoMinimo(d.hoje);   // A e D se revezam, um por dia
  // nome da lista: a Lista a fazer aparece pelo título que o coordenador deu (ex.: "Oportunidades Experimentais")
  const nomeLista = (l) => (l.controle_id === 'lista_fazer'
    ? tituloTarefa(tarefas.find((t) => t.id === l.tarefa_id) || { controle_id: 'lista_fazer' }, listasFazer)
    : NOMES_CONTROLE[l.controle_id] || l.controle_id);
  const minimo = d.listas.reduce((s, l) => s + l.minimo, 0);
  const feitos = d.feitos_hoje;
  const ok = minimo === 0 || feitos >= minimo;
  // ordem: atrasadas, depois as que vencem hoje, depois as novas, depois pelo prazo
  const peso = (l) => (l.prazo < d.hoje ? 0 : l.prazo === d.hoje ? 1 : l.nova ? 2 : 3);
  const listas = [...d.listas].sort((a, b) => peso(a) - peso(b) || a.prazo.localeCompare(b.prazo));
  const primeira = listas.find((l) => l.faltam_agora > 0);
  // avisos que não são das listas (estas já aparecem abaixo): pedido de troca de escala e interessados sem responsável
  const urgentes = ctx.avisos().filter((a) => a.nivel !== 'info' && (a.id.startsWith('escala-') || a.id === 'nf-pool'));

  // placar do dia: círculos (1º = mínimo; fechou, abre o próximo por dentro), sequência de dias e trilha da semana
  const hojeInfo = minimo ? { feitos, minimo } : null;
  const c = circulos(feitos, minimo, disponivelDe(d));
  const seq = caminhoSequencia(dias, hojeInfo);   // sequência 🔥 com escudos 🛡️ e chama que muda de cor
  const trilha = trilhaSemana(dias, d.hoje, hojeInfo, seq.estados);
  const premios = conquistasDoMes(dias, d.hoje, hojeInfo, meusRes || []);
  const subCirculo = !c ? '' : c.zerou ? 'listas zeradas' : c.nivel === 1 ? 'mínimo do dia' : `círculo ${c.nivel}${c.ultimo ? ' · o último' : ''}`;
  const tituloPlacar = !c ? '' : c.zerou ? 'Listas zeradas! 🏆' : !c.bateuMinimo ? `Faltam <em>${c.falta}</em> para o mínimo`
    : `Círculo ${c.nivel}: faltam <em>${c.falta}</em>`;
  const nome = esc((ctx.perfil.nome || '').split(' ')[0]);

  // ação principal: a lista mais urgente de hoje; se as de hoje acabaram, a próxima com prazo mais perto (adiantar)
  const idsHoje = new Set(d.listas.map((l) => l.tarefa_id));
  const adiante = pendentes.filter((t) => !idsHoje.has(t.id) && t.total - t.feitos > 0).sort((a, b) => a.prazo.localeCompare(b.prazo));
  const acao = primeira
    ? { href: `#/${ROTA_CONTROLE[primeira.controle_id]}/${primeira.tarefa_id}`, nome: nomeLista(primeira),
      verbo: c?.bateuMinimo ? `Círculo ${c.nivel}` : feitos ? 'Continuar' : 'Começar' }
    : adiante[0] ? { href: `#/${ROTA_CONTROLE[adiante[0].controle_id]}/${adiante[0].id}`, nome: tituloTarefa(adiante[0], listasFazer), verbo: 'Adiantar' } : null;
  const prazoTxt = (p) => (p < d.hoje ? `<span class="selo vermelho">atrasada desde ${dataCurta(p)}</span>` : p === d.hoje ? '<span class="selo laranja">último dia hoje</span>' : `<span class="selo cinza">até ${diaSemana(p)} ${dataCurta(p)}</span>`);

  // Ordem da tela (revisão de 18/11/2026): 1) avisos urgentes · 2) HOJE: número, frase e o botão de ação (o que ela faz
  // agora) · 3) META DA SEMANA logo abaixo (o resultado que esse esforço gera; também fica no placar do topo de todas as
  // telas) · 4) as listas de hoje + o que vem depois · 5) resultados · 6) sequência e medalhas
  el.innerHTML = `
    ${urgentes.map((a) => `<div class="faixa ${a.nivel === 'urgente' ? 'urgente' : ''}"><div>${esc(a.texto)} <a href="${a.rota}">Abrir →</a></div></div>`).join('')}

    ${guiaVisto() ? '' : `<div class="cartao guia"><h2>Como funciona (30 segundos)</h2>
      <ol>
        <li>Toque no botão verde: ele abre a lista certa. Na lista, o contato da vez vem marcado como <b>Próximo</b>.</li>
        <li>Feche pelo menos o <b>1º círculo</b> (o mínimo do dia). Depois abrem círculos extras para ir além.</li>
        <li>Cada dia útil com o mínimo soma na <b>sequência 🔥</b>; a cada 12 dias seguidos você ganha um <b>escudo 🛡️</b> que salva a sequência num dia que não der.</li>
      </ol>
      <div class="linha-acoes" style="margin-top:12px"><button class="btn sec peq" id="guia-ok">Entendi</button></div></div>`}

    <section class="cartao placar ${c?.bateuMinimo ? 'bateu' : ''}">
      <div class="placar-principal">
        <div class="placar-anel">${c
          ? aneisSvg(c, { tam: 196, traco: 11, gap: 4, centro: `<b data-contar="${feitos}">0</b><span>/${c.alvo}</span>`, sub: subCirculo })
          : aneisSvg({ nivel: 1, completos: 1, pct: 100, bateuMinimo: true }, { tam: 196, traco: 11, centro: '<b>✓</b>', sub: 'sem mínimo hoje' })}</div>
        <div class="placar-info">
          <small class="placar-ola">Olá, ${nome}! ${ok ? '🎉' : '💪'}</small>
          ${c ? `<h2 class="placar-titulo">${tituloPlacar}</h2>
            <p class="placar-frase">${esc(fraseDoDia(c, seq, d.hoje))}</p>`
          : `<h2 class="placar-titulo">Sem mínimo hoje</h2><p class="placar-frase">${acao ? 'Dá para adiantar o que tem prazo mais à frente.' : 'Nada pendente. Bom trabalho! 🎉'}</p>`}
          ${acao ? `<a class="btn verde grande btn-comecar" href="${acao.href}"><span>${acao.verbo}: ${esc(acao.nome)}</span><i>→</i></a>` : ''}
          ${c ? `<p class="placar-recado">${esc(recado.frase)}</p>` : ''}
        </div>
      </div>
      <div class="placar-seq">
        <div class="placar-chips">${chipsSequencia(seq)}</div>
        ${trilhaHtml(trilha)}
        ${caminhoHtml(seq)}
      </div>
    </section>

    ${cartaoMeta(meta, d.hoje, ctx.perfil.unidade)}

    ${listas.length || adiante.length ? `<div class="cartao"><h2>🎯 ${listas.length ? 'Listas de hoje' : 'Para adiantar'} ${listas.length ? `<span class="selo verde">${esc(recado.selo)}</span>` : ''}</h2>
      ${listas.length ? `<div class="missoes">${listas.map((l, k) => {
        const atrasada = l.prazo < d.hoje;
        const hojeNela = porLista ? porLista[l.tarefa_id] || 0 : null;
        const cumpriu = l.faltam_agora === 0 || (hojeNela != null && l.minimo > 0 && hojeNela >= l.minimo);
        const pctM = cumpriu ? 100 : hojeNela != null && l.minimo ? Math.min(100, Math.round((100 * hojeNela) / l.minimo)) : 0;
        return `<a class="missao ${cumpriu ? 'cumprida' : ''} ${atrasada ? 'atrasada' : ''}" style="--k:${k}" href="#/${ROTA_CONTROLE[l.controle_id]}/${l.tarefa_id}">
          <div class="missao-topo">${l.nova ? '<span class="selo azul">nova</span>' : ''}${prazoTxt(l.prazo)}</div>
          <b class="missao-nome">${esc(nomeLista(l))}</b>
          <div class="missao-num"><span>${hojeNela == null ? `mínimo hoje: <b>${l.minimo}</b>` : `<b>${Math.min(hojeNela, l.minimo)}</b>/${l.minimo} hoje${hojeNela > l.minimo ? ` <em>+${hojeNela - l.minimo}</em>` : ''}`}</span><span>faltam ${l.faltam_agora} na lista</span></div>
          <div class="mini-barra"><i data-largura="${pctM}%"></i></div>
          <span class="missao-ir">${cumpriu ? '✓ Mínimo desta lista feito' : 'Abrir →'}</span></a>`;
      }).join('')}</div>
      <p class="dica" style="margin-top:10px">O mínimo de hoje é o que falta dividido pelos dias úteis até o prazo. Um pouco por dia rende mais que tudo no último dia.</p>` : ''}
      ${adiante.length ? `<div class="adiante"><h3>Depois de hoje <small>não é tudo para hoje: é o que falta em cada lista até o prazo dela</small></h3>
        <ul>${adiante.map((t) => `<li><a href="#/${ROTA_CONTROLE[t.controle_id]}/${t.id}"><span><b>${esc(tituloTarefa(t, listasFazer))}</b>${prazoTxt(t.prazo)}</span>
          <span class="adiante-num"><b>${t.total - t.feitos}</b> faltam <i>→</i></span></a></li>`).join('')}</ul></div>` : ''}
    </div>` : ''}

    ${quadroResultados(res)}

    ${conquistasHtml(premios)}

    <p class="dica" style="text-align:center"><a href="#/minhas-tarefas">Ver todas as minhas tarefas (quadro) →</a></p>`;

  animar(el);
  // festa do círculo fechado, uma vez por círculo por dia (se ela fechou numa lista, a festa já aconteceu lá)
  festaCirculo(d.hoje, c, ctx.perfil.id);
  festasDaSequencia(seq, d.hoje, ctx.perfil.id);   // escudo ganho ou usado (as festas entram em fila)
  const festa = res && fraseResultado(res.novos);
  if (res?.ultimo) { try { localStorage.setItem(chaveResultados(ctx.perfil.id), res.ultimo); } catch { /* sem armazenamento */ } }
  if (festa) celebrar(festa.titulo, festa.texto, { icone: '🌟' });

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
      ${(() => {
        const li = (i, j) => `<li style="--k:${j}" class="${novo.has(i) ? 'novo' : ''}"><i>${TIPOS_RESULTADO[i.resultado].icone}</i>
          <span><b>${esc(nomeBonito(i.nome))}</b> ${TIPOS_RESULTADO[i.resultado].um}</span>${novo.has(i) ? '<em>novo</em>' : ''}<small>${quando(i.quando)}</small></li>`;
        const [primeiros, resto] = [r.recentes.slice(0, 3), r.recentes.slice(3)];
        return `<ul class="res-lista">${primeiros.map(li).join('')}</ul>${resto.length ? `<details class="res-mais"><summary>Ver mais ${resto.length}</summary><ul class="res-lista">${resto.map(li).join('')}</ul></details>` : ''}`;
      })()}`
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
