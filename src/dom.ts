// Petits utilitaires DOM (pas de framework)

type Attrs = Record<string, unknown> | null | undefined;
export type Child = Node | string | number | null | undefined | false | Child[];

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else if (k === 'class') {
        el.className = String(v);
      } else if (k === 'style' && typeof v === 'object') {
        Object.assign(el.style, v);
      } else if (k === 'value' && 'value' in el) {
        (el as HTMLInputElement).value = String(v);
      } else if (k === 'checked' && 'checked' in el) {
        (el as HTMLInputElement).checked = Boolean(v);
      } else if (v === true) {
        el.setAttribute(k, '');
      } else {
        el.setAttribute(k, String(v));
      }
    }
  }
  ajouter(el, children);
  return el;
}

function ajouter(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) ajouter(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function vider(el: Element, ...children: Child[]): void {
  el.replaceChildren();
  ajouter(el, children);
}

/** Boîte de dialogue modale. Retourne une fonction pour la fermer. */
export function modale(titre: string, contenu: Child, actions: { texte: string; classe?: string; action: () => boolean | void | Promise<boolean | void> }[]): () => void {
  const dlg = h('dialog', { class: 'modale' });
  const fermer = () => {
    dlg.close();
    dlg.remove();
  };
  const boutons = actions.map((a) =>
    h('button', {
      type: 'button',
      class: a.classe ?? '',
      onclick: async () => {
        const r = await a.action();
        if (r !== false) fermer();
      },
    }, a.texte),
  );
  vider(dlg, h('h2', null, titre), h('div', { class: 'modale-contenu' }, contenu), h('div', { class: 'modale-actions' }, boutons));
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    fermer();
  });
  document.body.appendChild(dlg);
  dlg.showModal();
  return fermer;
}

export function avis(message: string, type: 'info' | 'erreur' = 'info'): void {
  const el = h('div', { class: `avis avis-${type}`, role: 'status' }, message);
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('sortie'), 2600);
  setTimeout(() => el.remove(), 3200);
}
