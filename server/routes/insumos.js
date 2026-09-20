const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { q } = req.query;
  let rows;
  if (q) {
    rows = db.prepare(`SELECT * FROM insumos WHERE activo = 1 AND nombre LIKE ? ORDER BY nombre`).all(`%${q}%`);
  } else {
    rows = db.prepare(`SELECT * FROM insumos WHERE activo = 1 ORDER BY nombre`).all();
  }
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM insumos WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Insumo no encontrado' });
  res.json(row);
});

function validarInsumo(body) {
  if (!body.nombre || !body.nombre.trim()) return 'El nombre es obligatorio';
  if (body.costo_unitario != null && Number(body.costo_unitario) < 0) return 'El costo no puede ser negativo';
  return null;
}

router.post('/', (req, res) => {
  const err = validarInsumo(req.body);
  if (err) return res.status(400).json({ error: err });
  const { nombre, unidad, costo_unitario, notas } = req.body;
  const info = db.prepare(`
    INSERT INTO insumos (nombre, unidad, costo_unitario, notas)
    VALUES (?, ?, ?, ?)
  `).run(nombre.trim(), (unidad || 'unidad').trim(), Number(costo_unitario) || 0, notas || null);
  res.status(201).json(db.prepare(`SELECT * FROM insumos WHERE id = ?`).get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existente = db.prepare(`SELECT * FROM insumos WHERE id = ?`).get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Insumo no encontrado' });
  const err = validarInsumo(req.body);
  if (err) return res.status(400).json({ error: err });
  const { nombre, unidad, costo_unitario, notas } = req.body;
  db.prepare(`
    UPDATE insumos SET nombre = ?, unidad = ?, costo_unitario = ?, notas = ? WHERE id = ?
  `).run(nombre.trim(), (unidad || 'unidad').trim(), Number(costo_unitario) || 0, notas || null, req.params.id);
  res.json(db.prepare(`SELECT * FROM insumos WHERE id = ?`).get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existente = db.prepare(`SELECT * FROM insumos WHERE id = ?`).get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Insumo no encontrado' });
  db.prepare(`UPDATE insumos SET activo = 0 WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
