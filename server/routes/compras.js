const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT co.*, p.nombre AS proveedor_nombre
    FROM compras co
    LEFT JOIN proveedores p ON p.id = co.proveedor_id
    ORDER BY co.fecha DESC, co.id DESC
    LIMIT 500
  `).all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const compra = db.prepare(`
    SELECT co.*, p.nombre AS proveedor_nombre FROM compras co
    LEFT JOIN proveedores p ON p.id = co.proveedor_id
    WHERE co.id = ?
  `).get(req.params.id);
  if (!compra) return res.status(404).json({ error: 'Orden de compra no encontrada' });
  const detalle = db.prepare(`SELECT * FROM detalle_compra WHERE compra_id = ?`).all(req.params.id);
  res.json({ ...compra, detalle });
});

router.post('/', (req, res) => {
  const { proveedor_id, items, notas } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'La orden debe tener al menos un producto' });
  }

  const tx = db.transaction(() => {
    let total = 0;
    const lineas = [];
    for (const item of items) {
      const producto = db.prepare(`SELECT * FROM productos WHERE id = ?`).get(item.producto_id);
      if (!producto) throw new Error(`Producto ${item.producto_id} no existe`);
      const cantidad = Number(item.cantidad);
      if (!cantidad || cantidad <= 0) throw new Error(`Cantidad invalida para ${producto.nombre}`);
      const precioCosto = item.precio_costo != null ? Number(item.precio_costo) : producto.precio_costo;
      const lineaSubtotal = precioCosto * cantidad;
      total += lineaSubtotal;
      lineas.push({ producto, cantidad, precioCosto, lineaSubtotal });
    }

    const compraInfo = db.prepare(`
      INSERT INTO compras (proveedor_id, total, notas, estado) VALUES (?, ?, ?, 'pendiente')
    `).run(proveedor_id || null, total, notas || null);
    const compraId = compraInfo.lastInsertRowid;

    for (const linea of lineas) {
      db.prepare(`
        INSERT INTO detalle_compra (compra_id, producto_id, producto_nombre, cantidad, precio_costo, subtotal)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(compraId, linea.producto.id, linea.producto.nombre, linea.cantidad, linea.precioCosto, linea.lineaSubtotal);
    }

    return compraId;
  });

  try {
    const compraId = tx();
    const compra = db.prepare(`SELECT * FROM compras WHERE id = ?`).get(compraId);
    const detalle = db.prepare(`SELECT * FROM detalle_compra WHERE compra_id = ?`).all(compraId);
    res.status(201).json({ ...compra, detalle });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:id/recepcionar', (req, res) => {
  const compra = db.prepare(`SELECT * FROM compras WHERE id = ?`).get(req.params.id);
  if (!compra) return res.status(404).json({ error: 'Orden de compra no encontrada' });
  if (compra.estado === 'recepcionada') return res.status(400).json({ error: 'La orden ya fue recepcionada' });

  const tx = db.transaction(() => {
    const detalle = db.prepare(`SELECT * FROM detalle_compra WHERE compra_id = ?`).all(req.params.id);
    for (const linea of detalle) {
      if (linea.producto_id) {
        db.prepare(`
          UPDATE productos SET stock_actual = stock_actual + ?, precio_costo = ? WHERE id = ?
        `).run(linea.cantidad, linea.precio_costo, linea.producto_id);
        db.prepare(`
          INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, referencia)
          VALUES (?, 'entrada', ?, 'Recepcion de compra', ?)
        `).run(linea.producto_id, linea.cantidad, `compra #${req.params.id}`);
      }
    }
    db.prepare(`UPDATE compras SET estado = 'recepcionada' WHERE id = ?`).run(req.params.id);
  });
  tx();

  res.json(db.prepare(`SELECT * FROM compras WHERE id = ?`).get(req.params.id));
});

router.post('/:id/cancelar', (req, res) => {
  const compra = db.prepare(`SELECT * FROM compras WHERE id = ?`).get(req.params.id);
  if (!compra) return res.status(404).json({ error: 'Orden de compra no encontrada' });
  if (compra.estado === 'recepcionada') return res.status(400).json({ error: 'No se puede cancelar una orden ya recepcionada' });
  db.prepare(`UPDATE compras SET estado = 'cancelada' WHERE id = ?`).run(req.params.id);
  res.json(db.prepare(`SELECT * FROM compras WHERE id = ?`).get(req.params.id));
});

module.exports = router;
