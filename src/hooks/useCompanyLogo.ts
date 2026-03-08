import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const LOGO_PATH = 'company-logo.png';
const BUCKET = 'company-assets';

function getPublicUrl(): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(LOGO_PATH);
  return data.publicUrl;
}

export function useCompanyLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const checkLogo = useCallback(async () => {
    try {
      const { data } = await supabase.storage.from(BUCKET).list('', { search: LOGO_PATH });
      if (data && data.length > 0) {
        setLogoUrl(getPublicUrl() + '?t=' + Date.now());
      }
    } catch {
      // no logo yet
    }
  }, []);

  useEffect(() => { checkLogo(); }, [checkLogo]);

  const uploadLogo = useCallback(async (file: File) => {
    setUploading(true);
    try {
      // Delete existing first
      await supabase.storage.from(BUCKET).remove([LOGO_PATH]);
      const { error } = await supabase.storage.from(BUCKET).upload(LOGO_PATH, file, {
        cacheControl: '3600',
        upsert: true,
      });
      if (error) throw error;
      const url = getPublicUrl() + '?t=' + Date.now();
      setLogoUrl(url);
      toast.success('Logo actualizado correctamente');
    } catch (e: any) {
      toast.error('Error al subir logo: ' + e.message);
    } finally {
      setUploading(false);
    }
  }, []);

  const removeLogo = useCallback(async () => {
    await supabase.storage.from(BUCKET).remove([LOGO_PATH]);
    setLogoUrl(null);
    toast.success('Logo eliminado');
  }, []);

  return { logoUrl, uploading, uploadLogo, removeLogo };
}

/** Standalone getter for use outside React (exports, etc.) */
export function getCompanyLogoUrl(): string {
  return getPublicUrl();
}
