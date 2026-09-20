const ICONS = {
  panel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  ventas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none"/><path d="M2 3h3l2.4 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 7H6"/></svg>',
  productos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
  inventario: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 4v16"/></svg>',
  compras: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h2l1.6 12.4A2 2 0 0 0 8.6 17h8.9a2 2 0 0 0 2-1.7L21 7H5.2"/><path d="M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" stroke="none"/><path d="M12 7v5m-2.5-2.5h5" /></svg>',
  envios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="7" width="14" height="10" rx="1.5"/><path d="M15 10h4l3 3v4h-7z"/><circle cx="6" cy="19" r="1.6"/><circle cx="17.5" cy="19" r="1.6"/></svg>',
  proveedores: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-6h6v6"/></svg>',
  clientes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>',
  reportes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>',
  insumos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6M10 2v5.5L4.8 17a2 2 0 0 0 1.8 3h10.8a2 2 0 0 0 1.8-3L14 7.5V2"/><path d="M7 14h10"/></svg>',
  equilibrio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M3 20 12 6"/><path d="M21 20 12 6"/><circle cx="12" cy="6" r="1.6" fill="currentColor" stroke="none"/></svg>',
};

const NAV_ITEMS = [
  { href: '/index.html', label: 'Panel', icon: ICONS.panel },
  { href: '/ventas.html', label: 'Ventas', icon: ICONS.ventas },
  { href: '/envios.html', label: 'Envios', icon: ICONS.envios },
  { href: '/productos.html', label: 'Productos y precios', icon: ICONS.productos },
  { href: '/insumos.html', label: 'Insumos y costos', icon: ICONS.insumos },
  { href: '/inventario.html', label: 'Inventario', icon: ICONS.inventario },
  { href: '/compras.html', label: 'Compras', icon: ICONS.compras },
  { href: '/proveedores.html', label: 'Proveedores', icon: ICONS.proveedores },
  { href: '/clientes.html', label: 'Clientes', icon: ICONS.clientes },
  { href: '/reportes.html', label: 'Reportes', icon: ICONS.reportes },
  { href: '/punto-equilibrio.html', label: 'Punto de equilibrio', icon: ICONS.equilibrio },
];

function renderNav() {
  const mount = document.getElementById('app-nav');
  if (!mount) return;
  const current = location.pathname.replace(/\/$/, '') || '/index.html';
  const currentFile = current === '/' ? '/index.html' : current;

  mount.innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <img src="/img/logo_ayh.png" alt="A&amp;H">
        <small>Gestion PyME &middot; local</small>
      </div>
      <nav>
        ${NAV_ITEMS.map((item) => `
          <a href="${item.href}" class="${currentFile.endsWith(item.href) ? 'active' : ''}">
            ${item.icon} ${item.label}
          </a>
        `).join('')}
      </nav>
    </aside>
  `;
}

document.addEventListener('DOMContentLoaded', renderNav);
