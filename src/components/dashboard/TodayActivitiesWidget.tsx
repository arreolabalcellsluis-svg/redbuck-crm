import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActivities } from '@/hooks/useActivities';
import {
  ACTIVITY_TYPE_ICONS, ACTIVITY_STATUS_COLORS,
  type Activity, type ActivityStatus,
} from '@/lib/agendaEngine';
import { CalendarDays, ArrowRight } from 'lucide-react';

export default function TodayActivitiesWidget() {
  const navigate = useNavigate();
  const { data: dbActivities = [] } = useActivities();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const summary = useMemo(() => {
    const todayActivities = dbActivities.filter(a => a.date === today);
    const pending = todayActivities.filter(a => a.status === 'pendiente' || a.status === 'en_proceso').length;
    const overdue = dbActivities.filter(a => a.date < today && (a.status === 'pendiente' || a.status === 'en_proceso')).length;
    const done = todayActivities.filter(a => a.status === 'realizada').length;
    const upcoming = dbActivities
      .filter(a => a.date > today && (a.status === 'pendiente' || a.status === 'en_proceso'))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);

    return { todayActivities, pending, overdue, done, upcoming };
  }, [dbActivities, today]);

  return (
    <div className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/crm/agenda')}>
      <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
        <CalendarDays size={18} className="text-primary" /> Actividades de hoy
        <ArrowRight size={14} className="ml-auto text-muted-foreground" />
      </h3>

      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="text-center p-2 bg-warning/10 rounded-lg">
          <div className="text-lg font-bold text-warning">{summary.pending}</div>
          <div className="text-[10px] text-muted-foreground">Pendientes</div>
        </div>
        <div className="text-center p-2 bg-destructive/10 rounded-lg">
          <div className="text-lg font-bold text-destructive">{summary.overdue}</div>
          <div className="text-[10px] text-muted-foreground">Vencidas</div>
        </div>
        <div className="text-center p-2 bg-success/10 rounded-lg">
          <div className="text-lg font-bold text-success">{summary.done}</div>
          <div className="text-[10px] text-muted-foreground">Realizadas</div>
        </div>
        <div className="text-center p-2 bg-info/10 rounded-lg">
          <div className="text-lg font-bold text-info">{summary.upcoming.length}</div>
          <div className="text-[10px] text-muted-foreground">Próximas</div>
        </div>
      </div>

      <div className="space-y-1.5">
        {summary.todayActivities
          .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
          .slice(0, 5)
          .map(act => (
            <div key={act.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs ${
              act.status === 'realizada' ? 'opacity-50' : ''
            } ${ACTIVITY_STATUS_COLORS[act.status as ActivityStatus] || ''}`}>
              <span>{ACTIVITY_TYPE_ICONS[act.type as keyof typeof ACTIVITY_TYPE_ICONS] || '📌'}</span>
              <span className={`flex-1 truncate font-medium ${act.status === 'realizada' ? 'line-through' : ''}`}>{act.title}</span>
              {act.time && <span className="text-muted-foreground">{act.time}</span>}
            </div>
          ))}
        {summary.todayActivities.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-3">Sin actividades hoy</div>
        )}
      </div>

      {summary.upcoming.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <div className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Próximas</div>
          {summary.upcoming.slice(0, 3).map(act => (
            <div key={act.id} className="flex items-center gap-2 text-xs py-1">
              <span className="text-muted-foreground w-12">{act.date.slice(5)}</span>
              <span>{ACTIVITY_TYPE_ICONS[act.type as keyof typeof ACTIVITY_TYPE_ICONS] || '📌'}</span>
              <span className="truncate">{act.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
