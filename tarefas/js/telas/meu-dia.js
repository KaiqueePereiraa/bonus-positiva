// Meu dia — a tela inicial da consultora: o que fazer hoje, na ordem certa. No celular, a 1ª tela responde "o que eu
// faço agora?" com um botão só (abre a lista mais urgente; se as de hoje acabaram, a de prazo mais perto). Abaixo: as
// listas de hoje e o que vem depois, os resultados e, por último, sequência e medalhas. Guia de 3 passos na 1ª vez.
import { MOTIVOS } from './_ausencias.js?v=20261126220127';
import * as dados from '../dados.js?v=20261126220127';
import { esc, dataCurta, diaSemana, NOMES_CONTROLE, ROTA_CONTROLE } from '../ui.js?v=20261126220127';
import { resumoSemana, painelMeta } from '../bonus-meta.js?v=20261126220127';
import { pendentesAtePrazo, recadoMinimo } from '../regras.js?v=20261126220127';
import { titulo as tituloTarefa } from './minhas-tarefas.js?v=20261126220127';
import { avaliarTime, taxaConsultoras } from '../comercial-regras.js?v=20261126220127';
import { listaVitorias, ligarPalmas, festaPalmasRecebidas, quandoCurto, faltaAplaudir } from './_vitorias.js?v=20261126220127';
import { circulos, disponivelDe, recordeDoDia, caminhoSequencia, trilhaSemana, conquistasDoMes, fraseDoDia, resumoResultados, fraseResultado, TIPOS_RESULTADO } from '../jogo.js?v=20261126220127';
import { aneisSvg, animar, trilhaHtml, conquistasHtml, festaCirculo, celebrar, chipsSequencia, caminhoHtml, festasDaSequencia, festaMedalhas, barraNiveisHtml, festaRecorde } from '../jogo-visual.js?v=20261126220127';

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
  const [kanban, comercial] = await Promise.all([dados.meuKanban().catch(() => null),   // kanban da WasFit: contatos dela parados (atrasado/crítico)
    dados.desempenhoComercial(`${d.hoje.slice(0, 8)}01`).catch(() => null)]);   // carteira do mês dela (Seu mês)
  // contatos dela hoje em cada lista (sem conexão/permissão: as missões mostram só o que falta)
  const [porLista, meusRes, vits, recordeItens] = await Promise.all([dados.meusFeitosHojePorLista(ctx.perfil.id, d.hoje).catch(() => null),
    dados.meusResultados(ctx.perfil.id).catch(() => null), dados.vitoriasEquipe(7).catch(() => []), dados.meuRecordeDia(ctx.perfil.id, d.hoje).catch(() => 0)]);
  // contatos dela que deram certo: quadro dos últimos 7 dias + festa para os novos desde a última visita
  const res = meusRes ? resumoResultados(meusRes, d.hoje, lerVisto(ctx.perfil.id)) : null;
  // tudo o que ela ainda tem para fazer, em todas as listas (inclusive a Lista a fazer), até cada prazo
  const pendentes = pendentesAtePrazo(tarefas, d.hoje);
  const recado = recadoMinimo(d.hoje);   // A e D se revezam, um por dia
  // nome da lista: a Lista a fazer aparece pelo título que o coordenador deu (ex.: "Oportunidades Experimentais")
  // unidades em grupo: a parte que veio da outra unidade é uma lista à parte, com o nome dela
  const deOutraUnidade = (l) => (l.unidade && l.unidade !== ctx.perfil.unidade ? ` · ${ctx.nomeUnidade(l.unidade).replace('Positiva ', '')}` : '');
  const nomeLista = (l) => (l.controle_id === 'lista_fazer'
    ? tituloTarefa(tarefas.find((t) => t.id === l.tarefa_id) || { controle_id: 'lista_fazer' }, listasFazer)
    : NOMES_CONTROLE[l.controle_id] || l.controle_id) + deOutraUnidade(l);
  const minimo = d.listas.reduce((s, l) => s + l.minimo, 0);
  const feitos = d.feitos_hoje;
  const ok = minimo === 0 || feitos >= minimo;
  // ordem: atrasadas, depois as que vencem hoje, depois as novas, depois pelo prazo
  const peso = (l) => (l.prazo < d.hoje ? 0 : l.prazo === d.hoje ? 1 : l.nova ? 2 : 3);
  const daOutra = (l) => Number(!!l.unidade && l.unidade !== ctx.perfil.unidade);   // a da própria unidade vem primeiro
  const listas = [...d.listas].sort((a, b) => peso(a) - peso(b) || daOutra(a) - daOutra(b) || a.prazo.localeCompare(b.prazo));
  const primeira = listas.find((l) => l.faltam_agora > 0);
  // avisos que não são das listas (estas já aparecem abaixo): pedido de troca de escala e interessados sem responsável
  const urgentes = ctx.avisos().filter((a) => a.nivel !== 'info' && (a.id.startsWith('escala-') || a.id === 'nf-pool'));

  // placar do dia: círculos (1º = mínimo; fechou, abre o próximo por dentro), sequência de dias e trilha da semana
  const hojeInfo = minimo ? { feitos, minimo } : null;
  const c = circulos(feitos, minimo, disponivelDe(d), d.listas);   // níveis = frações do pendente (1/3, metade, 3/4, tudo)
  const seq = caminhoSequencia(dias, hojeInfo);   // sequência 🔥 com escudos 🛡️ e chama que muda de cor
  const trilha = trilhaSemana(dias, d.hoje, hojeInfo, seq.estados);
  const premios = conquistasDoMes(dias, d.hoje, hojeInfo, meusRes || []);
  const recorde = Math.max(recordeDoDia(dias), recordeItens || 0);   // maior número de contatos num dia antes de hoje
  const tituloPlacar = !c ? '' : c.zerou ? 'Lista zerada! 🏁' : !c.bateuMinimo ? `Faltam <em>${c.falta}</em> ${c.falta === 1 ? 'contato' : 'contatos'} para o mínimo`
    : `${c.atingido.nome} ${c.atingido.icone}`;
  const nome = esc((ctx.perfil.nome || '').split(' ')[0]);

  // ação principal: a lista mais urgente de hoje; se as de hoje acabaram, a próxima com prazo mais perto (adiantar)
  const idsHoje = new Set(d.listas.map((l) => l.tarefa_id));
  const adiante = pendentes.filter((t) => !idsHoje.has(t.id) && t.total - t.feitos > 0).sort((a, b) => a.prazo.localeCompare(b.prazo));
  const acao = primeira
    ? { href: `#/${ROTA_CONTROLE[primeira.controle_id]}/${primeira.tarefa_id}`, nome: nomeLista(primeira),
      verbo: feitos ? 'Continuar' : 'Começar' }
    : adiante[0] ? { href: `#/${ROTA_CONTROLE[adiante[0].controle_id]}/${adiante[0].id}`, nome: tituloTarefa(adiante[0], listasFazer), verbo: 'Adiantar' } : null;
  const prazoTxt = (p) => (p < d.hoje ? `<span class="selo vermelho">atrasada desde ${dataCurta(p)}</span>` : p === d.hoje ? '<span class="selo laranja">último dia hoje</span>' : `<span class="selo cinza">até ${diaSemana(p)} ${dataCurta(p)}</span>`);

  // Ordem da tela (revisão de 18/11/2026): 1) avisos urgentes · 2) HOJE: número, frase e o botão de ação (o que ela faz
  // agora) · 3) META DA SEMANA logo abaixo (o resultado que esse esforço gera; também fica no placar do topo de todas as
  // telas) · 4) as listas de hoje + o que vem depois · 5) resultados · 6) sequência e medalhas
  el.innerHTML = `
    ${urgentes.map((a) => `<div class="faixa ${a.nivel === 'urgente' ? 'urgente' : ''}"><div>${esc(a.texto)} <a href="${a.rota}">Abrir →</a></div></div>`).join('')}
    ${kanban?.ligada && (kanban.niveis.critico || kanban.niveis.urgente) ? `<div class="faixa ${kanban.niveis.critico ? 'urgente' : ''}"><div>
      Kanban da WasFit: ${kanban.niveis.critico ? `🔴 <b>${kanban.niveis.critico} crítico${kanban.niveis.critico > 1 ? 's' : ''}</b>` : ''}${kanban.niveis.critico && kanban.niveis.urgente ? ' e ' : ''}${kanban.niveis.urgente ? `🟠 <b>${kanban.niveis.urgente} atrasado${kanban.niveis.urgente > 1 ? 's' : ''}</b>` : ''}
      sem nenhuma ação há tempo demais. <a href="#/analises/kanban">Ver quem →</a></div></div>` : ''}

    ${guiaVisto() ? '' : `<div class="cartao guia"><h2>Como funciona (30 segundos)</h2>
      <ol>
        <li>Toque no botão verde: ele abre a lista certa. Na lista, o contato da vez vem marcado como <b>Próximo</b>.</li>
        <li>Faça pelo menos o <b>mínimo do dia</b>. Depois vêm os níveis: 💪 No pique (1/3 das suas listas), 🔥 Pegando fogo (metade), ✈️ Voando (3/4) e 🏁 Lista zerada.</li>
        <li>Cada dia útil com o mínimo soma na <b>sequência 🔥</b>; a cada 13 dias seguidos você ganha um <b>escudo 🛡️</b> que salva a sequência num dia que não der.</li>
      </ol>
      <div class="linha-acoes" style="margin-top:12px"><button class="btn sec peq" id="guia-ok">Entendi</button></div></div>`}

    <section class="cartao placar ${c?.bateuMinimo ? 'bateu' : ''}">
      <div class="placar-principal">
        <div class="placar-anel">${c
          ? aneisSvg(c, { tam: 196, traco: 11, centro: `<b data-contar="${feitos}">0</b>`, sub: feitos === 1 ? 'contato hoje' : 'contatos hoje' })
          : aneisSvg({ nivel: 1, completos: 1, pct: 100, bateuMinimo: true }, { tam: 196, traco: 11, centro: '<b>✓</b>', sub: 'sem mínimo hoje' })}</div>
        <div class="placar-info">
          <small class="placar-ola">Olá, ${nome}! ${ok ? '🎉' : '💪'}</small>
          ${c ? `<h2 class="placar-titulo">${tituloPlacar}</h2>
            <p class="placar-frase">${esc(fraseDoDia(c, seq, d.hoje))}</p>
            ${barraNiveisHtml(c, feitos, recorde)}`
          : d.ausencia ? `<h2 class="placar-titulo">Hoje: ${esc(MOTIVOS[d.ausencia] || d.ausencia)}</h2><p class="placar-frase">Sem mínimo hoje${d.ausencia_protege === false ? '' : ' e a sua sequência 🔥 não quebra'}. O que falta foi dividido pelos próximos dias.</p>`
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

    ${quadroResultados(res, vits, ctx.perfil.id)}

    ${seuMes(comercial, kanban)}

    ${conquistasHtml(premios)}

    <p class="dica" style="text-align:center"><a href="#/minhas-tarefas">Ver todas as minhas tarefas (quadro) →</a></p>`;

  animar(el);
  // festa do círculo fechado, uma vez por círculo por dia (se ela fechou numa lista, a festa já aconteceu lá)
  festaCirculo(d.hoje, c, ctx.perfil.id);
  festaRecorde(d.hoje, feitos, recorde, ctx.perfil.id);
  festasDaSequencia(seq, d.hoje, ctx.perfil.id);   // escudo ganho ou usado (as festas entram em fila)
  festaMedalhas(premios, d.hoje, ctx.perfil.id);   // medalha nova no mês
  const festa = res && fraseResultado(res.novos);
  if (res?.ultimo) { try { localStorage.setItem(chaveResultados(ctx.perfil.id), res.ultimo); } catch { /* sem armazenamento */ } }
  if (festa) celebrar(festa.titulo, festa.texto, { icone: '🌟' });
  festaPalmasRecebidas(vits, ctx.perfil.id);   // colegas/coordenador aplaudiram um resultado dela
  const caixaRes = el.querySelector('.resultados');
  if (caixaRes) {
    ligarPalmas(caixaRes, vits, ctx.perfil.id);
    caixaRes.addEventListener('aplaudiu', () => {   // atualiza o contador "faltam aplaudir" da aba
      const n = faltaAplaudir(vits, ctx.perfil.id);
      const cont = caixaRes.querySelector('[data-aba=equipe] .cont');
      if (cont) cont.textContent = n || '✓';
    });
    caixaRes.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => {
      caixaRes.querySelectorAll('[data-aba]').forEach((x) => x.classList.toggle('ativo', x === b));
      caixaRes.querySelectorAll('[data-painel]').forEach((p) => { p.hidden = p.dataset.painel !== b.dataset.aba; });
    }));
  }

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

// Duas abas: "Minhas" (os contatos dela que deram certo, com as palmas recebidas) e "Da equipe" (vitórias das colegas
// da unidade, com 👏). Abre em "Da equipe" quando ela ainda não tem resultado na semana.
function quadroResultados(r, vits = [], euId = '') {
  if (!r && !vits.length) return '';
  const tipos = r ? Object.entries(TIPOS_RESULTADO).filter(([k]) => r.porTipo[k]) : [];
  const novo = new Set(r?.novos || []);
  // quem aplaudiu os resultados dela (uma vez por pessoa, mesmo aplaudindo vários dias)
  const quemAplaudiu = [...new Set(vits.filter((v) => v.consultora_id === euId).flatMap((v) => v.palmas.map((p) => p.nome.split(' ')[0])))];
  const aAplaudir = faltaAplaudir(vits, euId);
  const equipe = vits.filter((v) => v.consultora_id !== euId);
  const abaInicial = r?.semana ? 'minhas' : equipe.length ? 'equipe' : 'minhas';
  const minhas = r?.semana ? `<div class="res-topo"><b class="res-num" data-contar="${r.semana}">${r.semana}</b>
        <span>${r.semana === 1 ? 'contato seu deu certo' : 'contatos seus deram certo'} nesta semana</span></div>
      <div class="res-tipos">${tipos.map(([k, t], j) => `<span class="res-tipo" style="--k:${j}"><i>${t.icone}</i><b>${r.porTipo[k]}</b> ${r.porTipo[k] === 1 ? t.um : t.varios}</span>`).join('')}</div>
      ${quemAplaudiu.length ? `<p class="aplaudiram">👏 <b>${esc(quemAplaudiu.slice(0, 3).join(', '))}${quemAplaudiu.length > 3 ? ` e mais ${quemAplaudiu.length - 3}` : ''}</b> ${quemAplaudiu.length === 1 ? 'aplaudiu' : 'aplaudiram'} seus resultados</p>` : ''}
      ${(() => {
        const li = (i, j) => {
          return `<li style="--k:${j}" class="${novo.has(i) ? 'novo' : ''}"><i>${TIPOS_RESULTADO[i.resultado].icone}</i>
          <span><b>${esc(nomeBonito(i.nome))}</b> ${TIPOS_RESULTADO[i.resultado].um}</span>${novo.has(i) ? '<em>novo</em>' : ''}
          <small>${quandoCurto(i.quando)}</small></li>`; };
        const [primeiros, resto] = [r.recentes.slice(0, 3), r.recentes.slice(3)];
        return `<ul class="res-lista">${primeiros.map(li).join('')}</ul>${resto.length ? `<details class="res-mais"><summary>Ver mais ${resto.length}</summary><ul class="res-lista">${resto.map(li).join('')}</ul></details>` : ''}`;
      })()}`
    : '<p class="dica">Quando um contato seu fizer o aluno voltar a treinar, pagar ou se matricular, ele aparece aqui. A EVO confere toda madrugada.</p>';
  return `<div class="cartao resultados ${r?.semana || equipe.length ? '' : 'vazio-res'}">
    <h2>🌟 Deu resultado! <span class="selo cinza">últimos 7 dias</span>${r?.total ? `<span class="mais">${r.total} ${r.total === 1 ? 'seu' : 'seus'} desde o começo</span>` : ''}</h2>
    <div class="abas res-abas">
      <button type="button" data-aba="minhas" class="${abaInicial === 'minhas' ? 'ativo' : ''}">Minhas <span class="cont">${r?.semana || 0}</span></button>
      <button type="button" data-aba="equipe" class="${abaInicial === 'equipe' ? 'ativo' : ''}" title="Dias de colegas que você ainda não aplaudiu">Da equipe 👏 <span class="cont">${aAplaudir || '✓'}</span></button>
    </div>
    <div data-painel="minhas" ${abaInicial === 'minhas' ? '' : 'hidden'}>${minhas}</div>
    <div data-painel="equipe" ${abaInicial === 'equipe' ? '' : 'hidden'}>
      <p class="dica" style="margin-bottom:8px">Uma linha por colega por dia. Um 👏 dá os parabéns por todos os resultados daquele dia — ela fica sabendo.</p>
      ${listaVitorias(equipe, euId)}</div>
  </div>`;
}

// Meta da semana do Bônus, em destaque no topo: contratos "de meta" dela na semana (mês dividido em 4, como no Bônus),
// com a barra até a faixa mais alta (Super meta; Meta real na Acqua desde dez/2026) e os marcos de cada faixa. Os números vêm da EVO de madrugada.
export function cartaoMeta(meta, hoje, unidade) {
  if (!meta || !meta.publicado_em) return '';
  const r = resumoSemana(meta.vendas || [], hoje, unidade, meta.regua);
  const p = painelMeta(r, hoje, unidade);
  // dez/2026+: a caixa d'água da equipe (Laranjeiras + República) — os extras só saem se a equipe repor as saídas do mês
  const rg = meta.regua?.v3 && meta.equipe != null ? meta.regua : null;
  const saidas = rg ? (rg.saidas_mes ?? Math.round(rg.saidas_base)) : 0;
  const equipe = rg ? `<p class="ms-nota"><b>Equipe no mês: ${meta.equipe} de ${saidas} contratos</b> para não perder alunos${meta.equipe >= saidas ? ' ✓ — bônus de equipe e da Central liberados' : ` — faltam ${saidas - meta.equipe}`}.</p>` : '';
  const ultimo = p.marcos.length - 1;
  return `<div class="cartao meta-semana ${r.proxima ? '' : 'super'}">
    <div class="ms-topo"><span>🎯&nbsp; Meta da semana ${r.semana}</span><span>${dataCurta(r.ini)} a ${dataCurta(r.fim)}</span></div>
    <div class="ms-numero"><b data-contar="${r.feitos}">${r.feitos}</b><span>${r.feitos === 1 ? 'contrato' : 'contratos'}</span>
      <span class="ms-faixa ${r.abaixo ? '' : 'ok'}">${esc(r.faixa)}</span></div>
    <div class="ms-trilha" role="progressbar" aria-valuenow="${r.feitos}" aria-valuemin="0" aria-valuemax="${p.topo}" aria-label="Contratos da semana">
      <div class="ms-fill" style="width:0" data-largura="${p.pct}%"></div>
      ${p.marcos.map((m) => `<i class="${m.atingido ? 'ok' : ''}" style="left:${m.pos}%"></i>`).join('')}</div>
    <div class="ms-marcos">${p.marcos.map((m, k) => `<span class="${m.atingido ? 'ok' : ''}" style="left:${m.pos}%;${k === ultimo ? 'transform:translateX(-100%);text-align:right' : ''}">${m.atingido ? '✓ ' : ''}${esc(m.nome)}<small>${m.n}</small></span>`).join('')}</div>
    <p class="ms-frase">${esc(p.frase)}</p>${equipe}
    <p class="ms-nota">Contam matrícula, rematrícula e venda completa. Atualiza de madrugada pela EVO: a venda de hoje aparece amanhã. <a href="../bonus/index.html">Ver detalhes no Bônus →</a></p>
  </div>`;
}

// Seu mês (revisão 26/11, item "Meu dia com os números dela"): a carteira do mês (o que ela cadastrou + o que assumiu da IA),
// quantos viraram cliente comparado com a equipe, e o kanban dela. Os mesmos números que o gestor vê em Análises.
function seuMes(com, kb) {
  let eu = null, equipe = null;
  for (const t of com?.times || []) {
    const p = avaliarTime(t).find((x) => x.eu);
    if (p) { eu = p; equipe = taxaConsultoras(t); break; }
  }
  const k = kb?.ligada ? kb.niveis || {} : null;
  if (!eu && !k) return '';
  const pc = (v) => (v == null ? '—' : `${String(v).replace('.', ',')}%`);
  const carteira = eu ? eu.atual.cadastros : 0;
  const SIT = { acima: ['verde', 'acima da equipe'], dentro: ['azul', 'no padrão da equipe'], abaixo: ['laranja', 'abaixo da equipe'], poucos: ['cinza', 'poucos contatos ainda'] };
  const [cor, rot] = eu ? SIT[eu.status] || SIT.poucos : SIT.poucos;
  return `<div class="cartao seu-mes"><h2>📈 Seu mês</h2>
    <div class="seu-mes-grade">
      ${eu ? `<div><small>Sua carteira</small><b>${carteira}</b><span>${carteira - (eu.atual.da_ia || 0)} que você cadastrou${eu.atual.da_ia ? ` + ${eu.atual.da_ia} da IA` : ''}</span></div>
      <div><small>Viraram cliente</small><b>${pc(eu.taxa)}</b><span>${eu.atual.vendas} de ${carteira} · equipe ${pc(equipe)}</span><span class="selo ${cor}">${rot}</span></div>` : ''}
      ${k ? `<div><small>Seu kanban</small><b>${(k.critico || 0) + (k.urgente || 0)}</b><span>${k.critico ? `${k.critico} crítico${k.critico > 1 ? 's' : ''} · ` : ''}${k.urgente || 0} atrasado${k.urgente === 1 ? '' : 's'} · ${k.normal || 0} em dia</span></div>` : ''}
    </div>
    ${eu?.diagnostico ? `<p class="dica" style="margin-top:10px">💡 ${esc(eu.diagnostico)}</p>` : ''}
    <p class="dica" style="margin-top:6px"><a href="#/analises/comercial">Ver o detalhe →</a>${k ? ` · <a href="#/analises/kanban">Seu kanban →</a>` : ''}</p></div>`;
}
