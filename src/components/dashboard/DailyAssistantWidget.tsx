import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateDailyRecommendations, getAssistantSummary } from '@/lib/dailyAssistantEngine';
import { Brain, Zap, Target, TrendingUp, ArrowRight } from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

export default function DailyAssistantWidget() {
  const navigate = useNavigate();
  const recs = useMemo(() => generateDailyRecommendations(), []);
  const summary = useMemo(() => getAssistantSummary(recs), [recs]);
  const topRecs = recs.filter(r => !r.worked && !r.closed).slice(0, 3);

  return (
    <div
      className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all group"
      onClick={() => navigate('/crm/asistente')}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold flex items-center gap-2 group-hover:text-primary transition-colors">
          <Brain size={18} className="text-primary" /> Asistente Comercial
        </h3>
        <ArrowRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
      </div>

      {/* Counters */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <div className="text-lg font-bold">{summary.total}</div>
          <div className="text-[10px] text-muted-foreground">Total</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-destructive/5">
          <div className="text-lg font-bold text-destructive">{summary.alta}</div>
          <div className="text-[10px] text-muted-foreground">Alta</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-warning/5">
          <div className="text-lg font-bold text-warning">{summary.media}</div>
          <div className="text-[10px] text-muted-foreground">Media</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-muted/30">
          <div className="text-lg font-bold text-muted-foreground">{summary.baja}</div>
          <div className="text-[10px] text-muted-foreground">Baja</div>
        </div>
      </div>

      {/* Value */}
      <div className="text-sm mb-3">
        <span className="text-muted-foreground">Valor potencial:</span>{' '}
        <span className="font-bold text-primary">{fmt(summary.totalValue)}</span>
      </div>

      {/* Top 3 */}
      <div className="space-y-2">
        {topRecs.map(rec => (
          <div key={rec.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/30">
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              rec.priority === 'alta' ? 'bg-destructive' : rec.priority === 'media' ? 'bg-warning' : 'bg-muted-foreground'
            }`} />
            <span className="font-medium truncate flex-1">{rec.customerName}</span>
            <span className="text-muted-foreground truncate">{rec.suggestedProduct}</span>
          </div>
        ))}
      </div>

      <div className="text-[10px] text-muted-foreground mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        Click para ver todas las oportunidades →
      </div>
    </div>
  );
}
