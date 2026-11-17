/**
* Treasure Hoard Manager - D&D 5e System Adapter
* Адаптер для системы Dungeons & Dragons 5th Edition
*/

import { SystemAdapter } from '../system-adapter.js';
import { CONSTANTS } from '../../core/constants.js';

export class Dnd5eAdapter extends SystemAdapter {

  constructor() {
    super();
    this.systemId = "dnd5e";
  }

  /**
   * Получение количества предмета
   */
  getItemQuantity(item) {
    return item.system?.quantity || 1;
  }

  /**
   * Получение цены предмета в золотых монетах (gp) с учетом официальной деноминации D&D 5e
   * @param {Item} item
   * @returns {number} Цена в gp (например, 5 sp = 0.5 gp, 2 cp = 0.02 gp)
   */
  getItemPrice(item) {
    if (!item) return 0;

    const priceObj = item.system?.price;
    if (typeof priceObj === 'number' && priceObj > 0) {
      return priceObj;
    }

    if (priceObj && typeof priceObj === 'object') {
      const val = Number(priceObj.value);
      if (!isNaN(val) && val > 0) {
        const denom = (priceObj.denomination || 'gp').toLowerCase();
        // В D&D 5e: 1 pp = 10 gp, 1 gp = 1 gp, 1 ep = 0.5 gp, 1 sp = 0.1 gp, 1 cp = 0.01 gp
        const rates = { pp: 10, gp: 1, ep: 0.5, sp: 0.1, cp: 0.01 };
        const rate = rates[denom] ?? 1;
        return Math.round(val * rate * 100) / 100;
      }
    }

    return 0;
  }


  /**
   * Получение валюты актера
   */
  getActorCurrency(actor) {
    if (!actor || !actor.system) return {};
    const currency = actor.system.currency || {};
    const config = this.getCurrencyConfig();
    const result = {};
    for (const key of Object.keys(config)) {
      result[key] = currency[key] || 0;
    }
    return result;
  }

  /**
   * Обновление валюты актера
   */
  async updateActorCurrency(actor, currencyData) {
    if (!actor || !actor.update) return;
    return actor.update({ "system.currency": currencyData });
  }

  /**
   * Фильтрация предметов для D&D 5e
   */
  getItemFilters() {
    return [
      {
        path: "type",
        filters: "spell,feat,class,subclass,background,race"
      },
      {
        path: "system.weaponType",
        filters: "natural"
      }
    ];
  }

  /**
   * Получение типа актера по умолчанию
   */
  getDefaultActorType() {
    return "character";
  }

  /**
   * Получение типа предмета по умолчанию для добычи
   */
  getDefaultItemType() {
    return "loot";
  }

  /**
   * Проверка является ли предмет природной частью существа (атака, броня, орган)
   */
  isNaturalItem(item) {
    if (!item) return false;

    // 1. Проверка явных типов dnd5e (v2, v3, v4)
    const typeValue = item.system?.type?.value;
    const weaponType = item.system?.weaponType;
    const armorType = item.system?.armor?.type;

    if (typeValue === "natural" || weaponType === "natural" || armorType === "natural") {
      return true;
    }

    // 2. Проверка свойств (Set в v3+, Array/Object в v2)
    const props = item.system?.properties;
    if (props) {
      if (typeof props.has === 'function' && props.has('natural')) return true;
      if (Array.isArray(props) && props.includes('natural')) return true;
      if (typeof props === 'object' && props.natural) return true;
    }

    // 3. Семантическая проверка по названию (для оружия и экипировки)
    if (item.type === "weapon" || item.type === "equipment") {
      const name = item.name?.trim().toLowerCase() || "";
      const naturalNamePattern = /^(?:щупальц[еаы]|укус|когт[ией]|хвост|удар\s+хвостом|жало|рог[аио]?|клюв|таран|сжатие|дыхание|панцирь|чешуя|природный\s+доспех|ложноножк[аи]|клешн[яи]|заглатывание|поглощение|лап[аы]|tentacle[s]?|bite|claw[s]?|tail|slam|sting(er)?|gore|horn[s]?|beak|talon[s]?|constrict|breath\s+weapon|natural\s+armor|pincer[s]?|pseudopod|engulf|swallow|unarmed\s+strike)/i;
      
      if (naturalNamePattern.test(name)) {
        // Если это природное название и цена 0 либо тип natural/пустой - точно природная атака
        const price = item.system?.price?.value || 0;
        if (price === 0 || typeValue === "natural" || !typeValue) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Проверка может ли предмет быть в хранилище
   */
  canItemBeInHoard(item) {
    if (!item) return false;

    // Исключаем заклинания, умения, классы и расы
    const excludedTypes = ["spell", "feat", "class", "subclass", "background", "race"];
    if (excludedTypes.includes(item.type)) return false;

    // Исключаем природное оружие и части тела
    if (this.isNaturalItem(item)) return false;

    return true;
  }

  /**
   * Получение только строкового идентификатора редкости (common, rare и т.д.)
   */
  getItemRarity(item) {
    return this.getItemRarityData(item).class;
  }

  /**
   * Получение данных о редкости предмета
   */
  getItemRarityData(item) {
    const rarityValue = item?.system?.rarity?.toLowerCase?.() || item?.system?.rarity?.value?.toLowerCase?.() || 'common';

    // Формируем чистый класс для CSS (very rare -> veryrare)
    const rarityClass = rarityValue.replace(/\s+/g, '').replace(/-/g, '');

    // Локализация для D&D 5e
    const labels = {
      common: "Обычный",
      uncommon: "Необычный",
      rare: "Редкий",
      veryrare: "Очень редкий",
      legendary: "Легендарный",
      artifact: "Артефакт"
    };

    return {
      value: rarityValue,
      class: rarityClass,
      label: labels[rarityClass] || rarityValue
    };
  }

  /**
   * Получение локализованного названия типа предмета
   */
  getItemTypeName(item) {
    const typeNames = {
      weapon: "Оружие",
      equipment: "Снаряжение",
      consumable: "Расходуемый",
      tool: "Инструмент",
      loot: "Добыча",
      backpack: "Рюкзак"
    };
    return typeNames[item.type] || "Предмет";
  }

  /**
   * Получение конфигурации валют системы
   */
  getCurrencyConfig() {
    return {
      pp: { weight: 1000, label: "Platinum", img: "systems/dnd5e/icons/currency/platinum.webp", class: "thm-currency-item pp" },
      gp: { weight: 100, label: "Gold", img: "systems/dnd5e/icons/currency/gold.webp", class: "thm-currency-item gp" },
      ep: { weight: 50, label: "Electrum", img: "systems/dnd5e/icons/currency/electrum.webp", class: "thm-currency-item ep" },
      sp: { weight: 10, label: "Silver", img: "systems/dnd5e/icons/currency/silver.webp", class: "thm-currency-item silver" },
      cp: { weight: 1, label: "Copper", img: "systems/dnd5e/icons/currency/copper.webp", class: "thm-currency-item copper" }
    };
  }



  /**
   * Получение ключа основной валюты системы
   */
  getPrimaryCurrencyKey() {
    return "gp";
  }

  /**
   * Получение названия валюты для отображения
   */
  getCurrencyLabel() {
    return "gp";
  }

  /**
   * Форматирование атомов (меди) для отображения в чате
   */
  formatAtoms(atoms) {
    const gp = Math.floor(atoms / 100);
    const sp = Math.floor((atoms % 100) / 10);
    const cp = atoms % 10;
    const parts = [];
    if (gp > 0) parts.push(`${gp} зм`);
    if (sp > 0) parts.push(`${sp} см`);
    if (cp > 0) parts.push(`${cp} мм`);
    return parts.join(' ') || '0 зм';
  }

  /**
   * Перевод объекта валют в "атомы" (медь)
   */
  convertCurrencyToAtoms(currencyData) {
    if (!currencyData) return 0;

    // Если передали число, считаем что это уже атомы
    if (typeof currencyData === 'number') return currencyData;

    const config = this.getCurrencyConfig();
    let total = 0;
    for (const [key, conf] of Object.entries(config)) {
      if (currencyData[key]) {
        total += currencyData[key] * conf.weight;
      }
    }
    return total;
  }

  /**
   * Перевод "атомов" (меди) в объект валют с опциональной фильтрацией платины и электрума
   */
  convertAtomsToCurrency(atoms, options = {}) {
    const config = this.getCurrencyConfig();
    let remaining = Math.abs(Math.round(atoms));
    const result = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };

    let sortedKeys = Object.keys(config).sort((a, b) => config[b].weight - config[a].weight);

    // Если платина отключена, не конвертируем золото в платину (остается в gp)
    if (options.allowPlatinum === false) {
      sortedKeys = sortedKeys.filter(k => k !== 'pp');
    }
    // Если электрум отключен, исключаем его
    if (options.allowElectrum === false) {
      sortedKeys = sortedKeys.filter(k => k !== 'ep');
    }

    for (const key of sortedKeys) {
      const conf = config[key];
      result[key] = Math.floor(remaining / conf.weight);
      remaining %= conf.weight;
    }

    return result;
  }

  /**
   * Форматирование отображения цены (простая строка)
   */
  formatPrice(price) {
    if (typeof price !== 'number') price = this.getItemPrice(price);

    const currencies = this.convertAtomsToCurrency(price * 100); // price обычно в gp, переводим в cp

    let result = "";
    const config = this.getCurrencyConfig();
    const sortedKeys = Object.keys(config).sort((a, b) => config[b].weight - config[a].weight);

    for (const key of sortedKeys) {
      if (currencies[key] > 0) {
        result += `${currencies[key]}${config[key].label} `;
      }
    }

    return result.trim() || "0 gp";
  }

  /**
   * Форматирование объекта валют в красивый HTML с иконками
   */
  formatCurrencyHtml(currencyData, options = {}) {
    let data = currencyData;
    // Если передали число, конвертируем с учетом опций (allowPlatinum, allowElectrum)
    if (typeof currencyData === 'number') {
      data = this.convertAtomsToCurrency(currencyData, options);
    }

    if (!data || Object.values(data).every(v => v === 0)) {
      return '<span class="thm-currency-item cp" title="Copper">0<img src="systems/dnd5e/icons/currency/copper.webp"/></span>';
    }

    const config = this.getCurrencyConfig();
    const sortedKeys = Object.keys(config).sort((a, b) => config[b].weight - config[a].weight);
    const parts = [];

    // Если мы хотим отобразить ТОЛЬКО одну валюту (например, для чат-карты покупки услуги)
    // Мы проверяем, передана ли "чистая" сумма в одной валюте
    for (const key of sortedKeys) {
      const conf = config[key];
      if (data[key] > 0) {
        parts.push(`
          <span class="thm-currency-item ${key}" title="${conf.label}">
            ${data[key]}<img src="${conf.img}" alt="${conf.label}"/>
          </span>
        `);
      }
    }

    return parts.length > 0 ? parts.join(' ') : '<span class="thm-currency-item cp">0<img src="systems/dnd5e/icons/currency/copper.webp"/></span>';
  }

  /**
   * Получение базовой цены предмета на основе типа и редкости
   */
  getBaseItemPrice(item) {
    const rarityPrices = {
      common: { min: 1, max: 50 },
      uncommon: { min: 50, max: 200 },
      rare: { min: 200, max: 1000 },
      "very rare": { min: 1000, max: 5000 },
      legendary: { min: 5000, max: 50000 }
    };

    const rarity = this.getItemRarityData(item).value;
    const priceRange = rarityPrices[rarity] || rarityPrices.common;

    // Базовая цена в зависимости от типа предмета
    let basePrice = 0;

    switch (item.type) {
      case "weapon":
        basePrice = this.getWeaponPrice(item);
        break;
      case "equipment":
        basePrice = this.getArmorPrice(item);
        break;
      case "consumable":
        basePrice = this.getConsumablePrice(item);
        break;
      default:
        basePrice = Math.floor((priceRange.min + priceRange.max) / 2);
    }

    return basePrice;
  }

  /**
   * Получение цены оружия
   */
  getWeaponPrice(item) {
    const basePrices = {
      "simple melee": 5,
      "simple ranged": 25,
      "martial melee": 10,
      "martial ranged": 50
    };

    return basePrices[item.system.weaponType] || 10;
  }

  /**
   * Получение цены брони
   */
  getArmorPrice(item) {
    const basePrices = {
      light: 10,
      medium: 50,
      heavy: 75
    };

    const armorType = item.system.armor?.type;
    return basePrices[armorType] || 10;
  }

  /**
   * Получение цены расходуемых материалов
   */
  getConsumablePrice(item) {
    // Базовые цены для зелий и свитков
    const rarityPrices = {
      common: 50,
      uncommon: 200,
      rare: 1000,
      "very rare": 5000,
      legendary: 50000
    };

    const rarity = this.getItemRarityData(item).value;
    return rarityPrices[rarity] || 50;
  }

  // === НОВАЯ РЕАЛИЗАЦИЯ КЛАССИФИКАЦИИ (ПЕРЕНЕСЕНО ИЗ SHOP MANAGER) ===

  isWeapon(item) {
    return item.type === 'weapon';
  }

  isArmor(item) {
    return item.type === 'equipment' &&
      (item.system?.type?.value === 'light' ||
        item.system?.type?.value === 'medium' ||
        item.system?.type?.value === 'heavy' ||
        item.system?.type?.value === 'shield');
  }

  isPotion(item) {
    const typeValue = item.system?.type?.value || '';
    const nameLower = (item.name || '').toLowerCase();
    return item.type === 'consumable' &&
      (typeValue === 'potion' || typeValue === 'poison' ||
        nameLower.includes('зелье') || nameLower.includes('яд') ||
        nameLower.includes('эликсир') || nameLower.includes('potion'));
  }

  isFood(item) {
    if (!item) return false;
    const typeValue = item.system?.type?.value || item.system?.consumableType || '';
    const nameLower = (item.name || '').toLowerCase();
    return (item.type === 'consumable' || item.type === 'loot') && (
      typeValue === 'food' ||
      nameLower.includes('еда') ||
      nameLower.includes('пищ') ||
      nameLower.includes('рацион') ||
      nameLower.includes('мясо') ||
      nameLower.includes('рыб') ||
      nameLower.includes('хлеб') ||
      nameLower.includes('фрукт') ||
      nameLower.includes('яблок') ||
      nameLower.includes('тыкв') ||
      nameLower.includes('баклан') ||
      nameLower.includes('припас') ||
      nameLower.includes('сыр') ||
      nameLower.includes('овощ')
    );
  }

  isGem(item) {
    if (!item) return false;
    const nameLower = (item.name || '').toLowerCase();
    return item.type === 'loot' && (
      nameLower.includes('камен') ||
      nameLower.includes('самоцвет') ||
      nameLower.includes('бриллиант') ||
      nameLower.includes('рубин') ||
      nameLower.includes('изумруд') ||
      nameLower.includes('сапфир') ||
      nameLower.includes('алмаз') ||
      nameLower.includes('gem')
    );
  }

  isMaterial(item) {
    if (!item) return false;
    const nameLower = (item.name || '').toLowerCase();
    return item.type === 'loot' && (
      nameLower.includes('руда') ||
      nameLower.includes('дерево') ||
      nameLower.includes('кожа') ||
      nameLower.includes('ткань') ||
      nameLower.includes('слиток') ||
      nameLower.includes('ингредиент') ||
      nameLower.includes('трава') ||
      nameLower.includes('уголь') ||
      nameLower.includes('растение') ||
      nameLower.includes('шкур') ||
      nameLower.includes('перо') ||
      nameLower.includes('кость') ||
      nameLower.includes('металл')
    );
  }

  isScroll(item) {
    const typeValue = item.system?.type?.value || '';
    const nameLower = (item.name || '').toLowerCase();
    const identifier = item.system?.identifier || '';

    return item.type === 'consumable' && (
      typeValue === 'scroll' ||
      identifier === 'spell-scroll' ||
      nameLower.includes('свиток') ||
      nameLower.includes('свит') ||
      nameLower.includes('пергамент') ||
      nameLower.includes('рукопись') ||
      nameLower.includes('scroll') ||
      nameLower.includes('заклинание')
    );
  }

  /**
   * Конфигурация магазинов D&D 5e (Перенесено из ConfigApp и ShopManager)
   */
  getShopConfiguration() {
    return {
      shopTypes: {
        weaponsmith: {
          name: 'Кузнец',
          icon: 'icons/skills/trades/smithing-anvil-silver-red.webp',
          description: 'Оружие, доспехи и металлические изделия',
          defaultRarity: { common: 60, uncommon: 30, rare: 10, veryrare: 0, legendary: 0 }
        },
        armorer: {
          name: 'Бронник',
          icon: 'icons/equipment/chest/breastplate-helmet-metal.webp',
          description: 'Доспехи и защитное снаряжение',
          defaultRarity: { common: 50, uncommon: 35, rare: 15, veryrare: 0, legendary: 0 }
        },
        alchemist: {
          name: 'Знахарь',
          icon: 'icons/skills/toxins/cauldron-pot-bubbles-green.webp',
          description: 'Зелья, яды и алхимические ингредиенты',
          defaultRarity: { common: 70, uncommon: 20, rare: 8, veryrare: 2, legendary: 0 }
        },
        scribe: {
          name: 'Писец',
          icon: 'icons/sundries/scrolls/scroll-yellow-teal.webp',
          description: 'Свитки заклинаний и письменные принадлежности',
          defaultRarity: { common: 65, uncommon: 25, rare: 10, veryrare: 0, legendary: 0 }
        },
        cook: {
          name: 'Повар',
          icon: 'icons/skills/trades/farming-wheat-circle-yellow.webp',
          description: 'Еда и кулинарные изделия',
          defaultRarity: { common: 90, uncommon: 10, rare: 0, veryrare: 0, legendary: 0 }
        },
        merchant: {
          name: 'Рыночный торговец',
          icon: 'icons/environment/settlement/market-stall.webp',
          description: 'Различные товары и безделушки',
          defaultRarity: { common: 75, uncommon: 20, rare: 5, veryrare: 0, legendary: 0 }
        },
        general: {
          name: 'Общий торговец',
          icon: 'icons/skills/social/trading-justice-scale-yellow.webp',
          description: 'Смешанный ассортимент товаров',
          defaultRarity: { common: 70, uncommon: 20, rare: 8, veryrare: 2, legendary: 0 }
        }
      },
      categoryConfig: {
        weaponsmith: { categoryWeapons: true, categoryArmor: true, categoryMaterials: true },
        armorer: { categoryArmor: true, categoryMaterials: true },
        alchemist: { categoryPotions: true, categoryGems: true, categoryMaterials: true },
        scribe: { categoryScrolls: true },
        cook: { categoryFood: true, categoryMaterials: true },
        merchant: { categoryScrolls: true, categoryGems: true },
        general: { 
          categoryWeapons: true, categoryArmor: true, categoryPotions: true, 
          categoryScrolls: true, categoryFood: true, categoryGems: true, categoryMaterials: true 
        }
      }
    };
  }

  /**
   * Таблицы цен для D&D 5e (Перенесено из constants.js)
   */
  getPricingConfig() {
    return {
      methods: ['dmg', 'xge'],
      tables: {
        default: { common: 50, uncommon: 200, rare: 1000, veryrare: 5000, legendary: 25000 },
        xge: {
          common: '(1d6+1) * 10',
          uncommon: '(1d6) * 100', 
          rare: '2d10 * 1000',
          veryrare: '(1d4+1) * 10000',
          legendary: '2d6 * 25000',
          artifact: '2d6 * 250000'
        },
        dmg: {
          common: [50, 100],
          uncommon: [101, 500],
          rare: [501, 1500],
          veryrare: [1501, 8000],
          legendary: [8001, 15000],
          artifact: [200000, 1000000]
        },
        types: {
          consumable: 0.5,
          weapon: 1.2,
          equipment: 1.0,
          loot: 0.7,
          tool: 1.0
        }
      }
    };
  }

  /**
   * Безопасное списание валюты в D&D 5e (вызывает умное списание spendWealth)
   */
  async subtractCurrency(actor, baseAmountCp) {
    return this.spendWealth(actor, baseAmountCp);
  }

  /**
   * Генерация богатства для торговца D&D 5e с учетом настроек платины и электрума
   */
  async generateMerchantWealth(actor) {
    // ВАЖНО: В v12/v13 для синтетических актеров настройки хранятся в токене
    const settings = actor.token?.getFlag(CONSTANTS.MODULE_NAME, 'settings')?.specific || 
                     actor.getFlag(CONSTANTS.MODULE_NAME, 'settings')?.specific || {};
    
    // Если использование валюты выключено, деньги бесконечные (0)
    if (settings.useNpcCurrency === false) {
      await actor.update({ "system.currency": { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 } });
      return true;
    }

    const level = settings.merchantLevel || game.THM?.manager?.shopManager?.getAveragePlayerLevel() || 1;
    const allowPlatinum = settings.allowPlatinum === true;
    const allowElectrum = settings.allowElectrum === true;

    // Масштабирование капитала на основе уровня
    let baseGp = 0;
    if (level <= 1) {
      baseGp = Math.floor(15 + Math.random() * 35); // 15-50 gp для базового деревенского лавочника
    } else if (level <= 2) {
      baseGp = Math.floor(50 + Math.random() * 50); // 50-100 gp
    } else if (level <= 4) {
      baseGp = Math.floor(100 + Math.random() * 150); // 100-250 gp
    } else {
      baseGp = Math.floor(level * 150 * (1 + (level / 10)) + (Math.random() * 200));
    }

    let pp = 0;
    if (allowPlatinum) {
      pp = level >= 5 ? Math.floor(level / 2) * 10 + Math.floor(Math.random() * 20) : Math.floor(Math.random() * 5);
    }

    let ep = 0;
    if (allowElectrum) {
      ep = Math.floor(Math.random() * 20);
    }

    const currency = {
      cp: Math.floor(Math.random() * 100),
      sp: Math.floor(Math.random() * 50) + 20,
      ep: ep,
      gp: baseGp,
      pp: pp
    };
    
    console.log(`THM | Generated wealth for level ${level} (allowPP: ${allowPlatinum}, allowEP: ${allowElectrum}):`, currency);
    await actor.update({ 'system.currency': currency });
    return true;
  }

  /**
   * Получение общего богатства актера в минимальных единицах (медяках для 5е)
   */
  getActorWealth(actor) {
    const currency = actor.system?.currency || {};
    // В DnD5e 1 pp = 10 gp, 1 gp = 2 ep, 1 ep = 5 sp, 1 sp = 10 cp
    // Но лучше брать из конфига, если он доступен
    const config = globalThis.CONFIG?.DND5E?.currencies || {
      pp: { conversion: 1000 },
      gp: { conversion: 100 },
      ep: { conversion: 50 },
      sp: { conversion: 10 },
      cp: { conversion: 1 }
    };

    let total = 0;
    for (const [key, amount] of Object.entries(currency)) {
      const conv = config[key]?.conversion || 1;
      total += (parseInt(amount) || 0) * conv;
    }
    return total;
  }

  /**
   * Списание богатства у актера (Умное списание БЕЗ схлопывания всего кошелька в платину)
   */
  async spendWealth(actor, amountCp) {
    if (!actor) return false;
    
    const amount = Number(amountCp);
    if (isNaN(amount) || amount <= 0) return true;

    const currency = foundry.utils.deepClone(actor.system.currency || {});
    const config = this.getCurrencyConfig();

    // 1. Считаем общий баланс в меди
    let totalCp = 0;
    for (const [key, conf] of Object.entries(config)) {
      totalCp += (Number(currency[key]) || 0) * (conf.weight || 1);
    }

    console.log(`THM | Spending ${amount} cp. Total available: ${totalCp} cp`);

    if (totalCp < amount) {
      console.warn(`THM | Not enough funds! Required: ${amount}, Available: ${totalCp}`);
      return false;
    }

    // 2. Умное списание: списываем сначала монеты, соответствующие размеру платежа (pp, gp, ep, sp)
    // чтобы покупка меча за 15 золотых не сжигала последние медяки игрока!
    let remainingToPay = amount;
    const descKeys = ['pp', 'gp', 'ep', 'sp', 'cp'];

    for (const key of descKeys) {
      const weight = config[key].weight;
      const val = Number(currency[key]) || 0;
      if (val > 0 && remainingToPay >= weight) {
        const canTake = Math.min(val, Math.floor(remainingToPay / weight));
        if (canTake > 0) {
          currency[key] = val - canTake;
          remainingToPay -= canTake * weight;
        }
      }
    }

    // Если остался небольшой остаток, пробуем доплатить медью/серебром
    if (remainingToPay > 0) {
      const ascKeys = ['cp', 'sp', 'ep', 'gp', 'pp'];
      for (const key of ascKeys) {
        const weight = config[key].weight;
        const val = Number(currency[key]) || 0;
        if (val > 0 && remainingToPay > 0) {
          const canTake = Math.min(val, Math.floor(remainingToPay / weight));
          if (canTake > 0) {
            currency[key] = val - canTake;
            remainingToPay -= canTake * weight;
          }
        }
      }
    }

    // 3. Если все еще нужно доплатить (нужен размен ровно одной более крупной монеты)
    if (remainingToPay > 0) {
      const breakCandidates = ['sp', 'ep', 'gp', 'pp'];
      for (const key of breakCandidates) {
        const weight = config[key].weight;
        const val = Number(currency[key]) || 0;
        if (val > 0 && weight >= remainingToPay) {
          // Размениваем ровно ОДНУ монету
          currency[key] = val - 1;
          let change = weight - remainingToPay;
          remainingToPay = 0;

          // Распределяем сдачу (change) по монетам более низкого ранга (пропуская ep если электрум не используется)
          const settings = actor.token?.getFlag(CONSTANTS.MODULE_NAME, 'settings')?.specific || 
                           actor.getFlag(CONSTANTS.MODULE_NAME, 'settings')?.specific || {};
          const allowElectrum = settings.allowElectrum === true || ((Number(currency.ep) || 0) > 0);

          const subKeys = ['gp', allowElectrum ? 'ep' : null, 'sp', 'cp']
            .filter(k => k && config[k].weight < weight);

          for (const sKey of subKeys) {
            const sWeight = config[sKey].weight;
            const coinsToAdd = Math.floor(change / sWeight);
            if (coinsToAdd > 0) {
              currency[sKey] = (Number(currency[sKey]) || 0) + coinsToAdd;
              change %= sWeight;
            }
          }
          break;
        }
      }
    }

    // Финальная проверка
    if (remainingToPay > 0) {
      console.error("THM | Critical error in spendWealth: remaining payment after deduction logic", remainingToPay);
      return false;
    }

    // Сохраняем обновленный кошелек
    console.log("THM | New currency state:", currency);
    await actor.update({ "system.currency": currency });
    return true;
  }

  /**
   * Пополнение кошелька актера БЕЗ глобального схлопывания в высшую валюту
   * @param {Actor} actor
   * @param {number} amountCp - сумма в медяках (атомах)
   * @param {Object} [options]
   * @param {string} [options.denomination] - конкретная валюта ('pp', 'gp', 'sp', 'cp') если передана
   */
  async addWealth(actor, amountCp, options = {}) {
    if (!actor) return false;
    const amount = Number(amountCp);
    if (isNaN(amount) || amount <= 0) return true;

    const currency = foundry.utils.deepClone(actor.system.currency || {});
    const config = this.getCurrencyConfig();

    // Если прямо указана конкретная монета (например, игрок заплатил чистой платиной 'pp')
    if (options.denomination && config[options.denomination]) {
      const denomWeight = config[options.denomination].weight;
      const count = Math.floor(amount / denomWeight);
      if (count > 0) {
        currency[options.denomination] = (Number(currency[options.denomination]) || 0) + count;
      }
      let remainder = amount % denomWeight;
      if (remainder > 0) {
        const addGp = Math.floor(remainder / 100);
        remainder %= 100;
        const addSp = Math.floor(remainder / 10);
        const addCp = remainder % 10;
        if (addGp > 0) currency.gp = (Number(currency.gp) || 0) + addGp;
        if (addSp > 0) currency.sp = (Number(currency.sp) || 0) + addSp;
        if (addCp > 0) currency.cp = (Number(currency.cp) || 0) + addCp;
      }
      await actor.update({ "system.currency": currency });
      return true;
    }

    // Проверяем настройки магазина / актера на разрешение платины и электрума
    const settings = actor.token?.getFlag(CONSTANTS.MODULE_NAME, 'settings')?.specific || 
                     actor.getFlag(CONSTANTS.MODULE_NAME, 'settings')?.specific || {};
    const allowPlatinum = settings.allowPlatinum === true;
    const allowElectrum = settings.allowElectrum === true;

    let remaining = amount;
    let addPp = 0;
    if (allowPlatinum && remaining >= 1000) {
      addPp = Math.floor(remaining / 1000);
      remaining %= 1000;
    }

    const addGp = Math.floor(remaining / 100);
    remaining %= 100;

    let addEp = 0;
    if (allowElectrum && remaining >= 50) {
      addEp = Math.floor(remaining / 50);
      remaining %= 50;
    }

    const addSp = Math.floor(remaining / 10);
    const addCp = remaining % 10;

    if (addPp > 0) currency.pp = (Number(currency.pp) || 0) + addPp;
    if (addGp > 0) currency.gp = (Number(currency.gp) || 0) + addGp;
    if (addEp > 0) currency.ep = (Number(currency.ep) || 0) + addEp;
    if (addSp > 0) currency.sp = (Number(currency.sp) || 0) + addSp;
    if (addCp > 0) currency.cp = (Number(currency.cp) || 0) + addCp;

    await actor.update({ "system.currency": currency });
    return true;
  }

  /**
   * Получение коэффициента конвертации для указанной валюты
   */
  getCurrencyConversion(key) {
    const config = globalThis.CONFIG?.DND5E?.currencies || {
      pp: { conversion: 1000 },
      gp: { conversion: 100 },
      ep: { conversion: 50 },
      sp: { conversion: 10 },
      cp: { conversion: 1 }
    };
    return config[key]?.conversion || 1;
  }

  /**
   * Генерация цены предмета для D&D 5e с поддержкой категорий еды, сырья, руды, боеприпасов и живых разменных цен
   */
  async generateItemPrice(item, method = 'dmg', specificSettings = {}) {
    const rarity = this.getItemRarity(item);
    const itemType = item.type || 'loot';
    const subType = item.system?.type?.value || item.system?.consumableType || '';

    // 1. Провиант / Еда / Напитки (consumable.food или по распознаванию)
    if (this.isFood(item) || subType === 'food') {
      const foodPrices = {
        common: [0.02, 0.5],   // 2 cp - 5 sp (хлеб, сыр, эль, рацион на день)
        uncommon: [0.5, 3],    // 5 sp - 3 gp (хорошая трапеза, выдержанное вино)
        rare: [3, 15],         // 3 gp - 15 gp (экзотический пир, редкий ликер)
        veryrare: [15, 50],
        legendary: [50, 200]
      };
      const range = foodPrices[rarity] || foodPrices.common;
      const rawPrice = Math.random() * (range[1] - range[0]) + range[0];
      return this._finalizePrice(rawPrice, specificSettings);
    }

    // 2. Боеприпасы (consumable.ammo)
    const nameLower = (item.name || '').toLowerCase();
    const isAmmo = (itemType === 'consumable' && subType === 'ammo') ||
      nameLower.includes('ядро') || nameLower.includes('стрел') ||
      nameLower.includes('болт') || nameLower.includes('bullet') ||
      nameLower.includes('arrow') || nameLower.includes('bolt') ||
      nameLower.includes('снаряд');

    if (isAmmo) {
      const ammoPrices = {
        common: [0.05, 1],    // 5 cp - 1 gp (пачка обычных стрел, болтов, пуль)
        uncommon: [2, 10],    // серебряные / особые
        rare: [20, 100],
        veryrare: [100, 500],
        legendary: [500, 2000]
      };
      const range = ammoPrices[rarity] || ammoPrices.common;
      const rawPrice = Math.random() * (range[1] - range[0]) + range[0];
      return this._finalizePrice(rawPrice, specificSettings);
    }

    // 3. Сырье, ремесло, товары и мусор (Loot: material, resource, trade, junk)
    if (itemType === 'loot') {
      if (['material', 'resource', 'trade', 'junk'].includes(subType) || this.isMaterial(item)) {
        const materialPrices = {
          common: [0.05, 2],    // 5 cp - 2 gp (железная руда, уголь, мука, лен, медный слиток)
          uncommon: [5, 25],    // серебряный слиток, редкие травы
          rare: [50, 150],      // золотой слиток, адамантин, шкура виверны
          veryrare: [200, 800],
          legendary: [1000, 5000]
        };
        const range = materialPrices[rarity] || materialPrices.common;
        const rawPrice = Math.random() * (range[1] - range[0]) + range[0];
        return this._finalizePrice(rawPrice, specificSettings);
      }

      if (subType === 'gem' || this.isGem(item)) {
        const gemValues = {
          common: 10,
          uncommon: 50,
          rare: 100,
          veryrare: 500,
          legendary: 1000
        };
        const gemBase = gemValues[rarity] || 10;
        return this._finalizePrice(gemBase, specificSettings);
      }

      if (subType === 'art') {
        const artValues = {
          common: 25,
          uncommon: 250,
          rare: 750,
          veryrare: 2500,
          legendary: 7500
        };
        const artBase = artValues[rarity] || 25;
        return this._finalizePrice(artBase, specificSettings);
      }
    }

    // 4. Обычные таблицы цен (DMG / XGE) для магических предметов, снаряжения и оружия
    const pricingConfig = this.getPricingConfig();
    const tables = pricingConfig.tables;
    const priceTable = tables[method] || tables.dmg;
    const priceData = priceTable[rarity] || priceTable.common;

    if (!priceData) return 50;

    let basePrice = 0;

    if (method === 'xge' && typeof priceData === 'string') {
      try {
        if (typeof Roll !== 'undefined') {
          const roll = new Roll(priceData);
          const evaluated = await roll.evaluate({ async: true });
          basePrice = evaluated.total ?? roll.total ?? 100;
        } else {
          basePrice = this._evaluateDiceFormula(priceData);
        }
      } catch (error) {
        console.warn(`THM Adapter | XGE roll failed for ${item.name}:`, error);
        basePrice = this._evaluateDiceFormula(priceData);
      }
    } else {
      if (Array.isArray(priceData) && priceData.length >= 2) {
        const [min, max] = priceData;
        basePrice = Math.floor(Math.random() * (max - min + 1)) + min;
      } else {
        basePrice = typeof priceData === 'number' ? priceData : 100;
      }
    }

    // Применяем множитель типа предмета
    const typeMultiplier = tables.types[itemType] || 1.0;
    let finalMultiplier = typeMultiplier;
    if (this.isPotion(item) || this.isScroll(item)) {
      finalMultiplier *= 0.8;
    }

    const calculatedPrice = basePrice * finalMultiplier;
    return this._finalizePrice(calculatedPrice, specificSettings);
  }

  /**
   * Финализация цены с поддержкой "живых" разменных цен (detailedPrices)
   */
  _finalizePrice(price, specificSettings = {}) {
    if (specificSettings?.detailedPrices) {
      if (price >= 5) {
        const sp = Math.floor(Math.random() * 9 + 1);
        const cp = Math.floor(Math.random() * 9 + 1);
        const base = Math.floor(price) - 1;
        return Math.round((base + (sp * 0.1) + (cp * 0.01)) * 100) / 100;
      } else if (price >= 1) {
        const sp = Math.floor(Math.random() * 8 + 1);
        const cp = Math.floor(Math.random() * 9 + 1);
        return Math.round((Math.floor(price) + (sp * 0.1) + (cp * 0.01)) * 100) / 100;
      } else {
        const cp = Math.floor(Math.random() * 9 + 1);
        const sp = Math.floor(price * 10);
        return Math.max(0.01, Math.round((sp * 0.1 + cp * 0.01) * 100) / 100);
      }
    } else {
      if (price >= 10) {
        return Math.round(price);
      } else if (price >= 1) {
        return Math.round(price * 2) / 2;
      } else {
        return Math.max(0.01, Math.round(price * 20) / 20);
      }
    }
  }

  /**
   * Безопасное вычисление формулы костей (на случай сбоя Roll или вызова вне Foundry)
   */
  _evaluateDiceFormula(formula) {
    if (!formula || typeof formula !== 'string') return 100;
    try {
      const rolled = formula.replace(/(\d*)d(\d+)/g, (match, count, sides) => {
        const num = parseInt(count) || 1;
        const s = parseInt(sides) || 6;
        let sum = 0;
        for (let i = 0; i < num; i++) {
          sum += Math.floor(Math.random() * s) + 1;
        }
        return String(sum);
      });
      return Math.round(Function('"use strict"; return (' + rolled + ')')());
    } catch {
      return 100;
    }
  }

  /**
   * Получение уровня актера (D&D 5e)
   */
  getActorLevel(actor) {
    return actor?.system?.details?.level || 1;
  }

  /**
   * Проверка можно ли стакать предмет (D&D 5e)
   */
  isStackable(item) {
    if (!item) return true;
    // Оружие, броня и инструменты обычно не стакаются в 5е
    const nonStackableTypes = ['weapon', 'equipment', 'tool'];
    return !nonStackableTypes.includes(item.type);
  }

  /**
   * Получение "нулевого" объекта валют (D&D 5e)
   */
  getZeroCurrency() {
    return { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
  }
}
