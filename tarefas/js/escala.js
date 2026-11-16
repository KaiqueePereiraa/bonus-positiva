// Escala de fim de semana e feriados — funções puras (sem tela, sem banco): agrupam as linhas de
// escala_periodo em blocos para exibir e montam as opções do pedido de troca.
import { somarDias } from './regras.js?v=20261116154455';

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const dow = (d) => new Date(`${d}T12:00:00Z`).getUTCDay();   // 0 = domingo … 6 = sábado

// "sábado 15/11"
export const rotuloData = (d) => `${DIAS[dow(d)]} ${d.slice(8, 10)}/${d.slice(5, 7)}`;

// linhas: [{ data, pessoa_id, nome }] (escala_periodo); feriados: [{ data, nome }].
// Devolve blocos ordenados por data:
//   { tipo: 'fds', data: <sábado>, dias: [sábado, domingo] }   (feriado em fim de semana aparece dentro do bloco)
//   { tipo: 'feriado', data, dias: [dia] }                      (feriado em dia útil)
// dia = { data, pessoas: [{ id, nome }], feriado: nome | null }
export function agendaEscala({ ini, fim, linhas, feriados = [], incluirFeriadosVazios = false }) {
  const porData = new Map();
  for (const l of linhas) {
    if (!porData.has(l.data)) porData.set(l.data, []);
    porData.get(l.data).push({ id: l.pessoa_id || null, nome: l.nome });
  }
  const fer = new Map(feriados.map((f) => [f.data, f.nome]));
  const dia = (data) => ({ data, pessoas: porData.get(data) || [], feriado: fer.get(data) || null });

  const blocos = [];
  // se o período começa num domingo, o sábado anterior entra para o fim de semana não ficar pela metade
  let sab = ini;
  if (dow(ini) === 0) sab = somarDias(ini, -1);
  else while (dow(sab) !== 6) sab = somarDias(sab, 1);
  for (; sab <= fim; sab = somarDias(sab, 7)) {
    blocos.push({ tipo: 'fds', data: sab, dias: [dia(sab), dia(somarDias(sab, 1))] });
  }
  for (const f of feriados) {
    if (f.data < ini || f.data > fim) continue;
    const w = dow(f.data);
    if (w === 0 || w === 6) continue;
    const d = dia(f.data);
    if (!d.pessoas.length && !incluirFeriadosVazios) continue;
    blocos.push({ tipo: 'feriado', data: f.data, dias: [d] });
  }
  return blocos.sort((a, b) => a.data.localeCompare(b.data));
}

// Opções do pedido de troca para quem trabalha em `origem`.
// consultoras: [{ id, nome }] com login. Cada colega que NÃO está na escala de `origem` gera:
//   • "cobre o meu dia" (valor "<id>|")
//   • uma opção por dia futuro em que ela trabalha e eu não: "em troca fico com <data>" (valor "<id>|<data>")
export function opcoesTroca({ blocos, eu, origem, hoje, consultoras }) {
  const dias = blocos.flatMap((b) => b.dias);
  const ids = (data) => new Set((dias.find((d) => d.data === data)?.pessoas || []).map((p) => p.id).filter(Boolean));
  const naOrigem = ids(origem);
  const opcoes = [];
  for (const c of consultoras) {
    if (c.id === eu || naOrigem.has(c.id)) continue;
    opcoes.push({ valor: `${c.id}|`, destino: c.id, dataTroca: null, rotulo: `${c.nome} — cobre o meu dia` });
    for (const d of dias) {
      if (d.data <= hoje || d.data === origem) continue;
      const no = ids(d.data);
      if (no.has(c.id) && !no.has(eu)) {
        opcoes.push({ valor: `${c.id}|${d.data}`, destino: c.id, dataTroca: d.data, rotulo: `${c.nome} — em troca fico com ${rotuloData(d.data)}` });
      }
    }
  }
  return opcoes;
}

// Lê o valor de uma opção ("<id>|<data?>") de volta em { destino, dataTroca }.
export function lerOpcaoTroca(valor) {
  const [destino, data] = String(valor || '').split('|');
  return { destino: destino || null, dataTroca: data || null };
}
