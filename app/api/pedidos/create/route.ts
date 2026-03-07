import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Usa el Service Role Key para bypassear RLS en todas las tablas
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { cabecera, detalles } = body

    if (!cabecera || !detalles || detalles.length === 0) {
      return NextResponse.json({ error: 'Datos incompletos: se requiere cabecera y detalles' }, { status: 400 })
    }

    // 1. Insertar la cabecera del pedido
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('pedidos')
      .insert(cabecera)
      .select()
      .single()

    if (orderError) {
      console.error('[API /pedidos/create] Error insertando cabecera:', orderError)
      return NextResponse.json({
        error: orderError.message,
        code: orderError.code,
        details: orderError.details,
        hint: orderError.hint,
      }, { status: 500 })
    }

    // 2. Insertar los detalles del pedido enlazados al nuevo pedido
    const detallesConId = detalles.map((d: any) => ({
      ...d,
      pedido_id: orderData.id,
    }))

    const { error: detallesError } = await supabaseAdmin
      .from('detalle_pedido')
      .insert(detallesConId)

    if (detallesError) {
      // Revertir: eliminar la cabecera si los detalles fallaron
      await supabaseAdmin.from('pedidos').delete().eq('id', orderData.id)
      console.error('[API /pedidos/create] Error insertando detalles (cabecera revertida):', detallesError)
      return NextResponse.json({
        error: detallesError.message,
        code: detallesError.code,
        details: detallesError.details,
        hint: detallesError.hint,
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, pedido_id: orderData.id, pedido: orderData })

  } catch (err: any) {
    console.error('[API /pedidos/create] Error inesperado:', err)
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
  }
}
