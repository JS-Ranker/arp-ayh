const express = require('express');
const db = require('../db');

const router = express.Router();

const PERIODICIDADES = ['mensual', 'anual'];

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT * FROM costos_fijos WHERE activo = 1 ORDER BY nombre`).all();
  res.json(rows);
});

function validar(body) {
  if (!body.nombre || !body.nombre.trim()) return 'El nombre es obligatorio';
  if (body.monto != null && Number(body.monto) < 0) return 'El monto no puede ser negativo';
  if (body.periodicidad && !PERIODICIDADES.includes(body.periodicidad)) return 'Periodicidad invalida';
  return null;
}

router.post('/', (req, res) => {
  const err = validar(req.body);
  if (err) return res.status(400).json({ error: err });
  const { nombre, monto, periodicidad, notas } = req.body;
  const info = db.prepare(`
    INSERT INTO costos_fijos (nombre, monto, periodicidad, notas)
    VALUES (?, ?, ?, ?)
  `).run(nombre.trim(), Number(monto) || 0, periodicidad || 'mensual', notas || null);
  res.status(201).json(db.prepare(`SELECT * FROM costos_fijos WHERE id = ?`).get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existente = db.prepare(`SELECT * FROM costos_fijos WHERE id = ?`).get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Costo fijo no encontrado' });
  const err = validar(req.body);
  if (err) return res.status(400).json({ error: err });
  const { nombre, monto, periodicidad, notas } = req.body;
  db.prepare(`
    UPDATE costos_fijos SET nombre = ?, monto = ?, periodicidad = ?, notas = ? WHERE id = ?
  `).run(nombre.trim(), Number(monto) || 0, periodicidad || 'mensual', notas || null, req.params.id);
  res.json(db.prepare(`SELECT * FROM costos_fijos WHERE id = ?`).get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existente = db.prepare(`SELECT * FROM costos_fijos WHERE id = ?`).get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Costo fijo no encontrado' });
  db.prepare(`UPDATE costos_fijos SET activo = 0 WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
