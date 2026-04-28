/**
 * Treasure Hoard Manager - System Adapter Base Class
 * Базовый класс адаптера для игровых систем
 */

export class SystemAdapter {

  constructor() {
    this.systemId = game.system.id;
    this.systemVersion = game.system.version;
  }

  /**
   * Получение количества предмета
   */
  getItemQuantity(item) {
    throw new Error("getItemQuantity must be implemented by system adapter");
  }

  /**
   * Установка количества предмета
   */
  setItemQuantity(item, quantity) {
    throw new Error("setItemQuantity must be implemented by system adapter");
  }

  /**
   * Получение цены предмета
   */
  getItemPrice(item) {
    if (!item || !item.system) return 0;
    return item.system.price?.value ?? 0;
  }

  /**
   * Путь для сохранения цены в предмете
   */
  getPricePath() {
    return "system.price.value";
  }

  /**
   * Получение валюты актера
   */
  getActorCurrency(actor) {
    const path = this.getCurrencyPath();
    return foundry.utils.getProperty(actor, path) || {};
  }

  /**
   * Обновление валюты актера
   */
  async updateActorCurrency(actor, currencyData) {
    const path = this.getCurrencyPath();
    return actor.update({ [path]: currencyData });
  }

  /**
   * Списание валюты с актера (атомы)
   */
  async spendWealth(actor, amountAtoms) {
    const currency = this.getActorCurrency(actor);
    const totalAtoms = this.convertCurrencyToAtoms(currency);

    if (totalAtoms < amountAtoms) return false;

    const remainingAtoms = totalAtoms - amountAtoms;
    const newCurrency = this.convertAtomsToCurrency(remainingAtoms);

    await this.updateActorCurrency(actor, newCurrency);
    return true;
  }

  /**
   * Получение пути к данным валюты в системе
   */
  getCurrencyPath() {
    return "system.currency";
  }

  /**
   * Фильтрация предметов для хранилища
   */
  getItemFilters() {
    // Базовые фильтры (переопределяются в системных адаптерах)
    return [
      {
        path: "type",
        filters: "spell,feat,class,subclass,background,race"
      }
    ];
  }

  /**
   * Получение типа актера по умолчанию для создания хранилищ
   */
  getDefaultActorType() {
    return "npc";
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
    return true;
  }

  /**
   * Получение локализованного названия типа предмета
   */
  getItemTypeName(item) {
    return item.type || "item";
  }

  /**
   * Получение отфильтрованного инвентаря актера
   */
  getFilteredInventory(actor) {
    return actor.items.contents.filter(i => this.canItemBeInHoard(i));
  }

  /**
   * Получение данных о редкости предмета
   * @returns {Object} { label: string, class: string }
   */
  getItemRarityData(item) {
    return { label: 'Common', class: 'common' };
  }

  /**
   * Получение только строкового идентификатора редкости (common, rare и т.д.)
   */
  getItemRarity(item) {
    return this.getItemRarityData(item).class;
  }

  /**
   * Форматирование отображения цены
   */
  formatPrice(price) {
    return `${price} gp`;
  }

  /**
   * Получение пути к полю количества предмета
   */
  getQuantityPath() {
    return "system.quantity";
  }

  /**
   * Получение конфигурации валют системы
   */
  getCurrencyConfig() {
    return {
      gp: { weight: 100, label: "Gold", img: "icons/svg/coins.svg" }
    };
  }

  /**
   * Получение ключа основной валюты системы
   */
  getPrimaryCurrencyKey() {
    return "gp"; // По умолчанию золото
  }

  /**
   * Перевод объекта валют в "атомы"
   */
  convertCurrencyToAtoms(currencyData) {
    return 0;
  }

  /**
   * Перевод "атомов" в объект валют
   */
  convertAtomsToCurrency(atoms) {
    return {};
  }

  /**
   * Форматирование объекта валют в красивый HTML с иконками
   */
  formatCurrencyHtml(currencyData) {
    return "💰";
  }

  /**
   * Получение коэффициента конвертации для указанной валюты
   */
  getCurrencyConversion(key) {
    // В агностик-режиме считаем всё 1 к 1, если не переопределено
    return 1;
  }

  // === НОВЫЕ МЕТОДЫ ДЛЯ КЛАССИФИКАЦИИ ПРЕДМЕТОВ ===

  isWeapon(item) { return item.type === 'weapon' || item.name?.toLowerCase().includes('меч'); }
  isArmor(item) { return item.type === 'equipment' || item.name?.toLowerCase().includes('доспех'); }
  isConsumable(item) { return item.type === 'consumable'; }
  isPotion(item) { return item.name?.toLowerCase().includes('зелье') || item.name?.toLowerCase().includes('potion'); }
  isScroll(item) { return item.name?.toLowerCase().includes('свиток') || item.name?.toLowerCase().includes('scroll'); }
  isFood(item) { return false; }
  isGem(item) { return false; }
  isMaterial(item) { return false; }

  /**
   * Получение конфигурации типов торговцев и их категорий
   */
  getShopConfiguration() {
    return {
      shopTypes: {
        general: { name: 'Торговец', icon: 'icons/svg/vendor.svg', description: 'Общие товары' }
      },
      categoryConfig: {
        general: { categoryWeapons: true, categoryArmor: true, categoryPotions: true }
      }
    };
  }

  /**
   * Получение системных таблиц цен
   */
  getPricingConfig() {
    return {
      methods: ['default'],
      tables: {
        default: { common: 10, uncommon: 50, rare: 100, veryrare: 500, legendary: 1000 }
      }
    };
  }

  /**
   * Генерация стартового капитала для торговца
   */
  async generateMerchantWealth(actor) {
    return true; // Агностик-заглушка
  }

  /**
   * Безопасное списание валюты
   */
  async subtractCurrency(actor, baseAmount) {
    // В агностик-режиме мы не знаем структуру валют, поэтому просто возвращаем true (на совести мастера)
    // Либо можно попробовать вычесть из первого попавшегося поля в system.currency
    return true; 
  }



  /**
   * Получение уровня актера
   */
  getActorLevel(actor) {
    return 1;
  }

  /**
   * Проверка можно ли стакать предмет
   */
  isStackable(item) {
    return !['weapon', 'equipment', 'armor'].includes(item?.type);
  }

  /**
   * Получение "нулевого" объекта валют
   */
  getZeroCurrency() {
    const config = this.getCurrencyConfig();
    const result = {};
    for (const key of Object.keys(config)) {
      result[key] = 0;
    }
    return result;
  }

  /**
   * Генерация цены предмета на основе настроек системы
   */
  async generateItemPrice(item, method = 'default') {
    return 10;
  }
}
