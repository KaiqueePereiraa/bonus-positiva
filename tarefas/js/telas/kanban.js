// Kanban da WasFit espelhado — só para monitorar e cobrar (não opera o kanban).
// Cada etiqueta marcada/desmarcada na WasFit chega por webhook (função wasfit-etiquetas). Cada contato fica Normal / Atrasado /
// Crítico pelo tempo sem nenhuma ação (mudança de etiqueta), com os dias que o gestor define em Configurações → Kanban.
// Gestor: todas as consultoras, a lista do que está crítico/atrasado, as regras e quem é quem na WasFit.
// Consultora: só os contatos dela, crítico e atrasado primeiro.
import * as dados from '../dados.js?v=20261126172117';
import { esc, vazio, toast, erro } from '../ui.js?v=20261126172117';
import { texto as regraTexto } from '../kanban-regras.js?v=20261126172117';

const NIVEL = { critico: ['vermelho', '🔴 Crítico'], urgente: ['laranja', '🟠 Atrasado'], normal: ['verde', '🟢 Normal'], fora: ['cinza', 'Não monitorada'] };
const tempo = (h) => (h == null ? '—' : h < 1 ? 'menos de 1 h' : h < 48 ? `${Math.floor(h)} h` : `${Math.floor(h / 24)} dias`);
const selo = (n) => `<span class="selo ${NIVEL[n][0]}">${NIVEL[n][1]}</span>`;

export async function render(el, ctx) {
  if (!ctx.ehAdmin || dados.vendoComo()) return consultora(el);
  const r = await dados.kanbanWasfit();
  const ganchos = ctx.ehSuper ? await dados.kanbanWebhooks().catch(() => []) : [];
  const n = r.niveis || {};
  el.innerHTML = `
    <div class="cartao"><p class="dica">Espelho do kanban da WasFit: cada etiqueta marcada ou desmarcada chega aqui na hora. A dona do contato é quem mexeu
      nas etiquetas dele por último. "Ação" = mudança de etiqueta — conversar sem mover o contato no kanban conta como sem ação.
      ${r.eventos_7d} movimento(s) nos últimos 7 dias.</p></div>
    ${!r.contatos ? `<div class="cartao">${vazio('Ainda não chegou nenhum contato com etiqueta do kanban. Confira se as etiquetas da WasFit têm o webhook desta plataforma, com "Disparar ao marcar" e "ao desmarcar" ligados.')}</div>` : `
    <div class="numeros" style="margin:0 0 14px">
      <div class="numero vermelho"><small>🔴 Críticos</small><b>${n.critico || 0}</b><span>passaram do limite crítico</span></div>
      <div class="numero" style="border-top-color:#F39C12"><small>🟠 Atrasados</small><b>${n.urgente || 0}</b><span>passaram do limite de atraso</span></div>
      <div class="numero verde"><small>🟢 Normais</small><b>${n.normal || 0}</b><span>dentro do padrão</span></div>
      <div class="numero azul"><small>Contatos no kanban</small><b>${r.contatos}</b><span>${n.fora ? `${n.fora} em colunas não monitoradas` : 'com etiqueta de coluna'}</span></div>
    </div>
    <div class="cartao"><h2>Por consultora</h2>
      <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Dona</th><th>Contatos</th><th>🔴 Críticos</th><th>🟠 Atrasados</th><th>🟢 Normais</th>${r.colunas.map((c) => `<th>${esc(c.coluna)}</th>`).join('')}</tr></thead><tbody>
      ${r.pessoas.map((p) => `<tr><td class="nome">${esc(p.dona)}</td><td>${p.contatos}</td>
        <td>${p.critico ? `<span class="selo vermelho">${p.critico}</span>` : '0'}</td><td>${p.urgente ? `<span class="selo laranja">${p.urgente}</span>` : '0'}</td><td>${p.normal}</td>
        ${r.colunas.map((c) => `<td>${(p.por_coluna || {})[c.coluna] || '—'}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div></div>
    <div class="cartao"><h2>Para cobrar — críticos e atrasados</h2>
      ${r.alertas.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Nível</th><th>Contato</th><th>Coluna</th><th>Sem ação há</th><th>Na coluna há</th><th>Dona</th></tr></thead><tbody>
        ${r.alertas.map((x) => `<tr><td>${selo(x.nivel)}</td><td class="nome">${esc(x.contato || '—')}<span class="sub">${esc(x.numero || '')}</span></td><td>${esc(x.coluna)}</td>
          <td><b>${tempo(x.horas_sem_acao)}</b></td><td>${tempo(x.horas_na_coluna)}</td><td>${esc(x.dona)}</td></tr>`).join('')}
      </tbody></table></div>` : vazio('Nada crítico nem atrasado agora. 👏')}</div>`}
    ${resumoRegras(r)}
    ${quadroUsuarios(r)}
    ${quadroWebhooks(ganchos)}`;
  el.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(ganchos[+b.dataset.copiar].url); toast('Endereço copiado.'); } catch (e) { erro(e); }
  }));
  el.querySelectorAll('[data-usuario]').forEach((s) => s.addEventListener('change', async () => {
    try { await dados.kanbanLigarUsuario(+s.dataset.usuario, s.value || null); toast('Ligação salva.'); render(el, ctx); } catch (e) { erro(e); }
  }));
}

// Regras do monitoramento: só o resumo aqui; o gestor muda em Configurações → Kanban
function resumoRegras(r) {
  const padrao = r.regras.find((x) => x.coluna === '*');
  const outras = r.regras.filter((x) => x.coluna !== '*');
  return `<div class="cartao"><h2>Regras do monitoramento</h2>
    <p><b>${esc(regraTexto(padrao))}</b>${outras.length ? `<span class="dica"> · ${outras.length} coluna(s) com regra própria</span>` : ''}</p>
    <p class="dica">Ação = mudança de etiqueta na WasFit. <a href="#/configuracoes/kanban">Mudar os dias em Configurações → Kanban →</a></p></div>`;
}

// Quem é quem: usuário da WasFit → pessoa da Central (para a consultora ver os contatos dela)
function quadroUsuarios(r) {
  if (!r.usuarios?.length) return '';
  return `<div class="cartao"><h2>Quem é quem na WasFit</h2>
    <p class="dica">Cada usuário da WasFit precisa estar ligado à pessoa da Central para ela ver os próprios contatos. A ligação é feita sozinha pelo primeiro nome; corrija aqui se precisar.</p>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Usuário na WasFit</th><th>Pessoa na Central</th></tr></thead><tbody>
    ${r.usuarios.map((u) => `<tr><td class="nome">${esc(u.nome)}</td><td><select class="ctrl" data-usuario="${u.usuario_id}">
      <option value="">— ninguém —</option>${r.equipe.map((p) => `<option value="${p.id}" ${p.id === u.profile_id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
      </select></td></tr>`).join('')}
    </tbody></table></div></div>`;
}

// Endereços do webhook (só o super admin): um por unidade — cada etiqueta do kanban daquela unidade na WasFit usa o da unidade
function quadroWebhooks(lista) {
  if (!lista?.length) return '';
  return `<div class="cartao"><h2>Webhook de cada unidade</h2>
    <p class="dica">Na WasFit, em cada etiqueta do kanban: cole o endereço da unidade, ligue "Disparar ao marcar" e "ao desmarcar". Não precisa de um por consultora:
      cada aviso já diz quem mexeu. Não compartilhe estes endereços.</p>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Unidade</th><th>Endereço</th><th></th></tr></thead><tbody>
    ${lista.map((w, i) => `<tr><td class="nome">${esc(w.unidade)}</td><td><code style="font-size:12px;word-break:break-all">${esc(w.url)}</code></td>
      <td><button class="btn peq sec" data-copiar="${i}">Copiar</button></td></tr>`).join('')}
    </tbody></table></div></div>`;
}

// Consultora: os contatos dela no kanban, crítico e atrasado primeiro
async function consultora(el) {
  const r = await dados.meuKanban();
  if (!r.ligada) { el.innerHTML = `<div class="cartao">${vazio('Seu usuário da WasFit ainda não está ligado ao seu nome aqui. Peça ao gestor para ligar em "Kanban da WasFit" → "Quem é quem".')}</div>`; return; }
  const n = r.niveis || {};
  const padrao = (r.regras || []).find((x) => x.coluna === '*');
  el.innerHTML = `
    <div class="numeros" style="margin:0 0 14px">
      <div class="numero vermelho"><small>🔴 Críticos</small><b>${n.critico || 0}</b><span>resolva primeiro</span></div>
      <div class="numero" style="border-top-color:#F39C12"><small>🟠 Atrasados</small><b>${n.urgente || 0}</b><span>antes de virar crítico</span></div>
      <div class="numero verde"><small>🟢 Normais</small><b>${n.normal || 0}</b><span>em dia</span></div>
    </div>
    <div class="cartao"><h2>Seus contatos no kanban</h2>
      <p class="dica">Tempo sem nenhuma ação (mudança de etiqueta na WasFit). ${padrao ? `Regra: ${regraTexto(padrao)}.` : ''} Mova o contato no kanban sempre que avançar com ele.</p>
      ${r.lista.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Nível</th><th>Contato</th><th>Coluna</th><th>Sem ação há</th></tr></thead><tbody>
        ${r.lista.map((x) => `<tr><td>${selo(x.nivel)}</td><td class="nome">${esc(x.contato || '—')}<span class="sub">${esc(x.numero || '')}</span></td><td>${esc(x.coluna)}</td><td><b>${tempo(x.horas_sem_acao)}</b></td></tr>`).join('')}
      </tbody></table></div>` : vazio('Nenhum contato seu no kanban agora.')}</div>`;
}
