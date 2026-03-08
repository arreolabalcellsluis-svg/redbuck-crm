import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// Types matching the DB schema
export type AssetCategory = 'vehiculos' | 'maquinaria' | 'computadoras' | 'software' | 'mobiliario' | 'equipo_oficina' | 'otros';
export type AssetType = 'depreciacion' | 'amortizacion';
export type AssetStatus = 'activo' | 'dado_de_baja';

export interface Asset {
  id: string;
  nombre: string;
  categoria: AssetCategory;
  tipo: AssetType;
  descripcion: string;
  fechaCompra: string;
  costoAdquisicion: number;
  vidaUtilMeses: number;
  valorRescate: number;
  estatus: AssetStatus;
  notas?: string;
}

function mapRow(row: any): Asset {
  return {
    id: row.id,
    nombre: row.nombre,
    categoria: row.categoria as AssetCategory,
    tipo: row.tipo as AssetType,
    descripcion: row.descripcion ?? '',
    fechaCompra: row.fecha_compra,
    costoAdquisicion: Number(row.costo_adquisicion),
    vidaUtilMeses: Number(row.vida_util_meses),
    valorRescate: Number(row.valor_rescate),
    estatus: row.estatus as AssetStatus,
    notas: row.notas ?? undefined,
  };
}

export function useAssets() {
  return useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('fecha_compra', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });
}

export function useAddAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (asset: Omit<Asset, 'id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('assets').insert({
        nombre: asset.nombre,
        categoria: asset.categoria,
        tipo: asset.tipo,
        descripcion: asset.descripcion,
        fecha_compra: asset.fechaCompra,
        costo_adquisicion: asset.costoAdquisicion,
        vida_util_meses: asset.vidaUtilMeses,
        valor_rescate: asset.valorRescate,
        estatus: asset.estatus,
        notas: asset.notas ?? null,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] });
      toast({ title: 'Activo registrado' });
    },
    onError: (e: any) => toast({ title: 'Error al guardar', description: e.message, variant: 'destructive' }),
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...asset }: Asset) => {
      const { error } = await supabase.from('assets').update({
        nombre: asset.nombre,
        categoria: asset.categoria,
        tipo: asset.tipo,
        descripcion: asset.descripcion,
        fecha_compra: asset.fechaCompra,
        costo_adquisicion: asset.costoAdquisicion,
        vida_util_meses: asset.vidaUtilMeses,
        valor_rescate: asset.valorRescate,
        estatus: asset.estatus,
        notas: asset.notas ?? null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] });
      toast({ title: 'Activo actualizado' });
    },
    onError: (e: any) => toast({ title: 'Error al actualizar', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assets').update({ estatus: 'dado_de_baja' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] });
      toast({ title: 'Activo dado de baja' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

// ─── Depreciation calculations (reusable) ───────────────────────
export function calcDepreciation(asset: Asset) {
  const baseDepreciable = asset.costoAdquisicion - asset.valorRescate;
  const cargoMensual = asset.vidaUtilMeses > 0 ? baseDepreciable / asset.vidaUtilMeses : 0;
  const hoy = new Date();
  const compra = new Date(asset.fechaCompra);
  const mesesTranscurridos = Math.max(0, (hoy.getFullYear() - compra.getFullYear()) * 12 + (hoy.getMonth() - compra.getMonth()));
  const depAcumuladaRaw = cargoMensual * mesesTranscurridos;
  const depAcumulada = Math.min(depAcumuladaRaw, baseDepreciable);
  const valorLibros = asset.costoAdquisicion - depAcumulada;
  return { baseDepreciable, cargoMensual, mesesTranscurridos, depAcumulada, valorLibros };
}

export function getTotalMonthlyDepAmort(assets: Asset[]): number {
  return assets
    .filter(a => a.estatus === 'activo')
    .reduce((sum, a) => {
      const { cargoMensual, depAcumulada, baseDepreciable } = calcDepreciation(a);
      return sum + (depAcumulada < baseDepreciable ? cargoMensual : 0);
    }, 0);
}
