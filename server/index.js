const express = require('express');
const path = require('node:path');

require('./db'); // asegura que la base de datos y tablas existan

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/productos', require('./routes/productos'));
app.use('/api/proveedores', require('./routes/proveedores'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/categorias', require('./routes/categorias'));
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/compras', require('./routes/compras'));
app.use('/api/envios', require('./routes/envios'));
app.use('/api/insumos', require('./routes/insumos'));
app.use('/api/costos-fijos', require('./routes/costos-fijos'));
app.use('/api/reportes', require('./routes/reportes'));

app.use(express.static(path.join(__dirname, '..', 'public')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`\n  ERP AYH corriendo en http://localhost:${PORT}\n`);
});
