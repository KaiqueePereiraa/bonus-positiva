// Acesso a dados da Central. Toda leitura/escrita passa por aqui (as telas não falam com o Supabase).
// Escritas usam as funções do banco (supabase/migrations/005_funcoes.sql), que conferem permissão.
import { sb } from '../../shared/sessao.js?v=20261117103025';

const ok = ({ data, error }) => { if (error) throw error; return data; };
const rpc = async (nome, args) => ok(await sb.rpc(nome, args));

// ── Leituras ──
export const equipe = () => rpc('listar_equipe');
export const controles = async () => ok(await sb.from('controles').select('*'));
export const unidades = async () => ok(await sb.from('unidades').select('*').order('ordem'));
export const salvarUnidade = async (id, campos) => ok(await sb.from('unidades').update(campos).eq('id', id));
export const motivos = async () => ok(await sb.from('motivos').select('*').order('ordem'));
export const feriados = async () => ok(await sb.from('feriados').select('*').order('data'));

// Tarefas com status calculado (view tarefas_status). RLS já filtra para a consultora.
export async function tarefas({ controle, responsavel, desde, ate, importacao, unidade } = {}) {
  let q = sb.from('tarefas_status').select('*').order('prazo', { ascending: false });
  if (controle) q = q.eq('controle_id', controle);
  if (unidade) q = q.eq('unidade', unidade);
  if (responsavel) q = q.eq('responsavel_id', responsavel);
  if (importacao) q = q.eq('importacao_id', importacao);
  if (desde) q = q.gte('prazo', desde);
  if (ate) q = q.lte('prazo', ate);
  return ok(await q);
}

export const tarefa = async (id) => ok(await sb.from('tarefas_status').select('*').eq('id', id).maybeSingle());

export const item = async (id) => ok(await sb.from('itens').select('*').eq('id', id).maybeSingle());

export const itensDaTarefa = async (tarefaId) =>
  ok(await sb.from('itens').select('*').eq('tarefa_id', tarefaId).order('ordem'));

export const itensDaImportacao = async (importacaoId) =>
  ok(await sb.from('itens').select('*').eq('importacao_id', importacaoId).order('ordem'));

export const semResponsavel = async (importacaoId) =>
  ok(await sb.from('itens').select('*').eq('importacao_id', importacaoId).is('responsavel_id', null).order('ordem'));

// "Sem responsável" do Por que não fechou? que a consultora enxerga (RLS); para o admin, todos.
export const semResponsavelVisiveis = async () =>
  ok(await sb.from('itens').select('*').eq('controle_id', 'nao_fechou').is('responsavel_id', null).order('ordem'));

export async function importacoes(controle, { limite = 20, unidade } = {}) {
  let q = sb.from('importacoes').select('*').eq('controle_id', controle).is('desfeita_em', null);
  if (unidade) q = q.eq('unidade', unidade);
  return ok(await q.order('referencia_inicio', { ascending: false }).limit(limite));
}

// Itens para análises (indicadores, insights, relatórios), com o prazo da tarefa.
// Contatos feitos no período (inadimplência, risco, não fechou) com o resultado conferido na EVO.
export async function itensComResultado({ desde, ate, unidade }) {
  let q = sb.from('itens').select('id, controle_id, responsavel_id, feito_em, resultado, resultado_valor, tarefas!inner(unidade, cancelada_em)')
    .is('tarefas.cancelada_em', null).in('controle_id', ['inadimplencia', 'risco', 'nao_fechou']).not('feito_em', 'is', null);
  if (desde) q = q.gte('feito_em', `${desde}T00:00:00-03:00`);
  if (ate) q = q.lte('feito_em', `${ate}T23:59:59-03:00`);
  if (unidade) q = q.eq('tarefas.unidade', unidade);
  return ok(await q.limit(20000));
}

export async function itensPeriodo({ controle, desde, ate, unidade }) {
  let q = sb.from('itens').select('*, tarefas!inner(prazo, periodo_inicio, responsavel_id, cancelada_em, unidade)')
    .is('tarefas.cancelada_em', null);
  if (controle) q = q.eq('controle_id', controle);
  if (desde) q = q.gte('tarefas.prazo', desde);
  if (ate) q = q.lte('tarefas.prazo', ate);
  if (unidade) q = q.eq('tarefas.unidade', unidade);
  return ok(await q.limit(10000));
}

// Todos os interessados das listas escolhidas (inclui quem ainda não tem consultora) — relatório da diretoria.
export async function itensDasImportacoes(ids) {
  if (!ids.length) return [];
  return ok(await sb.from('itens').select('*').eq('controle_id', 'nao_fechou').in('importacao_id', ids).order('ordem').limit(10000));
}

// Listas a fazer (título, explicação, prazo). A consultora só enxerga as listas em que tem contatos (RLS).
export async function listasFazer({ unidade } = {}) {
  let q = sb.from('listas_fazer').select('*').order('criada_em', { ascending: false });
  if (unidade) q = q.eq('unidade', unidade);
  return ok(await q);
}
export const editarListaFazer = async (id, campos) => ok(await sb.from('listas_fazer').update(campos).eq('id', id));

// ── Ações da consultora ──
export const marcar = (id) => rpc('marcar_enviada', { p_item: id });
// Lista a fazer: marca como feito e guarda a observação (opcional); chamar de novo atualiza a observação.
export const marcarListaItem = (id, observacao) => rpc('marcar_lista_item', { p_item: id, p_obs: observacao || null });
// Risco de abandono: marca com observação e tipo do aluno (gympass_convenios | beneficio_colaborador | vazio).
// Com tipo, o aluno fica registrado e sai das próximas listas; chamar de novo atualiza.
export const marcarRisco = (id, observacao, classe) =>
  rpc('marcar_risco_item', { p_item: id, p_observacao: observacao || null, p_classe: classe || null });
export const riscoExcecoes = async (unidade) =>
  ok(await sb.from('risco_excecoes').select('*').eq('unidade', unidade).order('criado_em', { ascending: false }));
export const removerExcecaoRisco = (id) => rpc('remover_excecao_risco', { p_id: id });
export const desmarcar = (id) => rpc('desmarcar', { p_item: id });
export const assumir = (id) => rpc('assumir_item', { p_item: id });
export const salvarMotivo = (id, motivo, texto, observacao) =>
  rpc('salvar_motivo', { p_item: id, p_motivo: motivo, p_texto: texto, p_observacao: observacao });

// ── Arquivos ──
export async function enviarArquivo(controle, userId, arquivo) {
  const nome = arquivo.name.replace(/[^\w.\-]+/g, '_');
  const caminho = `${controle}/${userId}/${Date.now()}-${nome}`;
  ok(await sb.storage.from('importacoes').upload(caminho, arquivo, { upsert: false }));
  return caminho;
}

export async function linkArquivo(caminho) {
  const { signedUrl } = ok(await sb.storage.from('importacoes').createSignedUrl(caminho, 120, { download: true }));
  return signedUrl;
}

// ── Importações ──
export const importarRisco = (unidade, data, caminho, nome, registros, proximoPonteiro) =>
  rpc('importar_risco', { p_unidade: unidade, p_data: data, p_arquivo_path: caminho, p_arquivo_nome: nome, p_registros: registros, p_proximo_ponteiro: proximoPonteiro });
export const importarNaoFechou = (unidade, ano, mes, caminho, nome, registros) =>
  rpc('importar_nao_fechou', { p_unidade: unidade, p_ano: ano, p_mes: mes, p_arquivo_path: caminho, p_arquivo_nome: nome, p_registros: registros });
export const importarInadimplencia = (tarefaId, caminho, nome, registros) =>
  rpc('importar_inadimplencia', { p_tarefa: tarefaId, p_arquivo_path: caminho, p_arquivo_nome: nome, p_registros: registros });
export const importarListaFazer = (unidade, titulo, instrucoes, prazo, mensagem, caminho, nome, registros) =>
  rpc('importar_lista_fazer', { p_unidade: unidade, p_titulo: titulo, p_instrucoes: instrucoes, p_prazo: prazo, p_mensagem: mensagem || null,
    p_arquivo_path: caminho, p_arquivo_nome: nome, p_registros: registros });
// Lista própria da consultora (só dela, sem divisão): migration 016.
export const importarListaFazerPropria = (titulo, instrucoes, prazo, mensagem, caminho, nome, registros) =>
  rpc('importar_lista_fazer_propria', { p_titulo: titulo, p_instrucoes: instrucoes, p_prazo: prazo, p_mensagem: mensagem || null,
    p_arquivo_path: caminho, p_arquivo_nome: nome, p_registros: registros });
export const desfazerListaPropria = (id) => rpc('desfazer_lista_propria', { p_importacao: id });
export const desfazerImportacao = (id) => rpc('desfazer_importacao', { p_importacao: id });

// ── Ações do admin ──
export const dividirSemResponsavel = (importacaoId) => rpc('dividir_sem_responsavel', { p_importacao: importacaoId });
export const moverItem = (id, para) => rpc('mover_item', { p_item: id, p_para: para });
// Remove um interessado do "Por que não fechou?" (ex.: cadastro duplicado). Só admin; fica registrado em `eventos`.
export const excluirInteressado = (id) => rpc('excluir_item_nao_fechou', { p_item: id });
export const trocarPlantao = (tarefaId, nova) => rpc('trocar_plantao', { p_tarefa: tarefaId, p_nova: nova });
export const garantirInadimplencia = () => rpc('garantir_inadimplencia');

// Convite por e-mail (Edge Function convidar-usuario, só admin). O link leva à tela de criar senha.
export async function convidar(email, perfil) {
  const redirectTo = new URL('../index.html', location.href).href;
  const { data, error } = await sb.functions.invoke('convidar-usuario', { body: { email, perfil, redirectTo } });
  if (error) {
    const detalhe = await error.context?.json?.().catch(() => null);
    throw new Error(detalhe?.erro || 'Não foi possível enviar o convite.');
  }
  return data;
}

// Conexão privada com a EVO (Edge Function `evo`, só admin). O DNS e o token ficam nos segredos da função;
// daqui só saem pedidos e só voltam contagens (nunca dados de alunos nem a chave).
export async function evoAcao(acao, extra = {}) {
  const { data, error } = await sb.functions.invoke('evo', { body: { acao, ...extra } });
  if (error) {
    const detalhe = await error.context?.json?.().catch(() => null);
    throw new Error(detalhe?.erro || 'Não foi possível falar com a função da EVO.');
  }
  return data;
}
export const testarEvo = () => evoAcao('ping');
// Painel do gestor e Retorno do mês (números agregados, só admin)
export const painelGestor = () => rpc('painel_gestor', {});
export const retornoMes = (ano, mes) => rpc('retorno_mes', { p_ano: ano, p_mes: mes });
export const descobrirFiliaisEvo = () => evoAcao('filiais');
// simular = true (padrão) só conta; false roda de verdade e envia a lista
export const rodarEvo = (tipo, unidade, simular = true, substituir = false) => evoAcao('rodar', { tipo, unidade, simular, ...(substituir ? { substituir: true } : {}) });
export const evoUnidades = async () => ok(await sb.from('evo_unidades').select('*'));
export const evoExecucoes = async (limite = 25) =>
  ok(await sb.from('evo_execucoes').select('*').order('criado_em', { ascending: false }).limit(limite));
export const ligarUnidadeEvo = (unidade, idBranch) => rpc('evo_ligar_unidade', { p_unidade: unidade, p_id_branch: idBranch ?? null });

// Novo link para criar/trocar a senha (mesmo e-mail do "Esqueci minha senha"; o convite vence em 24h).
export async function enviarLinkAcesso(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: new URL('../index.html', location.href).href });
  if (error) throw error;
}

export const perfis = async () => ok(await sb.from('profiles').select('*').order('nome'));
export const atualizarPerfil = async (id, campos) => ok(await sb.from('profiles').update(campos).eq('id', id));
export const atualizarControle = async (id, campos) => ok(await sb.from('controles').update(campos).eq('id', id));

export async function config() {
  const linhas = ok(await sb.from('config_central').select('*'));
  return Object.fromEntries(linhas.map((l) => [l.chave, l.valor]));
}
export const salvarConfig = async (chave, valor) => ok(await sb.from('config_central').upsert({ chave, valor }));

export const salvarMotivoCadastro = async (m) => ok(await sb.from('motivos').upsert(m));
export const salvarFeriado = async (f) => ok(await sb.from('feriados').upsert(f));
export const removerFeriado = async (data) => ok(await sb.from('feriados').delete().eq('data', data));

// ── Escala de fim de semana e feriados (migration 017) ──
export const escalaPeriodo = (ini, fim) => rpc('escala_periodo', { p_ini: ini, p_fim: fim });
export const escalaConfig = async () => ok(await sb.from('escala_config').select('*').eq('id', 1).maybeSingle());   // só admin
export const escalaCiclo = async () => ok(await sb.from('escala_ciclo').select('*'));                              // só admin
export const salvarCicloEscala = (inicio, semanas, ciclo) => rpc('escala_salvar_ciclo', { p_inicio: inicio, p_semanas: semanas, p_ciclo: ciclo });
// Escala: troca o nome de quem não tem cadastro, em toda a escala — por um cadastro (vincular) ou por outro nome.
export const substituirNomeEscala = (nome, pessoa, novoNome) =>
  rpc('escala_substituir_nome', { p_nome: nome, p_pessoa: pessoa || null, p_novo_nome: novoNome || null });
export const definirDiaEscala = (data, pessoas) => rpc('escala_definir_dia', { p_data: data, p_pessoas: pessoas });
export const trocasEscala = async () => ok(await sb.from('escala_trocas').select('*').order('criada_em', { ascending: false }).limit(80));
export const solicitarTrocaEscala = (destino, dataOrigem, dataTroca) =>
  rpc('solicitar_troca_escala', { p_destino: destino, p_data_origem: dataOrigem, p_data_troca: dataTroca || null });
export const responderTrocaEscala = (id, aceitar) => rpc('responder_troca_escala', { p_troca: id, p_aceitar: aceitar });
export const cancelarTrocaEscala = (id) => rpc('cancelar_troca_escala', { p_troca: id });

export const testarWhatsapp = () => rpc('testar_whatsapp');
export const enviosWhatsapp = async () =>
  ok(await sb.from('envios_whatsapp').select('*').order('criado_em', { ascending: false }).limit(100));

// ── Sino ──
export async function vistoAte(userId) {
  const d = ok(await sb.from('avisos_vistos').select('visto_ate').eq('user_id', userId).maybeSingle());
  return d?.visto_ate || null;
}
export const marcarAvisosVistos = async (userId) =>
  ok(await sb.from('avisos_vistos').upsert({ user_id: userId, visto_ate: new Date().toISOString() }));
