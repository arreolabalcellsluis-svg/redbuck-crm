import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Download, FileSpreadsheet, X, Filter } from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, startOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export interface DatePreset {
  label: string;
  from: Date;
  to: Date;
}

const DATE_PRESETS: DatePreset[] = [
  { label: 'Hoy', from: new Date(), to: new Date() },
  { label: 'Últimos 30 días', from: subDays(new Date(), 30), to: new Date() },
  { label: 'Últimos 90 días', from: subDays(new Date(), 90), to: new Date() },
  { label: 'Últimos 6 meses', from: subMonths(new Date(), 6), to: new Date() },
  { label: 'Mes actual', from: startOfMonth(new Date()), to: new Date() },
  { label: 'Año actual', from: startOfYear(new Date()), to: new Date() },
];

export interface FilterConfig {
  search?: boolean;
  searchPlaceholder?: string;
  dateRange?: boolean;
  selects?: { key: string; label: string; options: { value: string; label: string }[] }[];
  exportExcel?: boolean;
  exportPdf?: boolean;
}

interface ReportFilterBarProps {
  config: FilterConfig;
  filters: Record<string, any>;
  onFilterChange: (key: string, value: any) => void;
  onClear: () => void;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  hasActiveFilters?: boolean;
}

export function exportToExcel(data: Record<string, any>[], filename: string) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = Object.keys(data[0] || {}).map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename}.xlsx`);
}

export default function ReportFilterBar({
  config, filters, onFilterChange, onClear, onExportExcel, onExportPdf, hasActiveFilters
}: ReportFilterBarProps) {
  return (
    <div className="bg-card rounded-xl border p-4 mb-6 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={16} className="text-muted-foreground" />
        <span className="text-sm font-semibold text-muted-foreground">Filtros</span>

        {config.dateRange && (
          <>
            <div className="flex gap-1">
              {DATE_PRESETS.map(p => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => {
                    onFilterChange('dateFrom', p.from);
                    onFilterChange('dateTo', p.to);
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </>
        )}

        <div className="ml-auto flex gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClear} className="text-xs h-7">
              <X size={14} className="mr-1" /> Limpiar
            </Button>
          )}
          {config.exportExcel && onExportExcel && (
            <Button variant="outline" size="sm" onClick={onExportExcel} className="text-xs h-7">
              <FileSpreadsheet size={14} className="mr-1" /> Excel
            </Button>
          )}
          {config.exportPdf && onExportPdf && (
            <Button variant="outline" size="sm" onClick={onExportPdf} className="text-xs h-7">
              <Download size={14} className="mr-1" /> PDF
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {config.dateRange && (
          <>
            <DatePicker
              label="Desde"
              value={filters.dateFrom}
              onChange={(d) => onFilterChange('dateFrom', d)}
            />
            <DatePicker
              label="Hasta"
              value={filters.dateTo}
              onChange={(d) => onFilterChange('dateTo', d)}
            />
          </>
        )}

        {config.search && (
          <Input
            placeholder={config.searchPlaceholder || 'Buscar...'}
            value={filters.search || ''}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="w-48 h-8 text-xs"
          />
        )}

        {config.selects?.map(s => (
          <Select key={s.key} value={filters[s.key] || ''} onValueChange={(v) => onFilterChange(s.key, v === '_all' ? '' : v)}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder={s.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos</SelectItem>
              {s.options.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>
    </div>
  );
}

function DatePicker({ label, value, onChange }: { label: string; value?: Date; onChange: (d: Date | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('h-8 text-xs gap-1', !value && 'text-muted-foreground')}>
          <CalendarIcon size={12} />
          {value ? format(value, 'dd/MM/yyyy') : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          locale={es}
          className={cn('p-3 pointer-events-auto')}
        />
      </PopoverContent>
    </Popover>
  );
}
