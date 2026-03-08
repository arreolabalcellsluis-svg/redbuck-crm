/**
 * SalesComparative – Compares sales between two user-selected date ranges.
 * Reuses monthlySales from demo-data. Modular component for ExecutiveDashboard.
 */
import { useState, useMemo } from 'react';
import { format, parse, isWithinInterval, startOfMonth, endOfMonth, differenceInMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, ArrowUpRight, ArrowDownRight, TrendingUp, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { monthlySales, salesByVendor, salesByCategory } from '@/data/demo-data';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

// Map month labels to Date objects for filtering
const MONTH_MAP: Record<string, string> = {
  'Ene': '01', 'Feb': '02', 'Mar': '03', 'Abr': '04',
  'May': '05', 'Jun': '06', 'Jul': '07', 'Ago': '08',
  'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dic': '12',
};

interface MonthEntry { month: string; sales: number; date: Date }

function parseMonthlyData(): MonthEntry[] {
  return monthlySales.map(m => {
    const parts = m.month.split(' ');
    const monthNum = MONTH_MAP[parts[0]] || '01';
    const year = parts[1] ? `20${parts[1]}` : '2025';
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return { ...m, date };
  });
}

function filterByRange(data: MonthEntry[], start: Date, end: Date): MonthEntry[] {
  return data.filter(d => d.date >= startOfMonth(start) && d.date <= endOfMonth(end));
}

function DatePicker({ date, onChange, label }: { date: Date; onChange: (d: Date) => void; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-[140px] justify-start text-left text-xs h-8", !date && "text-muted-foreground")}>
            <CalendarIcon className="mr-1 h-3 w-3" />
            {format(date, 'dd/MM/yyyy')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={d => d && onChange(d)}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

type FilterType = 'all' | 'vendor' | 'category';

export default function SalesComparative() {
  // Default: Period A = current year, Period B = previous year
  const [startA, setStartA] = useState(new Date(2025, 0, 1));
  const [endA, setEndA] = useState(new Date(2025, 11, 31));
  const [startB, setStartB] = useState(new Date(2024, 0, 1));
  const [endB, setEndB] = useState(new Date(2024, 11, 31));
  const [filterType, setFilterType] = useState<FilterType>('all');

  const allData = useMemo(() => parseMonthlyData(), []);

  const dataA = useMemo(() => filterByRange(allData, startA, endA), [allData, startA, endA]);
  const dataB = useMemo(() => filterByRange(allData, startB, endB), [allData, startB, endB]);

  const totalA = useMemo(() => dataA.reduce((s, d) => s + d.sales, 0), [dataA]);
  const totalB = useMemo(() => dataB.reduce((s, d) => s + d.sales, 0), [dataB]);
  const diff = totalA - totalB;
  const variation = totalB > 0 ? ((totalA - totalB) / totalB) * 100 : 0;

  // Build comparative chart data: align by index (month 1 vs month 1)
  const chartData = useMemo(() => {
    const maxLen = Math.max(dataA.length, dataB.length);
    const result = [];
    for (let i = 0; i < maxLen; i++) {
      result.push({
        label: dataA[i]?.month || dataB[i]?.month || `Mes ${i + 1}`,
        periodoA: dataA[i]?.sales || 0,
        periodoB: dataB[i]?.sales || 0,
      });
    }
    return result;
  }, [dataA, dataB]);

  const periodLabelA = `${format(startA, 'MMM yyyy', { locale: es })} – ${format(endA, 'MMM yyyy', { locale: es })}`;
  const periodLabelB = `${format(startB, 'MMM yyyy', { locale: es })} – ${format(endB, 'MMM yyyy', { locale: es })}`;

  return (
    <div className="bg-card rounded-xl border p-5 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <TrendingUp size={18} className="text-primary" />
          Comparativo de Ventas por Periodo
        </h3>
      </div>

      {/* Date selectors */}
      <div className="flex flex-wrap items-end gap-6">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-primary">Periodo A</span>
          <div className="flex gap-2">
            <DatePicker date={startA} onChange={setStartA} label="Desde" />
            <DatePicker date={endA} onChange={setEndA} label="Hasta" />
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-xs font-semibold text-muted-foreground">Periodo B</span>
          <div className="flex gap-2">
            <DatePicker date={startB} onChange={setStartB} label="Desde" />
            <DatePicker date={endB} onChange={setEndB} label="Hasta" />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-primary/5 rounded-lg p-4 text-center">
          <div className="text-[10px] text-muted-foreground mb-1">Periodo A</div>
          <div className="text-lg font-bold text-primary">{fmt(totalA)}</div>
          <div className="text-[10px] text-muted-foreground">{periodLabelA}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <div className="text-[10px] text-muted-foreground mb-1">Periodo B</div>
          <div className="text-lg font-bold">{fmt(totalB)}</div>
          <div className="text-[10px] text-muted-foreground">{periodLabelB}</div>
        </div>
        <div className={`rounded-lg p-4 text-center ${diff >= 0 ? 'bg-success/5' : 'bg-destructive/5'}`}>
          <div className="text-[10px] text-muted-foreground mb-1">Diferencia</div>
          <div className={`text-lg font-bold flex items-center justify-center gap-1 ${diff >= 0 ? 'text-success' : 'text-destructive'}`}>
            {diff >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            {fmt(Math.abs(diff))}
          </div>
          <div className="text-[10px] text-muted-foreground">{diff >= 0 ? 'Incremento' : 'Disminución'}</div>
        </div>
        <div className={`rounded-lg p-4 text-center ${variation >= 0 ? 'bg-success/5' : 'bg-destructive/5'}`}>
          <div className="text-[10px] text-muted-foreground mb-1">Variación %</div>
          <div className={`text-lg font-bold ${variation >= 0 ? 'text-success' : 'text-destructive'}`}>
            {variation >= 0 ? '+' : ''}{fmtPct(variation)}
          </div>
          <div className="text-[10px] text-muted-foreground">{variation >= 0 ? 'Crecimiento' : 'Disminución'}</div>
        </div>
      </div>

      {/* Comparative chart */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3">Comparativo mensual</h4>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Bar dataKey="periodoA" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={`Periodo A`} />
              <Bar dataKey="periodoB" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name={`Periodo B`} opacity={0.5} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            No hay datos para los periodos seleccionados
          </div>
        )}
      </div>

      {/* Detail table */}
      {chartData.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-2 px-3">Mes</th>
                <th className="text-right py-2 px-3">Periodo A</th>
                <th className="text-right py-2 px-3">Periodo B</th>
                <th className="text-right py-2 px-3">Diferencia</th>
                <th className="text-right py-2 px-3">Variación</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row, i) => {
                const d = row.periodoA - row.periodoB;
                const v = row.periodoB > 0 ? ((row.periodoA - row.periodoB) / row.periodoB) * 100 : 0;
                return (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="py-2 px-3 font-medium">{row.label}</td>
                    <td className="py-2 px-3 text-right font-bold text-primary">{fmt(row.periodoA)}</td>
                    <td className="py-2 px-3 text-right">{fmt(row.periodoB)}</td>
                    <td className={`py-2 px-3 text-right font-medium ${d >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {d >= 0 ? '+' : ''}{fmt(d)}
                    </td>
                    <td className={`py-2 px-3 text-right font-medium ${v >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {v >= 0 ? '+' : ''}{fmtPct(v)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-bold">
                <td className="py-2 px-3">TOTAL</td>
                <td className="py-2 px-3 text-right text-primary">{fmt(totalA)}</td>
                <td className="py-2 px-3 text-right">{fmt(totalB)}</td>
                <td className={`py-2 px-3 text-right ${diff >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {diff >= 0 ? '+' : ''}{fmt(diff)}
                </td>
                <td className={`py-2 px-3 text-right ${variation >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {variation >= 0 ? '+' : ''}{fmtPct(variation)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
