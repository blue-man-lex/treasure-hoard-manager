/**
 * Глобальный хук для автоматического назначения цен предметам
 */
import { CONSTANTS } from './constants.js';
import { THMSettings } from './settings.js';

export class THMPricingHook {
  static MODULE_NAME = 'treasure-hoard-manager';
  
  /**
   * Инициализация хуков
   */
  static init() {
    // Хук на создание предметов
    Hooks.on('createItem', this.onItemCreate.bind(this));
  }
  
  /**
   * Обработчик создания предмета
   */
  static async onItemCreate(item, options, userId) {
    // Только если настройка включена и это текущий пользователь
    if (!THMSettings.autoPriceItems || userId !== game.userId) {
      return;
    }
    
    // Сначала проверяем есть ли у предмета цена
    const currentPrice = typeof item.system?.price === 'number' ? item.system.price :
                       (item.system?.price?.value || 0);
    
    if (currentPrice > 0) {
      return; // ✅ Цена уже есть - ничего не делаем
    }
    
    // Генерируем цену через системный адаптер
    const adapter = game.modules.get(CONSTANTS.MODULE_NAME).api.systemAdapter;
    if (!adapter) return;

    const priceMethod = 'dmg'; // Глобально всегда используем метод Диапазонов (DMG)
    const price = await adapter.generateItemPrice(item, priceMethod);
    
    if (price > 0) {
      // Обновляем предмет с ценой
      await item.update({
        'system.price.value': price
      });
      
      if (THMSettings.debugMode) {
        const source = item._stats?.compendiumSource ? `from compendium` : `created`;
        console.log(`THM Auto Pricing | Set price for ${item.name}: ${price} gp (${priceMethod}) [${source}]`);
      }
    }
  }
}
