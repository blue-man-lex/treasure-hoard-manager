/**
 * Treasure Hoard Manager - D&D 5e System Adapter
 * Адаптер для системы Dungeons & Dragons 5th Edition
 */

import { SystemAdapter } from '../system-adapter.js';

export class Dnd5eAdapter extends SystemAdapter {
  
  constructor() {
    super();
    this.systemId = "dnd5e";
  }

  /**
   * Получение количества предмета
   */
  getItemQuantity(item) {
    return item.system.quantity || 1;
  }

  /**
   * Установка количества предмета
   */
  setItemQuantity(item, quantity) {
    return item.update({"system.quantity": quantity});
  }

  /**
   * Получение цены предмета
   */
  getItemPrice(item) {
    return item.system.price?.value || 0;
  }

  /**
   * Получение валюты актера
   */
  getActorCurrency(actor) {
    return actor.system.currency || {
      pp: 0,
      gp: 0,
      ep: 0,
      sp: 0,
      cp: 0
    };
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
   * Получение редкости предмета
   */
  getItemRarity(item) {
    return item.system.rarity || "common";
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
   * Конвертация валюты в базовые единицы (медь)
   */
  toBaseUnit(currency) {
    if (!currency) return 0;
    return (currency.cp || 0) + 
           (currency.sp || 0) * 10 + 
           (currency.ep || 0) * 50 + 
           (currency.gp || 0) * 100 + 
           (currency.pp || 0) * 1000;
  }

  /**
   * Конвертация из базовых единиц (меди) в объект валюты (каскад)
   */
  fromBaseUnit(total) {
    let remaining = Math.max(0, Math.floor(total));
    
    const pp = Math.floor(remaining / 1000);
    remaining %= 1000;
    
    const gp = Math.floor(remaining / 100);
    remaining %= 100;
    
    const ep = Math.floor(remaining / 50);
    remaining %= 50;
    
    const sp = Math.floor(remaining / 10);
    const cp = remaining % 10;
    
    return { pp, gp, ep, sp, cp };
  }

  /**
   * Форматирование отображения цены
   */
  formatPrice(price) {
    if (typeof price !== 'number') price = this.getItemPrice(price);
    
    // В dnd5e базовая цена предмета обычно в золотых. Переводим в медь для каскада.
    const totalCp = Math.floor(price * 100);
    const currencyObj = this.fromBaseUnit(totalCp);
    
    const currencies = {
      pp: { name: "pp", value: currencyObj.pp },
      gp: { name: "gp", value: currencyObj.gp },
      ep: { name: "ep", value: currencyObj.ep },
      sp: { name: "sp", value: currencyObj.sp },
      cp: { name: "cp", value: currencyObj.cp }
    };
    
    let result = "";
    for (const [key, currency] of Object.entries(currencies)) {
      if (currency.value > 0) {
        result += `${currency.value}${currency.name} `;
      }
    }
    
    return result.trim() || "0 gp";
  }

  /**
   * Форматирование отображения цены в HTML (с иконками)
   */
  formatPriceHtml(price) {
    if (typeof price !== 'number') price = this.getItemPrice(price);
    const totalCp = Math.floor(price * 100);
    const currencyObj = this.fromBaseUnit(totalCp);
    
    const parts = [];
    if (currencyObj.pp > 0) parts.push(`<span class="currency pp currency-pp"><span class="amount">${currencyObj.pp}</span></span>`);
    if (currencyObj.gp > 0) parts.push(`<span class="currency gp currency-gp"><span class="amount">${currencyObj.gp}</span></span>`);
    if (currencyObj.ep > 0) parts.push(`<span class="currency ep currency-ep"><span class="amount">${currencyObj.ep}</span></span>`);
    if (currencyObj.sp > 0) parts.push(`<span class="currency sp currency-sp"><span class="amount">${currencyObj.sp}</span></span>`);
    if (currencyObj.cp > 0) parts.push(`<span class="currency cp currency-cp"><span class="amount">${currencyObj.cp}</span></span>`);
    
    return parts.length > 0 ? parts.join(' ') : `<span class="currency gp currency-gp"><span class="amount">0</span></span>`;
  }

  /**
   * Форматирование базовых единиц (меди) в HTML
   */
  formatBaseUnitHtml(amount) {
    const currencyObj = this.fromBaseUnit(Math.abs(amount));
    const parts = [];
    
    if (currencyObj.pp > 0) parts.push(`<span class="currency pp currency-pp"><span class="amount">${currencyObj.pp}</span></span>`);
    if (currencyObj.gp > 0) parts.push(`<span class="currency gp currency-gp"><span class="amount">${currencyObj.gp}</span></span>`);
    if (currencyObj.ep > 0) parts.push(`<span class="currency ep currency-ep"><span class="amount">${currencyObj.ep}</span></span>`);
    if (currencyObj.sp > 0) parts.push(`<span class="currency sp currency-sp"><span class="amount">${currencyObj.sp}</span></span>`);
    if (currencyObj.cp > 0 || parts.length === 0) parts.push(`<span class="currency cp currency-cp"><span class="amount">${currencyObj.cp}</span></span>`);
    
    return parts.join(' ');
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
    
    const rarity = this.getItemRarity(item);
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
   * Получение расходуемых материалов
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
    
    const rarity = this.getItemRarity(item);
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
          description: 'Оружие, доспехи и металлические изделия'
        },
        armorer: {
          name: 'Бронник',
          icon: 'icons/equipment/chest/breastplate-helmet-metal.webp',
          description: 'Доспехи и защитное снаряжение'
        },
        alchemist: {
          name: 'Знахарь',
          icon: 'icons/skills/toxins/cauldron-pot-bubbles-green.webp',
          description: 'Зелья, яды и алхимические ингредиенты'
        },
        scribe: {
          name: 'Писец',
          icon: 'icons/sundries/scrolls/scroll-yellow-teal.webp',
          description: 'Свитки заклинаний и письменные принадлежности'
        },
        cook: {
          name: 'Повар',
          icon: 'icons/skills/trades/farming-wheat-circle-yellow.webp',
          description: 'Еда и кулинарные изделия'
        },
        merchant: {
          name: 'Рыночный торговец',
          icon: 'icons/environment/settlement/market-stall.webp',
          description: 'Различные товары и безделушки'
        },
        general: {
          name: 'Общий торговец',
          icon: 'icons/skills/social/trading-justice-scale-yellow.webp',
          description: 'Смешанный ассортимент товаров'
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
          veryRare: '(1d4+1) * 10000',
          legendary: '2d6 * 25000',
          artifact: '2d6 * 250000'
        },
        dmg: {
          common: [50, 100],
          uncommon: [101, 500],
          rare: [501, 1500],
          veryRare: [1501, 8000],
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
    const totalPlayerCp = this.toBaseUnit(currentCurrency);

    if (totalPlayerCp < baseAmountCp) {
      return false;
    }

    const newTotalCp = totalPlayerCp - baseAmountCp;
    const newCurrency = this.fromBaseUnit(newTotalCp);

    await actor.update({ 'system.currency': newCurrency });
    return true;
  }

  /**
   * Генерация богатства для торговца D&D 5e
   */
  async generateMerchantWealth(actor) {
    // Рандомная сумма для торговца (например, 100-1000 золотых)
    const gp = Math.floor(Math.random() * 900) + 100;
    const cp = gp * 100;
    const currency = this.fromBaseUnit(cp);
    
    await actor.update({ 'system.currency': currency });
  }
}
