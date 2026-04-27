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
    throw new Error("getItemPrice must be implemented by system adapter");
  }

  /**
   * Получение валюты актера
   */
  getActorCurrency(actor) {
    throw new Error("getActorCurrency must be implemented by system adapter");
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
   * Получение редкости предмета
   */
  getItemRarity(item) {
    return item.system?.rarity || "common";
  }

  /**
   * Форматирование отображения цены
   */
  formatPrice(price) {
    return `${price} gp`;
  }

  /**
   * Форматирование отображения цены в HTML (с иконками)
   */
  formatPriceHtml(price) {
    return this.formatPrice(price);
  }

  /**
   * Форматирование базовых единиц (атомов) в HTML
   */
  formatBaseUnitHtml(amount) {
    return this.formatPriceHtml(amount);
  }

  /**
   * Конвертация валюты в базовые единицы (атомы/медь)
   * @param {Object} currency - Объект валюты (например {gp: 1, sp: 5})
   * @returns {number} Количество в базовой единице
   */
  toBaseUnit(currency) {
    throw new Error("toBaseUnit must be implemented by system adapter");
  }

  /**
   * Конвертация из базовых единиц в объект валюты (каскад/Up-conversion)
   * @param {number} total - Общее количество в базовой единице
   * @returns {Object} Объект валюты системы
   */
  fromBaseUnit(total) {
    throw new Error("fromBaseUnit must be implemented by system adapter");
  }

  /**
   * Получение множителя репутации для актера
   * @param {Actor} actor 
   * @returns {number} Множитель (default 1.0)
   */
  getReputationModifier(actor) {
    const modifier = actor.getFlag('treasure-hoard-manager', 'reputationModifier');
    return typeof modifier === 'number' ? modifier : 1.0;
  }

  /**
   * Получение пути к полю количества предмета
   */
  getQuantityPath() {
    return "system.quantity";
  }

  // === НОВЫЕ МЕТОДЫ ДЛЯ КЛАССИФИКАЦИИ ПРЕДМЕТОВ ===

  isWeapon(item) { return false; }
  isArmor(item) { return false; }
  isConsumable(item) { return false; }
  isPotion(item) { return false; }
  isScroll(item) { return false; }
  isFood(item) { return false; }
  isGem(item) { return false; }
  isMaterial(item) { return false; }

  /**
   * Получение конфигурации типов торговцев и их категорий
   */
  getShopConfiguration() {
    return {
      shopTypes: {},
      categoryConfig: {}
    };
  }

  /**
   * Получение системных таблиц цен
   */
  getPricingConfig() {
    return {
      methods: ['default'],
      tables: {}
    };
  }

  /**
   * Безопасное списание валюты
   * @param {Actor} actor - Актер, у которого списываем
   * @param {number} baseAmount - Сумма в базовых единицах системы (медь/ат)
   * @returns {Promise<boolean>} - Успех операции
   */
  async subtractCurrency(actor, baseAmount) {
    throw new Error("subtractCurrency must be implemented by system adapter");
  }

  /**
   * Генерация богатства мерчанта
   * @param {Actor} actor 
   */
  async generateMerchantWealth(actor) {
    // Базовая реализация (может быть переопределена)
    return Promise.resolve();
  }
}
