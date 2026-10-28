// Insights da Operação — frases geradas por regras sobre os dados reais (sem IA, sem inventar).
import * as dados from '../dados.js';
import { gerarInsights } from '../analises.js';
import { somarDias } from '../regras.js';
import { esc } from '../ui.js';

const GRUPOS = { comercial: 'Comercial', produtividade: 'Produtividade', prazos: 'Prazos' };

export async function render(el, ctx) {
  const hoje = ctx.hoje();
  const desde = somarDias(hoje, -120);
  const unidade = ctx.unidade || undefined;   // segue a unidade escolhida no topo
  const [tarefas, itensNaoFechou] = await Promise.all([
    dados.tarefas({ desde, ate: somarDias(hoje, 40), unidade }),
    dados.itensPeriodo({ controle: 'nao_fechou', desde, ate: somarDias(hoje, 40), unidade }),
  ]);
  const lista = gerarInsights({ tarefas, itensNaoFechou, motivos: ctx.motivos, hoje });

  el.innerHTML = `<div class="cartao"><p class="dica"><b>${esc(ctx.unidade ? ctx.nomeUnidade(ctx.unidade) : 'Todas as unidades')}</b> (troque no seletor do topo). Análises automáticas dos últimos meses, calculadas a partir do que foi registrado na Central. Cada frase mostra os números que a sustentam; quando não há dados suficientes (por exemplo, menos de 10 justificativas no mês), o insight não aparece.</p></div>
    ${lista.length ? Object.entries(GRUPOS).map(([tipo, titulo]) => {
      const doGrupo = lista.filter((i) => i.tipo === tipo);
      return doGrupo.length ? `<div class="cartao"><h2>${titulo}</h2>${doGrupo.map((i) => `<div class="faixa" style="background:#F4FAEC;border-color:#D5EDB8;color:var(--dark);margin-bottom:10px">
        <div><b>${esc(i.texto)}</b><span class="dica">Base: ${esc(i.base)}</span></div></div>`).join('')}</div>` : '';
    }).join('') : '<div class="cartao"><div class="vazio">Ainda não há dados suficientes para gerar insights. Eles aparecem conforme as consultoras forem registrando contatos e justificativas.</div></div>'}`;
}
