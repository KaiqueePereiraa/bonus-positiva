// Meta da semana do Bônus (resumo do "Meu dia"). Mesmas regras da página do Bônus (site/bonus/index.html):
// o mês é dividido em exatamente 4 semanas — dias soltos do começo entram na 1ª e os do fim na 4ª — e as faixas são
// Club 6/9/12 e Acqua 2/3/4 contratos "de meta" (cadastro, rematrícula ou venda completa) na semana.
// Puro: testado em tests/bonus-meta.test.js.

export const FAIXAS = {
  club: [[12, 'Super meta'], [9, 'Meta real'], [6, 'Básico']],
  laranjeiras: [[4, 'Super meta'], [3, 'Meta real'], [2, 'Básico']],
  republica: [[4, 'Super meta'], [3, 'Meta real'], [2, 'Básico']],
};

const iso = (d) => d.toISOString().slice(0, 10);
const dataISO = (br) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(br || '')); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };

// As 4 semanas do mês de `hoje` (AAAA-MM-DD): [{ ini, fim }] em AAAA-MM-DD
export function semanasDoMes(hoje) {
  const ano = +hoje.slice(0, 4), mes = +hoje.slice(5, 7) - 1;
  const primeiro = new Date(Date.UTC(ano, mes, 1)), ultimo = new Date(Date.UTC(ano, mes + 1, 0));
  const segundas = [];
  for (let d = new Date(primeiro); d <= ultimo; d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() === 1) segundas.push(new Date(d));
  const antes = (d) => { const r = new Date(d); r.setUTCDate(r.getUTCDate() - 1); return iso(r); };
  const [, s2, s3, s4] = segundas;
  return [{ ini: iso(primeiro), fim: antes(s2) }, { ini: iso(s2), fim: antes(s3) }, { ini: iso(s3), fim: antes(s4) }, { ini: iso(s4), fim: iso(ultimo) }];
}

// vendas: [{ data: 'DD/MM/AAAA', unit }] (já só as "de meta" da consultora, vindas de minha_meta_semana)
export function resumoSemana(vendas, hoje, unidade) {
  const semanas = semanasDoMes(hoje);
  const n = semanas.findIndex((s) => hoje >= s.ini && hoje <= s.fim);
  const s = semanas[n];
  const faixas = FAIXAS[unidade] || FAIXAS.club;
  const feitos = vendas.filter((v) => v.unit === unidade).map((v) => dataISO(v.data)).filter((d) => d && d >= s.ini && d <= s.fim).length;
  const atual = faixas.find(([min]) => feitos >= min);
  const proxima = [...faixas].reverse().find(([min]) => feitos < min);
  return { semana: n + 1, ini: s.ini, fim: s.fim, feitos, faixa: atual ? atual[1] : 'Abaixo do básico',
    proxima: proxima ? { nome: proxima[1], faltam: proxima[0] - feitos } : null, basico: faixas[faixas.length - 1][0] };
}

// Quadro da meta no topo do "Meu dia": marcos das faixas na barra, quantos dias faltam e uma frase de incentivo.
// r = resumoSemana(...). A barra vai até a Super meta; cada faixa vira um marco (✓ quando atingida).
export function painelMeta(r, hoje, unidade) {
  const faixas = [...(FAIXAS[unidade] || FAIXAS.club)].reverse();   // da menor para a maior
  const topo = faixas[faixas.length - 1][0];
  const dia = (s) => Date.parse(`${s}T12:00:00Z`);
  const dias = Math.max(1, Math.round((dia(r.fim) - dia(hoje)) / 864e5) + 1);   // hoje incluído
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const marcos = faixas.map(([n, nome]) => ({ n, nome, atingido: r.feitos >= n, pos: Math.round((100 * n) / topo) }));
  let frase;
  if (!r.proxima) frase = 'Super meta batida! 🏆 Semana de referência — tudo o que vier agora é extra.';
  else {
    const alvo = r.proxima.nome === 'Básico' ? 'o Básico' : `a ${r.proxima.nome}`;
    const quando = dias === 1 ? 'hoje é o último dia da semana' : `você tem ${plural(dias, 'dia', 'dias')} até domingo`;
    frase = `${r.feitos === 0 ? 'Bora começar!' : r.faixa === 'Abaixo do básico' ? 'Você está no caminho!' : `${r.faixa} garantida!`} `
      + `${r.proxima.faltam === 1 ? 'Falta' : 'Faltam'} ${plural(r.proxima.faltam, 'contrato', 'contratos')} para ${alvo} — ${quando}.`;
  }
  return { marcos, pct: Math.min(100, Math.round((100 * r.feitos) / topo)), dias, frase, topo };
}
