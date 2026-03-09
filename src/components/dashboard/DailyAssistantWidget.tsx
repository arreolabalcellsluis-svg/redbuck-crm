import { useNavigate } from 'react-router-dom';
import { Brain, ArrowRight } from 'lucide-react';

export default function DailyAssistantWidget() {
  const navigate = useNavigate();

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

      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Brain size={32} className="text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          El asistente generará recomendaciones a medida que registres cotizaciones, pedidos y actividades.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Click para ver el módulo completo →
        </p>
      </div>
    </div>
  );
}
