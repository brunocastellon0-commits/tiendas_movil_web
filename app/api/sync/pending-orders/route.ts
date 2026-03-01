import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSqlConnection } from '@/utils/mssql';
import sql from 'mssql';

// Obligamos a Next.js a ejecutar esta ruta de forma dinámica en cada petición
// para evitar que intente compilarla estáticamente sin variables de entorno.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Las variables y la conexión a Supabase ahora viven DENTRO de la función
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; 
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Buscar pedidos pendientes en Supabase (legacy_id es NULL)
    const { data: pendingOrders, error } = await supabase
      .from('pedidos')
      .select(`
        *,
        clients:clients_id ( legacy_id ),
        detalle_pedido (
          producto_id,
          cantidad,
          precio_unitario,
          productos:producto_id ( codigo_producto )
        )
      `)
      .is('legacy_id', null)
      .eq('estado', 'Pendiente') // Solo sincronizamos pendientes
      .limit(5); // Procesamos de 5 en 5 para evitar bloqueos

    if (error) throw new Error(error.message);

    if (!pendingOrders || pendingOrders.length === 0) {
      return NextResponse.json({ message: 'No hay pedidos pendientes' });
    }

    const pool = await getSqlConnection();
    let syncedCount = 0;

    // 2. Procesar cada pedido encontrado
    for (const order of pendingOrders) {
      const transaction = new sql.Transaction(pool);
      
      try {
        await transaction.begin();

        // Validacion: El cliente debe existir en SQL Server
        const clienteLegacyId = order.clients?.legacy_id;
        if (!clienteLegacyId) {
          throw new Error(`El pedido ${order.id} tiene un cliente sin legacy_id`);
        }

        // A. Insertar Cabecera en tbven
        const requestCabecera = new sql.Request(transaction);
        const resultCabecera = await requestCabecera
          .input('idcli', sql.Int, parseInt(clienteLegacyId))
          .input('idemp', sql.Int, 30) // Asignamos un ID de vendedor generico para la App (o mapear real)
          .input('vdoc', sql.VarChar, `APP-${order.numero_documento}`)
          .query(`
            INSERT INTO tbven (vtipo, vtipa, idcli, idemp, vdoc, vfec, vtc, vidzona, venest, usumod, fecmod)
            VALUES ('VD', 0, @idcli, @idemp, @vdoc, GETDATE(), 6.96, 10, 0, 'APP_MOVIL', GETDATE());
            SELECT SCOPE_IDENTITY() AS idven;
          `);

        // Corrección de TypeScript aplicada aquí
        const newIdVen = (resultCabecera.recordset as any).idven;

        // B. Insertar Facturacion en tbfven
        const requestFactura = new sql.Request(transaction);
        await requestFactura
          .input('id', sql.Int, newIdVen)
          .input('total', sql.Decimal(14, 2), order.total_venta)
          .input('idcli', sql.Int, parseInt(clienteLegacyId))
          .query(`
            INSERT INTO tbfven (id, fecha, totalfac, totalice, idcli, esp)
            VALUES (@id, GETDATE(), @total, 0, @idcli, 0)
          `);

        // C. Insertar Detalles en tbivven
        // Nota: Necesitamos buscar el idprd (ID SQL) usando el codigo de producto
        if (order.detalle_pedido && order.detalle_pedido.length > 0) {
          for (const item of order.detalle_pedido) {
            
            // Buscar el ID del producto en SQL Server usando su codigo
            const codigoProducto = item.productos?.codigo_producto;
            if (codigoProducto) {
              const requestProd = new sql.Request(transaction);
              const prodResult = await requestProd
                .input('cod', sql.VarChar, codigoProducto)
                .query('SELECT idprd FROM tbprd WHERE prdcod = @cod');
              
              if (prodResult.recordset.length > 0) {
                // Corrección de TypeScript aplicada aquí
                const idPrdSql = (prodResult.recordset as any).idprd;

                const requestDetalle = new sql.Request(transaction);
                await requestDetalle
                  .input('idac', sql.Int, newIdVen)
                  .input('idprd', sql.Int, idPrdSql)
                  .input('can', sql.Decimal(14, 2), item.cantidad)
                  .input('pre', sql.Decimal(14, 2), item.precio_unitario)
                  .query(`
                    INSERT INTO tbivven (idac, idaj, idal, idprd, spcan, sppre)
                    VALUES (@idac, 0, 1, @idprd, @can, @pre)
                  `);
              }
            }
          }
        }

        await transaction.commit();

        // D. Actualizar Supabase marcando el pedido como sincronizado
        await supabase
          .from('pedidos')
          .update({ legacy_id: newIdVen })
          .eq('id', order.id);

        syncedCount++;

      } catch (err) {
        console.error(`Error procesando pedido ${order.id}:`, err);
        await transaction.rollback();
        // Continuamos con el siguiente pedido aunque este falle
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Procesados ${syncedCount} de ${pendingOrders.length} pedidos pendientes` 
    });

  } catch (error: any) {
    console.error('Error general en sincronizacion:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}