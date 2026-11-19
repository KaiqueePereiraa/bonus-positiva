// Escala de fim de semana e feriados — funções puras (sem tela, sem banco): agrupam as linhas de
// escala_periodo em blocos para exibir e montam as opções do pedido de troca.
import { somarDias, semAcento } from './regras.js?v=20261118214522';

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

// ── Visual ──

// Cor de cada pessoa, no mesmo estilo da planilha da escala (Maria amarela, Isa verde, Rayny vermelha,
// Adrielly preta, Vitória branca, Ana azul). Quem não está na lista ganha uma cor fixa pelo nome.
const FIXAS = {
  maria: { bg: '#FFE74C', fg: '#3A3000', bd: '#E6CB1E' },
  isa: { bg: '#6DAA45', fg: '#FFFFFF', bd: '#6DAA45' },
  isabelly: { bg: '#6DAA45', fg: '#FFFFFF', bd: '#6DAA45' },
  rayny: { bg: '#E5393C', fg: '#FFFFFF', bd: '#E5393C' },
  adrielly: { bg: '#1A1F26', fg: '#FFFFFF', bd: '#1A1F26' },
  vitoria: { bg: '#FFFFFF', fg: '#212B37', bd: '#212B37' },
  ana: { bg: '#2F6DB5', fg: '#FFFFFF', bd: '#2F6DB5' },
};
const PALETA = [
  { bg: '#8E5BD6', fg: '#FFFFFF', bd: '#8E5BD6' }, { bg: '#E8833A', fg: '#FFFFFF', bd: '#E8833A' },
  { bg: '#1FA3A3', fg: '#FFFFFF', bd: '#1FA3A3' }, { bg: '#D6457F', fg: '#FFFFFF', bd: '#D6457F' },
  { bg: '#5B6472', fg: '#FFFFFF', bd: '#5B6472' }, { bg: '#A67C52', fg: '#FFFFFF', bd: '#A67C52' },
];
export function corPessoa(nome) {
  const primeiro = semAcento(String(nome ?? '').trim().split(/\s+/)[0]).toLowerCase();
  if (FIXAS[primeiro]) return FIXAS[primeiro];
  let h = 0;
  for (const ch of primeiro) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return PALETA[h % PALETA.length];
}

// Agrupa os blocos (já ordenados por data) por mês do primeiro dia: [{ ano, mes, blocos }]
export function agruparPorMes(blocos) {
  const grupos = [];
  for (const b of blocos) {
    const ano = +b.data.slice(0, 4);
    const mes = +b.data.slice(5, 7);
    let g = grupos[grupos.length - 1];
    if (!g || g.ano !== ano || g.mes !== mes) { g = { ano, mes, blocos: [] }; grupos.push(g); }
    g.blocos.push(b);
  }
  return grupos;
}
