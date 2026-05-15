import { DURATION_MAX_MS, DURATION_MIN_MS, MODULE_ID, SETTINGS } from '../constants';
import { getSetting, setSetting } from './settings';

type FormApplicationOptions = {
  id?: string;
  title?: string;
  template?: string;
  width?: number;
  height?: number | 'auto';
  closeOnSubmit?: boolean;
  submitOnChange?: boolean;
};

declare const FormApplication: {
  new (
    object?: unknown,
    options?: FormApplicationOptions,
  ): {
    render(force?: boolean): unknown;
  };
  defaultOptions: FormApplicationOptions;
};

interface GMConfigData {
  gmAvatar: string;
  pcCriticalSfx: string;
  gmCriticalSfx: string;
  cinematicDuration: number;
}

export class GMConfigMenu extends FormApplication {
  static get defaultOptions(): FormApplicationOptions {
    return {
      ...FormApplication.defaultOptions,
      id: `${MODULE_ID}-gm-config`,
      title: 'GLUniverse Critical — GM Configuration',
      template: `modules/${MODULE_ID}/templates/gm-config.html`,
      width: 520,
      height: 'auto',
      closeOnSubmit: true,
      submitOnChange: false,
    };
  }

  getData(): {
    data: GMConfigData;
    durationMin: number;
    durationMax: number;
  } {
    return {
      data: {
        gmAvatar: getSetting<string>(SETTINGS.GM_AVATAR),
        pcCriticalSfx: getSetting<string>(SETTINGS.PC_CRITICAL_SFX),
        gmCriticalSfx: getSetting<string>(SETTINGS.GM_CRITICAL_SFX),
        cinematicDuration: getSetting<number>(SETTINGS.CINEMATIC_DURATION),
      },
      durationMin: DURATION_MIN_MS,
      durationMax: DURATION_MAX_MS,
    };
  }

  async _updateObject(_event: Event, formData: Record<string, unknown>): Promise<void> {
    await Promise.all([
      setSetting(SETTINGS.GM_AVATAR, String(formData.gmAvatar ?? '')),
      setSetting(SETTINGS.PC_CRITICAL_SFX, String(formData.pcCriticalSfx ?? '')),
      setSetting(SETTINGS.GM_CRITICAL_SFX, String(formData.gmCriticalSfx ?? '')),
      setSetting(SETTINGS.CINEMATIC_DURATION, Number(formData.cinematicDuration)),
    ]);
  }
}
