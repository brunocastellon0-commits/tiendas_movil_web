import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type SyncResult = { tabla: string; direccion: 'SQL→Supabase' | 'Supabase→SQL'; procesados: number; errores: number; mensaje: string; };

export async function GET() {
  const results: SyncResult[] = [];
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Obtenemos la URL de la Mini-API de Cloudflare
    const API_OFICINA = process.env.NEXT_PUBLIC_API_OFICINA || 'https://db-sql.tiendasmovil.com';
    const batchSize = 100;

    // ==================================================================
    // BLOQUE A: SOLICITAR DATOS A LA OFICINA (SQL SERVER → SUPABASE)
    // ==================================================================
    const pullResponse = await fetch(`${API_OFICINA}/api/pull`);
    if (!pullResponse.ok) throw new Error(`La API de la oficina no responde: ${pullResponse.status}`);
    const pullData = await pullResponse.json();

    // A1. Empleados
    if (pullData.employees?.length > 0) {
      const toUpsert = pullData.employees.map((e: any) => ({
        legacy_id: e.idemp, full_name: e.empnom ? e.empnom.trim() : 'Sin Nombre',
        email: e.empemail?.includes('@') ? e.empemail.trim() : `vendedor_${(e.empcod || '').trim()}@tiendasmovil.com`,
        phone: e.emptel ? e.emptel.trim() : '', job_title: e.empcar ? e.empcar.trim() : 'Preventista', status: 'Activo', role: 'user',
      }));
      const { error } = await supabase.from('employees').upsert(toUpsert, { onConflict: 'legacy_id' });
      results.push({ tabla: 'employees', direccion: 'SQL→Supabase', procesados: toUpsert.length, errores: error ? 1 : 0, mensaje: error ? error.message : `${toUpsert.length} empleados listos` });
    }

    // MAPA UUID (Necesario para Clientes)
    const { data: sbEmployees } = await supabase.from('employees').select('id, legacy_id');
    const vendorMap = new Map<number, string>();
    sbEmployees?.forEach((e) => { if (e.legacy_id) vendorMap.set(e.legacy_id, e.id); });

    // A2. Categorías
    if (pullData.categories?.length > 0) {
      const toUpsert = pullData.categories.map((c: any) => ({ legacy_id: c.linid, nombre_categoria: c.linnom?.trim() || '', codigo_categoria: c.lincod?.trim() || '' }));
      for (let i = 0; i < toUpsert.length; i += batchSize) await supabase.from('categorias').upsert(toUpsert.slice(i, i + batchSize), { onConflict: 'nombre_categoria' });
      results.push({ tabla: 'categorias', direccion: 'SQL→Supabase', procesados: toUpsert.length, errores: 0, mensaje: `${toUpsert.length} categorías listas` });
    }

    // A3. Proveedores
    if (pullData.providers?.length > 0) {
      const toUpsert = pullData.providers.map((p: any) => ({ legacy_id: p.prvid, codigo: p.prvcod?.trim() || '', nombre: p.prvnom?.trim() || '', razon_social: p.prvrazon?.trim() || '', nit_ci: p.prvnit?.trim() || '', direccion: p.prvdir?.trim() || '', telefono: p.prvtel?.trim() || '' }));
      for (let i = 0; i < toUpsert.length; i += batchSize) await supabase.from('proveedores').upsert(toUpsert.slice(i, i + batchSize), { onConflict: 'codigo' });
      results.push({ tabla: 'proveedores', direccion: 'SQL→Supabase', procesados: toUpsert.length, errores: 0, mensaje: `${toUpsert.length} proveedores listos` });
    }

    // A4. Productos
    if (pullData.products?.length > 0) {
      const toUpsert = pullData.products.map((p: any) => ({ codigo_producto: p.prdcod?.trim() || '', nombre_producto: p.prdnom?.trim() || '', precio_base_venta: p.prdpoficial || 0, stock_actual: p.prdstmax || 0, stock_min: p.prdstmin || 0, unidad_base_venta: p.prdunid?.trim() || 'UND', estado: 'Activo' }));
      for (let i = 0; i < toUpsert.length; i += batchSize) await supabase.from('productos').upsert(toUpsert.slice(i, i + batchSize), { onConflict: 'codigo_producto' });
      results.push({ tabla: 'productos', direccion: 'SQL→Supabase', procesados: toUpsert.length, errores: 0, mensaje: `${toUpsert.length} productos listos` });
    }

    // A5. Clientes
    if (pullData.clients?.length > 0) {
      const toUpsert = pullData.clients.map((c: any) => ({ legacy_id: c.idcli || null, code: c.clicod?.trim() || '', name: c.clinom?.trim() || 'Sin nombre', tax_id: c.clinit?.trim() || '', address: c.clidir?.trim() || '', phones: c.clitel?.trim() || '', credit_limit: c.clitlimcre || 0, vendor_id: vendorMap.get(c.idven) || null, status: 'Vigente' }));
      for (let i = 0; i < toUpsert.length; i += batchSize) await supabase.from('clients').upsert(toUpsert.slice(i, i + batchSize), { onConflict: 'code' });
      results.push({ tabla: 'clients', direccion: 'SQL→Supabase', procesados: toUpsert.length, errores: 0, mensaje: `${toUpsert.length} clientes listos` });
    }

    // ==================================================================
    // BLOQUE B: ENVIAR DATOS A LA OFICINA (SUPABASE → SQL SERVER)
    // ==================================================================
    
    // B1. Pedidos
    const { data: pendingOrders } = await supabase.from('pedidos').select(`*, clients:clients_id ( legacy_id ), detalle_pedido ( producto_id, cantidad, precio_unitario, productos:producto_id ( codigo_producto ) )`).is('legacy_id', null).eq('estado', 'Pendiente').limit(20);
    
    if (pendingOrders && pendingOrders.length > 0) {
      const pushResp = await fetch(`${API_OFICINA}/api/push-orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orders: pendingOrders }) });
      const { results: pushResults } = await pushResp.json();
      
      let procesados = 0;
      for (const res of pushResults) {
        if (res.success) {
          await supabase.from('pedidos').update({ legacy_id: res.legacy_id }).eq('id', res.id);
          procesados++;
        }
      }
      results.push({ tabla: 'pedidos', direccion: 'Supabase→SQL', procesados, errores: pendingOrders.length - procesados, mensaje: `${procesados} pedidos enviados a la oficina` });
    } else {
       results.push({ tabla: 'pedidos', direccion: 'Supabase→SQL', procesados: 0, errores: 0, mensaje: 'Sin pedidos pendientes' });
    }

    // B2. Visitas
    const { data: pendingVisits } = await supabase.from('visits').select(`id, start_time, end_time, outcome, notes, seller_id, clients:client_id ( legacy_id ), employees:seller_id ( legacy_id )`).is('legacy_id', null).limit(50);
    
    if (pendingVisits && pendingVisits.length > 0) {
      const pushResp = await fetch(`${API_OFICINA}/api/push-visits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visits: pendingVisits }) });
      const { results: pushResults } = await pushResp.json();
      
      let procesados = 0;
      for (const res of pushResults) {
        if (res.success) {
          await supabase.from('visits').update({ legacy_id: res.legacy_id }).eq('id', res.id);
          procesados++;
        }
      }
      results.push({ tabla: 'visits', direccion: 'Supabase→SQL', procesados, errores: pendingVisits.length - procesados, mensaje: `${procesados} visitas enviadas a la oficina` });
    } else {
       results.push({ tabla: 'visits', direccion: 'Supabase→SQL', procesados: 0, errores: 0, mensaje: 'Sin visitas pendientes' });
    }

    // RESUMEN
    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), resumen: { tablas: results.length }, resultados: results });

  } catch (error: any) {
    console.error('Error FATAL en sync/full:', error);
    return NextResponse.json({ success: false, error: error.message, resultados: results }, { status: 500 });
  }
}