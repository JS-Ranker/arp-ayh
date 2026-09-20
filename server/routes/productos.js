const express = require('express');
const db = require('../db');

const router = express.Router();

const SELECT_BASE = `
  SELECT p.*, c.nombre AS categoria_nombre, pr.nombre AS proveedor_nombre
  FROM productos p
  LEFT JOIN categorias c ON c.id = p.categoria_id
  LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
`;

router.get('/', (req, res) => {
  const { q, bajo_stock, categoria_id } = req.query;
  const clauses = ['p.activo = 1'];
  const params = [];

  if (q) {
    clauses.push('(p.nombre LIKE ? OR p.sku LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (categoria_id) {
    clauses.push('p.categoria_id = ?');
    params.push(categoria_id);
  }
  if (bajo_stock === '1') {
    clauses.push('p.stock_actual <= p.stock_minimo');
  }

  const sql = `${SELECT_BASE} WHERE ${clauses.join(' AND ')} ORDER BY p.nombre`;
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`${SELECT_BASE} WHERE p.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(row);
});

router.get('/:id/movimientos', (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM movimientos_inventario WHERE producto_id = ? ORDER BY fecha DESC, id DESC LIMIT 200`
  ).all(req.params.id);
  res.json(rows);
});

function getReceta(productoId) {
  const items = db.prepare(`
    SELECT pi.id, pi.insumo_id, pi.cantidad, pi.rinde_unidades, i.nombre AS insumo_nombre, i.unidad, i.costo_unitario,
           (pi.cantidad * i.costo_unitario / pi.rinde_unidades) AS subtotal
    FROM producto_insumos pi
    JOIN insumos i ON i.id = pi.insumo_id
    WHERE pi.producto_id = ?
    ORDER BY i.nombre
  `).all(productoId);
  const costoTotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  return { items, costo_total: costoTotal };
}

router.get('/:id/receta', (req, res) => {
  const producto = db.prepare(`SELECT id FROM productos WHERE id = ?`).get(req.params.id);
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(getReceta(req.params.id));
});

router.put('/:id/receta', (req, res) => {
  const producto = db.prepare(`SELECT id FROM productos WHERE id = ?`).get(req.params.id);
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Formato invalido' });

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM producto_insumos WHERE producto_id = ?`).run(req.params.id);
    const insert = db.prepare(`
      INSERT INTO producto_insumos (producto_id, insumo_id, cantidad, rinde_unidades) VALUES (?, ?, ?, ?)
    `);
    for (const item of items) {
      const cantidad = Number(item.cantidad);
      const rinde = Number(item.rinde_unidades) || 1;
      if (!item.insumo_id || !cantidad || cantidad <= 0 || rinde <= 0) continue;
      insert.run(req.params.id, item.insumo_id, cantidad, rinde);
    }
  });
  tx();

  res.json(getReceta(req.params.id));
});

function validarProducto(body) {
  if (!body.nombre || !body.nombre.trim()) return 'El nombre es obligatorio';
  if (body.precio_venta != null && Number(body.precio_venta) < 0) return 'El precio de venta no puede ser negativo';
  if (body.precio_costo != null && Number(body.precio_costo) < 0) return 'El precio de costo no puede ser negativo';
  return null;
}

router.post('/', (req, res) => {
  const err = validarProducto(req.body);
  if (err) return res.status(400).json({ error: err });
  const {
    sku, nombre, descripcion, categoria_id, proveedor_id, unidad,
    precio_costo, precio_venta, stock_actual, stock_minimo,
  } = req.body;

  try {
    const info = db.prepare(`
      INSERT INTO productos
        (sku, nombre, descripcion, categoria_id, proveedor_id, unidad, precio_costo, precio_venta, stock_actual, stock_minimo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sku || null, nombre.trim(), descripcion || null,
      categoria_id || null, proveedor_id || null, unidad || 'un',
      Number(precio_costo) || 0, Number(precio_venta) || 0,
      Number(stock_actual) || 0, Number(stock_minimo) || 0
    );

    const stockInicial = Number(stock_actual) || 0;
    if (stockInicial > 0) {
      db.prepare(`
        INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo)
        VALUES (?, 'entrada', ?, 'Stock inicial')
      `).run(info.lastInsertRowid, stockInicial);
    }

    res.status(201).json(db.prepare(`${SELECT_BASE} WHERE p.id = ?`).get(info.lastInsertRowid));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Ese SKU ya existe' });
    throw e;
  }
});

router.put('/:id', (req, res) => {
  const existing = db.prepare(`SELECT * FROM productos WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });
  const err = validarProducto(req.body);
  if (err) return res.status(400).json({ error: err });

  const {
    sku, nombre, descripcion, categoria_id, proveedor_id, unidad,
    precio_costo, precio_venta, stock_minimo,
  } = req.body;

  try {
    db.prepare(`
      UPDATE productos SET
        sku = ?, nombre = ?, descripcion = ?, categoria_id = ?, proveedor_id = ?,
        unidad = ?, precio_costo = ?, precio_venta = ?, stock_minimo = ?
      WHERE id = ?
    `).run(
      sku || null, nombre.trim(), descripcion || null,
      categoria_id || null, proveedor_id || null, unidad || 'un',
      Number(precio_costo) || 0, Number(precio_venta) || 0,
      Number(stock_minimo) || 0, req.params.id
    );
    res.json(db.prepare(`${SELECT_BASE} WHERE p.id = ?`).get(req.params.id));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Ese SKU ya existe' });
    throw e;
  }
});

router.post('/:id/ajustar-stock', (req, res) => {
  const producto = db.prepare(`SELECT * FROM productos WHERE id = ?`).get(req.params.id);
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

  const { cantidad, tipo, motivo } = req.body;
  const cant = Number(cantidad);
  if (!cant || cant <= 0) return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
  if (!['entrada', 'salida', 'ajuste'].includes(tipo)) return res.status(400).json({ error: 'Tipo invalido' });

  const delta = tipo === 'salida' ? -cant : cant;
  const nuevoStock = producto.stock_actual + delta;
  if (nuevoStock < 0) return res.status(400).json({ error: 'El stock no puede quedar negativo' });

  const tx = db.transaction(() => {
    db.prepare(`UPDATE productos SET stock_actual = ? WHERE id = ?`).run(nuevoStock, req.params.id);
    db.prepare(`
      INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, tipo, cant, motivo || null);
  });
  tx();

  res.json(db.prepare(`${SELECT_BASE} WHERE p.id = ?`).get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare(`SELECT * FROM productos WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });
  db.prepare(`UPDATE productos SET activo = 0 WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
