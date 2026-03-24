import { useAppSettings, useSaveSetting } from '@/hooks/useAppSettings';
import { DEFAULT_ONBOARDING_CONFIG, type OnboardingConfig } from '@/lib/onboardingEngine';
import { useMemo, useCallback } from 'react';

const SETTING_KEY = 'onboarding_config';

export function useOnboardingConfig() {
  const { data: settings = [] } = useAppSettings();
  const saveSetting = useSaveSetting();

  const config: OnboardingConfig = useMemo(() => {
    if (!settings || typeof settings !== 'object') return DEFAULT_ONBOARDING_CONFIG;
    const val = settings[SETTING_KEY];
    if (!val) return DEFAULT_ONBOARDING_CONFIG;
    try {
      const parsed = typeof val === 'string' ? JSON.parse(val) : val;
      return { ...DEFAULT_ONBOARDING_CONFIG, ...parsed };
    } catch {
      return DEFAULT_ONBOARDING_CONFIG;
    }
  }, [settings]);

  const saveConfig = useCallback((newConfig: OnboardingConfig) => {
    saveSetting.mutate({ key: SETTING_KEY, value: newConfig as any });
  }, [saveSetting]);

  return { config, saveConfig, isSaving: saveSetting.isPending };
}
