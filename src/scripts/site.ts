// All first-party JavaScript for the site shell: theme toggle, mobile menu, copy buttons,
// table-of-contents highlighting, and the analytics loader. No dependencies.
import { SITE } from '../lib/site';

const root = document.documentElement;

// Theme toggle. Contract: <html data-theme="light|dark"> + localStorage.theme.
document.querySelector('.theme-toggle')?.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  try { localStorage.setItem('theme', next); } catch { /* private mode: theme lasts for this page only */ }
});

// Mobile menu.
const menuBtn = document.querySelector<HTMLButtonElement>('.menu-btn');
const nav = document.getElementById('site-nav');
if (menuBtn && nav) {
  const setOpen = (open: boolean) => {
    nav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  };
  menuBtn.addEventListener('click', () => setOpen(menuBtn.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { setOpen(false); menuBtn.focus(); }
  });
}

// Copy buttons (event delegation: one listener for every code block on the page).
document.addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.copy-btn');
  if (!btn) return;
  const code = btn.closest('.code-block')?.querySelector('pre code');
  if (!code) return;
  const text = (code as HTMLElement).innerText.replace(/\n$/, '');
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied';
    btn.classList.add('is-copied');
  } catch {
    btn.textContent = 'Press Ctrl+C';
    const range = document.createRange();
    range.selectNodeContents(code);
    const sel = getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
  setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('is-copied'); }, 2000);
});

// Horizontal scroll affordance: mark each scroller with .fade-r / .fade-l while content is hidden beyond
// that edge (global.css fades the edge). Reads are batched before writes so a page with 60 code blocks
// costs one layout, and ResizeObserver covers rotation and blocks inside a <details> that opens later.
const scrollers = [...document.querySelectorAll<HTMLElement>('.code-block pre, .table-scroll, .diagram-scroll')];
if (scrollers.length) {
  const measure = (el: HTMLElement) => {
    const max = el.scrollWidth - el.clientWidth;
    return { el, right: max > 4 && el.scrollLeft < max - 4, left: max > 4 && el.scrollLeft > 4 };
  };
  const apply = (m: ReturnType<typeof measure>) => {
    m.el.classList.toggle('fade-r', m.right);
    m.el.classList.toggle('fade-l', m.left);
  };
  const pending = new Set<HTMLElement>();
  const schedule = (el: HTMLElement) => {
    if (!pending.size) requestAnimationFrame(() => { const ms = [...pending].map(measure); pending.clear(); ms.forEach(apply); });
    pending.add(el);
  };
  const ro = 'ResizeObserver' in window ? new ResizeObserver((entries) => entries.forEach((e) => schedule(e.target as HTMLElement))) : null;
  for (const el of scrollers) {
    el.addEventListener('scroll', () => schedule(el), { passive: true });
    // A ResizeObserver reports every element once when observation starts, which is the initial measurement.
    if (ro) ro.observe(el);
    else schedule(el);
  }
}

// "On this page": highlight the section currently being read.
const tocLinks = [...document.querySelectorAll<HTMLAnchorElement>('.toc-list a')];
if (tocLinks.length) {
  const byId = new Map<string, HTMLAnchorElement[]>();
  for (const a of tocLinks) {
    const id = decodeURIComponent(a.hash.slice(1));
    byId.set(id, [...(byId.get(id) ?? []), a]);
  }
  const headings = [...byId.keys()].map((id) => document.getElementById(id)).filter((h): h is HTMLElement => !!h);
  const activate = () => {
    // The active heading is the last one whose top has passed 30% of the viewport.
    const line = window.innerHeight * 0.3;
    let current = headings[0];
    for (const h of headings) if (h.getBoundingClientRect().top <= line) current = h;
    for (const a of tocLinks) a.classList.remove('is-active');
    if (current && current.getBoundingClientRect().top <= window.innerHeight) {
      for (const a of byId.get(current.id) ?? []) a.classList.add('is-active');
    }
  };
  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; activate(); });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  activate();
  // Close the inline (mobile) table of contents after jumping to a section.
  document.querySelector('.toc-inline')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) (e.currentTarget as HTMLDetailsElement).open = false;
  });
}

// Google Analytics 4. Loaded only on the production hostname (never on localhost, previews or
// staging) and never when the browser sends Global Privacy Control or Do Not Track.
const nav2 = navigator as Navigator & { globalPrivacyControl?: boolean };
const optedOut = nav2.globalPrivacyControl === true || navigator.doNotTrack === '1';
if ((SITE.productionHosts as readonly string[]).includes(location.hostname) && !optedOut) {
  const load = () => {
    const w = window as unknown as { dataLayer: unknown[] };
    w.dataLayer = w.dataLayer || [];
    function gtag(..._args: unknown[]) { w.dataLayer.push(arguments); }
    // Consent defaults are set inline in BaseLayout's <head>, before AdSense or this script load.
    gtag('js', new Date());
    gtag('config', SITE.gaId);
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${SITE.gaId}`;
    document.head.appendChild(s);
  };
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 3000 });
  else addEventListener('load', load);
}
