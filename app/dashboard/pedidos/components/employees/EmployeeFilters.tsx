import { Users, ChevronDown, Filter } from 'lucide-react'
import type { Employee, DateRange } from '../../types/employee-reports'

interface EmployeeFiltersProps {
  employees: Employee[]
  selectedEmployee: string
  setSelectedEmployee: (id: string) => void
  dateRange: DateRange
  setDateRange: (range: DateRange) => void
}

export default function EmployeeFilters({
  employees,
  selectedEmployee,
  setSelectedEmployee,
  dateRange,
  setDateRange
}: EmployeeFiltersProps) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-end">
      <div className="flex-1 w-full">
        <label className="text-xs font-semibold text-gray-500 mb-1 block uppercase">Empleado</label>
        <div className="relative">
          <select 
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg appearance-none focus:ring-2 focus:ring-green-500 outline-none font-medium text-gray-900"
          >
            <option value="ALL">📊 Todos los Empleados</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
          <Users className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      <div className="w-full md:w-48">
        <label className="text-xs font-semibold text-gray-500 mb-1 block uppercase">Desde</label>
        <input 
          type="date" 
          value={dateRange.start} 
          onChange={e => setDateRange({...dateRange, start: e.target.value})} 
          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-gray-900" 
        />
      </div>
      
      <div className="w-full md:w-48">
        <label className="text-xs font-semibold text-gray-500 mb-1 block uppercase">Hasta</label>
        <input 
          type="date" 
          value={dateRange.end} 
          onChange={e => setDateRange({...dateRange, end: e.target.value})} 
          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-gray-900" 
        />
      </div>

      <button className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 shadow-md shadow-green-900/10 transition-all flex items-center gap-2">
        <Filter className="w-4 h-4" /> Aplicar
      </button>
    </div>
  )
}
