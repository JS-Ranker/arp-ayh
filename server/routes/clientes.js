const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { q } = req.query;
  let rows;
  if (q) {
    rows = db.prepare(`SELECT * FROM clientes WHERE nombre LIKE ? OR rut LIKE ? ORDER BY nombre`).all(`%${q}%`, `%${q}%`);
  } else {
    rows = db.prepare(`SELECT * FROM clientes ORDER BY nombre`).all();
  }
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM clientes WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { nombre, rut, telefono, email, direccion } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const info = db.prepare(
    `INSERT INTO clientes (nombre, rut, telefono, email, direccion) VALUES (?, ?, ?, ?, ?)`
  ).run(nombre.trim(), rut || null, telefono || null, email || null, direccion || null);
  res.status(201).json(db.prepare(`SELECT * FROM clientes WHERE id = ?`).get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare(`SELECT * FROM clientes WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' });
  const { nombre, rut, telefono, email, direccion } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  db.prepare(
    `UPDATE clientes SET nombre = ?, rut = ?, telefono = ?, email = ?, direccion = ? WHERE id = ?`
  ).run(nombre.trim(), rut || null, telefono || null, email || null, direccion || null, req.params.id);
  res.json(db.prepare(`SELECT * FROM clientes WHERE id = ?`).get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare(`SELECT * FROM clientes WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' });
  db.prepare(`DELETE FROM clientes WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
