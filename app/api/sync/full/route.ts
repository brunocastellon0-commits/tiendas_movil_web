import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSqlConnection } from '@/utils/mssql';
import sql from 'mssql';

export const dynamic = 'force-dynamic';

// ============================================================
// TIPOS PARA EL REPORTE DE RESULTADOS
// ============================================================
type SyncResult = {
  tabla: string;
  direccion: 'SQL→Supabase' | 'Supabase→SQL';
  procesados: number;
  errores: number;
  mensaje: string;
};

// ============================================================
// GET /api/sync/full
// Sincronización COMPLETA bidireccional de todas las tablas
// ============================================================
export async function GET() {
  const results: SyncResult[] = [];
  let pool: sql.ConnectionPool | null = null;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    pool = await getSqlConnection();
    const batchSize = 100;

    // ==================================================================
    // BLOQUE A: SQL SERVER → SUPABASE (datos maestros del sistema de oficina)
    // ==================================================================

    // ------------------------------------------------------------------
    // A1: EMPLEADOS (tbemp → employees)
    // ------------------------------------------------------------------
    try {
      const sqlEmployees = await pool.request().query(`
        SELECT idemp, empcod, empnom, emptel, empemail, empcar 
        FROM tbemp 
        WHERE empest = 1
      `);

      if (sqlEmployees.recordset.length > 0) {
        const toUpsert = sqlEmployees.recordset.map((e: any) => {
          const email =
            e.empemail && e.empemail.includes('@')
              ? e.empemail.trim()
              : `vendedor_${(e.empcod || '').trim()}@tiendasmovil.com`;
          return {
            legacy_id: e.idemp,
            full_name: e.empnom ? e.empnom.trim() : 'Sin Nombre',
            email,
            phone: e.emptel ? e.emptel.trim() : '',
            job_title: e.empcar ? e.empcar.trim() : 'Preventista',
            status: 'Activo',
            role: 'user',
          };
        });

        const { error } = await supabase
          .from('employees')
          .upsert(toUpsert, { onConflict: 'legacy_id' });

        results.push({
          tabla: 'employees',
          direccion: 'SQL→Supabase',
          procesados: toUpsert.length,
          errores: error ? 1 : 0,
          mensaje: error
            ? `Error: ${error.message}`
            : `${toUpsert.length} empleados sincronizados`,
        });
      } else {
        results.push({ tabla: 'employees', direccion: 'SQL→Supabase', procesados: 0, errores: 0, mensaje: 'Sin datos en SQL Server' });
      }
    } catch (err: any) {
      results.push({ tabla: 'employees', direccion: 'SQL→Supabase', procesados: 0, errores: 1, mensaje: err.message });
    }

    // ------------------------------------------------------------------
    // MAPA de vinculación SQL ID → Supabase UUID (necesario para clientes y zonas)
    // ------------------------------------------------------------------
    const { data: sbEmployees } = await supabase.from('employees').select('id, legacy_id');
    const vendorMap = new Map<number, string>();
    sbEmployees?.forEach((e) => { if (e.legacy_id) vendorMap.set(e.legacy_id, e.id); });

    // ------------------------------------------------------------------
    // A2: CATEGORÍAS (tbprdlin → categorias)
    // ------------------------------------------------------------------
    try {
      const sqlCats = await pool.request().query(`
        SELECT linid, linnom, lincod, linniv
        FROM tbprdlin
        WHERE linniv = 2
      `);

      if (sqlCats.recordset.length > 0) {
        const toUpsert = sqlCats.recordset.map((c: any) => ({
          legacy_id: c.linid,
          nombre_categoria: c.linnom ? c.linnom.trim() : '',
          codigo_categoria: c.lincod ? c.lincod.trim() : '',
        }));

        let errors = 0;
        for (let i = 0; i < toUpsert.length; i += batchSize) {
          const batch = toUpsert.slice(i, i + batchSize);
          const { error } = await supabase
            .from('categorias')
            .upsert(batch, { onConflict: 'nombre_categoria' });
          if (error) { errors++; console.error('Error batch categorias:', error); }
        }

        results.push({
          tabla: 'categorias',
          direccion: 'SQL→Supabase',
          procesados: toUpsert.length,
          errores: errors,
          mensaje: `${toUpsert.length} categorías sincronizadas`,
        });
      } else {
        results.push({ tabla: 'categorias', direccion: 'SQL→Supabase', procesados: 0, errores: 0, mensaje: 'Sin datos en SQL Server' });
      }
    } catch (err: any) {
      results.push({ tabla: 'categorias', direccion: 'SQL→Supabase', procesados: 0, errores: 1, mensaje: err.message });
    }

    // ------------------------------------------------------------------
    // A3: PROVEEDORES (tbprv → proveedores)
    // ------------------------------------------------------------------
    try {
      const sqlProvs = await pool.request().query(`
        SELECT prvid, prvcod, prvnom, prvrazon, prvnit, prvdir, prvtel
        FROM tbprv
      `);

      if (sqlProvs.recordset.length > 0) {
        const toUpsert = sqlProvs.recordset.map((p: any) => ({
          legacy_id: p.prvid,
          codigo: p.prvcod ? p.prvcod.trim() : '',
          nombre: p.prvnom ? p.prvnom.trim() : '',
          razon_social: p.prvrazon ? p.prvrazon.trim() : '',
          nit_ci: p.prvnit ? p.prvnit.trim() : '',
          direccion: p.prvdir ? p.prvdir.trim() : '',
          telefono: p.prvtel ? p.prvtel.trim() : '',
        }));

        let errors = 0;
        for (let i = 0; i < toUpsert.length; i += batchSize) {
          const batch = toUpsert.slice(i, i + batchSize);
          const { error } = await supabase
            .from('proveedores')
            .upsert(batch, { onConflict: 'codigo' });
          if (error) { errors++; console.error('Error batch proveedores:', error); }
        }

        results.push({
          tabla: 'proveedores',
          direccion: 'SQL→Supabase',
          procesados: toUpsert.length,
          errores: errors,
          mensaje: `${toUpsert.length} proveedores sincronizados`,
        });
      } else {
        results.push({ tabla: 'proveedores', direccion: 'SQL→Supabase', procesados: 0, errores: 0, mensaje: 'Sin datos en SQL Server' });
      }
    } catch (err: any) {
      results.push({ tabla: 'proveedores', direccion: 'SQL→Supabase', procesados: 0, errores: 1, mensaje: err.message });
    }

    // ------------------------------------------------------------------
    // A4: PRODUCTOS (tbprd → productos)
    // ------------------------------------------------------------------
    try {
      const sqlProds = await pool.request().query(`
        SELECT prdcod, prdnom, prdpoficial, prdstmax, prdstmin, prdunid
        FROM tbprd
        WHERE prdest = 0
      `);

      if (sqlProds.recordset.length > 0) {
        const toUpsert = sqlProds.recordset.map((p: any) => ({
          codigo_producto: p.prdcod.trim(),
          nombre_producto: p.prdnom.trim(),
          precio_base_venta: p.prdpoficial || 0,
          stock_actual: p.prdstmax || 0,
          stock_min: p.prdstmin || 0,
          unidad_base_venta: p.prdunid ? p.prdunid.trim() : 'UND',
          estado: 'Activo',
        }));

        let errors = 0;
        for (let i = 0; i < toUpsert.length; i += batchSize) {
          const batch = toUpsert.slice(i, i + batchSize);
          const { error } = await supabase
            .from('productos')
            .upsert(batch, { onConflict: 'codigo_producto' });
          if (error) { errors++; console.error('Error batch productos:', error); }
        }

        results.push({
          tabla: 'productos',
          direccion: 'SQL→Supabase',
          procesados: toUpsert.length,
          errores: errors,
          mensaje: `${toUpsert.length} productos sincronizados`,
        });
      } else {
        results.push({ tabla: 'productos', direccion: 'SQL→Supabase', procesados: 0, errores: 0, mensaje: 'Sin datos en SQL Server' });
      }
    } catch (err: any) {
      results.push({ tabla: 'productos', direccion: 'SQL→Supabase', procesados: 0, errores: 1, mensaje: err.message });
    }

    // ------------------------------------------------------------------
    // A5: CLIENTES (tbcli → clients)
    // ------------------------------------------------------------------
    try {
      const sqlClients = await pool.request().query(`
        SELECT c.clicod, c.clinom, c.clinit, c.clidir, c.clitel, c.clitlimcre, c.idven,
               ISNULL(c.idcli, 0) AS idcli
        FROM tbcli c
        WHERE c.cliest = 0
      `);

      if (sqlClients.recordset.length > 0) {
        const toUpsert = sqlClients.recordset.map((c: any) => ({
          legacy_id: c.idcli || null,
          code: c.clicod ? c.clicod.trim() : '',
          name: c.clinom ? c.clinom.trim() : 'Sin nombre',
          tax_id: c.clinit ? c.clinit.trim() : '',
          address: c.clidir ? c.clidir.trim() : '',
          phones: c.clitel ? c.clitel.trim() : '',
          credit_limit: c.clitlimcre || 0,
          vendor_id: vendorMap.get(c.idven) || null,
          status: 'Vigente',
        }));

        let errors = 0;
        for (let i = 0; i < toUpsert.length; i += batchSize) {
          const batch = toUpsert.slice(i, i + batchSize);
          const { error } = await supabase
            .from('clients')
            .upsert(batch, { onConflict: 'code' });
          if (error) { errors++; console.error('Error batch clientes:', error); }
        }

        results.push({
          tabla: 'clients',
          direccion: 'SQL→Supabase',
          procesados: toUpsert.length,
          errores: errors,
          mensaje: `${toUpsert.length} clientes sincronizados`,
        });
      } else {
        results.push({ tabla: 'clients', direccion: 'SQL→Supabase', procesados: 0, errores: 0, mensaje: 'Sin datos en SQL Server' });
      }
    } catch (err: any) {
      results.push({ tabla: 'clients', direccion: 'SQL→Supabase', procesados: 0, errores: 1, mensaje: err.message });
    }

    // ==================================================================
    // BLOQUE B: SUPABASE → SQL SERVER (transacciones generadas en la app)
    // ==================================================================

    // ------------------------------------------------------------------
    // B1: PEDIDOS PENDIENTES (pedidos → tbven + tbfven + tbivven)
    // ------------------------------------------------------------------
    try {
      const { data: pendingOrders, error: fetchError } = await supabase
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
        .eq('estado', 'Pendiente')
        .limit(20);

      if (fetchError) throw new Error(fetchError.message);

      let syncedCount = 0;
      let errorCount = 0;

      if (pendingOrders && pendingOrders.length > 0) {
        for (const order of pendingOrders) {
          const transaction = new sql.Transaction(pool!);
          try {
            await transaction.begin();

            const clienteLegacyId = order.clients?.legacy_id;
            if (!clienteLegacyId) throw new Error(`Pedido ${order.id} sin legacy_id de cliente`);

            // Cabecera tbven
            const resCabecera = await new sql.Request(transaction)
              .input('idcli', sql.Int, parseInt(clienteLegacyId))
              .input('idemp', sql.Int, 30)
              .input('vdoc', sql.VarChar, `APP-${order.numero_documento}`)
              .query(`
                INSERT INTO tbven (vtipo, vtipa, idcli, idemp, vdoc, vfec, vtc, vidzona, venest, usumod, fecmod)
                VALUES ('VD', 0, @idcli, @idemp, @vdoc, GETDATE(), 6.96, 10, 0, 'APP_MOVIL', GETDATE());
                SELECT SCOPE_IDENTITY() AS idven;
              `);

            const newIdVen = resCabecera.recordset[0]?.idven;

            // Facturación tbfven
            await new sql.Request(transaction)
              .input('id', sql.Int, newIdVen)
              .input('total', sql.Decimal(14, 2), order.total_venta)
              .input('idcli', sql.Int, parseInt(clienteLegacyId))
              .query(`INSERT INTO tbfven (id, fecha, totalfac, totalice, idcli, esp) VALUES (@id, GETDATE(), @total, 0, @idcli, 0)`);

            // Detalles tbivven
            if (order.detalle_pedido?.length > 0) {
              for (const item of order.detalle_pedido) {
                const cod = item.productos?.codigo_producto;
                if (cod) {
                  const prodRes = await new sql.Request(transaction)
                    .input('cod', sql.VarChar, cod)
                    .query('SELECT idprd FROM tbprd WHERE prdcod = @cod');

                  if (prodRes.recordset.length > 0) {
                    const idPrd = prodRes.recordset[0].idprd;
                    await new sql.Request(transaction)
                      .input('idac', sql.Int, newIdVen)
                      .input('idprd', sql.Int, idPrd)
                      .input('can', sql.Decimal(14, 2), item.cantidad)
                      .input('pre', sql.Decimal(14, 2), item.precio_unitario)
                      .query(`INSERT INTO tbivven (idac, idaj, idal, idprd, spcan, sppre) VALUES (@idac, 0, 1, @idprd, @can, @pre)`);
                  }
                }
              }
            }

            await transaction.commit();

            // Marcar como sincronizado en Supabase
            await supabase.from('pedidos').update({ legacy_id: newIdVen }).eq('id', order.id);
            syncedCount++;

          } catch (err: any) {
            console.error(`Error en pedido ${order.id}:`, err);
            await transaction.rollback();
            errorCount++;
          }
        }
      }

      results.push({
        tabla: 'pedidos',
        direccion: 'Supabase→SQL',
        procesados: syncedCount,
        errores: errorCount,
        mensaje: `${syncedCount}/${(pendingOrders?.length || 0)} pedidos enviados a SQL Server`,
      });
    } catch (err: any) {
      results.push({ tabla: 'pedidos', direccion: 'Supabase→SQL', procesados: 0, errores: 1, mensaje: err.message });
    }

    // ------------------------------------------------------------------
    // B2: VISITAS (visits → tbvis, si la tabla existe en SQL Server)
    // Se registran las visitas de la app móvil que aún no tienen legacy_id
    // ------------------------------------------------------------------
    try {
      const { data: pendingVisits, error: visitsError } = await supabase
        .from('visits')
        .select(`
          id, start_time, end_time, outcome, notes, seller_id,
          clients:client_id ( legacy_id ),
          employees:seller_id ( legacy_id )
        `)
        .is('legacy_id', null)
        .limit(50);

      if (visitsError) throw new Error(visitsError.message);

      let visitsSynced = 0;
      let visitsErrors = 0;

      if (pendingVisits && pendingVisits.length > 0) {
        for (const visit of pendingVisits) {
          try {
            const clientLegacy = (visit.clients as any)?.legacy_id;
            const empLegacy = (visit.employees as any)?.legacy_id;

            if (!clientLegacy || !empLegacy) continue;

            // Intentar insertar en tbvis (tabla de visitas del sistema de oficina)
            // Si la tabla no existe en tu SQL Server, este bloque fallará silenciosamente
            const resVis = await pool!.request()
              .input('idcli', sql.Int, parseInt(clientLegacy))
              .input('idemp', sql.Int, parseInt(empLegacy))
              .input('outcome', sql.VarChar, visit.outcome || 'no_sale')
              .input('start_time', sql.DateTime, visit.start_time ? new Date(visit.start_time) : new Date())
              .input('end_time', sql.DateTime, visit.end_time ? new Date(visit.end_time) : new Date())
              .input('notes', sql.VarChar, visit.notes || '')
              .query(`
                IF OBJECT_ID('tbvis', 'U') IS NOT NULL
                BEGIN
                  INSERT INTO tbvis (idcli, idemp, visresult, visfecini, visfecfin, visobs, fecmod)
                  VALUES (@idcli, @idemp, @outcome, @start_time, @end_time, @notes, GETDATE());
                  SELECT SCOPE_IDENTITY() AS idvis;
                END
                ELSE
                BEGIN
                  SELECT -1 AS idvis;
                END
              `);

            const newIdVis = resVis.recordset[0]?.idvis;
            if (newIdVis && newIdVis > 0) {
              await supabase.from('visits').update({ legacy_id: newIdVis }).eq('id', visit.id);
              visitsSynced++;
            } else if (newIdVis === -1) {
              // La tabla tbvis no existe en SQL Server, saltamos silenciosamente
              break;
            }
          } catch (err: any) {
            console.error(`Error en visita ${visit.id}:`, err);
            visitsErrors++;
          }
        }
      }

      results.push({
        tabla: 'visits',
        direccion: 'Supabase→SQL',
        procesados: visitsSynced,
        errores: visitsErrors,
        mensaje: visitsSynced > 0
          ? `${visitsSynced} visitas enviadas a SQL Server`
          : `Sin visitas pendientes (o tabla tbvis no existe en SQL Server)`,
      });
    } catch (err: any) {
      results.push({ tabla: 'visits', direccion: 'Supabase→SQL', procesados: 0, errores: 1, mensaje: err.message });
    }

    // ==================================================================
    // RESUMEN FINAL
    // ==================================================================
    const totalProcesados = results.reduce((acc, r) => acc + r.procesados, 0);
    const totalErrores = results.reduce((acc, r) => acc + r.errores, 0);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      resumen: {
        tablas: results.length,
        total_procesados: totalProcesados,
        total_errores: totalErrores,
      },
      resultados: results,
    });

  } catch (error: any) {
    console.error('Error FATAL en sync/full:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        resultados: results,
      },
      { status: 500 }
    );
  }
}
