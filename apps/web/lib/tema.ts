/**
 * Tema claro/escuro (Configurações › Aparência). A preferência fica no aparelho (localStorage, lida antes da 1ª pintura
 * pelo SCRIPT_TEMA no <head>, sem piscar) e na conta (user_metadata.tema), para seguir a pessoa em outro aparelho.
 * O padrão continua o escuro Astro G: quem nunca escolheu não vê nada mudar.
 */
export type PreferenciaTema = 'claro' | 'escuro' | 'sistema';
export type ModoTema = 'light' | 'dark';

export const CHAVE_TEMA = 'meudia-tema';
export const TEMA_PADRAO: PreferenciaTema = 'escuro';
export const PREFERENCIAS_TEMA: readonly PreferenciaTema[] = ['claro', 'escuro', 'sistema'];

/** Cor da barra do navegador/PWA em cada modo (= fundo da página). */
export const COR_BARRA: Record<ModoTema, string> = { dark: '#050a16', light: '#f6f8fb' };

export function lerPreferencia(valor: unknown): PreferenciaTema | null {
  return typeof valor === 'string' && (PREFERENCIAS_TEMA as readonly string[]).includes(valor) ? (valor as PreferenciaTema) : null;
}

export function resolverModo(preferencia: PreferenciaTema, sistemaEscuro: boolean): ModoTema {
  if (preferencia === 'sistema') return sistemaEscuro ? 'dark' : 'light';
  return preferencia === 'claro' ? 'light' : 'dark';
}

/** Põe o modo no <html> (data-mode + color-scheme) e na cor da barra. Não grava nada. */
export function pintarModo(modo: ModoTema, doc: Document = document): void {
  const raiz = doc.documentElement;
  if (raiz.dataset.mode === modo) return;
  // Sem isso, cada transition-colors do app desbota do tema velho para o novo (botões ficam cinza por um instante).
  raiz.setAttribute('data-trocando-tema', '');
  raiz.dataset.mode = modo;
  raiz.style.colorScheme = modo;
  doc.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', COR_BARRA[modo]));
  void raiz.offsetHeight;
  const soltar = () => raiz.removeAttribute('data-trocando-tema');
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(soltar));
  else soltar();
}

/**
 * Roda no <head> antes do React: mesma regra de `resolverModo`, escrita à mão em ES5 para não depender do bundle.
 * Sem localStorage (modo privado antigo) fica no padrão escuro.
 */
export const SCRIPT_TEMA = `(function(){try{var p=null;try{p=localStorage.getItem('${CHAVE_TEMA}')}catch(e){}
if(p!=='claro'&&p!=='escuro'&&p!=='sistema')p='${TEMA_PADRAO}';
var m=p==='sistema'?(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):(p==='claro'?'light':'dark');
var r=document.documentElement;r.dataset.mode=m;r.style.colorScheme=m;
var c=m==='light'?'${COR_BARRA.light}':'${COR_BARRA.dark}';
var f=function(){var l=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<l.length;i++)l[i].setAttribute('content',c)};
f();document.addEventListener('DOMContentLoaded',f);}catch(e){}})();`;
