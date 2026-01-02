"use client";

import React, { useState, useMemo } from "react";
import { 
  Download, Filter, TrendingUp, TrendingDown, DollarSign, 
  Users, Target, Activity, Clock, Award, AlertCircle, CheckCircle2, XCircle 
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, AreaChart, Area
} from "recharts";

// ==========================================
// 1. DATOS Y TIPOS (Simulación Avanzada)
// ==========================================

const CATALOGOS = {
  prevendedores: ["Carlos Mendoza", "Ana García", "Luis Fernández", "María Torres", "Jorge Ramírez", "Laura Morales", "Roberto Silva", "Patricia López"],
  productos: ["Coca-Cola 2L", "Pepsi 1.5L", "Fanta Naranja", "Sprite 2L", "Agua Vital", "Monster Energy"],
  zonas: ["Norte", "Sur", "Este", "Oeste", "Centro"]
};

type Transaction = {
  id: string;
  rep: string;
  product: string;
  zone: string;
  amount: number;
  success: boolean;
  duration: number; // Minutos en la visita
  date: Date; // Fecha de la transacción
  outcome: 'venta' | 'no_venta' | 'cerrado'; // Resultado de la visita
};

// Generamos 1000 transacciones para que haya datos suficientes
const RAW_DATA: Transaction[] = (() => {
  const data: Transaction[] = [];
  const now = new Date();
  
  for (let i = 0; i < 1000; i++) {
    const randomOutcome = Math.random();
    const isSuccess = randomOutcome > 0.35;
    const isClosed = randomOutcome < 0.1; // 10% cerrado
    
    const outcome: 'venta' | 'no_venta' | 'cerrado' = 
      isClosed ? 'cerrado' : (isSuccess ? 'venta' : 'no_venta');
    
    data.push({
      id: `TRX-${i}`,
      date: new Date(now.getTime() - Math.random() * 14 * 24 * 60 * 60 * 1000), // Últimos 14 días
      rep: CATALOGOS.prevendedores[Math.floor(Math.random() * CATALOGOS.prevendedores.length)],
      product: CATALOGOS.productos[Math.floor(Math.random() * CATALOGOS.productos.length)],
      zone: CATALOGOS.zonas[Math.floor(Math.random() * CATALOGOS.zonas.length)],
      amount: isSuccess ? Math.floor(Math.random() * 1500) + 200 : 0,
      success: isSuccess,
      duration: 
        outcome === 'venta' ? Math.floor(Math.random() * 20) + 20 :  // 20-40 min
        outcome === 'cerrado' ? 2 :  // 2 min
        Math.floor(Math.random() * 10) + 5, // 5-15 min para no_venta
      outcome
    });
  }
  return data;
})();

// Función para generar datos diarios agregados (para gráfico de tendencias)
const generateDailyData = () => {
  const dailyMap: { [key: string]: any } = {};
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  
  RAW_DATA.forEach(transaction => {
    const dateKey = transaction.date.toISOString().split('T')[0];
    
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = {
        date: dateKey,
        dayName: days[transaction.date.getDay()],
        venta: 0,
        noVenta: 0,
        cerrado: 0,
        timeVenta: [],
        timeNoVenta: [],
        timeCerrado: []
      };
    }
    
    if (transaction.outcome === 'venta') {
      dailyMap[dateKey].venta++;
      dailyMap[dateKey].timeVenta.push(transaction.duration);
    } else if (transaction.outcome === 'no_venta') {
      dailyMap[dateKey].noVenta++;
      dailyMap[dateKey].timeNoVenta.push(transaction.duration);
    } else {
      dailyMap[dateKey].cerrado++;
      dailyMap[dateKey].timeCerrado.push(transaction.duration);
    }
  });
  
  // Convertir a array y calcular promedios
  return Object.values(dailyMap)
    .map((day: any) => ({
      ...day,
      timeVenta: day.timeVenta.length > 0 
        ? Math.round(day.timeVenta.reduce((a: number, b: number) => a + b, 0) / day.timeVenta.length) 
        : 0,
      timeNoVenta: day.timeNoVenta.length > 0 
        ? Math.round(day.timeNoVenta.reduce((a: number, b: number) => a + b, 0) / day.timeNoVenta.length) 
        : 0,
      timeCerrado: day.timeCerrado.length > 0 
        ? Math.round(day.timeCerrado.reduce((a: number, b: number) => a + b, 0) / day.timeCerrado.length) 
        : 2
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-14); // Últimos 14 días
};

const DAILY_CHART_DATA = generateDailyData();

const formatCurrency = (val: number) => new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB', maximumFractionDigits: 0 }).format(val);

// ==========================================
// 2. COMPONENTES VISUALES
// ==========================================

const KpiCard = ({ title, value, subtext, icon: Icon, colorClass, trend }: any) => (
  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
    <div className="flex justify-between items-start mb-2">
      <div>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      </div>
      <div className={`p-2 rounded-lg ${colorClass}`}>
        <Icon size={20} />
      </div>
    </div>
    <div className="flex items-center gap-2 text-xs">
        {trend && (
            <span className={`font-bold ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {trend > 0 ? '+' : ''}{trend}%
            </span>
        )}
        <span className="text-slate-400 font-medium">{subtext}</span>
    </div>
  </div>
);

// Tooltip Personalizado para el Gráfico de Tendencias
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-4 border border-slate-200 shadow-xl rounded-xl text-sm">
        <p className="font-bold text-slate-800 mb-2 border-b pb-2">{data.dayName}, {label}</p>
        
        <div className="space-y-3">
          {/* Venta */}
          <div className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 size={16} /> 
              <span>Con Venta:</span>
            </div>
            <div className="text-right">
              <span className="font-bold block">{data.venta} visitas</span>
              <span className="text-xs text-slate-400 font-medium flex items-center justify-end gap-1">
                <Clock size={10}/> {data.timeVenta} min/avg
              </span>
            </div>
          </div>

          {/* Sin Venta */}
          <div className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-2 text-orange-500">
              <AlertCircle size={16} /> 
              <span>Sin Venta:</span>
            </div>
            <div className="text-right">
              <span className="font-bold block">{data.noVenta} visitas</span>
              <span className="text-xs text-slate-400 font-medium flex items-center justify-end gap-1">
                <Clock size={10}/> {data.timeNoVenta} min/avg
              </span>
            </div>
          </div>

          {/* Cerrado */}
          <div className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-2 text-slate-400">
              <XCircle size={16} /> 
              <span>Cerrado:</span>
            </div>
            <div className="text-right">
              <span className="font-bold block">{data.cerrado} locales</span>
              <span className="text-xs text-slate-400 font-medium flex items-center justify-end gap-1">
                <Clock size={10}/> {data.timeCerrado} min/avg
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// ==========================================
// 3. PÁGINA PRINCIPAL
// ==========================================

export default function ReportsPage() {
  const [selectedRep, setSelectedRep] = useState("Todos");
  const [selectedProduct, setSelectedProduct] = useState("Todos");
  const [selectedZone, setSelectedZone] = useState("Todos");
  const [selectedTrendRep, setSelectedTrendRep] = useState("Todos"); // Filtro para gráfico de tendencias
  const [selectedDay, setSelectedDay] = useState<any>(null); // Día seleccionado para ver detalles

  // --- MOTOR DE CÁLCULO ---
  const filteredData = useMemo(() => {
    return RAW_DATA.filter(item => {
      if (selectedRep !== "Todos" && item.rep !== selectedRep) return false;
      if (selectedProduct !== "Todos" && item.product !== selectedProduct) return false;
      if (selectedZone !== "Todos" && item.zone !== selectedZone) return false;
      return true;
    });
  }, [selectedRep, selectedProduct, selectedZone]);

  // Cálculos Generales (KPIs)
  const kpis = useMemo(() => {
    const totalVentas = filteredData.reduce((acc, curr) => acc + curr.amount, 0);
    const visitasTotales = filteredData.length;
    const ventasExitosas = filteredData.filter(t => t.success).length;
    const tiempoTotal = filteredData.reduce((acc, curr) => acc + curr.duration, 0);
    
    const tasaConversion = visitasTotales > 0 ? (ventasExitosas / visitasTotales) * 100 : 0;
    const ticketPromedio = ventasExitosas > 0 ? totalVentas / ventasExitosas : 0;
    const tiempoPromedio = visitasTotales > 0 ? tiempoTotal / visitasTotales : 0;

    return { totalVentas, visitasTotales, ventasExitosas, tasaConversion, ticketPromedio, tiempoPromedio };
  }, [filteredData]);

  // Datos Agrupados por Vendedor (Para Gráficas y Listas)
  const groupedByRep = useMemo(() => {
    const grouped: any = {};
    
    // Inicializar todos los prevendedores (para que aparezcan aunque tengan 0 ventas si no hay filtro)
    CATALOGOS.prevendedores.forEach(rep => {
         if (selectedRep === "Todos" || selectedRep === rep) {
            grouped[rep] = { name: rep, visitas: 0, ventas: 0, monto: 0, tiempo: 0 };
         }
    });

    filteredData.forEach(item => {
      if (grouped[item.rep]) {
        grouped[item.rep].visitas += 1;
        grouped[item.rep].tiempo += item.duration;
        if (item.success) {
          grouped[item.rep].ventas += 1;
          grouped[item.rep].monto += item.amount;
        }
      }
    });

    // Convertir a array y calcular métricas derivadas (eficiencia, etc)
    return Object.values(grouped).map((item: any) => ({
        ...item,
        eficiencia: item.visitas > 0 ? (item.ventas / item.visitas) * 100 : 0,
        tiempoPromedio: item.visitas > 0 ? item.tiempo / item.visitas : 0
    })).sort((a: any, b: any) => b.monto - a.monto); // Ordenar por monto por defecto

  }, [filteredData, selectedRep]);


  // Datos para Gráfico Radar (Normalizados)
  const radarData = useMemo(() => {
    // Metas hipotéticas para calcular el % del radar
    const metas = { venta: 30000, conv: 70, tiempo: 35, visita: 60, ticket: 1200 };
    
    return [
      { subject: 'Volumen ($)', A: Math.min((kpis.totalVentas / metas.venta) * 100, 100), fullMark: 100 },
      { subject: 'Efectividad (%)', A: Math.min((kpis.tasaConversion / metas.conv) * 100, 100), fullMark: 100 },
      { subject: 'Tiempo (min)', A: Math.min((kpis.tiempoPromedio / metas.tiempo) * 100, 100), fullMark: 100 },
      { subject: 'Cobertura (#)', A: Math.min((kpis.visitasTotales / metas.visita) * 100, 100), fullMark: 100 },
      { subject: 'Ticket Prom', A: Math.min((kpis.ticketPromedio / metas.ticket) * 100, 100), fullMark: 100 },
    ];
  }, [kpis]);

  // Datos de tendencias FILTRADOS por empleado seleccionado
  const filteredDailyTrends = useMemo(() => {
    const dailyMap: { [key: string]: any } = {};
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    
    // Filtrar datos por empleado si está seleccionado
    const dataToProcess = selectedTrendRep === "Todos" 
      ? RAW_DATA 
      : RAW_DATA.filter(t => t.rep === selectedTrendRep);
    
    dataToProcess.forEach(transaction => {
      const dateKey = transaction.date.toISOString().split('T')[0];
      
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = {
          date: dateKey,
          dayName: days[transaction.date.getDay()],
          venta: 0,
          noVenta: 0,
          cerrado: 0,
          timeVenta: [],
          timeNoVenta: [],
          timeCerrado: [],
          transactions: [] // Guardamos las transacciones para el detalle
        };
      }
      
      dailyMap[dateKey].transactions.push(transaction);
      
      if (transaction.outcome === 'venta') {
        dailyMap[dateKey].venta++;
        dailyMap[dateKey].timeVenta.push(transaction.duration);
      } else if (transaction.outcome === 'no_venta') {
        dailyMap[dateKey].noVenta++;
        dailyMap[dateKey].timeNoVenta.push(transaction.duration);
      } else {
        dailyMap[dateKey].cerrado++;
        dailyMap[dateKey].timeCerrado.push(transaction.duration);
      }
    });
    
    // Convertir a array y calcular promedios
    return Object.values(dailyMap)
      .map((day: any) => ({
        ...day,
        timeVenta: day.timeVenta.length > 0 
          ? Math.round(day.timeVenta.reduce((a: number, b: number) => a + b, 0) / day.timeVenta.length) 
          : 0,
        timeNoVenta: day.timeNoVenta.length > 0 
          ? Math.round(day.timeNoVenta.reduce((a: number, b: number) => a + b, 0) / day.timeNoVenta.length) 
          : 0,
        timeCerrado: day.timeCerrado.length > 0 
          ? Math.round(day.timeCerrado.reduce((a: number, b: number) => a + b, 0) / day.timeCerrado.length) 
          : 2
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-14); // Últimos 14 días
  }, [selectedTrendRep]);

  // Análisis e Interpretación de Datos
  const interpretation = useMemo(() => {
    if (filteredDailyTrends.length === 0) return null;

    const totalVentas = filteredDailyTrends.reduce((acc, d) => acc + d.venta, 0);
    const totalNoVentas = filteredDailyTrends.reduce((acc, d) => acc + d.noVenta, 0);
    const totalCerrados = filteredDailyTrends.reduce((acc, d) => acc + d.cerrado, 0);
    const totalVisitas = totalVentas + totalNoVentas;
    
    const tasaConversion = totalVisitas > 0 ? (totalVentas / totalVisitas) * 100 : 0;
    const avgTimeVenta = filteredDailyTrends.reduce((acc, d) => acc + d.timeVenta, 0) / filteredDailyTrends.length;
    const avgTimeNoVenta = filteredDailyTrends.reduce((acc, d) => acc + d.timeNoVenta, 0) / filteredDailyTrends.length;

    // Detectar tendencias (comparar primera mitad vs segunda mitad)
    const midPoint = Math.floor(filteredDailyTrends.length / 2);
    const firstHalf = filteredDailyTrends.slice(0, midPoint);
    const secondHalf = filteredDailyTrends.slice(midPoint);
    
    const firstHalfConv = firstHalf.reduce((acc, d) => acc + d.venta, 0) / 
                          (firstHalf.reduce((acc, d) => acc + d.venta + d.noVenta, 0) || 1) * 100;
    const secondHalfConv = secondHalf.reduce((acc, d) => acc + d.venta, 0) / 
                           (secondHalf.reduce((acc, d) => acc + d.venta + d.noVenta, 0) || 1) * 100;
    
    const trending = secondHalfConv > firstHalfConv ? 'up' : secondHalfConv < firstHalfConv ? 'down' : 'stable';

    return {
      totalVentas,
      totalNoVentas,
      totalCerrados,
      tasaConversion,
      avgTimeVenta,
      avgTimeNoVenta,
      trending,
      insights: []
    };
  }, [filteredDailyTrends]);


  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-8 text-slate-800 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Reportes y Analíticas</h1>
          <p className="text-slate-500 mt-1">Visión general del rendimiento comercial y operativo.</p>
        </div>
        <button className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-900/20">
            <Download size={18} /> Exportar Data
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-slate-400 border-r border-slate-200 pr-4">
            <Filter size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Filtros</span>
        </div>
        <select value={selectedRep} onChange={(e) => setSelectedRep(e.target.value)} className="bg-slate-50 border border-slate-200 text-sm rounded-md px-3 py-2 outline-none focus:border-blue-500 w-48">
            <option value="Todos">Todos los Prevendedores</option>
            {CATALOGOS.prevendedores.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)} className="bg-slate-50 border border-slate-200 text-sm rounded-md px-3 py-2 outline-none focus:border-blue-500 w-40">
            <option value="Todos">Todas las Zonas</option>
            {CATALOGOS.zonas.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
        {(selectedRep !== "Todos" || selectedZone !== "Todos") && (
             <button onClick={() => { setSelectedRep("Todos"); setSelectedZone("Todos"); }} className="ml-auto text-xs text-rose-500 font-bold hover:underline">Limpiar Filtros</button>
        )}
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Ventas Totales" value={formatCurrency(kpis.totalVentas)} trend={12.5} subtext="vs mes anterior" icon={DollarSign} colorClass="bg-emerald-100 text-emerald-600" />
        <KpiCard title="Tasa de Conversión" value={kpis.tasaConversion.toFixed(1) + "%"} trend={-2.4} subtext="Bajo el objetivo" icon={Target} colorClass="bg-blue-100 text-blue-600" />
        <KpiCard title="Tiempo Promedio Visita" value={Math.round(kpis.tiempoPromedio) + " min"} trend={5.1} subtext="Óptimo: 35 min" icon={Clock} colorClass="bg-violet-100 text-violet-600" />
        <KpiCard title="Visitas Realizadas" value={kpis.visitasTotales} trend={8.2} subtext="Cobertura de ruta" icon={Activity} colorClass="bg-orange-100 text-orange-600" />
      </div>

      {/* SECCIÓN DE GRÁFICAS (2 TIPOS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRÁFICO 1: BARRAS (Volumen) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Volumen de Operaciones</h3>
            <p className="text-sm text-slate-500 mb-6">Comparativa de cantidad de visitas vs. ventas exitosas por empleado.</p>
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupedByRep} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barGap={8}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tickFormatter={(val) => val.split(" ")[0]} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                        <Legend iconType="circle" />
                        <Bar dataKey="visitas" name="Visitas" fill="#cbd5e1" radius={[4, 4, 4, 4]} barSize={20} />
                        <Bar dataKey="ventas" name="Ventas" fill="#3b82f6" radius={[4, 4, 4, 4]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* GRÁFICO 2: RADAR (Eficiencia Vectorial) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={100}/></div>
             <h3 className="text-lg font-bold text-slate-800 mb-1 z-10">Eficiencia 360°</h3>
             <p className="text-sm text-slate-500 mb-4 z-10">
                {selectedRep === "Todos" ? "Promedio general del equipo" : `Análisis de ${selectedRep}`}
             </p>
             
             <div className="flex-1 min-h-[250px] flex items-center justify-center z-10">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name="Score" dataKey="A" stroke="#8b5cf6" strokeWidth={3} fill="#8b5cf6" fillOpacity={0.3} />
                        <Tooltip contentStyle={{borderRadius: '8px', border:'none'}} cursor={{strokeWidth: 0}} />
                    </RadarChart>
                </ResponsiveContainer>
             </div>
             <div className="mt-2 text-center">
                <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-1 rounded-full">
                    Puntaje Global: {Math.round(radarData.reduce((a,b)=>a+b.A,0)/5)}/100
                </span>
             </div>
        </div>

      </div>

      {/* SECCIÓN DE LISTAS (TOP & BOTTOM) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LISTA 1: MEJORES PREVENDEDORES */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="text-xl">🏆</span> Top 3 Mejores Prevendedores
            </h3>
            <div className="space-y-4">
                {groupedByRep.slice(0, 3).map((v: any, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-transparent hover:border-emerald-200 transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                                {i + 1}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 text-sm">{v.name}</p>
                                <p className="text-xs text-slate-500">{v.ventas} ventas • {v.eficiencia.toFixed(1)}% efic.</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-emerald-600 text-sm">{formatCurrency(v.monto)}</p>
                            <p className="text-[10px] text-emerald-500 font-medium">Excelente</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* LISTA 2: REQUIEREN APOYO */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <AlertCircle size={20} className="text-orange-500" /> 
                Necesitan Apoyo (Bajo Rendimiento)
            </h3>
            <div className="space-y-4">
                {/* Tomamos los últimos 3, invirtiendo el array y filtrando los que tengan ventas > 0 para no mostrar gente inactiva */}
                {[...groupedByRep].reverse().filter(v => v.visitas > 0).slice(0, 3).map((v: any, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-orange-50/50 rounded-lg border border-transparent hover:border-orange-200 transition-all">
                        <div className="flex gap-3 items-center">
                            <span className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 text-slate-500 rounded-full text-xs font-bold shadow-sm">
                                {groupedByRep.length - i}
                            </span>
                            <div>
                                <p className="font-bold text-slate-800 text-sm">{v.name}</p>
                                <p className="text-xs text-slate-500">{v.ventas} ventas • {v.eficiencia.toFixed(1)}% efic.</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-slate-700 text-sm">{formatCurrency(v.monto)}</p>
                            <span className="text-[10px] px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full font-bold">Baja Conversión</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>

      {/* SECCIÓN DE EVOLUCIÓN TEMPORAL (GRÁFICOS DE TENDENCIAS) */}
      <div className="space-y-6">
        
        {/* Header de sección con filtro de empleado */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="text-blue-600" />
              Evolución de Efectividad de Ruta
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {selectedTrendRep === "Todos" 
                ? "Análisis general del equipo en los últimos 14 días" 
                : `Rendimiento individual de ${selectedTrendRep} en los últimos 14 días`}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Selector de Empleado */}
            <select 
              value={selectedTrendRep} 
              onChange={(e) => setSelectedTrendRep(e.target.value)}
              className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg px-4 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 w-52"
            >
              <option value="Todos">👥 Todo el Equipo</option>
              {CATALOGOS.prevendedores.map(p => (
                <option key={p} value={p}>👤 {p}</option>
              ))}
            </select>
            
            {/* Selector de Período */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1">
                <button className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200">14 Días</button>
                <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 rounded">30 Días</button>
            </div>
          </div>
        </div>

        {/* GRÁFICO DE LÍNEAS (Tendencias Diarias) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={filteredDailyTrends}
                margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                onClick={(data: any) => {
                  if (data && data.activePayload && data.activePayload.length > 0) {
                    setSelectedDay(data.activePayload[0].payload);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date"
                  tickFormatter={(val) => {
                    const date = new Date(val);
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                  }}
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }} 
                  label={{ value: 'Cantidad de Visitas', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
                />
                
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 2, strokeDasharray: '4 4' }} />
                <Legend verticalAlign="top" height={36} iconType="circle"/>

                {/* LÍNEA 1: VENTAS (Verde / Emerald) */}
                <Line 
                  type="monotone" 
                  dataKey="venta" 
                  name="Visita con Venta" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 7, strokeWidth: 0, onClick: (e:any, payload: any) => setSelectedDay(payload.payload) }}
                />

                {/* LÍNEA 2: SIN VENTA (Naranja / Orange) */}
                <Line 
                  type="monotone" 
                  dataKey="noVenta" 
                  name="Sin Venta" 
                  stroke="#f97316" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 7, strokeWidth: 0, onClick: (e:any, payload: any) => setSelectedDay(payload.payload) }}
                />

                {/* LÍNEA 3: CERRADO (Gris / Slate) */}
                <Line 
                  type="monotone" 
                  dataKey="cerrado" 
                  name="Tienda Cerrada" 
                  stroke="#94a3b8" 
                  strokeWidth={3} 
                  strokeDasharray="5 5"
                  dot={{ r: 4, fill: '#94a3b8', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 7, strokeWidth: 0, onClick: (e:any, payload: any) => setSelectedDay(payload.payload) }}
                />

              </LineChart>
            </ResponsiveContainer>
          </div>
          
          {/* Nota al pie */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                  <AlertCircle size={14}/>
                  <span>Haz clic en cualquier punto del gráfico para ver el detalle completo del día.</span>
              </div>
              <span>Datos actualizados en tiempo real</span>
          </div>
        </div>

        {/* PANEL DE INTERPRETACIÓN DE DATOS (IA - Insights) */}
        {interpretation && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-600 rounded-lg text-white">
                <Activity size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 mb-2">📊 Interpretación Inteligente de Datos</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Análisis automático del rendimiento {selectedTrendRep === "Todos" ? "del equipo" : `de ${selectedTrendRep}`}
                </p>
                
                {/* Métricas Resumidas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-white p-3 rounded-lg">
                    <p className="text-xs text-slate-500 font-bold uppercase">Ventas Totales</p>
                    <p className="text-2xl font-bold text-emerald-600">{interpretation.totalVentas}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <p className="text-xs text-slate-500 font-bold uppercase">Rechazos</p>
                    <p className="text-2xl font-bold text-orange-600">{interpretation.totalNoVentas}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <p className="text-xs text-slate-500 font-bold uppercase">Tasa Conversión</p>
                    <p className="text-2xl font-bold text-blue-600">{interpretation.tasaConversion.toFixed(1)}%</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <p className="text-xs text-slate-500 font-bold uppercase">Tendencia</p>
                    <p className={`text-2xl font-bold ${
                      interpretation.trending === 'up' ? 'text-emerald-600' : 
                      interpretation.trending === 'down' ? 'text-rose-600' : 'text-slate-600'
                    }`}>
                      {interpretation.trending === 'up' ? '📈 Mejorando' : 
                       interpretation.trending === 'down' ? '📉 Decayendo' : '➡️ Estable'}
                    </p>
                  </div>
                </div>

                {/* Insights y Recomendaciones */}
                <div className="space-y-3">
                  <div className="bg-white p-4 rounded-lg border-l-4 border-blue-500">
                    <p className="text-sm font-bold text-slate-800 mb-1">💡 Análisis de Tiempos</p>
                    <p className="text-sm text-slate-600">
                      {interpretation.avgTimeVenta >= 20 && interpretation.avgTimeVenta <= 30
                        ? `✅ Tiempo promedio en ventas (${Math.round(interpretation.avgTimeVenta)} min) está dentro del rango óptimo. Excelente control del proceso.`
                        : interpretation.avgTimeVenta > 30
                        ? `⚠️ Tiempo promedio en ventas (${Math.round(interpretation.avgTimeVenta)} min) es elevado. Considerar optimizar el proceso de cierre.`
                        : `⚠️ Tiempo promedio en ventas (${Math.round(interpretation.avgTimeVenta)} min) es muy bajo. Verificar calidad de atención.`}
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-lg border-l-4 border-orange-500">
                    <p className="text-sm font-bold text-slate-800 mb-1">🎯 Efectividad de Visitas</p>
                    <p className="text-sm text-slate-600">
                      {interpretation.tasaConversion >= 60
                        ? `🌟 Tasa de conversión de ${interpretation.tasaConversion.toFixed(1)}% es excelente. Mantener la estrategia actual.`
                        : interpretation.tasaConversion >= 40
                        ? `👍 Tasa de conversión de ${interpretation.tasaConversion.toFixed(1)}% es buena. Oportunidad de mejora con capacitación.`
                        : `🚨 Tasa de conversión de ${interpretation.tasaConversion.toFixed(1)}% requiere atención urgente. Revisar estrategia de ventas.`}
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-lg border-l-4 border-emerald-500">
                    <p className="text-sm font-bold text-slate-800 mb-1">⏱️ Eficiencia Operativa</p>
                    <p className="text-sm text-slate-600">
                      {interpretation.avgTimeNoVenta < 10
                        ? `✅ Tiempo en visitas sin venta (${Math.round(interpretation.avgTimeNoVenta)} min) es eficiente. Buena gestión del tiempo.`
                        : `⚠️ Tiempo en visitas sin venta (${Math.round(interpretation.avgTimeNoVenta)} min) se puede reducir. Recomendar rápida identificación de no-prospectos.`}
                      {interpretation.totalCerrados > interpretation.totalVentas * 0.2 && 
                        ` Se detectan ${interpretation.totalCerrados} locales cerrados (alto). Revisar rutas y horarios.`}
                    </p>
                  </div>

                  {interpretation.trending === 'down' && (
                    <div className="bg-rose-50 p-4 rounded-lg border-l-4 border-rose-500">
                      <p className="text-sm font-bold text-rose-800 mb-1">🚨 Alerta de Rendimiento</p>
                      <p className="text-sm text-rose-700">
                        Se detecta una tendencia decreciente en la conversión. Recomendaciones: 
                        (1) Revisar motivación del equipo, (2) Analizar objeciones comunes en rechazos,
                        (3) Considerar ajuste de incentivos.
                      </p>
                    </div>
                  )}

                  {interpretation.trending === 'up' && (
                    <div className="bg-emerald-50 p-4 rounded-lg border-l-4 border-emerald-500">
                      <p className="text-sm font-bold text-emerald-800 mb-1">🎉 Rendimiento en Alza</p>
                      <p className="text-sm text-emerald-700">
                        ¡Excelente! La tendencia es positiva. Identificar y replicar buenas prácticas con todo el equipo.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL/PANEL DE DETALLES DEL DÍA SELECCIONADO */}
        {selectedDay && (
          <div className="bg-white p-6 rounded-xl border-2 border-blue-300 shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  📅 Detalle del {selectedDay.dayName}, {new Date(selectedDay.date).toLocaleDateString('es-BO')}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {selectedDay.transactions?.length || 0} transacciones registradas
                  {selectedTrendRep !== "Todos" && ` por ${selectedTrendRep}`}
                </p>
              </div>
              <button 
                onClick={() => setSelectedDay(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>

            {/* Resumen del Día */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                <p className="text-xs text-emerald-700 font-bold uppercase">Ventas Exitosas</p>
                <p className="text-3xl font-bold text-emerald-600">{selectedDay.venta}</p>
                <p className="text-xs text-emerald-600 mt-1">⏱️ {selectedDay.timeVenta} min promedio</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <p className="text-xs text-orange-700 font-bold uppercase">Sin Venta</p>
                <p className="text-3xl font-bold text-orange-600">{selectedDay.noVenta}</p>
                <p className="text-xs text-orange-600 mt-1">⏱️ {selectedDay.timeNoVenta} min promedio</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-700 font-bold uppercase">Cerrados</p>
                <p className="text-3xl font-bold text-slate-600">{selectedDay.cerrado}</p>
                <p className="text-xs text-slate-600 mt-1">⏱️ {selectedDay.timeCerrado} min promedio</p>
              </div>
            </div>

            {/* Lista de Transacciones del Día */}
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-bold text-slate-700">Empleado</th>
                    <th className="text-left p-2 font-bold text-slate-700">Producto</th>
                    <th className="text-left p-2 font-bold text-slate-700">Zona</th>
                    <th className="text-left p-2 font-bold text-slate-700">Resultado</th>
                    <th className="text-right p-2 font-bold text-slate-700">Monto</th>
                    <th className="text-right p-2 font-bold text-slate-700">Tiempo</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDay.transactions?.map((t: Transaction, idx: number) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-2 text-slate-700">{t.rep.split(' ')[0]}</td>
                      <td className="p-2 text-slate-600">{t.product}</td>
                      <td className="p-2 text-slate-600">{t.zone}</td>
                      <td className="p-2">
                        {t.outcome === 'venta' && <span className="text-emerald-600 font-medium">✅ Venta</span>}
                        {t.outcome === 'no_venta' && <span className="text-orange-600 font-medium">❌ Sin venta</span>}
                        {t.outcome === 'cerrado' && <span className="text-slate-400 font-medium">🔒 Cerrado</span>}
                      </td>
                      <td className="p-2 text-right font-bold text-slate-800">
                        {t.amount > 0 ? formatCurrency(t.amount) : '-'}
                      </td>
                      <td className="p-2 text-right text-slate-600">{t.duration} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TARJETAS DE ANÁLISIS DE TIEMPO (Con Sparklines) - ACTUALIZADAS CON DATOS FILTRADOS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Tiempo en Ventas */}
           <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Tiempo en Ventas</p>
                  <h3 className="text-2xl font-bold text-emerald-600">
                    {filteredDailyTrends.length > 0 
                      ? Math.round(filteredDailyTrends.reduce((acc, d) => acc + d.timeVenta, 0) / filteredDailyTrends.length) 
                      : 0} min
                  </h3>
                  <p className="text-xs text-slate-400">Promedio ideal: 20-30 min</p>
              </div>
              <div className="h-10 w-20">
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={filteredDailyTrends}>
                          <Line type="monotone" dataKey="timeVenta" stroke="#10b981" strokeWidth={2} dot={false} />
                      </LineChart>
                  </ResponsiveContainer>
              </div>
           </div>

           {/* Tiempo Perdido */}
           <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Tiempo Perdido (No Venta)</p>
                  <h3 className="text-2xl font-bold text-orange-500">
                    {filteredDailyTrends.length > 0 
                      ? Math.round(filteredDailyTrends.reduce((acc, d) => acc + d.timeNoVenta, 0) / filteredDailyTrends.length)
                      : 0} min
                  </h3>
                  <p className="text-xs text-slate-400">Objetivo: &lt; 8 min</p>
              </div>
              <div className="h-10 w-20">
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={filteredDailyTrends}>
                          <Line type="monotone" dataKey="timeNoVenta" stroke="#f97316" strokeWidth={2} dot={false} />
                      </LineChart>
                  </ResponsiveContainer>
              </div>
           </div>

           {/* Tasa de Cierre Global */}
           <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
               <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Tasa de Cierre Global</p>
                  <h3 className="text-2xl font-bold text-blue-600">
                    {(() => {
                      if (filteredDailyTrends.length === 0) return 0;
                      const totalVentas = filteredDailyTrends.reduce((acc, d) => acc + d.venta, 0);
                      const totalVisitas = filteredDailyTrends.reduce((acc, d) => acc + d.venta + d.noVenta, 0);
                      return totalVisitas > 0 ? Math.round((totalVentas / totalVisitas) * 100) : 0;
                    })()}%
                  </h3>
                  <p className="text-xs text-emerald-500 flex items-center">
                    {interpretation && interpretation.trending === 'up' ? '+5% vs semana pasada' : 
                     interpretation && interpretation.trending === 'down' ? '-3% vs semana pasada' : 'Sin cambios'}
                  </p>
              </div>
              <TrendingUp className="text-slate-200" size={40} />
           </div>
        </div>

      </div>
    </div>
  );
}