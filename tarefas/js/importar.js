// Leitura e validação das planilhas exportadas do EVO.
// lerXlsx/lerCsv produzem uma matriz (linhas x colunas de texto); matrizParaRegistros
// aplica o mapeamento do controle e devolve registros prontos para a função de importação.

import { normalizarCabecalho, normalizarTelefone } from './regras.js?v=20261030185834';

// Sinônimos já normalizados (ver normalizarCabecalho).
export const MAPEAMENTOS = {
  inadimplencia: {
    nome: 'Inadimplência',
    obrigatorias: {
      evo_id: ['id do cliente', 'id'],
      nome: ['nome'],
      celular: ['no do celular', 'celular', 'telefone'],
    },
    opcionais: {
      sobrenome: ['sobrenome'],
      telefone: ['telefone'],
    },
  },
  risco: {
    nome: 'Risco de abandono',
    obrigatorias: {
      evo_id: ['id'],
      nome: ['nome'],
      celular: ['celular', 'no do celular'],
    },
    opcionais: {
      consultor_evo: ['consultor'],
      ultima_presenca: ['ultima presenca'],
    },
  },
  nao_fechou: {
    nome: 'Por que não fechou?',
    obrigatorias: {
      evo_id: ['id'],
      nome: ['nome'],
      consultor_evo: ['consultor'],
    },
    opcionais: {
      data_cadastro: ['data de cadastro'],
      idade: ['idade'],
      como_conheceu: ['como conheceu'],
      interesse: ['interesse'],
      celular: ['celular', 'no do celular'],
    },
  },
};

const ROTULOS = { evo_id: 'ID', nome: 'Nome', celular: 'Celular', consultor_evo: 'Consultor' };

// Colunas que só existem num tipo de export — usadas para dizer "isso parece ser o arquivo de X".
const ASSINATURAS = {
  inadimplencia: ['id do cliente', 'sobrenome'],
  risco: ['ultima presenca'],
  nao_fechou: ['data de cadastro', 'como conheceu', 'interesse'],
};

// Converte o valor de uma célula do ExcelJS em texto.
export function celulaTexto(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('result' in v) return celulaTexto(v.result);
    if ('text' in v) return celulaTexto(v.text);
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('');
    return '';
  }
  return String(v).trim();
}

// Lê a primeira aba sem confiar na <dimension> declarada (o export do EVO declara só "A1").
export async function lerXlsx(buffer, ExcelJS) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const matriz = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const linha = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => { linha[col - 1] = celulaTexto(cell.value); });
    matriz.push(Array.from(linha, (c) => c ?? ''));
  });
  return matriz;
}

// CSV com ";" ou "," (detectado pela 1ª linha) e aspas duplas.
export function lerCsv(texto) {
  const t = String(texto).replace(/^﻿/, '');
  const primeira = t.split(/\r?\n/, 1)[0];
  const sep = (primeira.match(/;/g) || []).length >= (primeira.match(/,/g) || []).length ? ';' : ',';
  const linhas = [];
  let linha = [], campo = '', aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo.trim()); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      linha.push(campo.trim()); linhas.push(linha); linha = []; campo = '';
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo.trim()); linhas.push(linha); }
  return linhas.filter((l) => l.some((c) => c !== ''));
}

function localizar(cabecalho, sinonimos) {
  for (const s of sinonimos) {
    const i = cabecalho.indexOf(s);
    if (i !== -1) return i;
  }
  return -1;
}

function parecerSer(cabecalho, controleAtual) {
  for (const [id, cols] of Object.entries(ASSINATURAS)) {
    if (id !== controleAtual && cols.some((c) => cabecalho.includes(c))) return MAPEAMENTOS[id].nome;
  }
  return null;
}

// "30/09/2026" -> "2026-09-30"; já ISO fica como está; outro formato -> null
function dataBR(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

// Devolve { registros, avisos, erro }. Com erro, nada deve ser importado.
export function matrizParaRegistros(matriz, controle) {
  const mapa = MAPEAMENTOS[controle];
  const linhas = matriz.filter((l) => l.some((c) => String(c).trim() !== ''));
  if (linhas.length === 0) return { registros: [], avisos: [], erro: 'O arquivo está vazio.' };

  const cabecalho = linhas[0].map(normalizarCabecalho);
  const idx = {};
  const faltando = [];
  for (const [campo, sin] of Object.entries(mapa.obrigatorias)) {
    idx[campo] = localizar(cabecalho, sin);
    if (idx[campo] === -1) faltando.push(ROTULOS[campo]);
  }
  if (faltando.length) {
    const outro = parecerSer(cabecalho, controle);
    const dica = outro ? ` Este arquivo parece ser do controle "${outro}".` : '';
    return { registros: [], avisos: [], erro: `Faltam colunas obrigatórias para ${mapa.nome}: ${faltando.join(', ')}.${dica}` };
  }
  // Tem as colunas, mas é claramente o export de outro controle (ex.: risco subido como "não fechou").
  const outro = parecerSer(cabecalho, controle);
  if (outro && !ASSINATURAS[controle].some((c) => cabecalho.includes(c))) {
    return { registros: [], avisos: [], erro: `Este arquivo parece ser do controle "${outro}", não de ${mapa.nome}.` };
  }
  for (const [campo, sin] of Object.entries(mapa.opcionais)) idx[campo] = localizar(cabecalho, sin);

  const avisos = [];
  const vistos = new Set();
  const registros = [];
  const val = (l, campo) => (idx[campo] >= 0 ? String(l[idx[campo]] ?? '').trim() : '');

  linhas.slice(1).forEach((l, n) => {
    const linhaPlanilha = n + 2;
    const evo_id = val(l, 'evo_id');
    let nome = val(l, 'nome');
    if (!evo_id || !nome) {
      avisos.push(`Linha ${linhaPlanilha} ignorada: sem ${!evo_id ? 'ID' : 'nome'}.`);
      return;
    }
    if (vistos.has(evo_id)) {
      avisos.push(`Linha ${linhaPlanilha} ignorada: ID ${evo_id} repetido.`);
      return;
    }
    vistos.add(evo_id);

    const sobrenome = val(l, 'sobrenome');
    if (sobrenome) nome = `${nome} ${sobrenome}`;
    const celular = normalizarTelefone(val(l, 'celular')) || normalizarTelefone(val(l, 'telefone'));

    const dados = {};
    if (controle === 'risco') {
      dados.consultor_evo = val(l, 'consultor_evo') || null;
      dados.ultima_presenca = val(l, 'ultima_presenca') || null;
    } else if (controle === 'nao_fechou') {
      dados.consultor_evo = val(l, 'consultor_evo') || null;
      dados.data_cadastro = dataBR(val(l, 'data_cadastro'));
      const idade = parseInt(val(l, 'idade'), 10);
      dados.idade = Number.isFinite(idade) ? idade : null;
      dados.como_conheceu = val(l, 'como_conheceu') || null;
      dados.interesse = val(l, 'interesse') || null;
    }
    registros.push({ evo_id, nome: nome.replace(/\s+/g, ' '), celular, dados });
  });

  if (registros.length === 0) return { registros, avisos, erro: 'Nenhuma linha válida no arquivo.' };
  return { registros, avisos, erro: null };
}
