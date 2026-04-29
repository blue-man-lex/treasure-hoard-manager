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
