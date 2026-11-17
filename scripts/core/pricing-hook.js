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

    // Проверяем тип предмета: оцениваем только физические предметы
    const physicalTypes = ['weapon', 'equipment', 'consumable', 'loot', 'tool', 'backpack', 'container'];
    if (!physicalTypes.includes(item.type)) {
      return;
    }

    // Если предмет уже был оценен THM (например, при передаче между актерами), не пересчитываем заново
    if (item.getFlag?.(CONSTANTS.MODULE_NAME, 'priced')) {
      return;
    }

    const adapter = game.THM?.systemAdapter || game.modules.get(CONSTANTS.MODULE_NAME)?.api?.systemAdapter;
    if (!adapter) return;

    // Исключаем природные атаки монстров
    if (typeof adapter.isNaturalItem === 'function' && adapter.isNaturalItem(item)) {
      return;
    }

    const priceMethod = 'dmg'; // Глобально используем метод Диапазонов (DMG)
    const price = await adapter.generateItemPrice(item, priceMethod);

    if (price > 0) {
      const pricePath = typeof adapter.getPricePath === 'function' ? adapter.getPricePath() : 'system.price.value';
      const updateData = {
        [pricePath]: price,
        [`flags.${CONSTANTS.MODULE_NAME}.priced`]: true
      };

      if (item.system?.price && typeof item.system.price === 'object') {
        updateData['system.price.denomination'] = 'gp';
      }

      await item.update(updateData);

      if (THMSettings.debugMode) {
        const source = item._stats?.compendiumSource ? `from compendium` : `created`;
        console.log(`THM Auto Pricing | Overwrote price for ${item.name}: ${price} gp (${priceMethod}) [${source}]`);
      }
    }
  }
}
