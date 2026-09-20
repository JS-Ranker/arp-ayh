# ERP AYH

Sistema de gestion para PyME: ventas (punto de venta), inventario, proveedores, compras, clientes y reportes. Corre 100% en tu computador, sin necesitar internet (excepto la primera vez, para instalar dependencias).

## Como iniciarlo

**Opcion facil:** doble clic en `iniciar.bat`. Se abrira una ventana con el servidor y tu navegador con el sistema en `http://localhost:3000`.

**Opcion manual (linea de comandos):**

```
npm install    # solo la primera vez
npm start
```

Luego abre `http://localhost:3000` en tu navegador.

Para detener el sistema, cierra la ventana del servidor (o presiona Ctrl+C en la terminal).

## Modulos

- **Ventas**: punto de venta, carrito, boleta imprimible, descuenta stock automaticamente.
- **Productos y precios**: catalogo, categorias, precio de costo/venta, margen.
- **Inventario**: stock por producto, alertas de stock bajo, historial de movimientos.
- **Compras**: ordenes de compra a proveedores; al recepcionarlas se suma el stock y se actualiza el costo.
- **Proveedores** y **Clientes**: fichas de contacto.
- **Reportes**: ventas por dia, productos mas vendidos, valorizacion de inventario.

## Datos

Toda la informacion se guarda en un archivo `data/erp.db` (SQLite) dentro de esta misma carpeta. Para respaldar tu informacion, basta con copiar ese archivo a otro lugar (ej. un pendrive o Google Drive) mientras el sistema no este corriendo.

## Tecnologia

Node.js + Express + SQLite (better-sqlite3), con una interfaz web simple en HTML/CSS/JS (sin dependencias externas en tiempo de ejecucion).
