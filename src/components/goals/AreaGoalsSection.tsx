import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Save, Settings2, BarChart3, Target, Trophy } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type AreaGoalConfig, type AreaScoreResult, type AreaKPIDefinition, type AreaCalcContext,
  calcAreaScore, formatKPIValue, getDefaultKPIs,
} from '@/lib/areaGoalsEngine';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

interface AreaGoalsSectionProps {
  area: 'gerente_comercial' | 'cobranza' | 'administracion';
  areaLabel: string;
  config: AreaGoalConfig | undefined;
  ctx: AreaCalcContext;
  month: number;
  year: number;
  onSave: (config: AreaGoalConfig) => void;
  isSaving?: boolean;
}

const statusColor = (s: 'red' | 'yellow' | 'green') =>
  s === 'green' ? 'bg-green-100 text-green-800 border-green-300'
  : s === 'yellow' ? 'bg-amber-100 text-amber-800 border-amber-300'
  : 'bg-red-100 text-red-800 border-red-300';

const statusBorder = (s: 'red' | 'yellow' | 'green') =>
  s === 'green' ? 'border-l-green-500'
  : s === 'yellow' ? 'border-l-amber-500'
  : 'border-l-destructive';

const statusLabel = (s: 'red' | 'yellow' | 'green') =>
  s === 'green' ? 'En meta' : s === 'yellow' ? 'Cerca' : 'Bajo';

export default function AreaGoalsSection({ area, areaLabel, config, ctx, month, year, onSave, isSaving }: AreaGoalsSectionProps) {
  const defaults = getDefaultKPIs(area);

  const [localConfig, setLocalConfig] = useState<AreaGoalConfig>(() => ({
    id: config?.id,
    area,
    month,
    year,
    userName: config?.userName ?? '',
    kpiConfig: config?.kpiConfig?.length ? config.kpiConfig : defaults,
    bonusBase: config?.bonusBase ?? 0,
    bonusOverperformanceRate: config?.bonusOverperformanceRate ?? 2,
    manualKpiValues: config?.manualKpiValues ?? {},
  }));

  // Recalculate when config prop changes
  const effectiveConfig = useMemo(() => ({
    ...localConfig,
    id: config?.id ?? localConfig.id,
    month,
    year,
  }), [localConfig, config?.id, month, year]);

  const result: AreaScoreResult = useMemo(
    () => calcAreaScore(effectiveConfig, ctx),
    [effectiveConfig, ctx]
  );

  const updateKPI = (idx: number, field: keyof AreaKPIDefinition, value: any) => {
    setLocalConfig(prev => ({
      ...prev,
      kpiConfig: prev.kpiConfig.map((k, i) => i === idx ? { ...k, [field]: value } : k),
    }));
  };

  const updateManualValue = (key: string, value: number) => {
    setLocalConfig(prev => ({
      ...prev,
      manualKpiValues: { ...prev.manualKpiValues, [key]: value },
    }));
  };

  const handleSave = () => {
    onSave(effectiveConfig);
  };

  const totalWeight = localConfig.kpiConfig.filter(k => k.enabled).reduce((s, k) => s + k.weight, 0);

  return (
    <div className="space-y-4">
      {/* Score Banner */}
      <Card className={`border-l-4 ${statusBorder(result.status)}`}>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="text-lg font-bold">{areaLabel}</h3>
                <p className="text-sm text-muted-foreground">{effectiveConfig.userName || 'Sin asignar'}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{result.scoreTotal}<span className="text-lg text-muted-foreground">/100</span></div>
                <div className="text-xs text-muted-foreground">Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{result.overallProgress}%</div>
                <div className="text-xs text-muted-foreground">Cumplimiento</div>
              </div>
              <Badge className={`${statusColor(result.status)} text-sm px-3 py-1`}>{statusLabel(result.status)}</Badge>
              <div className="text-center">
                <div className="text-xl font-bold text-primary">{fmt(result.bonusTotal)}</div>
                <div className="text-xs text-muted-foreground">Bono</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="dashboard">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="dashboard"><BarChart3 size={14} className="mr-1" />Dashboard</TabsTrigger>
          <TabsTrigger value="goals"><Target size={14} className="mr-1" />Metas</TabsTrigger>
          <TabsTrigger value="config"><Settings2 size={14} className="mr-1" />Configuración</TabsTrigger>
        </TabsList>

        {/* ═══ DASHBOARD ═══ */}
        <TabsContent value="dashboard" className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {result.kpis.map(kpi => (
              <Card key={kpi.key} className={`border-l-4 ${statusBorder(kpi.status)}`}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="text-sm font-medium">{kpi.label}</div>
                    <Badge variant="outline" className={`${statusColor(kpi.status)} text-[10px]`}>{kpi.progress}%</Badge>
                  </div>
                  <div className="text-2xl font-bold">{formatKPIValue(kpi.actual, kpi.unit)}</div>
                  <div className="text-xs text-muted-foreground">Meta: {formatKPIValue(kpi.goal, kpi.unit)}</div>
                  <Progress value={Math.min(kpi.progress, 100)} className="h-2" />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Peso: {kpi.weight}%</span>
                    <span>Contribución al score: {Math.round(kpi.progress * kpi.weight / 100)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Bonus Summary */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy size={18} /> Resumen de bonos</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Bono base</span>
                <span className="text-sm font-medium">{fmt(result.bonusBase)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Bono sobrecumplimiento</span>
                <span className="text-sm font-medium">{fmt(result.bonusOverperformance)}</span>
              </div>
              <div className="flex justify-between py-2 border-t-2 border-primary/30">
                <span className="font-bold">BONO TOTAL</span>
                <span className="text-xl font-bold text-primary">{fmt(result.bonusTotal)}</span>
              </div>
              {result.overallProgress < 80 && (
                <p className="text-xs text-destructive mt-1">⚠ Cumplimiento menor a 80%. No se genera bono.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ GOALS (Metas) ═══ */}
        <TabsContent value="goals" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Metas y valores manuales</CardTitle>
                <Button size="sm" onClick={handleSave} disabled={isSaving}><Save size={14} className="mr-1" />Guardar</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* User name */}
              <div className="max-w-sm">
                <label className="text-sm font-medium">Nombre del responsable</label>
                <Input
                  value={localConfig.userName}
                  onChange={e => setLocalConfig(prev => ({ ...prev, userName: e.target.value }))}
                  className="h-8 mt-1"
                  placeholder="Nombre del responsable"
                />
              </div>

              {/* KPI Goals */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left py-2 px-2">KPI</th>
                      <th className="text-right px-2">Meta</th>
                      <th className="text-right px-2">Actual</th>
                      <th className="text-right px-2">%</th>
                      <th className="text-center px-2">Estado</th>
                      {localConfig.kpiConfig.some(k => !k.autoCalc && k.enabled) && (
                        <th className="text-right px-2">Valor manual</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {localConfig.kpiConfig.filter(k => k.enabled).map((kpi, idx) => {
                      const kpiResult = result.kpis.find(r => r.key === kpi.key);
                      const realIdx = localConfig.kpiConfig.findIndex(k => k.key === kpi.key);
                      return (
                        <tr key={kpi.key} className="border-b hover:bg-muted/30">
                          <td className="py-2 px-2 font-medium">{kpi.label}</td>
                          <td className="py-2 px-2 text-right">
                            <Input
                              type="number"
                              value={kpi.goal}
                              onChange={e => updateKPI(realIdx, 'goal', Number(e.target.value))}
                              className="h-7 w-24 text-right text-sm inline-block"
                            />
                          </td>
                          <td className="py-2 px-2 text-right font-mono">
                            {kpiResult ? formatKPIValue(kpiResult.actual, kpiResult.unit) : '-'}
                          </td>
                          <td className="py-2 px-2 text-right font-bold">
                            {kpiResult ? `${kpiResult.progress}%` : '-'}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {kpiResult && <Badge className={`${statusColor(kpiResult.status)} text-[10px]`}>{statusLabel(kpiResult.status)}</Badge>}
                          </td>
                          {localConfig.kpiConfig.some(k => !k.autoCalc && k.enabled) && (
                            <td className="py-2 px-2 text-right">
                              {!kpi.autoCalc ? (
                                <Input
                                  type="number"
                                  value={localConfig.manualKpiValues[kpi.key] ?? 0}
                                  onChange={e => updateManualValue(kpi.key, Number(e.target.value))}
                                  className="h-7 w-24 text-right text-sm inline-block"
                                />
                              ) : (
                                <span className="text-[10px] text-muted-foreground">Auto</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ CONFIG ═══ */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Configuración de KPIs y bonos</CardTitle>
                <Button size="sm" onClick={handleSave} disabled={isSaving}><Save size={14} className="mr-1" />Guardar</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Bonus config */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Bono base ($)</label>
                  <Input
                    type="number"
                    value={localConfig.bonusBase}
                    onChange={e => setLocalConfig(prev => ({ ...prev, bonusBase: Number(e.target.value) }))}
                    className="h-8 mt-1"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Se paga si cumplimiento ≥ 80%</p>
                </div>
                <div>
                  <label className="text-sm font-medium">% bono por sobrecumplimiento</label>
                  <Input
                    type="number"
                    value={localConfig.bonusOverperformanceRate}
                    onChange={e => setLocalConfig(prev => ({ ...prev, bonusOverperformanceRate: Number(e.target.value) }))}
                    className="h-8 mt-1"
                    step="0.5"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">% adicional del bono base por cada % sobre 100%</p>
                </div>
              </div>

              {/* KPI weights and activation */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">KPIs y pesos</label>
                  <span className={`text-xs ${totalWeight === 100 ? 'text-green-600' : 'text-destructive'} font-medium`}>
                    Total pesos: {totalWeight}% {totalWeight !== 100 && '(debe ser 100%)'}
                  </span>
                </div>
                <div className="space-y-2">
                  {localConfig.kpiConfig.map((kpi, idx) => (
                    <div key={kpi.key} className="flex items-center gap-3 py-1 border-b border-border/30">
                      <Switch
                        checked={kpi.enabled}
                        onCheckedChange={v => updateKPI(idx, 'enabled', v)}
                      />
                      <span className={`text-sm flex-1 ${!kpi.enabled ? 'text-muted-foreground line-through' : ''}`}>{kpi.label}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Peso:</span>
                        <Input
                          type="number"
                          value={kpi.weight}
                          onChange={e => updateKPI(idx, 'weight', Number(e.target.value))}
                          className="h-7 w-16 text-sm"
                          disabled={!kpi.enabled}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{kpi.autoCalc ? 'Auto' : 'Manual'}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
