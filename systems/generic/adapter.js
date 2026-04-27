/**
 * Treasure Hoard Manager - Generic System Adapter
 * Универсальный адаптер для любой игровой системы
 */

import { SystemAdapter } from '../system-adapter.js';

export class GenericSystemAdapter extends SystemAdapter {
  
  constructor() {
    super();
    this.systemId = 'generic';
  }

  /**
   * Получение количества предмета
   */
  getItemQuantity(item) {
    // Универсальная попытка получить количество
    return item.system?.quantity || item.system?.qty || item.system?.amount || 1;
  }

  /**
   * Установка количества предмета
   */
  setItemQuantity(item, quantity) {
    // Универсальная попытка установить количество
    const quantityPath = this.findQuantityPath(item);
    if (quantityPath) {
      return item.update({ [quantityPath]: quantity });
    }
    return Promise.resolve(item);
  }

  /**
   * Получение цены предмета
   */
  getItemPrice(item) {
    // Универсальная попытка получить цену
    return item.system?.price?.value || item.system?.price || item.system?.cost || 0;
  }

  /**
   * Получение валюты актера
   */
  getActorCurrency(actor) {
    // Универсальная попытка получить валюту
    return actor.system?.currency || {
      gp: 0,
      sp: 0,
      cp: 0
    };
  }

  /**
   * Фильтрация предметов для хранилища
   */
  getItemFilters() {
    // Базовые универсальные фильтры
    return [
      {
        path: "type",
        filters: "spell,feat,class,subclass,background,race"
      }
    ];
  }

  /**
   * Получение типа актера по умолчанию
   */
  getDefaultActorType() {
    return "npc";
  }

  /**
   * Получение типа предмета по умолчанию
   */
  getDefaultItemType() {
    return "loot";
  }

  /**
   * Проверка может ли предмет быть в хранилище
   */
  canItemBeInHoard(item) {
    // Исключаем системные типы предметов
    const excludedTypes = ["spell", "feat", "class", "subclass", "background", "race"];
    return !excludedTypes.includes(item.type);
  }

  /**
   * Получение локализованного названия типа предмета
   */
  getItemTypeName(item) {
    // Универсальные названия типов
    const typeNames = {
      weapon: "Оружие",
      equipment: "Снаряжение",
      consumable: "Расходуемый",
      tool: "Инструмент",
      loot: "Добыча",
      backpack: "Рюкзак",
      item: "Предмет"
    };
    return typeNames[item.type] || "Предмет";
  }

  /**
   * Получение редкости предмета
   */
  getItemRarity(item) {
    // Универсальная попытка получить редкость
    return item.system?.rarity || item.system?.rarity?.toLowerCase() || "common";
  }

  /**
   * Форматирование отображения цены
   */
  formatPrice(price) {
    if (typeof price !== 'number') price = this.getItemPrice(price);
    
    // Универсальное форматирование
    return `${price} gp`;
  }

  /**
   * Получение базовой цены предмета
   */
  getBaseItemPrice(item) {
    // Универсальная логика базовой цены
    const rarity = this.getItemRarity(item);
    const type = item.type;
    
    const rarityPrices = {
      common: { min: 1, max: 50 },
      uncommon: { min: 50, max: 200 },
      rare: { min: 200, max: 1000 },
      "very rare": { min: 1000, max: 5000 },
      legendary: { min: 5000, max: 50000 }
    };
    
    const priceRange = rarityPrices[rarity] || rarityPrices.common;
    
    // Базовая цена в зависимости от типа предмета
    let basePrice = Math.floor((priceRange.min + priceRange.max) / 2);
    
    // Модификаторы по типу
    const typeModifiers = {
      weapon: 1.2,
      equipment: 1.1,
      consumable: 0.8,
      tool: 1.0,
      loot: 1.0
    };
    
    const modifier = typeModifiers[type] || 1.0;
    basePrice = Math.floor(basePrice * modifier);
    
    return basePrice;
  }

  /**
   * Поиск пути к количеству в системе
   */
  findQuantityPath(item) {
    const system = item.system || {};
    
    // Поиск различных возможных путей к количеству
    if (system.quantity !== undefined) return "system.quantity";
    if (system.qty !== undefined) return "system.qty";
    if (system.amount !== undefined) return "system.amount";
    
    return null;
  }

  /**
   * Получение цены оружия
   */
  getWeaponPrice(item) {
    // Универсальная логика цены оружия
    const basePrice = 10;
    const weaponType = item.system?.weaponType || item.system?.type;
    
    const typePrices = {
      "simple melee": 5,
      "simple ranged": 25,
      "martial melee": 10,
      "martial ranged": 50
    };
    
    return typePrices[weaponType] || basePrice;
  }

  /**
   * Получение цены брони
   */
  getArmorPrice(item) {
    // Универсальная логика цены брони
    const basePrice = 10;
    const armorType = item.system?.armor?.type || item.system?.type;
    
    const typePrices = {
      light: 10,
      medium: 50,
      heavy: 75
    };
    
    return typePrices[armorType] || basePrice;
  }

  /**
   * Получение цены расходуемых материалов
   */
  getConsumablePrice(item) {
    // Универсальная логика цены расходуемых материалов
    const rarity = this.getItemRarity(item);
    
    const rarityPrices = {
      common: 50,
      uncommon: 200,
      rare: 1000,
      "very rare": 5000,
      legendary: 50000
    };
    
    return rarityPrices[rarity] || 50;
  }

  // === БАЗОВАЯ КЛАССИФИКАЦИЯ ===

  isWeapon(item) { return item.type === 'weapon'; }
  isArmor(item) { return item.type === 'equipment' || item.type === 'armor'; }
  isConsumable(item) { return item.type === 'consumable'; }
  isPotion(item) { return (item.name || '').toLowerCase().includes('potion'); }
  isScroll(item) { return (item.name || '').toLowerCase().includes('scroll'); }
  isFood(item) { return (item.name || '').toLowerCase().includes('food'); }
  isGem(item) { return item.type === 'loot' && (item.name || '').toLowerCase().includes('gem'); }
  isMaterial(item) { return item.type === 'loot' || item.type === 'material'; }

  /**
   * Конфигурация магазинов по умолчанию
   */
  getShopConfiguration() {
    return {
      shopTypes: {
        general: {
          name: 'Общий торговец',
          icon: 'icons/skills/social/trading-justice-scale-yellow.webp',
          description: 'Универсальный ассортимент товаров'
        }
      },
      categoryConfig: {
        general: { 
          categoryWeapons: true, categoryArmor: true, categoryPotions: true, 
          categoryScrolls: true, categoryFood: true, categoryGems: true, categoryMaterials: true 
        }
      }
    };
  }

  /**
   * Универсальные таблицы цен
   */
  getPricingConfig() {
    return {
      methods: ['default'],
      tables: {
        default: {
          common: [1, 50],
          uncommon: [51, 200],
          rare: [201, 1000],
          veryRare: [1001, 5000],
          legendary: [5001, 50000]
        },
        types: {
          consumable: 1.0,
          weapon: 1.0,
          equipment: 1.0,
          loot: 1.0,
          tool: 1.0
        }
      }
    };
  }

  /**
   * Универсальное списание валюты
   */
  async subtractCurrency(actor, amount) {
    const currencyPath = actor.system?.currency ? 'system.currency' : 'system.money';
    const current = foundry.utils.getProperty(actor, currencyPath);
    
    if (typeof current === 'number') {
      if (current < amount) return false;
      await actor.update({ [currencyPath]: current - amount });
      return true;
    }
    
    // Если сложная валюта, но нет спецификации - просто вычитаем из первого попавшегося поля
    if (typeof current === 'object') {
      const firstKey = Object.keys(current)[0];
      if (current[firstKey] < amount) return false;
      await actor.update({ [`${currencyPath}.${firstKey}`]: current[firstKey] - amount });
      return true;
    }
    
    return false;
  }
}
