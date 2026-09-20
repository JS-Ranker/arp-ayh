const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { q } = req.query;
  let rows;
  if (q) {
    rows = db.prepare(
      `SELECT * FROM proveedores WHERE activo = 1 AND (nombre LIKE ? OR rut LIKE ?) ORDER BY nombre`
    ).all(`%${q}%`, `%${q}%`);
  } else {
    rows = db.prepare(`SELECT * FROM proveedores WHERE activo = 1 ORDER BY nombre`).all();
  }
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM proveedores WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Proveedor no encontrado' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { nombre, rut, contacto, telefono, email, direccion, notas } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const info = db.prepare(
    `INSERT INTO proveedores (nombre, rut, contacto, telefono, email, direccion, notas)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(nombre.trim(), rut || null, contacto || null, telefono || null, email || null, direccion || null, notas || null);
  res.status(201).json(db.prepare(`SELECT * FROM proveedores WHERE id = ?`).get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare(`SELECT * FROM proveedores WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Proveedor no encontrado' });
  const { nombre, rut, contacto, telefono, email, direccion, notas } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  db.prepare(
    `UPDATE proveedores SET nombre = ?, rut = ?, contacto = ?, telefono = ?, email = ?, direccion = ?, notas = ? WHERE id = ?`
  ).run(nombre.trim(), rut || null, contacto || null, telefono || null, email || null, direccion || null, notas || null, req.params.id);
  res.json(db.prepare(`SELECT * FROM proveedores WHERE id = ?`).get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare(`SELECT * FROM proveedores WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Proveedor no encontrado' });
  db.prepare(`UPDATE proveedores SET activo = 0 WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
