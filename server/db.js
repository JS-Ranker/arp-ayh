const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'erp.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS proveedores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  rut TEXT,
  contacto TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  notas TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
  unidad TEXT NOT NULL DEFAULT 'un',
  precio_costo REAL NOT NULL DEFAULT 0,
  precio_venta REAL NOT NULL DEFAULT 0,
  stock_actual REAL NOT NULL DEFAULT 0,
  stock_minimo REAL NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  rut TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
  subtotal REAL NOT NULL DEFAULT 0,
  descuento REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'completada',
  notas TEXT
);

CREATE TABLE IF NOT EXISTS detalle_venta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
  producto_nombre TEXT NOT NULL,
  cantidad REAL NOT NULL,
  precio_unitario REAL NOT NULL,
  costo_unitario REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS compras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
  fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  estado TEXT NOT NULL DEFAULT 'pendiente',
  total REAL NOT NULL DEFAULT 0,
  notas TEXT
);

CREATE TABLE IF NOT EXISTS detalle_compra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  compra_id INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
  producto_nombre TEXT NOT NULL,
  cantidad REAL NOT NULL,
  precio_costo REAL NOT NULL,
  subtotal REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- entrada | salida | ajuste
  cantidad REAL NOT NULL,
  motivo TEXT,
  referencia TEXT,
  fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS envios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER NOT NULL UNIQUE REFERENCES ventas(id) ON DELETE CASCADE,
  metodo TEXT NOT NULL DEFAULT 'reparto_propio', -- reparto_propio | retiro_tienda
  estado TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | en_camino | entregado
  direccion TEXT,
  repartidor TEXT,
  fecha_estimada TEXT,
  fecha_entrega TEXT,
  notas TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS insumos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  unidad TEXT NOT NULL DEFAULT 'unidad',
  costo_unitario REAL NOT NULL DEFAULT 0,
  notas TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS producto_insumos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  insumo_id INTEGER NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  cantidad REAL NOT NULL,
  rinde_unidades REAL NOT NULL DEFAULT 1,
  UNIQUE(producto_id, insumo_id)
);

CREATE TABLE IF NOT EXISTS costos_fijos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  monto REAL NOT NULL DEFAULT 0,
  periodicidad TEXT NOT NULL DEFAULT 'mensual', -- mensual | anual
  notas TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras(fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos_inventario(producto_id);
CREATE INDEX IF NOT EXISTS idx_envios_estado ON envios(estado);
CREATE INDEX IF NOT EXISTS idx_producto_insumos_producto ON producto_insumos(producto_id);
`);

// Migraciones para bases de datos creadas antes de agregar esta columna.
const columnasProductoInsumos = db.prepare(`PRAGMA table_info(producto_insumos)`).all();
if (!columnasProductoInsumos.some((c) => c.name === 'rinde_unidades')) {
  db.exec(`ALTER TABLE producto_insumos ADD COLUMN rinde_unidades REAL NOT NULL DEFAULT 1`);
}

module.exports = db;
