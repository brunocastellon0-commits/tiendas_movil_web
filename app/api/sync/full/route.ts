import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results: any[] = [];
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const API_OFICINA = process.env.NEXT_PUBLIC_API_OFICINA || 'https://db-sql.tiendasmovil.com';
    const batchSize = 100;

    const pullResponse = await fetch(`${API_OFICINA}/api/pull`);
    if (!pullResponse.ok) throw new Error("La Mini-API de la oficina no respondió.");
    const pullData = await pullResponse.json();

    // --- ZONAS ---
    if (pullData.zones?.length > 0) {
      const data = pullData.zones.map((z: any) => ({
        legacy_id: z.idz,
        codigo_zona: String(z.zcod || z.idz || ''),
        name: (z.znom || 'Ruta').trim()
      }));
      const { error } = await supabase.from('zones').upsert(data, { onConflict: 'legacy_id' });
      if (error) console.error('zones error:', error.message);
      results.push({ tabla: 'zones', procesados: data.length, error: error?.message || null });
    }

    // --- EMPLEADOS ---
    if (pullData.employees?.length > 0) {
      const data = pullData.employees.map((e: any) => ({
        legacy_id: e.idemp,
        full_name: (e.empnom || 'Sin Nombre').trim(),
        email: e.empemail?.includes('@') ? e.empemail.trim() : `vendedor_${e.idemp}@tiendasmovil.com`,
        status: 'Habilitado'
      }));
      const { error } = await supabase.from('employees').upsert(data, { onConflict: 'legacy_id' });
      if (error) console.error('employees error:', error.message);
      results.push({ tabla: 'employees', procesados: data.length, error: error?.message || null });
    }

    // --- CATEGORÍAS ---
    if (pullData.categories?.length > 0) {
      const data = pullData.categories.map((c: any) => ({
        legacy_id: c.idlinea,
        nombre_categoria: (c.linnom || '').trim()
      }));
      const { error } = await supabase.from('categorias').upsert(data, { onConflict: 'legacy_id' });
      if (error) console.error('categorias error:', error.message);
      results.push({ tabla: 'categorias', procesados: data.length, error: error?.message || null });
    }

    // --- PRODUCTOS ---
    if (pullData.products?.length > 0) {
      const data = pullData.products.map((p: any) => ({
        legacy_id: p.idprd,
        codigo_producto: (p.prdcod || '').trim(),
        nombre_producto: (p.prdnom || '').trim(),
        precio_base_venta: p.prdpoficial || 0,
        unidad_base_venta: (p.prdunid || 'UND').trim(),
        stock_actual: p.prdstmax || 0,
        activo: true
      }));

      let productErrors: string[] = [];
      for (let i = 0; i < data.length; i += batchSize) {
        const { error } = await supabase.from('productos')
          .upsert(data.slice(i, i + batchSize), { onConflict: 'legacy_id' });
        if (error) productErrors.push(`batch ${i}: ${error.message}`);
      }
      results.push({ tabla: 'productos', procesados: data.length, error: productErrors[0] || null });
    }

    // --- STOCK REAL DESDE tbcd ---
    if (pullData.stock?.length > 0) {
      const stockMap = new Map<number, number>();
      for (const s of pullData.stock) {
        stockMap.set(s.idprd, Math.max(0, s.stock_actual || 0));
      }

      let stockActualizados = 0;
      let stockErrores = 0;
      const stockEntries = Array.from(stockMap.entries());

      for (let i = 0; i < stockEntries.length; i += batchSize) {
        const lote = stockEntries.slice(i, i + batchSize);
        for (const [idprd, stock] of lote) {
          const { error } = await supabase
            .from('productos')
            .update({ stock_actual: stock })
            .eq('legacy_id', idprd);
          if (error) stockErrores++;
          else stockActualizados++;
        }
      }

      results.push({
        tabla: 'stock',
        actualizados: stockActualizados,
        errores: stockErrores
      });
    }

    // --- CLIENTES ---
    if (pullData.clients?.length > 0) {
      console.log(`📊 TOTAL CLIENTES DESDE SQL: ${pullData.clients.length}`);

      const clientesSinId = pullData.clients.filter((c: any) => c.idcli == null);
      if (clientesSinId.length > 0) {
          console.log(`⚠️ ALERTA: Hay ${clientesSinId.length} clientes sin 'idcli' en el SQL. Estos se perderán.`);
      }

      const { data: sbZones } = await supabase.from('zones').select('id, legacy_id');
      const { data: sbEmps } = await supabase.from('employees').select('id, legacy_id');

      const data = pullData.clients.map((c: any) => ({
        legacy_id: c.idcli,
        code: (c.clicod || '').trim(),
        name: (c.clinom || '').trim(),
        address: (c.clidir || '').trim(),
        zone_id: sbZones?.find((z: any) => z.legacy_id == c.idz)?.id || null,
        vendor_id: sbEmps?.find((e: any) => e.legacy_id == c.cliidemp)?.id || null,
        status: 'Vigente'
      }));

      let clientErrors: string[] = [];
      for (let i = 0; i < data.length; i += batchSize) {
        const { error } = await supabase.from('clients')
          .upsert(data.slice(i, i + batchSize), { onConflict: 'legacy_id' });
        
        if (error) {
          console.error(`🚨 ERROR SUPABASE en Clientes (lote ${i}):`, error.message);
          clientErrors.push(`batch ${i}: ${error.message}`);
        }
      }
      
      results.push({ tabla: 'clients', procesados: data.length, error: clientErrors[0] || null });
    }

    // --- PUSH PEDIDOS (Supabase → SQL Server) ---
    const { data: pendingOrders, error: ordersError } = await supabase
      .from('pedidos')
      .select(`
        *,
        clients_id ( legacy_id ),
        detalle_pedido (
          producto_id,
          cantidad,
          precio_unitario,
          productos:producto_id ( codigo_producto )
        )
      `)
      .is('legacy_id', null)
      .eq('estado', 'Pendiente');

    if (ordersError) console.error('pedidos fetch error:', ordersError.message);

    if (pendingOrders && pendingOrders.length > 0) {
      const pushResp = await fetch(`${API_OFICINA}/api/push-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: pendingOrders })
      });
      const pushJson = await pushResp.json();
      if (pushJson.results) {
        for (const res of pushJson.results) {
          if (res.success) {
            await supabase.from('pedidos').update({ legacy_id: res.legacy_id }).eq('id', res.id);
          }
        }
      }
      results.push({ tabla: 'pedidos', procesados: pendingOrders.length, direccion: 'Supabase→SQL' });
    }

    // ========================================================================
    // --- PULL HISTORIAL DE PEDIDOS (SQL Server → Supabase) ---
    // ========================================================================
    try {
      // 1. Llamamos a nuestra nueva ruta en la oficina
      const pullOrdersResp = await fetch(`${API_OFICINA}/api/pull-orders`);
      
      if (pullOrdersResp.ok) {
        const ordersData = await pullOrdersResp.json();
        
        if (ordersData.success && ordersData.pedidos?.length > 0) {
          // Necesitamos traer el catálogo de Supabase para relacionar los IDs viejos con los UUIDs nuevos
          const { data: sbClients } = await supabase.from('clients').select('id, legacy_id');
          const { data: sbProducts } = await supabase.from('productos').select('id, codigo_producto');

          let pedidosActualizados = 0;
          let pedidosErrores = 0;

          // Recorremos las ventas que nos mandó la oficina
          for (const pedido of ordersData.pedidos) {
            // Buscamos el UUID real del cliente
            const clienteSupabase = sbClients?.find((c: any) => c.legacy_id == pedido.legacy_cliente_id);

            // 2. Insertamos la Cabecera de la venta en Supabase
            const { data: cabeceraGuardada, error: cabeceraError } = await supabase
              .from('pedidos')
              .upsert({
                legacy_id: pedido.legacy_id_venta,
                numero_documento: pedido.numero_documento || `V-OLD-${pedido.legacy_id_venta}`,
                clients_id: clienteSupabase ? clienteSupabase.id : null,
                total_venta: pedido.total_venta,
                estado: 'Completado' // Como vienen del historial de la ofi, ya están pagados/entregados
              }, { onConflict: 'legacy_id' })
              .select('id')
              .single();

            if (cabeceraError) {
              console.error(`🚨 Error insertando pedido ${pedido.legacy_id_venta}:`, cabeceraError.message);
              pedidosErrores++;
              continue; // Saltamos a la siguiente venta
            }

            // 3. Insertamos el Detalle de los productos si la cabecera se guardó bien
            if (cabeceraGuardada && pedido.detalle_pedido?.length > 0) {
              const detallesParaGuardar = pedido.detalle_pedido.map((det: any) => {
                // Buscamos el UUID real del producto guiándonos por su código (ej. PRD-001)
                const productoSupabase = sbProducts?.find((p: any) => p.codigo_producto === det.codigo_producto);
                
                return {
                  pedido_id: cabeceraGuardada.id,
                  producto_id: productoSupabase ? productoSupabase.id : null,
                  cantidad: det.cantidad,
                  precio_unitario: det.precio_unitario
                };
              }).filter((det: any) => det.producto_id !== null); // Descartamos productos que no existan en el panel web

              if (detallesParaGuardar.length > 0) {
                // Limpiamos detalles viejos por si esta venta se está resincronizando (evita duplicados)
                await supabase.from('detalle_pedido').delete().eq('pedido_id', cabeceraGuardada.id);
                // Insertamos todos los detalles en bloque
                await supabase.from('detalle_pedido').insert(detallesParaGuardar);
              }
            }
            pedidosActualizados++;
          }
          
          results.push({ 
            tabla: 'historial_ventas', 
            procesados: pedidosActualizados, 
            errores: pedidosErrores,
            direccion: 'SQL→Supabase'
          });
        }
      }
    } catch (err: any) {
      console.error('💥 Error crítico al sincronizar historial de pedidos:', err.message);
      results.push({ tabla: 'historial_ventas', error: err.message });
    }

    return NextResponse.json({ success: true, resultados: results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}