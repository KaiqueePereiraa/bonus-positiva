// Cartão "Análise da semana" (26/11/2026): a leitura que a IA escreve toda segunda ~7h (função analise-semanal) com o que
// melhorou/piorou por unidade e 3 a 5 ações para o gestor. Lê a mais recente de analises_semanais; a regra de acesso do banco
// limita à academia de quem está logado, e a análise da academia inteira só aparece para o administrador geral (super).
// Uso no Painel: `${await cartaoAnaliseSemanal(ctx)}` — devolve '' para quem não deve ver (consultora, coordenador de unidade).
// Sem CSS novo: só cartao/dica/selo e listas simples (tokens da marca).
import { sb } from '../../../shared/sessao.js?v=20261126225450';
import { esc } from '../ui.js?v=20261126225450';

const dataCurta = (iso) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' }).format(new Date(`${iso}T12:00:00Z`));
export const periodoSemana = (ini, fim) => `${dataCurta(ini)} a ${dataCurta(fim)}`;
const LISTA = 'style="margin:6px 0 10px;padding-left:18px;display:grid;gap:6px"';

// HTML do cartão a partir da linha de analises_semanais (puro, sem banco). Sem análise = nada (não ocupa o Painel).
export function htmlAnaliseSemanal(a) {
  if (!a) return '';
  const itens = (lista, selo, texto) => (lista || []).map((t) => `<li><span class="selo ${selo}">${texto}</span> ${esc(t)}</li>`).join('');
  const unidades = (a.por_unidade || []).map((u) => {
    const li = itens(u.melhorou, 'verde', 'melhorou') + itens(u.piorou, 'laranja', 'piorou');
    return li ? `<p style="margin:12px 0 0"><b>${esc(u.unidade)}</b></p><ul ${LISTA}>${li}</ul>` : '';
  }).join('');
  const acoes = (a.acoes || []).map((x) => `<li><b>${esc(x.acao)}</b>${x.unidade && x.unidade !== 'Todas' ? ` <span class="selo cinza">${esc(x.unidade)}</span>` : ''}${x.por_que ? `<br><span class="dica">${esc(x.por_que)}</span>` : ''}</li>`).join('');
  return `<div class="cartao" id="analise-semanal">
    <h2>Análise da semana <span class="selo cinza">${esc(periodoSemana(a.semana_ini, a.semana_fim))}</span> <span class="selo azul">IA</span></h2>
    <p>${esc(a.resumo)}</p>
    ${unidades}
    ${acoes ? `<p style="margin:14px 0 0"><b>O que fazer esta semana</b></p><ol ${LISTA}>${acoes}</ol>` : ''}
    <p class="dica">Escrita pela IA com os números da Central e da EVO (semana × semana anterior e × mesmos dias do mês anterior). Confira antes de cobrar.</p>
  </div>`;
}

export async function cartaoAnaliseSemanal(ctx) {
  if (ctx?.perfil?.papel_tarefas !== 'admin') return '';
  const { data, error } = await sb.from('analises_semanais')
    .select('semana_ini, semana_fim, resumo, por_unidade, acoes, criado_em')
    .is('unidade', null).order('semana_ini', { ascending: false }).limit(1).maybeSingle();
  if (error) { console.error('analises_semanais:', error.message); return ''; }
  return htmlAnaliseSemanal(data);   // coordenador de unidade não recebe a da academia inteira (regra do banco) → ''
}
