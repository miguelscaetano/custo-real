console.log('[Custo Real] content script carregado em', location.href);

// etiqueta temporária só para confirmar que a extensão corre na página
const badge = document.createElement('div');
badge.textContent = 'Custo Real: olá mundo';
badge.style.cssText =
    'position:fixed;bottom:16px;right:16px;z-index:2147483647;' +
    'padding:8px 12px;background:#111;color:#fff;font:14px sans-serif;border-radius:6px';
document.body.appendChild(badge);