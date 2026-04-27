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
}
