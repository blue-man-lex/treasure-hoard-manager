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
    // В CPR валюта - это просто число (eb), а не объект
    const wealth = currencyData?.eb ?? 0;
    console.log(`THM | CPR Adapter | Updating wealth for ${actor.name} to ${wealth}`);
    return await actor.update({ "system.wealth.value": wealth });
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
   * Получение ключа основной валюты системы
   */
  getPrimaryCurrencyKey() {
    return "eb";
  }

  /**
   * Получение названия валюты для отображения
   */
  getCurrencyLabel() {
    return "eb";
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
   * Путь для сохранения цены в предмете
   */
  getPricePath() {
    return "system.price.market";
  }

  /**
   * Генерация цены для предмета
   */
  async generateItemPrice(itemData, method = 'dmg') {
    // В Cyberpunk Red цены фиксированные (зависят от категории стоимости), поэтому просто возвращаем оригинальную цену
    if (itemData.system?.price?.market !== undefined) {
      return itemData.system.price.market;
    }
    if (itemData.system?.price?.value !== undefined) {
      return itemData.system.price.value;
    }
    return 0;
  }

  /**
   * HTML отображение валюты
   */
  formatCurrencyHtml(currencyData) {
    let data = currencyData;
    // Если передали число (атомы), конвертируем
    if (typeof currencyData === 'number') {
      data = this.convertAtomsToCurrency(currencyData);
    }
    const amount = data?.eb || 0;
    return `<span class="currency eb" title="Eurobucks"><span class="amount">${amount}</span> <span class="unit">eb</span></span>`;
  }

  /**
   * Проверка на стакаемость
   */
  isStackable(item) {
    // В CPR стакаются расходники, патроны и обычное снаряжение
    const nonStackable = ["weapon", "armor", "cyberware", "cyberdeck", "vehicle", "clothing"];
    return !nonStackable.includes(item.type);
  }

  /**
   * Получение уровня/репутации актера
   */
  getActorLevel(actor) {
    return actor.system?.reputation?.value || 1;
  }

  /**
   * Получение типа актера по умолчанию для CPR
   */
  getDefaultActorType() {
    return "container";
  }

  /**
   * Получение типа предмета по умолчанию для CPR
   */
  getDefaultItemType() {
    return "item";
  }

  /**
   * Путь к количеству предмета
   */
  getQuantityPath() {
    return "system.amount";
  }

  /**
   * Путь к валюте актера
   */
  getCurrencyPath() {
    return "system.wealth.value";
  }

  // === КЛАССИФИКАЦИЯ ПРЕДМЕТОВ CPR ===

  isWeapon(item) { return ['weapon', 'ammo'].includes(item.type); }
  isArmor(item) { return item.type === 'armor' || item.type === 'clothing'; }
  isConsumable(item) { return ["drug", "ammo"].includes(item.type); }
  isPotion(item) { return item.type === "drug"; }
  isScroll(item) { return item.type === "program"; } // Программы как аналог свитков
  isMaterial(item) { return item.type === "itemUpgrade" || item.type === "gear"; }
  isGem(item) { return item.type === "item" && (item.name.toLowerCase().includes("чип") || item.name.toLowerCase().includes("карта")); }

  /**
   * Генерация стартового капитала для торговца (в эдди)
   */
  async generateMerchantWealth(actor) {
    const wealth = Math.floor(Math.random() * 5000) + 1000; // 1000-6000 eb
    await this.updateActorCurrency(actor, { eb: wealth });
  }

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
