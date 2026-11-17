(() => {
  const ns = (globalThis.CustoReal ??= {});

  const HOST_ID = 'custo-real-panel';

  // os estilos vivem dentro do Shadow DOM: o site não os vê e o painel não herda os do site
  const STYLES = `
    :host { all: initial; }
    :host([data-placement="floating"]) { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; }
    :host([data-placement="inline"]) { display: block; margin: 12px 0; }
    .card {
      box-sizing: border-box; width: 300px; max-width: calc(100vw - 32px);
      background: #fff; color: #1b2430; border: 1px solid #d5dae1; border-radius: 10px;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.12);
      font: 13px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    .card.collapsed { width: auto; }
    .header { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 12px; }
    .title { font-weight: 600; white-space: nowrap; }
    .badge { font-size: 11px; color: #5b6675; border: 1px solid #d5dae1; border-radius: 999px; padding: 0 6px; }
    .summary { color: #4a5563; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .toggle {
      margin-left: auto; width: 24px; height: 24px; border: 0; border-radius: 6px;
      background: none; color: #5b6675; font: inherit; font-size: 16px; line-height: 1; cursor: pointer;
    }
    .toggle:hover { background: #f1f3f6; }
    .toggle:focus-visible, .co2-input:focus-visible, .co2-submit:focus-visible {
      outline: 2px solid #0b6bcb; outline-offset: 1px;
    }
    .body { display: grid; gap: 10px; padding: 10px 12px 12px; border-top: 1px solid #e6e9ee; }
    .label { font-size: 11px; letter-spacing: 0.03em; text-transform: uppercase; color: #5b6675; }
    .headline { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .detail { color: #4a5563; }
    .co2-form { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
    .co2-input {
      box-sizing: border-box; width: 110px; padding: 4px 6px; border: 1px solid #c3cad3; border-radius: 6px;
      background: #fff; color: inherit; font: inherit;
    }
    .co2-submit {
      padding: 4px 10px; border: 1px solid #0b6bcb; border-radius: 6px;
      background: #0b6bcb; color: #fff; font: inherit; cursor: pointer;
    }
    .notes { display: grid; gap: 4px; margin: 0; padding-left: 16px; color: #4a5563; }
    .footer { padding-top: 8px; border-top: 1px solid #e6e9ee; font-size: 11px; color: #6b7684; }
  `;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function buildRow({ label, headline, detail }) {
    const row = el('div', 'row');
    row.append(el('div', 'label', label), el('div', 'headline', headline), el('div', 'detail', detail));
    return row;
  }

  function buildCo2Form(onCo2) {
    const form = el('form', 'co2-form');
    const input = el('input', 'co2-input');
    input.type = 'number';
    input.min = '1';
    input.max = '600';
    input.required = true;
    input.placeholder = 'CO₂ em g/km';
    input.setAttribute('aria-label', 'Emissões de CO₂ em gramas por quilómetro');
    const submit = el('button', 'co2-submit', 'Calcular');
    submit.type = 'submit';
    form.append(input, submit);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = Number(input.value);
      if (Number.isFinite(value) && value >= 1 && value <= 600) onCo2(Math.round(value));
    });
    return form;
  }

  function buildCard(view, { collapsed, onToggle, onCo2 }) {
    const card = el('section', collapsed ? 'card collapsed' : 'card');
    card.setAttribute('aria-label', 'Custo Real: estimativa de custos deste carro');

    const header = el('div', 'header');
    header.append(el('span', 'title', 'Custo Real'));
    if (collapsed && view.summary) header.append(el('span', 'summary', view.summary));
    if (!collapsed) header.append(el('span', 'badge', 'estimativa'));
    const toggle = el('button', 'toggle', collapsed ? '+' : '–');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Abrir o painel Custo Real' : 'Minimizar o painel Custo Real');
    toggle.addEventListener('click', onToggle);
    header.append(toggle);
    card.append(header);
    if (collapsed) return card;

    const body = el('div', 'body');
    const iucRow = buildRow(view.iuc);
    if (view.iuc.askCo2) iucRow.append(buildCo2Form(onCo2));
    body.append(iucRow, buildRow(view.fuel));
    if (view.notes.length > 0) {
      const notes = el('ul', 'notes');
      notes.append(...view.notes.map((note) => el('li', '', note)));
      body.append(notes);
    }
    body.append(el('div', 'footer', view.footer));
    card.append(body);
    return card;
  }

  // reutiliza sempre o mesmo elemento, por isso o painel nunca aparece duas vezes
  function getHost(anchor) {
    let host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ID;
      host.attachShadow({ mode: 'open' });
    }
    host.dataset.placement = anchor ? 'inline' : 'floating';
    if (!host.isConnected) {
      if (anchor) anchor.after(host);
      else document.body.append(host);
    }
    return host;
  }

  function render(view, handlers) {
    const host = getHost(handlers.anchor ?? null);
    const style = document.createElement('style');
    style.textContent = STYLES;
    host.shadowRoot.replaceChildren(style, buildCard(view, handlers));
  }

  function remove() {
    document.getElementById(HOST_ID)?.remove();
  }

  function isAttached() {
    return document.getElementById(HOST_ID) !== null;
  }

  ns.panel = { render, remove, isAttached, HOST_ID };
})();
