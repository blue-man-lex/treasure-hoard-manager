/**
 * Treasure Hoard Manager - Cyberpunk Red System Adapter
 * Адаптер для системы Cyberpunk Red
 */

import { SystemAdapter } from '../system-adapter.js';

export class CyberpunkRedAdapter extends SystemAdapter {
  
  constructor() {
    super();
    this.systemId = "cyberpunk-red-core";
  }

  /**
   * Конвертация валюты в базовые единицы (Eurobucks)
   * В CPR нет конвертации 10x, поэтому мы просто возвращаем количество эдди.
   */
  toBaseUnit(currency) {
    if (!currency) return 0;
    // Поддержка как чистого числа (если кто-то передаст), так и объекта {eb: 100}
    if (typeof currency === 'number') return currency;
    return currency.eb || currency.value || 0;
  }

  /**
   * Конвертация из базовых единиц в объект валюты системы
   * В CPR мы возвращаем всё в одну валюту - eurobucks.
   */
  fromBaseUnit(total) {
    const value = Math.max(0, Math.floor(total));
    return { eb: value };
  }

  /**
   * Получение цены предмета
   */
  getItemPrice(item) {
    // В CPR цены обычно хранятся в system.price.market или system.price.value
    return item.system?.price?.market || item.system?.price?.value || 0;
  }

  /**
   * Получение валюты актера
   */
  getActorCurrency(actor) {
    // В CPR деньги хранятся по разному, обычно в system.wealth.value 
    // Но для совместимости мы можем возвращать объект {eb: value}
    const wealth = foundry.utils.getProperty(actor, "system.wealth.value") || 0;
    return { eb: wealth };
  }
  
  /**
   * Обновление валюты актера
   * Этот метод можно переопределить, если структура системы отличается
   */
  async updateActorCurrency(actor, currencyObj) {
    const amount = currencyObj.eb || 0;
    return actor.update({ "system.wealth.value": amount });
  }

  /**
   * Форматирование отображения цены
   */
  formatPrice(price) {
    if (typeof price !== 'number') price = this.getItemPrice(price);
    
    // В CPR мы просто выводим число с 'eb'
    const total = Math.floor(price);
    return `${total} eb`;
  }

  /**
   * Форматирование отображения цены в HTML (с иконками)
   */
  formatPriceHtml(price) {
    if (typeof price !== 'number') price = this.getItemPrice(price);
    const total = Math.floor(price);
    return `<span class="currency eb"><span class="amount">${total}</span> eb</span>`;
  }

  /**
   * Форматирование базовых единиц (эдди) в HTML
   */
  formatBaseUnitHtml(amount) {
    return this.formatPriceHtml(amount);
  }

  /**
   * Навык по умолчанию для взлома
   * Тестер предложил 'Basic Tech' (Базовая технология)
   */
  getDefaultLockpickSkill() {
    return "basictech"; 
  }
}
