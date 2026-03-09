import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const cleanString = (val: any) => val ? String(val).trim() : '';
const cleanInt    = (val: any) => { const n = parseInt(val); return isNaN(n) ? 0 : n; };
const cleanFloat  = (val: any) => { const n = parseFloat(val); return isNaN(n) ? 0.00 : n; };

export async function POST(req: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const API_OFICINA = process.env.NEXT_PUBLIC_API_OFICINA || 'https://db-sql.tiendasmovil.com';
    const { entity, data } = await req.json();

    console.log(`[sync-master] Recibiendo entidad: ${entity}`, data);

    switch (entity) {

      // ================================================================
      // PEDIDOS: Guardamos en Supabase primero.
      // La Mini-API de la oficina lo recoge via WebSocket automáticamente.
      // ================================================================
      case 'ORDER': {
        const clienteId = cleanInt(data.cliente_legacy_id);
        const totalVenta = cleanFloat(data.total_venta);

        if (clienteId === 0) {
          throw new Error('El ID del cliente es 0 o inválido.');
        }

        // 1. Buscar el UUID del cliente en Supabase usando su legacy_id
        const { data: cliente, error: cliErr } = await supabase
          .from('clients')
          .select('id')
          .eq('legacy_id', clienteId)
          .single();

        if (cliErr || !cliente) {
          throw new Error(`Cliente con legacy_id ${clienteId} no encontrado en Supabase.`);
        }

        // 2. Guardar cabecera del pedido en Supabase (legacy_id = null = pendiente)
        const numeroDoc = `WEB-${Date.now()}`;
        const { data: pedidoGuardado, error: pedErr } = await supabase
          .from('pedidos')
          .insert({
            numero_documento: numeroDoc,
            tipo_documento:   'VD',
            fecha_pedido:      new Date().toISOString().split('T')[0],
            clients_id:        cliente.id,
            empleado_id:       null,   // Sin vendedor asignado desde web
            total_venta:       totalVenta,
            estado:            'Pendiente',
            legacy_id:         null    // null = todavía no llegó a SQL Server
          })
          .select('id')
          .single();

        if (pedErr || !pedidoGuardado) {
          throw new Error(`Error guardando pedido: ${pedErr?.message}`);
        }

        // 3. Guardar detalles del pedido en Supabase
        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          const detalles = [];

          for (const item of data.items) {
            const codigoPrd = cleanString(item.codigo_producto);
            const { data: producto } = await supabase
              .from('productos')
              .select('id')
              .eq('codigo_producto', codigoPrd)
              .single();

            if (producto) {
              detalles.push({
                pedido_id:         pedidoGuardado.id,
                producto_id:       producto.id,
                cantidad:          cleanFloat(item.cantidad),
                precio_unitario:   cleanFloat(item.precio),
                subtotal:          parseFloat((cleanFloat(item.cantidad) * cleanFloat(item.precio)).toFixed(2)),
                unidad_seleccionada: cleanString(item.unidad) || 'UND',
              });
            } else {
              console.warn(`[sync-master] Producto SKU "${codigoPrd}" no encontrado en Supabase`);
            }
          }

          if (detalles.length > 0) {
            const { error: detErr } = await supabase.from('detalle_pedido').insert(detalles);
            if (detErr) throw new Error(`Error guardando detalles: ${detErr.message}`);
          }
        }

        // 4. El WebSocket de la Mini-API de la oficina lo detectará automáticamente
        //    y lo escribirá en SQL Server. No necesitamos llamar a nada más.
        console.log(`[sync-master] ✅ Pedido ${pedidoGuardado.id} guardado en Supabase. WebSocket lo enviará a SQL Server.`);

        return NextResponse.json({
          success: true,
          pedido_id: pedidoGuardado.id,
          numero_documento: numeroDoc,
          message: 'Pedido guardado. Será sincronizado con la oficina automáticamente.'
        });
      }

      // ================================================================
      // CLIENTES: Delegamos a la Mini-API de la oficina
      // ================================================================
      case 'CLIENT': {
        const resp = await fetch(`${API_OFICINA}/api/push-client`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client: data }),
          cache: 'no-store'
        });

        if (!resp.ok) {
          const errBody = await resp.text();
          throw new Error(`Mini-API no pudo guardar cliente: ${errBody}`);
        }

        return NextResponse.json({ success: true });
      }

      // ================================================================
      // PRODUCTOS y CATEGORÍAS: Delegamos a la Mini-API de la oficina
      // ================================================================
      case 'PRODUCT':
      case 'CATEGORY': {
        const endpoint = entity === 'PRODUCT' ? '/api/push-product' : '/api/push-category';
        const resp = await fetch(`${API_OFICINA}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data }),
          cache: 'no-store'
        });

        if (!resp.ok) {
          const errBody = await resp.text();
          throw new Error(`Mini-API no pudo guardar ${entity}: ${errBody}`);
        }

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Entidad no soportada' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('[sync-master] Error FATAL:', error.message);
    return NextResponse.json(
      { error: error.message, details: 'Revisar datos enviados o conexión con la oficina' },
      { status: 500 }
    );
  }
}