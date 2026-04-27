/**
 * Treasure Hoard Manager - UI Manager
 * Управление пользовательским интерфейсом
 */

import { CONSTANTS } from '../core/constants.js';
import { TreasureHoardConfig } from './config-app.js';

export class UIManager {
  
  constructor(mainManager) {
    this.mainManager = mainManager;
    this.activeWindows = new Map();
    this.hudElements = new Map();
  }

  /**
   * Показ конфигурации хранилища
   */
  async showConfig(actor) {
    console.log('THM Debug | showConfig called with actor:', actor);
    
    const existingWindow = this.activeWindows.get(actor.id);
    
    if (existingWindow) {
      existingWindow.render(true);
      return;
    }
    
    const configWindow = new TreasureHoardConfig(actor, {
      height: 700,
      width: 600
    });
    
    this.activeWindows.set(actor.id, configWindow);
    
    configWindow.render(true);
    
    // Очистка после закрытия - ПРАВИЛЬНЫЙ ОБРАБОТЧИК ДЛЯ FORMAPPLICATION
    configWindow.options.close = () => {
      this.activeWindows.delete(actor.id);
    };
  }

  /**
   * Показ интерфейса магазина
   */
  async showShopInterface(actor, options = {}) {
    if (!actor) return;
    
    console.log(`THM UI | showShopInterface called for ${actor.name}`);
    
    // Динамический импорт класса
    const { ShopInterface } = await import('./shop-interface.js');
    
    // Ищем УЖЕ ОТКРЫТОЕ окно магазина
    const existing = Object.values(ui.windows).find(w => 
      (w instanceof ShopInterface || w.constructor.name === 'ShopInterface') && 
      w.actor?.id === actor.id
    );
    
    // Если окно уже есть - выводим на передний план
    if (existing) {
      console.log(`THM UI | Shop window already exists for ${actor.name}, bringing to front`);
      existing.render(true, { focus: true });
      return existing;
    }

    // Создаем новое
    console.log(`THM UI | Creating new ShopInterface for ${actor.name}`);
    const app = new ShopInterface(actor, { bypassPermission: true, ...options });
    app.render(true);
    return app;
  }

  /**
   * Показ интерфейса хранилища игрокам
   */
  async showHoardInterface(actor, userIds) {
    if (!actor) return;
    
    console.log(`THM UI | showHoardInterface called for ${actor.name}`);
    
    // Динамический импорт класса
    const { ContainerInterface } = await import('./container-interface.js');
    
    // Ищем УЖЕ ОТКРЫТОЕ окно для этого актера
    const existing = Object.values(ui.windows).find(w => 
      (w instanceof ContainerInterface || w.constructor.name === 'ContainerInterface') && 
      w.actor?.id === actor.id
    );
    
    // Если окно уже есть - выводим на передний план
    if (existing) {
      console.log(`THM UI | Hoard window already exists for ${actor.name}, bringing to front`);
      existing.render(true, { focus: true });
      return existing;
    }
    
    // Создаем новое
    console.log(`THM UI | Creating new ContainerInterface for ${actor.name}`);
    const app = new ContainerInterface(actor, { bypassPermission: true });
    app.render(true);
    return app;
  }

  /**
   * Показ интерфейса торговли
   */
  async showTradeInterface(tradeId) {
    console.log(`THM UI | showTradeInterface called for trade ${tradeId}`);
    
    // Динамический импорт класса
    const { TradeInterface } = await import('./trade-interface.js');
    
    // Ищем УЖЕ ОТКРЫТОЕ окно для этой торговли
    const existing = Object.values(ui.windows).find(w => 
      (w instanceof TradeInterface || w.constructor.name === 'TradeInterface') && 
      w.tradeId === tradeId
    );
    
    // Если окно уже есть - выводим на передний план
    if (existing) {
      console.log(`THM UI | Trade window already exists for ${tradeId}, bringing to front`);
      existing.render(true, { focus: true });
      return existing;
    }
    
    // Создаем новое
    console.log(`THM UI | Creating new TradeInterface for ${tradeId}`);
    const app = new TradeInterface(tradeId);
    app.render(true);
    return app;
  }

  /**
   * Показ интерфейса чёрного рынка
   */
  async showBlackMarketInterface(actor, options = {}) {
    if (!actor) return;
    
    console.log(`THM UI | showBlackMarketInterface called for ${actor.name}`);
    
    // Динамический импорт класса
    const { BlackMarketInterface } = await import('./blackmarket-interface.js');
    
    // Ищем УЖЕ ОТКРЫТОЕ окно Чёрного рынка (правильная проверка через ui.windows)
    const existing = Object.values(ui.windows).find(w => 
      (w instanceof BlackMarketInterface || w.constructor.name === 'BlackMarketInterface') && 
      w.actor?.id === actor.id
    );
    
    // Если окно уже есть - выводим на передний план
    if (existing) {
      console.log(`THM UI | Black Market window already exists for ${actor.name}, bringing to front`);
      existing.render(true, { focus: true });
      return existing;
    }
    
    // Создаем новое
    console.log(`THM UI | Creating new BlackMarketInterface for ${actor.name}`);
    const app = new BlackMarketInterface(actor, { bypassPermission: true, ...options });
    app.render(true);
    return app;
  }

  /**
   * Показ интерфейса контейнера
   */
  async showContainerInterface(actor, options = {}) {
    if (!actor) return;
    
    console.log(`THM UI | showContainerInterface called for ${actor.name}`);
    
    // Динамический импорт класса
    const { ContainerInterface } = await import('./container-interface.js');
    
    // Ищем УЖЕ ОТКРЫТОЕ окно для этого актера (используем проверку имени конструктора для надежности)
    const existing = Object.values(ui.windows).find(w => 
      (w instanceof ContainerInterface || w.constructor.name === 'ContainerInterface') && 
      w.actor?.id === actor.id
    );
    
    // Если окно уже есть - просто выводим его на передний план и обновляем
    if (existing) {
      console.log(`THM UI | Window already exists for ${actor.name}, bringing to front`);
      existing.render(true, { focus: true });
      return existing;
    }
    
    // Если окна нет - создаем одно новое
    console.log(`THM UI | Creating new ContainerInterface for ${actor.name}`);
    const app = new ContainerInterface(actor, { bypassPermission: true, ...options });
    app.render(true);
    return app;
  }

  /**
   * Рендер HUD для токенов
   */
  renderTokenHUD(app, html, actor) {
    const tokenId = app.object.id;
    
    // Проверка что это хранилище THM
    if (!this.mainManager.isValidHoard(actor)) {
      return;
    }
    
    // Удаление существующих элементов THM
    this.removeTokenHUD(tokenId);
    
    const hoardType = this.mainManager.getHoardType(actor);
    const container = $(`<div class="col right thm-hud-container" data-token-id="${tokenId}"></div>`);
    
    // Кнопка настроек
    const configButton = this.createHUDButton({
      icon: CONSTANTS.ICONS.SETTINGS,
      title: 'Настроить хранилище',
      onClick: () => this.showConfig(actor)
    });
    
    // Кнопка открытия/закрытия
    const toggleButton = this.createHUDButton({
      icon: actor.getFlag(CONSTANTS.MODULE_NAME, 'data.closed') ? 'fas fa-lock-open' : 'fas fa-lock',
      title: actor.getFlag(CONSTANTS.MODULE_NAME, 'data.closed') ? 'Открыть' : 'Закрыть',
      onClick: () => this.toggleHoard(actor)
    });
    
    // Кнопка показа игрокам
    const showButton = this.createHUDButton({
      icon: CONSTANTS.ICONS.SHOW,
      title: 'Показать игрокам',
      onClick: () => this.showToPlayers(actor)
    });
    
    container.append(configButton, toggleButton, showButton);
    $(html).append(container);
    
    // Сохранение элементов для последующего удаления
    this.hudElements.set(tokenId, container);
  }

  /**
   * Создание кнопки для HUD
   */
  createHUDButton({ icon, title, onClick }) {
    return $(`
      <button class="control-icon ${CONSTANTS.CSS.HUD_BUTTON}" 
              data-fast-tooltip="${title}" 
              type="button">
        <i class="${icon}"></i>
      </button>
    `).on('click', onClick);
  }

  /**
   * Переключение состояния хранилища
   */
  async toggleHoard(actor) {
    const currentState = actor.getFlag(CONSTANTS.MODULE_NAME, 'data.closed') || false;
    const newState = !currentState;
    
    await actor.update({
      [`flags.${CONSTANTS.MODULE_NAME}.data.closed`]: newState
    });
    
    ui.notifications.info(`Хранилище ${actor.name} ${newState ? 'закрыто' : 'открыто'}`);
    
    // Обновление HUD
    this.refreshTokenHUD(actor);
  }

  /**
   * Показ хранилища игрокам
   */
  async showToPlayers(actor) {
    const activeUsers = game.users.filter(u => u.active && u !== game.user);
    
    if (!activeUsers.length) {
      ui.notifications.warn('Нет активных игроков для показа хранилища');
      return;
    }
    
    // Создание диалога выбора пользователей
    const content = `
      <div class="thm-user-select">
        <h3>Показать ${actor.name} игрокам</h3>
        <div class="user-list">
          ${activeUsers.map(user => `
            <label class="user-checkbox">
              <input type="checkbox" name="users" value="${user.id}">
              <img src="${user.avatar}" style="width: 24px; height: 24px; border-radius: 50%;">
              <span>${user.name}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
    
    new Dialog({
      title: 'Показать игрокам',
      content: content,
      buttons: [
        {
          label: 'Показать',
          callback: (html) => {
            const selectedUsers = [];
            html.find('input[name="users"]:checked').each((i, elem) => {
              selectedUsers.push(elem.value);
            });
            
            if (selectedUsers.length > 0) {
              this.showHoardInterface(actor, selectedUsers);
            }
          }
        },
        {
          label: 'Отмена',
          callback: () => {}
        }
      ]
    }).render(true);
  }

  /**
   * Обновление HUD для токена
   */
  refreshTokenHUD(actor) {
    const tokenId = actor.token?.id;
    if (!tokenId) return;
    
    // Поиск HUD элемента
    const hudElement = this.hudElements.get(tokenId);
    if (hudElement) {
      // Обновление иконки кнопки переключения (закрыто/открыто)
      const toggleButton = hudElement.find('.thm-hud-button:nth-child(2)');
      const newToggleIcon = actor.getFlag(CONSTANTS.MODULE_NAME, 'data.closed') ? 'fas fa-lock-open' : 'fas fa-lock';
      toggleButton.find('i').attr('class', newToggleIcon);
    }
  }

  /**
   * Удаление HUD элементов для токена
   */
  removeTokenHUD(tokenId) {
    const existingElement = this.hudElements.get(tokenId);
    if (existingElement) {
      existingElement.remove();
      this.hudElements.delete(tokenId);
    }
  }

  /**
   * Показ интерфейса ценообразования предмета
   */
  async showItemPricing(item) {
    const existingWindow = this.activeWindows.get(`item-pricing-${item.id}`);
    
    if (existingWindow) {
      existingWindow.render(true);
      return;
    }
    
    // Получение базовой цены через системный адаптер
    const basePrice = this.mainManager.systemAdapter.getBaseItemPrice(item);
    
    const content = `
      <div class="thm-item-pricing">
        <h2>Ценообразование: ${item.name}</h2>
        
        <div class="pricing-info">
          <div class="item-details">
            <img src="${item.img}" style="width: 64px; height: 64px;">
            <div class="item-text">
              <h3>${item.name}</h3>
              <p>Тип: ${this.mainManager.systemAdapter.getItemTypeName(item)}</p>
              <p>Редкость: ${this.mainManager.systemAdapter.getItemRarity(item)}</p>
            </div>
          </div>
          
          <div class="price-details">
            <h4>Базовая цена:</h4>
            <p class="base-price">${this.mainManager.systemAdapter.formatPrice(basePrice)}</p>
            
            <h4>Текущая цена:</h4>
            <p class="current-price">${this.mainManager.systemAdapter.formatPrice(this.mainManager.systemAdapter.getItemPrice(item))}</p>
            
            <div class="price-modifiers">
              <h5>Модификаторы:</h5>
              <label>Репутация: <input type="number" id="reputation-mod" value="1.0" step="0.1"></label>
              <label>Категория: <input type="number" id="category-mod" value="1.0" step="0.1"></label>
              <label>Магазин: <input type="number" id="shop-mod" value="1.0" step="0.1"></label>
            </div>
            
            <div class="final-price">
              <h4>Итоговая цена:</h4>
              <p class="final-price">${this.mainManager.systemAdapter.formatPrice(basePrice * 1.0)}</p>
            </div>
          </div>
        </div>
      </div>
    `;
    
    const pricingWindow = new Dialog({
      title: 'Ценообразование предмета',
      content: content,
      buttons: [
        {
          label: 'Сохранить',
          callback: (html) => {
            const reputationMod = parseFloat(html.find('#reputation-mod').val()) || 1.0;
            const categoryMod = parseFloat(html.find('#category-mod').val()) || 1.0;
            const shopMod = parseFloat(html.find('#shop-mod').val()) || 1.0;
            
            // Сохранение настроек ценообразования в flags предмета
            item.update({
              [`flags.${CONSTANTS.MODULE_NAME}.pricing`]: {
                basePrice,
                modifiers: {
                  reputation: reputationMod,
                  category: categoryMod,
                  shop: shopMod
                }
              }
            });
            
            ui.notifications.info(`Настройки ценообразования для ${item.name} сохранены`);
          }
        },
        {
          label: 'Отмена',
          callback: () => {}
        }
      ],
      width: 600,
      height: 500
    });
    
    this.activeWindows.set(`item-pricing-${item.id}`, pricingWindow);
    
    pricingWindow.render(true);
    
    // Очистка после закрытия
    pricingWindow.on('close', () => {
      this.activeWindows.delete(`item-pricing-${item.id}`);
    });
  }

  /**
   * Обновление интерфейса хранилища
   */
  refreshHoardInterface(actor) {
    // Обновление всех открытых окон для этого актера
    this.activeWindows.forEach((window, key) => {
      if (key.includes(actor.id)) {
        window.render();
      }
    });
  }

  /**
   * Закрытие всех окон
   */
  closeAllWindows() {
    this.activeWindows.forEach((window, key) => {
      window.close();
    });
    this.activeWindows.clear();
  }

  /**
   * Получение информации об активных окнах
   */
  getActiveWindows() {
    return {
      count: this.activeWindows.size,
      windows: Array.from(this.activeWindows.entries())
    };
  }

  /**
   * Показ уведомления
   */
  showNotification(message, type = 'info') {
    const notificationClass = `thm-notification thm-notification-${type}`;
    
    const notification = $(`
      <div class="${notificationClass}">
        <div class="thm-notification-icon">
          <i class="fas fa-info-circle"></i>
        </div>
        <div class="thm-notification-content">
          ${message}
        </div>
        <div class="thm-notification-close">
          <i class="fas fa-times"></i>
        </div>
      </div>
    `);
    
    // Добавление обработчика закрытия
    notification.find('.thm-notification-close').on('click', () => {
      notification.fadeOut(300, () => notification.remove());
    });
    
    // Автоматическое скрытие через 5 секунд
    setTimeout(() => {
      notification.fadeOut(300, () => notification.remove());
    }, 5000);
    
    $('body').append(notification);
    
    // Анимация появления
    notification.hide().fadeIn(300);
  }

  /**
   * Инициализация UI менеджера
   */
  async initialize() {
    console.log('THM UI Manager | Initializing...');
    
    // Регистрация стилей
    this.registerStyles();
    
    // Регистрация глобальных обработчиков
    this.registerGlobalHandlers();
    
    console.log('THM UI Manager | UI initialized');
  }

  /**
   * Регистрация стилей
   */
  registerStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .thm-hud-container {
        display: flex;
        gap: 2px;
      }
      
      .thm-hud-button {
        background: var(--thm-primary-color);
        border: 1px solid var(--thm-border-color);
        border-radius: 4px;
        color: var(--thm-text-color);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        height: 40px;
        width: 40px;
        transition: all 0.3s ease;
      }
      
      .thm-hud-button:hover {
        background: var(--thm-secondary-color);
        transform: scale(1.1);
      }
      
      .thm-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--thm-background-color);
        border: 2px solid var(--thm-border-color);
        border-radius: 8px;
        color: var(--thm-text-color);
        padding: 15px;
        max-width: 300px;
        box-shadow: var(--thm-shadow);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .thm-notification-success {
        border-color: var(--thm-success-color);
      }
      
      .thm-notification-error {
        border-color: var(--thm-error-color);
      }
      
      .thm-notification-close {
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.3s;
      }
      
      .thm-notification-close:hover {
        opacity: 1;
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Обновление всех открытых интерфейсов для актера
   */
  refreshActorInterfaces(actorId) {
    // Находим все открытые окна приложений
    const windows = Object.values(ui.windows);
    const actorWindows = windows.filter(window => 
      window.actor && window.actor.id === actorId
    );
    
    // Обновляем каждое окно
    actorWindows.forEach(window => {
      if (window.rendered) {
        window.render();
      }
    });
  }

  /**
   * Регистрация глобальных обработчиков
   */
  registerGlobalHandlers() {
    // Обработчик для обновления HUD при изменении токенов
    Hooks.on('updateToken', (token, updateData) => {
      if (updateData.actorId) {
        const actor = game.actors.get(updateData.actorId);
        if (this.mainManager.isValidHoard(actor)) {
          this.refreshTokenHUD(actor);
        }
      }
    });
    
    // Обработчик для закрытия окон при смене сцены
    Hooks.on('changeScene', () => {
      this.closeAllWindows();
    });
  }
}
