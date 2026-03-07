import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: { value: number; positive: boolean };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  href?: string;
  onClick?: () => void;
}

const variantStyles = {
  default: 'border-border',
  primary: 'border-l-4 border-l-primary',
  success: 'border-l-4 border-l-success',
  warning: 'border-l-4 border-l-warning',
  danger: 'border-l-4 border-l-destructive',
  info: 'border-l-4 border-l-info',
};

export default function MetricCard({ title, value, subtitle, icon: Icon, trend, variant = 'default', href, onClick }: MetricCardProps) {
  const navigate = useNavigate();
  const isClickable = !!(href || onClick);

  const handleClick = () => {
    if (onClick) onClick();
    else if (href) navigate(href);
  };

  const card = (
    <div
      className={`metric-card ${variantStyles[variant]} ${isClickable ? 'cursor-pointer hover:shadow-lg hover:border-primary/30 hover:scale-[1.02] transition-all duration-200 group' : ''}`}
      onClick={isClickable ? handleClick : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className={`text-2xl font-bold font-display mt-1 ${isClickable ? 'group-hover:text-primary transition-colors' : ''}`}>{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          {trend && (
            <p className={`text-xs font-medium mt-1 ${trend.positive ? 'text-success' : 'text-destructive'}`}>
              {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 ${isClickable ? 'group-hover:bg-primary/10 transition-colors' : ''}`}>
            <Icon size={20} className={`text-muted-foreground ${isClickable ? 'group-hover:text-primary transition-colors' : ''}`} />
          </div>
        )}
      </div>
      {isClickable && (
        <div className="text-[10px] text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          Click para ver detalle →
        </div>
      )}
    </div>
  );

  if (isClickable) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent><p>Ver detalle</p></TooltipContent>
      </Tooltip>
    );
  }

  return card;
}
