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
   * Получение цены предмета (с автогенерацией если 0)
   */
  getItemPrice(item) {
    const price = item.system?.price?.value || 0;
    if (price > 0) return price;

    // Попытка получить цену на основе редкости
    const rarity = this.getItemRarityData(item).class;
    const pricing = this.getPricingConfig();
    const table = pricing.tables.dmg;
    const priceRange = table[rarity] || table.common;
    
    if (Array.isArray(priceRange)) {
        return Math.floor((priceRange[0] + priceRange[1]) / 2);
    }
    return 10;
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
   * Проверка может ли предмет быть в хранилище
   */
  canItemBeInHoard(item) {
    // Исключаем заклинания, умения, классы и расы
    const excludedTypes = ["spell", "feat", "class", "subclass", "background", "race"];
    if (excludedTypes.includes(item.type)) return false;

    // Исключаем природное оружие
    if (item.type === "weapon" && item.system.weaponType === "natural") return false;

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
    const rarityValue = item.system.rarity?.toLowerCase?.() || item.system.rarity?.value?.toLowerCase?.() || 'common';

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
   * Перевод "атомов" (меди) в объект валют
   */
  convertAtomsToCurrency(atoms) {
    const config = this.getCurrencyConfig();
    let remaining = Math.abs(atoms);
    const result = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };

    const sortedKeys = Object.keys(config).sort((a, b) => config[b].weight - config[a].weight);

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
  formatCurrencyHtml(currencyData, forceDisplayAll = false) {
    let data = currencyData;
    // Если передали число, конвертируем
    if (typeof currencyData === 'number') {
      data = this.convertAtomsToCurrency(currencyData);
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
    const typeValue = item.system?.type?.value || '';
    const nameLower = (item.name || '').toLowerCase();
    return item.type === 'consumable' &&
      (typeValue === 'food' || nameLower.includes('еда') ||
        nameLower.includes('рацион') || nameLower.includes('мясо'));
  }

  isGem(item) {
    const nameLower = (item.name || '').toLowerCase();
    return item.type === 'loot' &&
      (nameLower.includes('камен') || nameLower.includes('самоцвет') ||
        nameLower.includes('бриллиант') || nameLower.includes('рубин') ||
        nameLower.includes('gem'));
  }

  isMaterial(item) {
    const nameLower = (item.name || '').toLowerCase();
    return item.type === 'loot' &&
      (nameLower.includes('руда') || nameLower.includes('дерево') ||
        nameLower.includes('слиток') || nameLower.includes('ингредиент'));
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
   * Безопасное списание валюты в D&D 5e (с каскадным обновлением)
   */
  async subtractCurrency(actor, baseAmountCp) {
    const currentCurrency = this.getActorCurrency(actor);
    const totalPlayerCp = this.convertCurrencyToAtoms(currentCurrency);

    if (totalPlayerCp < baseAmountCp) {
      return false;
    }

    const newTotalCp = totalPlayerCp - baseAmountCp;
    const newCurrency = this.convertAtomsToCurrency(newTotalCp);

    await actor.update({ 'system.currency': newCurrency });
    return true;
  }

  /**
   * Генерация богатства для торговца D&D 5e
   */
  async generateMerchantWealth(actor) {
    // ВАЖНО: В v12/v13 для синтетических актеров настройки хранятся в токене
    const settings = actor.token?.getFlag(CONSTANTS.MODULE_NAME, 'settings')?.specific || 
                     actor.getFlag(CONSTANTS.MODULE_NAME, 'settings')?.specific || {};
    
    // Если использование валюты выключено, деньги бесконечные (0)
    if (settings.useNpcCurrency === false) {
      // В 5e обычно обнуляем, если не используем NPC кошелек
      await actor.update({ "system.currency": { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 } });
      return;
    }

    // Приоритет: Уровень торговца из настроек -> Средний уровень игроков -> 1
    const level = settings.merchantLevel || game.THM?.manager?.shopManager?.getAveragePlayerLevel() || 1;
    
    // Расчет денег на основе уровня
    // Масштабирование: чем выше уровень, тем больше геометрическая прогрессия
    const baseGp = Math.floor(level * 150 * (1 + (level / 10)) + (Math.random() * 200));
    const pp = level >= 5 ? Math.floor(level / 2) * 10 + Math.floor(Math.random() * 20) : 0;

    const currency = {
      cp: Math.floor(Math.random() * 100),
      sp: Math.floor(Math.random() * 100) + 50,
      ep: Math.floor(Math.random() * 20),
      gp: baseGp,
      pp: pp
    };
    
    console.log(`THM | Generated wealth for level ${level}:`, currency);
    await actor.update({ 'system.currency': currency });
  }

  /**
   * Получение общего богатства актера в минимальных единицах (медяках для 5е)
   */
  getActorWealth(actor) {
    const currency = actor.system?.currency || {};
    // В DnD5e 1 pp = 10 gp, 1 gp = 2 ep, 1 ep = 5 sp, 1 sp = 10 cp
    // Но лучше брать из конфига, если он доступен
    const config = CONFIG.DND5E?.currencies || {
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
   * Списание богатства у актера (Умное списание БЕЗ схлопывания всего кошелька)
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

    // 2. Умное списание: пытаемся вычитать из существующих монет
    // Сортируем от меньшего к большему, чтобы сначала тратить медь
    const sortedKeys = ['cp', 'sp', 'ep', 'gp', 'pp'];
    let remainingToPay = amount;

    // Проходим по монетам и вычитаем что есть
    for (const key of sortedKeys) {
      const weight = config[key].weight;
      const val = Number(currency[key]) || 0;
      const available = val * weight;
      
      if (available > 0) {
        const canTake = Math.min(available, remainingToPay);
        const coinsToTake = Math.floor(canTake / weight);
        
        if (coinsToTake > 0) {
          currency[key] = val - coinsToTake;
          remainingToPay -= coinsToTake * weight;
        }
      }
    }

    // 3. Если все еще нужно доплатить (нужен размен)
    if (remainingToPay > 0) {
      // Идем сверху вниз и ищем первую монету, которую можно разменять
      const reverseKeys = ['pp', 'gp', 'ep', 'sp'];
      for (const key of reverseKeys) {
        const val = Number(currency[key]) || 0;
        if (val > 0) {
          // Размениваем ОДНУ монету
          currency[key] = val - 1;
          let change = config[key].weight - remainingToPay;
          remainingToPay = 0;
          
          // Распределяем сдачу (change) по монетам ниже уровнем
          const subKeys = sortedKeys.slice(0, sortedKeys.indexOf(key)).reverse();
          for (const sKey of subKeys) {
            const sWeight = config[sKey].weight;
            currency[sKey] = (Number(currency[sKey]) || 0) + Math.floor(change / sWeight);
            change %= sWeight;
          }
          break;
        }
      }
    }

    // Финальная проверка - если вдруг не удалось разменять (странный случай)
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
   * Получение коэффициента конвертации для указанной валюты
   */
  getCurrencyConversion(key) {
    const config = CONFIG.DND5E?.currencies || {
      pp: { conversion: 1000 },
      gp: { conversion: 100 },
      ep: { conversion: 50 },
      sp: { conversion: 10 },
      cp: { conversion: 1 }
    };
    return config[key]?.conversion || 1;
  }

  /**
   * Генерация цены предмета для D&D 5e
   */
  async generateItemPrice(item, method = 'dmg') {
    const pricingConfig = this.getPricingConfig();
    const rarity = this.getItemRarity(item);
    const itemType = item.type || 'loot';

    // Выбираем таблицу цен
    const tables = pricingConfig.tables;
    const priceTable = tables[method] || tables.dmg;
    const priceData = priceTable[rarity] || priceTable.common;

    if (!priceData) return 50;

    let basePrice = 0;

    if (method === 'xge' && typeof priceData === 'string') {
      try {
        const roll = new Roll(priceData);
        basePrice = (await roll.evaluate({ async: true })).total;
      } catch (error) {
        console.warn(`THM Adapter | XGE roll failed for ${item.name}:`, error);
        basePrice = 100;
      }
    } else {
      // DMG метод - случайное в диапазоне
      if (Array.isArray(priceData) && priceData.length >= 2) {
        const [min, max] = priceData;
        basePrice = Math.floor(Math.random() * (max - min + 1)) + min;
      } else {
        basePrice = typeof priceData === 'number' ? priceData : 100;
      }
    }

    // Применяем множитель типа предмета
    const typeMultiplier = tables.types[itemType] || 1.0;
    
    // Дополнительная логика для свитков и зелий (расходники стоят дешевле в генерации)
    let finalMultiplier = typeMultiplier;
    if (this.isPotion(item) || this.isScroll(item)) {
      finalMultiplier *= 0.8;
    }

    return Math.round(basePrice * finalMultiplier);
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
