import { useAppSettings, useSaveSetting } from '@/hooks/useAppSettings';
import { DEFAULT_ONBOARDING_CONFIG, type OnboardingConfig } from '@/lib/onboardingEngine';
import { useMemo, useCallback } from 'react';

const SETTING_KEY = 'onboarding_config';

export function useOnboardingConfig() {
  const { data: settings = [] } = useAppSettings();
  const saveSetting = useSaveSetting();

  const config: OnboardingConfig = useMemo(() => {
    const row = settings.find((s: any) => s.setting_key === SETTING_KEY);
    if (!row) return DEFAULT_ONBOARDING_CONFIG;
    try {
      const val = typeof row.setting_value === 'string' ? JSON.parse(row.setting_value) : row.setting_value;
      return { ...DEFAULT_ONBOARDING_CONFIG, ...val };
    } catch {
      return DEFAULT_ONBOARDING_CONFIG;
    }
  }, [settings]);

  const saveConfig = useCallback((newConfig: OnboardingConfig) => {
    saveSetting.mutate({ key: SETTING_KEY, value: newConfig as any });
  }, [saveSetting]);

  return { config, saveConfig, isSaving: saveSetting.isPending };
}
