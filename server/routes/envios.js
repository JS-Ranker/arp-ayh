const express = require('express');
const db = require('../db');

const router = express.Router();

const METODOS = ['reparto_propio', 'retiro_tienda'];
const ESTADOS = ['pendiente', 'en_camino', 'entregado'];

const SELECT_BASE = `
  SELECT e.*, v.total AS venta_total, v.fecha AS venta_fecha, v.cliente_id,
         c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.direccion AS cliente_direccion
  FROM envios e
  JOIN ventas v ON v.id = e.venta_id
  LEFT JOIN clientes c ON c.id = v.cliente_id
`;

router.get('/', (req, res) => {
  const { estado } = req.query;
  const clauses = [];
  const params = [];
  if (estado) { clauses.push('e.estado = ?'); params.push(estado); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`${SELECT_BASE} ${where} ORDER BY e.creado_en DESC, e.id DESC`).all(...params);
  res.json(rows);
});

router.get('/ventas-disponibles', (req, res) => {
  const rows = db.prepare(`
    SELECT v.id, v.fecha, v.total, c.nombre AS cliente_nombre, c.direccion AS cliente_direccion
    FROM ventas v
    LEFT JOIN clientes c ON c.id = v.cliente_id
    LEFT JOIN envios e ON e.venta_id = v.id
    WHERE v.estado = 'completada' AND e.id IS NULL
    ORDER BY v.fecha DESC
    LIMIT 100
  `).all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`${SELECT_BASE} WHERE e.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Envio no encontrado' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { venta_id, metodo, direccion, repartidor, fecha_estimada, notas } = req.body;

  if (!venta_id) return res.status(400).json({ error: 'Debes indicar la venta' });
  if (!METODOS.includes(metodo)) return res.status(400).json({ error: 'Metodo de envio invalido' });
  if (metodo === 'reparto_propio' && (!direccion || !direccion.trim())) {
    return res.status(400).json({ error: 'La direccion es obligatoria para reparto propio' });
  }

  const venta = db.prepare(`SELECT * FROM ventas WHERE id = ?`).get(venta_id);
  if (!venta) return res.status(404).json({ error: 'La venta no existe' });
  if (venta.estado !== 'completada') return res.status(400).json({ error: 'Solo se pueden despachar ventas completadas' });

  const existente = db.prepare(`SELECT id FROM envios WHERE venta_id = ?`).get(venta_id);
  if (existente) return res.status(409).json({ error: 'Esta venta ya tiene un envio registrado' });

  const info = db.prepare(`
    INSERT INTO envios (venta_id, metodo, direccion, repartidor, fecha_estimada, notas)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(venta_id, metodo, direccion || null, repartidor || null, fecha_estimada || null, notas || null);

  res.status(201).json(db.prepare(`${SELECT_BASE} WHERE e.id = ?`).get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existente = db.prepare(`SELECT * FROM envios WHERE id = ?`).get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Envio no encontrado' });

  const { metodo, direccion, repartidor, fecha_estimada, notas } = req.body;
  if (!METODOS.includes(metodo)) return res.status(400).json({ error: 'Metodo de envio invalido' });
  if (metodo === 'reparto_propio' && (!direccion || !direccion.trim())) {
    return res.status(400).json({ error: 'La direccion es obligatoria para reparto propio' });
  }

  db.prepare(`
    UPDATE envios SET metodo = ?, direccion = ?, repartidor = ?, fecha_estimada = ?, notas = ?
    WHERE id = ?
  `).run(metodo, direccion || null, repartidor || null, fecha_estimada || null, notas || null, req.params.id);

  res.json(db.prepare(`${SELECT_BASE} WHERE e.id = ?`).get(req.params.id));
});

router.post('/:id/estado', (req, res) => {
  const existente = db.prepare(`SELECT * FROM envios WHERE id = ?`).get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Envio no encontrado' });

  const { estado } = req.body;
  if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado invalido' });

  const fechaEntrega = estado === 'entregado' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : existente.fecha_entrega;
  db.prepare(`UPDATE envios SET estado = ?, fecha_entrega = ? WHERE id = ?`).run(estado, fechaEntrega, req.params.id);

  res.json(db.prepare(`${SELECT_BASE} WHERE e.id = ?`).get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existente = db.prepare(`SELECT * FROM envios WHERE id = ?`).get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Envio no encontrado' });
  db.prepare(`DELETE FROM envios WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
