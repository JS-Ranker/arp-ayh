const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { desde, hasta } = req.query;
  const clauses = [];
  const params = [];
  if (desde) { clauses.push('v.fecha >= ?'); params.push(desde); }
  if (hasta) { clauses.push('v.fecha <= ?'); params.push(hasta + ' 23:59:59'); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT v.*, c.nombre AS cliente_nombre, e.id AS envio_id, e.estado AS envio_estado
    FROM ventas v
    LEFT JOIN clientes c ON c.id = v.cliente_id
    LEFT JOIN envios e ON e.venta_id = v.id
    ${where}
    ORDER BY v.fecha DESC, v.id DESC
    LIMIT 500
  `).all(...params);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const venta = db.prepare(`
    SELECT v.*, c.nombre AS cliente_nombre FROM ventas v
    LEFT JOIN clientes c ON c.id = v.cliente_id
    WHERE v.id = ?
  `).get(req.params.id);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  const detalle = db.prepare(`SELECT * FROM detalle_venta WHERE venta_id = ?`).all(req.params.id);
  res.json({ ...venta, detalle });
});

router.post('/', (req, res) => {
  const { items, cliente_id, metodo_pago, descuento } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'La venta debe tener al menos un producto' });
  }

  try {
    const resultado = db.transaction(() => {
      let subtotal = 0;
      const lineas = [];

      for (const item of items) {
        const producto = db.prepare(`SELECT * FROM productos WHERE id = ?`).get(item.producto_id);
        if (!producto) throw new Error(`Producto ${item.producto_id} no existe`);
        const cantidad = Number(item.cantidad);
        if (!cantidad || cantidad <= 0) throw new Error(`Cantidad invalida para ${producto.nombre}`);
        if (producto.stock_actual < cantidad) {
          throw new Error(`Stock insuficiente para "${producto.nombre}" (disponible: ${producto.stock_actual})`);
        }
        const precioUnitario = item.precio_unitario != null ? Number(item.precio_unitario) : producto.precio_venta;
        const lineaSubtotal = precioUnitario * cantidad;
        subtotal += lineaSubtotal;
        lineas.push({ producto, cantidad, precioUnitario, lineaSubtotal });
      }

      const desc = Number(descuento) || 0;
      const total = Math.max(subtotal - desc, 0);

      const ventaInfo = db.prepare(`
        INSERT INTO ventas (cliente_id, metodo_pago, subtotal, descuento, total)
        VALUES (?, ?, ?, ?, ?)
      `).run(cliente_id || null, metodo_pago || 'efectivo', subtotal, desc, total);

      const ventaId = ventaInfo.lastInsertRowid;

      for (const linea of lineas) {
        db.prepare(`
          INSERT INTO detalle_venta (venta_id, producto_id, producto_nombre, cantidad, precio_unitario, costo_unitario, subtotal)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(ventaId, linea.producto.id, linea.producto.nombre, linea.cantidad, linea.precioUnitario, linea.producto.precio_costo, linea.lineaSubtotal);

        db.prepare(`UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?`).run(linea.cantidad, linea.producto.id);

        db.prepare(`
          INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, referencia)
          VALUES (?, 'salida', ?, 'Venta', ?)
        `).run(linea.producto.id, linea.cantidad, `venta #${ventaId}`);
      }

      return ventaId;
    })();

    const venta = db.prepare(`SELECT * FROM ventas WHERE id = ?`).get(resultado);
    const detalle = db.prepare(`SELECT * FROM detalle_venta WHERE venta_id = ?`).all(resultado);
    res.status(201).json({ ...venta, detalle });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:id/anular', (req, res) => {
  const venta = db.prepare(`SELECT * FROM ventas WHERE id = ?`).get(req.params.id);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if (venta.estado === 'anulada') return res.status(400).json({ error: 'La venta ya esta anulada' });

  const envio = db.prepare(`SELECT * FROM envios WHERE venta_id = ?`).get(req.params.id);
  if (envio && envio.estado !== 'pendiente') {
    return res.status(400).json({ error: 'No se puede anular: el envio ya esta en camino o entregado' });
  }

  const tx = db.transaction(() => {
    if (envio) db.prepare(`DELETE FROM envios WHERE id = ?`).run(envio.id);
    const detalle = db.prepare(`SELECT * FROM detalle_venta WHERE venta_id = ?`).all(req.params.id);
    for (const linea of detalle) {
      if (linea.producto_id) {
        db.prepare(`UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?`).run(linea.cantidad, linea.producto_id);
        db.prepare(`
          INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, referencia)
          VALUES (?, 'entrada', ?, 'Anulacion de venta', ?)
        `).run(linea.producto_id, linea.cantidad, `venta #${req.params.id}`);
      }
    }
    db.prepare(`UPDATE ventas SET estado = 'anulada' WHERE id = ?`).run(req.params.id);
  });
  tx();

  res.json(db.prepare(`SELECT * FROM ventas WHERE id = ?`).get(req.params.id));
});

module.exports = router;
