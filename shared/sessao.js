// Sessão do Supabase Auth compartilhada entre login, bônus e Central de Tarefas.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=20261106194830';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Caminho relativo à raiz do site (esta pasta é site/shared/).
export const raiz = (caminho = '') => new URL(`../${caminho}`, import.meta.url).href;

export async function carregarPerfil() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (error) throw error;
  return data ? { ...data, email: data.email || session.user.email } : { id: session.user.id, email: session.user.email, ativo: false };
}

export function areasDoPerfil(p) {
  return {
    tarefas: !!(p?.ativo && p.acesso_tarefas && p.papel_tarefas),
    bonus: !!(p?.ativo && p.acesso_bonus && p.papel_bonus),
  };
}

// Usado no topo de bonus/ e tarefas/: sem sessão ou sem acesso volta para o login.
export async function exigirArea(area) {
  const perfil = await carregarPerfil();
  if (!perfil || !areasDoPerfil(perfil)[area]) {
    location.replace(raiz('index.html'));
    return new Promise(() => {}); // a página está saindo; não continua
  }
  return perfil;
}

export async function sair() {
  await sb.auth.signOut();
  location.replace(raiz('index.html'));
}

// Mensagens do Supabase Auth em português.
export function traduzirErroAuth(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que você recebeu.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (m.includes('password should be') || m.includes('at least')) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (m.includes('same password') || m.includes('different from the old')) return 'A nova senha precisa ser diferente da anterior.';
  if (m.includes('expired') || m.includes('invalid') && m.includes('link')) return 'O link expirou. Peça um novo.';
  return 'Não foi possível concluir. Tente de novo.';
}
