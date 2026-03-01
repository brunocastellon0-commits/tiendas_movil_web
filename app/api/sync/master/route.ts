import { NextResponse } from 'next/server';
import { getSqlConnection } from '@/utils/mssql';
import sql from 'mssql';

/**
 * Función auxiliar para limpiar textos y evitar nulos
 */
const cleanString = (val: any) => val ? String(val).trim() : '';

/**
 * Función auxiliar para asegurar números enteros
 */
const cleanInt = (val: any) => {
  const num = parseInt(val);
  return isNaN(num) ? 0 : num;
};

/**
 * Función auxiliar para asegurar decimales (moneda)
 */
const cleanFloat = (val: any) => {
  const num = parseFloat(val);
  return isNaN(num) ? 0.00 : num;
};

export async function POST(req: Request) {
  try {
    const { entity, data } = await req.json();
    const pool = await getSqlConnection();

    // Log para depuración en consola del servidor
    console.log(`Recibiendo entidad: ${entity}`);

    switch (entity) {
      
      // --- SINCRONIZACIÓN DE PEDIDOS (La más crítica) ---
      case 'ORDER': 
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
          // 1. Validar datos críticos antes de intentar insertar
          const clienteId = cleanInt(data.cliente_legacy_id);
          const totalVenta = cleanFloat(data.total_venta);

          if (clienteId === 0) {
            throw new Error('El ID del cliente es 0 o inválido. No se puede sincronizar.');
          }

          // 2. Insertar Cabecera (TBVEN)
          const resVen = await new sql.Request(transaction)
            .input('idcli', sql.Int, clienteId)
            // Usamos un ID de vendedor genérico para la web (ej: 30) o lo mandamos desde la data
            .input('idemp', sql.Int, 30) 
            .input('vdoc', sql.VarChar, 'WEB-SYNC') 
            .query(`
              INSERT INTO tbven (vtipo, vtipa, idcli, idemp, vdoc, vfec, vtc, vidzona, venest, usumod, fecmod) 
              VALUES ('VD', 0, @idcli, @idemp, @vdoc, GETDATE(), 6.96, 10, 0, 'NEXTJS_API', GETDATE());
              
              SELECT SCOPE_IDENTITY() AS idven;
            `);

          const idven = resVen.recordset[0].idven; // Obtenemos el ID generado por SQL

          // 3. Insertar Facturación (TBFVEN)
          await new sql.Request(transaction)
            .input('id', sql.Int, idven)
            .input('total', sql.Decimal(10, 2), totalVenta) // Decimal es más preciso para dinero
            .input('idcli', sql.Int, clienteId)
            .query(`
              INSERT INTO tbfven (id, fecha, totalfac, idcli, totalice, esp) 
              VALUES (@id, GETDATE(), @total, @idcli, 0, 0)
            `);

          // 4. Insertar Detalles (TBIVVEN)
          // Recorremos el array de items que viene de la web
          if (data.items && Array.isArray(data.items)) {
            for (const item of data.items) {
              
              // Buscamos el ID interno del producto usando su SKU
              const productoSKU = cleanString(item.codigo_producto);
              
              const prodQuery = await new sql.Request(transaction)
                .input('cod', sql.VarChar, productoSKU)
                .query('SELECT idprd FROM tbprd WHERE prdcod = @cod');
              
              if(prodQuery.recordset.length > 0) {
                 const idPrdReal = prodQuery.recordset[0].idprd;
                 const cantidad = cleanFloat(item.cantidad);
                 const precio = cleanFloat(item.precio);

                 await new sql.Request(transaction)
                  .input('idac', sql.Int, idven)
                  .input('idprd', sql.Int, idPrdReal)
                  .input('can', sql.Decimal(10, 2), cantidad)
                  .input('pre', sql.Decimal(10, 2), precio)
                  .query(`
                      INSERT INTO tbivven (idac, idprd, spcan, sppre, idaj, idal) 
                      VALUES (@idac, @idprd, @can, @pre, 0, 1)
                  `);
              } else {
                console.warn(`Producto con SKU ${productoSKU} no encontrado en SQL Server`);
              }
            }
          }

          // Si todo funcionó, guardamos los cambios
          await transaction.commit();
          
        } catch (err) {
          // Si algo falló, deshacemos todo
          await transaction.rollback();
          throw err;
        }
        break;

      // --- SINCRONIZACIÓN DE CLIENTES ---
      case 'CLIENT':
        await pool.request()
          .input('cod', sql.VarChar, cleanString(data.code))
          .input('nom', sql.VarChar, cleanString(data.name))
          .input('nit', sql.VarChar, cleanString(data.tax_id) || '0')
          .input('dir', sql.VarChar, cleanString(data.address))
          .input('lim', sql.Decimal(10, 2), cleanFloat(data.credit_limit))
          .query(`
            IF EXISTS (SELECT 1 FROM tbcli WHERE clicod = @cod)
            BEGIN
              UPDATE tbcli SET clinom=@nom, clinit=@nit, clidir=@dir, clitlimcre=@lim 
              WHERE clicod=@cod
            END
            ELSE
            BEGIN
              INSERT INTO tbcli (clicod, clinom, clinit, clidir, clitlimcre, idconf, idclit, idclir) 
              VALUES (@cod, @nom, @nit, @dir, @lim, 1, 1, 1)
            END
          `);
        break;

      // --- SINCRONIZACIÓN DE PRODUCTOS ---
      case 'PRODUCT':
        await pool.request()
          .input('cod', sql.VarChar, cleanString(data.codigo_producto))
          .input('nom', sql.VarChar, cleanString(data.nombre_producto))
          .input('pre', sql.Decimal(10, 2), cleanFloat(data.precio_base_venta))
          .input('stk', sql.Decimal(10, 2), cleanFloat(data.stock_actual))
          .input('min', sql.Decimal(10, 2), cleanFloat(data.stock_min))
          .input('max', sql.Decimal(10, 2), cleanFloat(data.stock_max))
          .query(`
            IF EXISTS (SELECT 1 FROM tbprd WHERE prdcod = @cod)
              UPDATE tbprd SET prdnom=@nom, prdpoficial=@pre, prdstmax=@stk, prdstmin=@min WHERE prdcod=@cod
            ELSE
              INSERT INTO tbprd (prdcod, prdnom, prdpoficial, prdstmax, prdstmin, prdunid, prdest) 
              VALUES (@cod, @nom, @pre, @stk, @min, 'UND', 0)
          `);
        break;
      
      // --- SINCRONIZACIÓN DE CATEGORÍAS ---
      case 'CATEGORY':
        await pool.request()
          .input('nom', sql.VarChar, cleanString(data.nombre_categoria))
          .query(`
            IF EXISTS (SELECT 1 FROM tbprdlin WHERE linnom = @nom)
              UPDATE tbprdlin SET linfecmod = GETDATE() WHERE linnom = @nom
            ELSE
              INSERT INTO tbprdlin (linnom, linniv, lincod, idctaing, idctacos, linfecmod)
              VALUES (@nom, 2, UPPER(LEFT(@nom, 3)), 0, 0, GETDATE())
          `);
        break;

      default:
        return NextResponse.json({ error: 'Entidad no soportada' }, { status: 400 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error FATAL en Sync Master:', error);
    return NextResponse.json({ 
      error: error.message, 
      details: 'Revisar tipos de datos o conexión SQL' 
    }, { status: 500 });
  }
}