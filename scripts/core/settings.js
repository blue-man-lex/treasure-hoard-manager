/**
 * Глобальные настройки модуля Treasure Hoard Manager
 */
export class THMSettings {
  static MODULE_NAME = 'treasure-hoard-manager';
  
  /**
   * Регистрация настроек модуля
   */
  static registerSettings() {
    // Настройка автоматического назначения цен
    game.settings.register(THMSettings.MODULE_NAME, 'autoPriceItems', {
      name: 'THM.SETTINGS.AutoPriceItems.Name',
      hint: 'THM.SETTINGS.AutoPriceItems.Hint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean
    });
    
    
    // Отладочный режим
    game.settings.register(THMSettings.MODULE_NAME, 'debugMode', {
      name: 'THM.SETTINGS.DebugMode.Name',
      hint: 'THM.SETTINGS.DebugMode.Hint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean
    });

    // Визуальная тема
    game.settings.register(THMSettings.MODULE_NAME, 'visualTheme', {
      name: 'Визуальная тема',
      hint: 'Выберите стиль интерфейса. "Авто" определяет тему по игровой системе. Требуется перезагрузка страницы.',
      scope: 'world',
      config: true,
      default: 'auto',
      type: String,
      choices: {
        auto: 'Авто (по системе)',
        fantasy: 'Фэнтези (золото/пергамент)',
        cyberpunk: 'Киберпанк (неон/терминал)'
      },
      requiresReload: true
    });

    // ========== CORPSE LOOTING SETTINGS (D&D 5e only) ==========

    // Включение функции обыска трупов
    game.settings.register(THMSettings.MODULE_NAME, 'enableCorpseLooting', {
      name: 'THM.SETTINGS.EnableCorpseLooting.Name',
      hint: 'THM.SETTINGS.EnableCorpseLooting.Hint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean,
      onChange: value => {
        console.log(`THM Settings | Corpse Looting ${value ? 'enabled' : 'disabled'}`);
      }
    });

    // Автоматическое открытие интерфейса при смерти
    game.settings.register(THMSettings.MODULE_NAME, 'autoOpenCorpseOnDeath', {
      name: 'THM.SETTINGS.AutoOpenCorpseOnDeath.Name',
      hint: 'THM.SETTINGS.AutoOpenCorpseOnDeath.Hint',
      scope: 'world',
      config: true,
      default: false,
      type: Boolean
    });

    // Удаление пустых трупов
    game.settings.register(THMSettings.MODULE_NAME, 'deleteEmptyCorpse', {
      name: 'THM.SETTINGS.DeleteEmptyCorpse.Name',
      hint: 'THM.SETTINGS.DeleteEmptyCorpse.Hint',
      scope: 'world',
      config: true,
      default: true,
      type: Boolean
    });

    // Визуальные эффекты для трупов
    game.settings.register(THMSettings.MODULE_NAME, 'corpseVisualEffects', {
      name: 'THM.SETTINGS.CorpseVisualEffects.Name',
      hint: 'THM.SETTINGS.CorpseVisualEffects.Hint',
      scope: 'world',
      config: true,
      default: true,
      type: Boolean
    });

    // Время разложения трупа (в часах)
    game.settings.register(THMSettings.MODULE_NAME, 'corpseDecayTime', {
      name: 'THM.SETTINGS.CorpseDecayTime.Name',
      hint: 'THM.SETTINGS.CorpseDecayTime.Hint',
      scope: 'world',
      config: true,
      default: 0,
      type: Number,
      range: {
        min: 0,
        max: 168,
        step: 1
      }
    });
  }
  
  /**
   * Получение настроек
   */
  static get autoPriceItems() {
    return game.settings.get(THMSettings.MODULE_NAME, 'autoPriceItems');
  }
  
  static get debugMode() {
    return game.settings.get(THMSettings.MODULE_NAME, 'debugMode');
  }

  // Corpse Looting settings
  static get enableCorpseLooting() {
    return game.settings.get(THMSettings.MODULE_NAME, 'enableCorpseLooting');
  }

  static get autoOpenCorpseOnDeath() {
    return game.settings.get(THMSettings.MODULE_NAME, 'autoOpenCorpseOnDeath');
  }

  static get deleteEmptyCorpse() {
    return game.settings.get(THMSettings.MODULE_NAME, 'deleteEmptyCorpse');
  }

  static get corpseVisualEffects() {
    return game.settings.get(THMSettings.MODULE_NAME, 'corpseVisualEffects');
  }

  static get corpseDecayTime() {
    return game.settings.get(THMSettings.MODULE_NAME, 'corpseDecayTime');
  }

  /**
   * Определение активной темы
   * Возвращает 'fantasy' или 'cyberpunk'
   */
  static getActiveTheme() {
    try {
      const setting = game.settings.get(THMSettings.MODULE_NAME, 'visualTheme');
      if (setting === 'fantasy' || setting === 'cyberpunk') return setting;
      // Режим "auto": определяем по системе
      if (game.system.id === 'cyberpunk-red-core') return 'cyberpunk';
      return 'fantasy';
    } catch (e) {
      // Настройки еще не зарегистрированы (вызов на этапе init)
      if (game.system?.id === 'cyberpunk-red-core') return 'cyberpunk';
      return 'fantasy';
    }
  }
}
