// Regras do Painel master da WasFit (puras; testadas em tests/master-regras.test.js).
// Recebem a lista de academias de master_painel() e devolvem resumo, saúde de cada academia e filtros.
// Saúde = o que um dono de SaaS olha primeiro: está pagando (licença), está usando (contatos e acessos) e está ativa.

export const DIAS_ALERTA_LICENCA = 15;   // igual ao selo do topo da Central (laranja até 15 dias)
export const DIAS_SEM_ACESSO_ALERTA = 7;
export const DIAS_SEM_ACESSO_CRITICO = 14;

const diasDesde = (ts, agora) => (ts ? Math.floor((agora - Date.parse(ts)) / 864e5) : null);

// Saúde de uma academia: inativa | vermelho | amarelo | verde, com os motivos em português
export function saude(c, agora = Date.now()) {
  if (c.ativa === false) return { nivel: 'inativa', motivos: ['Academia inativa'] };
  const vermelho = [], amarelo = [];
  const dl = c.dias_licenca;
  if (dl != null && dl < 0) vermelho.push(`Licença vencida há ${-dl} ${-dl === 1 ? 'dia' : 'dias'}`);
  else if (dl != null && dl <= DIAS_ALERTA_LICENCA) amarelo.push(dl === 0 ? 'Licença vence hoje' : `Licença vence em ${dl} ${dl === 1 ? 'dia' : 'dias'}`);
  if (!(c.contatos_30d > 0)) vermelho.push('Nenhum contato feito em 30 dias');
  else if (!(c.contatos_7d > 0)) amarelo.push('Nenhum contato feito nesta semana');
  const sem = diasDesde(c.ultimo_login, agora);
  if (sem == null) vermelho.push('Ninguém entrou ainda');
  else if (sem >= DIAS_SEM_ACESSO_CRITICO) vermelho.push(`Ninguém entra há ${sem} dias`);
  else if (sem >= DIAS_SEM_ACESSO_ALERTA) amarelo.push(`Ninguém entra há ${sem} dias`);
  if (!(c.usuarios > 0)) vermelho.push('Sem usuários ativos');
  if (vermelho.length) return { nivel: 'vermelho', motivos: [...vermelho, ...amarelo] };
  if (amarelo.length) return { nivel: 'amarelo', motivos: amarelo };
  return { nivel: 'verde', motivos: ['Em dia e em uso'] };
}

// Números do topo
export function resumo(contas, agora = Date.now()) {
  const ativas = contas.filter((c) => c.ativa !== false);
  const s = ativas.map((c) => saude(c, agora).nivel);
  return {
    total: contas.length,
    ativas: ativas.length,
    inativas: contas.length - ativas.length,
    emUso: ativas.filter((c) => c.contatos_7d > 0).length,
    paradas: ativas.filter((c) => !(c.contatos_7d > 0)).length,
    emRisco: s.filter((n) => n === 'vermelho' || n === 'amarelo').length,
    licencaVencendo: ativas.filter((c) => c.dias_licenca != null && c.dias_licenca >= 0 && c.dias_licenca <= DIAS_ALERTA_LICENCA).length,
    licencaVencida: ativas.filter((c) => c.dias_licenca != null && c.dias_licenca < 0).length,
    semLicenca: ativas.filter((c) => c.licenca_vence == null).length,
    receitaMensal: ativas.reduce((t, c) => t + (Number(c.valor_mensal) || 0), 0),
    semValor: ativas.filter((c) => !(Number(c.valor_mensal) > 0)).length,
    unidades: ativas.reduce((t, c) => t + (c.unidades || 0), 0),
    usuarios: ativas.reduce((t, c) => t + (c.usuarios || 0), 0),
    contatos7d: ativas.reduce((t, c) => t + (c.contatos_7d || 0), 0),
  };
}

export const FILTROS = [
  ['todas', 'Todas'], ['ativas', 'Ativas'], ['inativas', 'Inativas'], ['risco', 'Precisam de atenção'], ['licenca', 'Licença vencendo ou vencida'],
];
export function filtrar(contas, filtro, agora = Date.now()) {
  if (filtro === 'ativas') return contas.filter((c) => c.ativa !== false);
  if (filtro === 'inativas') return contas.filter((c) => c.ativa === false);
  if (filtro === 'risco') return contas.filter((c) => ['vermelho', 'amarelo'].includes(saude(c, agora).nivel));
  if (filtro === 'licenca') return contas.filter((c) => c.ativa !== false && c.dias_licenca != null && c.dias_licenca <= DIAS_ALERTA_LICENCA);
  return contas;
}

// "há 5 min", "há 3 h", "ontem", "há 12 dias", "nunca"
export function haQuanto(ts, agora = Date.now()) {
  if (!ts) return 'nunca';
  const min = Math.round((agora - Date.parse(ts)) / 60000);
  if (min < 2) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

export const reais = (v) => `R$ ${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
