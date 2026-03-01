import { NextResponse } from 'next/server';
import { getSqlConnection } from '@/utils/mssql';
import sql from 'mssql';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const pool = await getSqlConnection();

    // Mapeo basado en tu componente ProvidersTab y tabla tbprv
    await pool.request()
      .input('cod', sql.VarChar, data.codigo)
      .input('nom', sql.VarChar, data.nombre)
      .input('rs', sql.VarChar, data.razon_social)
      .input('nit', sql.VarChar, data.nit_ci)
      .input('dir', sql.VarChar, data.direccion)
      .input('tel', sql.VarChar, data.telefono)
      .query(`
        IF EXISTS (SELECT 1 FROM tbprv WHERE prvcod = @cod)
        BEGIN
          UPDATE tbprv 
          SET prvnom = @nom, prvrazon = @rs, prvnit = @nit, prvdir = @dir, prvtel = @tel
          WHERE prvcod = @cod
        END
        ELSE
        BEGIN
          INSERT INTO tbprv (prvcod, prvnom, prvrazon, prvnit, prvdir, prvtel)
          VALUES (@cod, @nom, @rs, @nit, @dir, @tel)
        END
      `);

    return NextResponse.json({ success: true, message: 'Proveedor sincronizado localmente' });
  } catch (error: any) {
    console.error('Error en Sync Proveedor:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}