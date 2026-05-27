import { DURATION_MAX_MS, DURATION_MIN_MS, MODULE_ID, SETTINGS } from '../constants';
import { getSetting, setSetting } from './settings';

interface AppV2Options {
  id?: string;
  tag?: string;
  classes?: string[];
  window?: { title?: string; contentClasses?: string[]; icon?: string | false };
  position?: { width?: number; height?: number | 'auto' };
  form?: { handler?: unknown; closeOnSubmit?: boolean; submitOnChange?: boolean };
}

interface AppV2Instance {
  render(force?: boolean | object, options?: object): Promise<unknown>;
  options: AppV2Options;
}

declare const foundry: {
  applications: {
    api: {
      ApplicationV2: new (options?: AppV2Options) => AppV2Instance;
      HandlebarsApplicationMixin: <T extends abstract new (...args: any[]) => any>(base: T) => T;
    };
  };
};

interface GMConfigData {
  gmAvatar: string;
  pcCriticalSfx: string;
  gmCriticalSfx: string;
  cinematicDuration: number;
}

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

export class GMConfigMenu extends Base {
  static DEFAULT_OPTIONS: AppV2Options = {
    id: `${MODULE_ID}-gm-config`,
    tag: 'form',
    classes: ['gluc-gm-config'],
    window: { title: 'GLUC.Settings.MenuName', icon: 'fa-solid fa-cog' },
    position: { width: 520, height: 'auto' },
    form: {
      handler: GMConfigMenu.#onSubmit,
      closeOnSubmit: true,
      submitOnChange: false,
    },
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/gm-config.html` },
  };

  async _prepareContext(): Promise<{
    data: GMConfigData;
    durationMin: number;
    durationMax: number;
  }> {
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

  static async #onSubmit(
    _event: Event,
    _form: HTMLFormElement,
    formData: { object: Record<string, unknown> },
  ): Promise<void> {
    const data = formData.object;
    await Promise.all([
      setSetting(SETTINGS.GM_AVATAR, String(data.gmAvatar ?? '')),
      setSetting(SETTINGS.PC_CRITICAL_SFX, String(data.pcCriticalSfx ?? '')),
      setSetting(SETTINGS.GM_CRITICAL_SFX, String(data.gmCriticalSfx ?? '')),
      setSetting(SETTINGS.CINEMATIC_DURATION, Number(data.cinematicDuration)),
    ]);
  }
}
