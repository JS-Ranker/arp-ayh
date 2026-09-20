const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.prepare(`SELECT * FROM categorias ORDER BY nombre`).all());
});

router.post('/', (req, res) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    const info = db.prepare(`INSERT INTO categorias (nombre) VALUES (?)`).run(nombre.trim());
    res.status(201).json(db.prepare(`SELECT * FROM categorias WHERE id = ?`).get(info.lastInsertRowid));
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Esa categoria ya existe' });
    }
    throw err;
  }
});

router.delete('/:id', (req, res) => {
  db.prepare(`DELETE FROM categorias WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
