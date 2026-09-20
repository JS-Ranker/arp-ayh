const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/dashboard', (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const mesActual = hoy.slice(0, 7);

  const ventasHoy = db.prepare(`
    SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS cantidad
    FROM ventas WHERE date(fecha) = ? AND estado = 'completada'
  `).get(hoy);

  const ventasMes = db.prepare(`
    SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS cantidad
    FROM ventas WHERE strftime('%Y-%m', fecha) = ? AND estado = 'completada'
  `).get(mesActual);

  const utilidadMes = db.prepare(`
    SELECT COALESCE(SUM((dv.precio_unitario - dv.costo_unitario) * dv.cantidad), 0) AS utilidad
    FROM detalle_venta dv
    JOIN ventas v ON v.id = dv.venta_id
    WHERE strftime('%Y-%m', v.fecha) = ? AND v.estado = 'completada'
  `).get(mesActual);

  const bajoStock = db.prepare(`
    SELECT COUNT(*) AS cantidad FROM productos WHERE activo = 1 AND stock_actual <= stock_minimo
  `).get();

  const valorInventario = db.prepare(`
    SELECT COALESCE(SUM(stock_actual * precio_costo), 0) AS costo, COALESCE(SUM(stock_actual * precio_venta), 0) AS venta
    FROM productos WHERE activo = 1
  `).get();

  const topProductosMes = db.prepare(`
    SELECT dv.producto_nombre, SUM(dv.cantidad) AS cantidad, SUM(dv.subtotal) AS total
    FROM detalle_venta dv
    JOIN ventas v ON v.id = dv.venta_id
    WHERE strftime('%Y-%m', v.fecha) = ? AND v.estado = 'completada'
    GROUP BY dv.producto_id, dv.producto_nombre
    ORDER BY cantidad DESC
    LIMIT 5
  `).all(mesActual);

  const productosBajoStock = db.prepare(`
    SELECT id, nombre, sku, stock_actual, stock_minimo
    FROM productos WHERE activo = 1 AND stock_actual <= stock_minimo
    ORDER BY (stock_actual - stock_minimo) ASC
    LIMIT 10
  `).all();

  res.json({ ventasHoy, ventasMes, utilidadMes, bajoStock, valorInventario, topProductosMes, productosBajoStock });
});

router.get('/ventas-por-periodo', (req, res) => {
  const { desde, hasta, agrupar } = req.query;
  const formato = agrupar === 'mes' ? '%Y-%m' : '%Y-%m-%d';
  const clauses = [`estado = 'completada'`];
  const params = [];
  if (desde) { clauses.push('fecha >= ?'); params.push(desde); }
  if (hasta) { clauses.push('fecha <= ?'); params.push(hasta + ' 23:59:59'); }

  const rows = db.prepare(`
    SELECT strftime('${formato}', fecha) AS periodo, COUNT(*) AS cantidad_ventas, COALESCE(SUM(total), 0) AS total
    FROM ventas
    WHERE ${clauses.join(' AND ')}
    GROUP BY periodo
    ORDER BY periodo
  `).all(...params);
  res.json(rows);
});

router.get('/productos-mas-vendidos', (req, res) => {
  const { desde, hasta, limite } = req.query;
  const clauses = [`v.estado = 'completada'`];
  const params = [];
  if (desde) { clauses.push('v.fecha >= ?'); params.push(desde); }
  if (hasta) { clauses.push('v.fecha <= ?'); params.push(hasta + ' 23:59:59'); }

  const rows = db.prepare(`
    SELECT dv.producto_id, dv.producto_nombre,
           SUM(dv.cantidad) AS cantidad_vendida,
           SUM(dv.subtotal) AS total_vendido,
           SUM((dv.precio_unitario - dv.costo_unitario) * dv.cantidad) AS utilidad
    FROM detalle_venta dv
    JOIN ventas v ON v.id = dv.venta_id
    WHERE ${clauses.join(' AND ')}
    GROUP BY dv.producto_id, dv.producto_nombre
    ORDER BY cantidad_vendida DESC
    LIMIT ?
  `).all(...params, Number(limite) || 50);
  res.json(rows);
});

router.get('/movimientos-recientes', (req, res) => {
  const rows = db.prepare(`
    SELECT m.*, p.nombre AS producto_nombre, p.sku
    FROM movimientos_inventario m
    JOIN productos p ON p.id = m.producto_id
    ORDER BY m.fecha DESC, m.id DESC
    LIMIT 100
  `).all();
  res.json(rows);
});

router.get('/valorizacion-inventario', (req, res) => {
  const rows = db.prepare(`
    SELECT p.id, p.nombre, p.sku, p.stock_actual, p.precio_costo, p.precio_venta,
           (p.stock_actual * p.precio_costo) AS valor_costo,
           (p.stock_actual * p.precio_venta) AS valor_venta,
           c.nombre AS categoria_nombre
    FROM productos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.activo = 1
    ORDER BY valor_costo DESC
  `).all();
  res.json(rows);
});

router.get('/punto-equilibrio', (req, res) => {
  const fijos = db.prepare(`SELECT * FROM costos_fijos WHERE activo = 1 ORDER BY nombre`).all();
  const costosFijosTotal = fijos.reduce((sum, f) => sum + (f.periodicidad === 'anual' ? f.monto / 12 : f.monto), 0);

  const ventasRecientes = db.prepare(`
    SELECT dv.cantidad, dv.costo_unitario, dv.subtotal
    FROM detalle_venta dv
    JOIN ventas v ON v.id = dv.venta_id
    WHERE v.estado = 'completada' AND v.fecha >= datetime('now', '-30 days', 'localtime')
  `).all();

  let margenPct = null;
  let ticketPromedio = null;
  let fuenteMargen = null;

  if (ventasRecientes.length > 0) {
    const totalVenta = ventasRecientes.reduce((s, l) => s + l.subtotal, 0);
    const totalCosto = ventasRecientes.reduce((s, l) => s + l.costo_unitario * l.cantidad, 0);
    const totalUnidades = ventasRecientes.reduce((s, l) => s + l.cantidad, 0);
    if (totalVenta > 0) {
      margenPct = (totalVenta - totalCosto) / totalVenta;
      ticketPromedio = totalUnidades > 0 ? totalVenta / totalUnidades : null;
      fuenteMargen = 'ventas_30_dias';
    }
  }

  if (margenPct == null) {
    const productos = db.prepare(`
      SELECT precio_costo, precio_venta FROM productos WHERE activo = 1 AND precio_venta > 0
    `).all();
    const pcts = productos
      .map((p) => (p.precio_venta - p.precio_costo) / p.precio_venta)
      .filter((x) => Number.isFinite(x));
    if (pcts.length > 0) {
      margenPct = pcts.reduce((s, x) => s + x, 0) / pcts.length;
      fuenteMargen = 'promedio_productos';
    }
  }

  const puntoEquilibrioVentas = margenPct && margenPct > 0 ? costosFijosTotal / margenPct : null;

  const mesActual = new Date().toISOString().slice(0, 7);
  const ventasMes = db.prepare(`
    SELECT COALESCE(SUM(total), 0) AS total FROM ventas WHERE strftime('%Y-%m', fecha) = ? AND estado = 'completada'
  `).get(mesActual);

  const productos = db.prepare(`
    SELECT id, nombre, sku, precio_costo, precio_venta FROM productos WHERE activo = 1 ORDER BY nombre
  `).all().map((p) => {
    const margenUnitario = p.precio_venta - p.precio_costo;
    return {
      ...p,
      margen_unitario: margenUnitario,
      unidades_necesarias: margenUnitario > 0 ? Math.ceil(costosFijosTotal / margenUnitario) : null,
    };
  });

  res.json({
    costos_fijos: fijos,
    costos_fijos_total: costosFijosTotal,
    margen_contribucion_pct: margenPct,
    fuente_margen: fuenteMargen,
    ticket_promedio: ticketPromedio,
    punto_equilibrio_ventas: puntoEquilibrioVentas,
    ventas_mes_actual: ventasMes.total,
    productos,
  });
});

module.exports = router;
