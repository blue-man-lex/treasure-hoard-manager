/**
 * Treasure Hoard Manager - Cyberpunk Red System Adapter
 * Высокоточный адаптер для системы Cyberpunk Red
 */

import { SystemAdapter } from '../system-adapter.js';

export class CyberpunkRedAdapter extends SystemAdapter {

  constructor() {
    super();
    this.systemId = "cyberpunk-red-core";
  }

  /**
   * Получение количества предмета
   * В CPR количество хранится в system.amount
   */
  getItemQuantity(item) {
    return item.system?.amount ?? 1;
  }

  /**
   * Установка количества предмета
   */
  async setItemQuantity(item, quantity) {
    return item.update({ "system.amount": quantity });
  }

  /**
   * Получение цены предмета
   * Учитывает специфику CPR: цена боеприпасов указана за 10 шт.
   */
  getItemPrice(item) {
    let price = item.system?.price?.market ?? 0;
    
    // В CPR боеприпасы (кроме гранат/ракет) продаются пачками по 10 штук
    // system.ammoVariety определяет тип патронов
    if (item.type === "ammo") {
      const variety = item.system?.ammoVariety || "";
      if (!["grenade", "rocket"].includes(variety.toLowerCase())) {
        price = price / 10;
      }
    }
    
    return price;
  }

  /**
   * Получение валюты актера
   */
  getActorCurrency(actor) {
    const wealth = foundry.utils.getProperty(actor, "system.wealth.value") || 0;
    return { eb: wealth };
  }

  /**
   * Обновление валюты актера
   */
  async updateActorCurrency(actor, currencyData) {
    const amount = currencyData.eb ?? 0;
    return actor.update({ "system.wealth.value": amount });
  }

  /**
   * Путь к данным валюты
   */
  getCurrencyPath() {
    return "system.wealth";
  }

  /**
   * Фильтрация предметов (что НЕ может быть в магазине/луте)
   */
  getItemFilters() {
    return [
      {
        path: "type",
        filters: "skill,role,criticalInjury,cyberwareInternal,ability,class,subclass"
      }
    ];
  }

  /**
   * Проверка может ли предмет быть в хранилище
   */
  canItemBeInHoard(item) {
    const excludedTypes = ["skill", "role", "criticalInjury", "ability"];
    if (excludedTypes.includes(item.type)) return false;
    
    // В CPR некоторые предметы "встроены" и не могут быть переданы
    if (item.system?.core || item.system?.isFoundational) return false;
    
    return true;
  }

  /**
   * Получение данных о редкости на основе Cost Category из CPR
   */
  getItemRarityData(item) {
    const category = item.system?.price?.category || "everyday";
    
    const mapping = {
      "dirtCheap": { label: "Грошовый", class: "common" },
      "cheap": { label: "Дешевый", class: "common" },
      "everyday": { label: "Обычный", class: "common" },
      "costly": { label: "Дорогой", class: "uncommon" },
      "premium": { label: "Премиум", class: "rare" },
      "expensive": { label: "Дорогостоящий", class: "rare" },
      "veryExpensive": { label: "Очень дорогой", class: "veryrare" },
      "luxury": { label: "Роскошный", class: "legendary" },
      "superLuxury": { label: "Экзотика", class: "legendary" }
    };

    return mapping[category] || { label: "Обычный", class: "common" };
  }

  /**
   * Форматирование цены
   */
  formatPrice(price) {
    return `${Math.floor(price)} eb`;
  }

  /**
   * Конфигурация валюты
   */
  getCurrencyConfig() {
    return {
      eb: { 
        weight: 1, 
        label: "Eurobucks", 
        img: "systems/cyberpunk-red-core/icons/currency/eb.png" 
      }
    };
  }

  /**
   * Конвертация в атомы (для внутренних расчетов)
   */
  convertCurrencyToAtoms(currencyData) {
    return currencyData?.eb || 0;
  }

  /**
   * Конвертация из атомов
   */
  convertAtomsToCurrency(atoms) {
    return { eb: Math.max(0, Math.floor(atoms)) };
  }

  /**
   * HTML отображение валюты
   */
  formatCurrencyHtml(currencyData) {
    const amount = currencyData?.eb || 0;
    return `<span class="currency eb" title="Eurobucks"><span class="amount">${amount}</span> <span class="unit">eb</span></span>`;
  }

  /**
   * Проверка на стакаемость
   */
  isStackable(item) {
    // В CPR стакаются расходники, патроны и обычное снаряжение
    const nonStackable = ["weapon", "armor", "cyberware", "cyberdeck", "vehicle"];
    return !nonStackable.includes(item.type);
  }

  /**
   * Получение уровня/репутации актера
   */
  getActorLevel(actor) {
    return actor.system?.reputation?.value || 1;
  }

  // === КЛАССИФИКАЦИЯ ПРЕДМЕТОВ CPR ===

  isWeapon(item) { return item.type === 'weapon'; }
  isArmor(item) { return item.type === 'armor' || item.type === 'clothing'; }
  isConsumable(item) { return ["drug", "ammo"].includes(item.type); }
  isPotion(item) { return item.type === "drug"; }
  isScroll(item) { return item.type === "program"; } // Программы как аналог свитков
  isMaterial(item) { return item.type === "itemUpgrade" || item.type === "gear"; }

  /**
   * Конфигурация магазинов Найт-Сити
   */
  getShopConfiguration() {
    return {
      shopTypes: {
        fixer: {
          name: 'Фиксер (Fixer)',
          icon: 'icons/skills/social/trading-justice-scale-yellow.webp',
          description: 'У этого парня есть всё, если у тебя есть эдди. Специализируется на оружии и редком снаряжении.',
          defaultRarity: { common: 40, uncommon: 30, rare: 20, veryrare: 10, legendary: 0 }
        },
        medtech: {
          name: 'Рипердок (Medtech)',
          icon: 'icons/skills/toxins/cauldron-pot-bubbles-green.webp',
          description: 'Киберимпланты, фармацевтика и быстрая починка твоего тела.',
          defaultRarity: { common: 50, uncommon: 30, rare: 20, veryrare: 0, legendary: 0 }
        },
        tech: {
          name: 'Техник (Tech)',
          icon: 'icons/skills/trades/smithing-anvil-silver-red.webp',
          description: 'Запчасти, электроника и апгрейды. Лучшее место для тех, кто любит копаться в железе.',
          defaultRarity: { common: 60, uncommon: 30, rare: 10, veryrare: 0, legendary: 0 }
        },
        nightmarket: {
          name: 'Ночной Рынок (Night Market)',
          icon: 'icons/environment/settlement/market-stall.webp',
          description: 'Случайный набор товаров. От дешевой еды до экспериментальных программ.',
          defaultRarity: { common: 20, uncommon: 30, rare: 30, veryrare: 15, legendary: 5 }
        },
        netshop: {
          name: 'Декер-шоп (Netrunner)',
          icon: 'icons/skills/tech/computer-keyboard-luminous.webp',
          description: 'Кибердеки, программы и всё, что нужно для погружения в Сеть.',
          defaultRarity: { common: 40, uncommon: 40, rare: 20, veryrare: 0, legendary: 0 }
        }
      },
      categoryConfig: {
        fixer: { categoryWeapons: true, categoryArmor: true, categoryMaterials: true },
        medtech: { categoryPotions: true, categoryArmor: false },
        tech: { categoryMaterials: true, categoryWeapons: true },
        nightmarket: { categoryWeapons: true, categoryArmor: true, categoryPotions: true, categoryScrolls: true },
        netshop: { categoryScrolls: true, categoryMaterials: true }
      }
    };
  }

  /**
   * Таблицы цен CPR на основе категорий
   */
  getPricingConfig() {
    return {
      methods: ['default'],
      tables: {
        default: {
          common: 20,      // Everyday
          uncommon: 50,    // Costly
          rare: 100,       // Premium
          veryrare: 500,   // Expensive
          legendary: 1000  // Very Expensive
        }
      }
    };
  }
}
