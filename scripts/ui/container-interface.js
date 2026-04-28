import { CONSTANTS } from '../core/constants.js';
import ShopTooltipsNew from './shop-tooltips-new.js';

export class ContainerInterface extends FormApplication {
  constructor(actor, options = {}) {
    super(actor, options);
    this.actor = actor;
    this.looter = this._getLooter();

    // Уникальный ID для этого экземпляра
    this.instanceId = `container-${actor.id}-${Date.now()}`;

    // Универсальная система подсказок (используем мозг магазина)
    this.tooltips = new ShopTooltipsNew(this);

    // Принудительно загружаем CSS
    this._loadCSS();

    // Загружаем новые стили подсказок
    this._loadTooltipCSS();


  }


  _loadCSS() {
    const cssId = 'thm-container-interface-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = `modules/${CONSTANTS.MODULE_NAME}/styles/container-interface-premium.css`;
      document.head.appendChild(link);
    }
  }

  /**
   * Загрузка новых чистых стилей подсказок
   */
  _loadTooltipCSS() {
    const cssId = 'thm-container-tooltips-new-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = `modules/${CONSTANTS.MODULE_NAME}/styles/container-tooltips-new.css`;
      document.head.appendChild(link);
    }
  }

  /**
   * Проверка прав доступа - поддержка bypassPermission
   */
  _canUserView(user = game.user) {
    // Если есть bypassPermission - разрешаем доступ
    if (this.options.bypassPermission) {
      return true;
    }

    // GM всегда имеет доступ
    if (user.isGM) {
      return true;
    }

    // Проверка стандартных прав актера
    const hasPermission = this.actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER);
    return hasPermission;
  }

  /**
   * Переопределяем рендер для проверки прав и защиты от багов UI
   */
  async render(force = false, options = {}) {
    // 1. Спасибо Женя что помог!!! Бетонная защита
    if (this._state === Application.RENDER_STATES.CLOSING) return;

    // 2. Проверка прав доступа
    if (!this._canUserView()) {
      ui.notifications.warn(`У вас нет прав для доступа к ${this.actor.name}`);
      return;
    }

    const result = await super.render(force, options);

    // Добавляем класс на body для стилей подсказок
    document.body.classList.add('thm-loot-window-active');

    // 3. ФИКС бага с размерами окна
    setTimeout(() => {
      if (this.element && this.element.length > 0 && this._state !== Application.RENDER_STATES.CLOSING) {
        if (this.element.height() < 50) { // Если окно сплющило
          this.element.css({
            'height': '600px',
            'overflow': 'visible',
            'padding-top': '0px',
            'margin-top': '0px',
            'display': 'flex'
          });
        }
      }
    }, 50);

    return result;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: `thm-container-${foundry.utils.randomID()}`,
      classes: ["sheet", "thm-loot-window", "thm-window-fix"],
      template: `modules/${CONSTANTS.MODULE_NAME}/templates/container-interface.hbs`,
      width: 480,
      height: 600,
      resizable: true,
      title: "Добыча",
      closeOnSubmit: false
    });
  }

  get title() {
    return this.actor.name;
  }

  /**
   * Добавляем кнопки в хедер
   */
  _getHeaderButtons() {
    const buttons = super._getHeaderButtons();

    // Кнопка доступа к стандартному листу (bypass)
    if (game.user.isGM) {
      buttons.unshift({
        label: "Actor Sheet",
        icon: "fa-solid fa-user",
        class: "thm-open-actor-sheet",
        onclick: () => {
          this.actor.sheet.render(true, { focus: true, bypassTHM: true });
        }
      });
    }

    return buttons;
  }

  getData() {
    // Получаем состояние запирания
    const isLocked = this.actor.getFlag(CONSTANTS.MODULE_NAME, 'data.locked') || false;

    // Для игроков: если контейнер заперт - показываем пустой интерфейс
    if (!game.user.isGM && isLocked) {
      return {
        actor: this.actor,
        items: [], // Пустой список предметов
        currency: {}, // Пустая валюта
        hasCurrency: false,
        isGM: false,
        isLocked: true,
        looterName: this.looter ? this.looter.name : "Выберите свой токен"
      };
    }

    // Для ГМа или незапертого контейнера - показываем всё как обычно
    const mainManager = game.modules.get('treasure-hoard-manager').manager;
    const adapter = mainManager.systemAdapter;

    // Получаем валюту через адаптер и формируем HTML
    const currencyData = adapter.getActorCurrency(this.actor) || {};
    const currencyHtml = adapter.formatCurrencyHtml(currencyData);
    const hasCurrency = Object.values(currencyData).some(v => v > 0);

    // Безопасное получение предметов с использованием фильтров адаптера
    const items = this.actor.items.contents
      .filter(i => adapter.canItemBeInHoard(i))
      .map(i => {
        // Определяем редкость предмета
        let rarity = 'common';
        if (adapter && typeof adapter.getItemRarity === 'function') {
          rarity = (adapter.getItemRarity(i) || 'common').replace(/\s+/g, '').replace(/-/g, '');
        } else {
          const rarityValue = i.system.rarity?.toLowerCase?.() || i.system.rarity?.value?.toLowerCase?.() || '';
          if (rarityValue) {
            rarity = rarityValue.replace(/\s+/g, '').replace(/-/g, '');
          }
        }

        return {
          id: i.id,
          name: i.name,
          img: i.img,
          quantity: (adapter && typeof adapter.getItemQuantity === 'function') ? adapter.getItemQuantity(i) : (i.system.quantity || 1),
          price: (adapter && typeof adapter.getItemPrice === 'function') ? adapter.getItemPrice(i) : (i.system.price?.value || 0),
          rarity: rarity
        };
      });

    return {
      actor: this.actor,
      items: items,
      currency: currencyData,
      currencyHtml: currencyHtml,
      hasCurrency: hasCurrency,
      isGM: game.user.isGM,
      isLocked: isLocked,
      looterName: this.looter ? this.looter.name : "Выберите свой токен"
    };
  }

  activateListeners(html) {
    // Убиваем зависшие подсказки при любой перерисовке
    if (this.tooltips) {
      this.tooltips._removeTooltip();
    }
    super.activateListeners(html);

    html.find('.loot-all-btn').click(() => this._onLootAll());
    html.find('.take-currency-btn').click(() => this._onLootCurrency());

    html.find('.item-row').click(ev => {
      const itemId = ev.currentTarget.dataset.itemId;
      this._onLootItem(itemId);
    });

    html.find('.edit-actor-btn').click(() => {
      this.actor.sheet.render(true);
      this.close();
    });

    // Обработчик для контрола запирания
    html.find('.lock-checkbox').change(ev => {
      this._onToggleLock(ev.target.checked);
    });

    // Новые чистые подсказки для предметов
    this.tooltips.setupTooltips(html);
  }

  _getLooter() {
    const controlled = canvas.tokens?.controlled[0];
    return (controlled && controlled.actor) ? controlled.actor : game.user.character;
  }

  async _onLootAll() {
    if (!this.looter) return ui.notifications.warn("Сначала выберите свой токен!");
    if (this.tooltips) this.tooltips._removeTooltip();

    // Проверка на запертость для игроков
    const isLocked = this.actor.getFlag(CONSTANTS.MODULE_NAME, 'data.locked') || false;
    if (isLocked && !game.user.isGM) {
      ui.notifications.warn('Сундук заперт!');
      return;
    }

    // Показываем индикатор загрузки
    ui.notifications.info("Собираем предметы...");

    // Используем наш кастомный менеджер сокетов
    try {
      const mainManager = game.modules.get('treasure-hoard-manager').manager;
      await mainManager.socketManager.executeAsGM(CONSTANTS.SOCKET_HOOKS.LOOT_ALL, {
        containerUuid: this.actor.uuid,
        looterUuid: game.user.character?.uuid || canvas.tokens.controlled[0]?.actor?.uuid,
        userId: game.user.id
      });

      // Закрываем интерфейс после успешной операции
      this.close();
    } catch (error) {
      console.error('THM Container | Loot all error:', error);
      ui.notifications.error(`Ошибка при сборе предметов: ${error.message}`);
    }
  }

  async _onLootCurrency() {
    if (!this.looter) return;
    if (this.tooltips) this.tooltips._removeTooltip();

    // Проверка на запертость для игроков
    const isLocked = this.actor.getFlag(CONSTANTS.MODULE_NAME, 'data.locked') || false;
    if (isLocked && !game.user.isGM) {
      ui.notifications.warn('Сундук заперт!');
      return;
    }

    // Показываем индикатор загрузки
    ui.notifications.info("Забираем валюту...");

    // Используем наш кастомный менеджер сокетов
    try {
      const mainManager = game.modules.get('treasure-hoard-manager').manager;
      await mainManager.socketManager.executeAsGM(CONSTANTS.SOCKET_HOOKS.LOOT_CURRENCY, {
        containerUuid: this.actor.uuid,
        looterUuid: game.user.character?.uuid || canvas.tokens.controlled[0]?.actor?.uuid,
        userId: game.user.id
      });

    } catch (error) {
      console.error('THM Container | Loot currency error:', error);
      ui.notifications.error(`Ошибка при сборе валюты: ${error.message}`);
    }
  }

  async _onLootItem(id) {
    if (!this.looter) {
      return;
    }
    if (this.tooltips) this.tooltips._removeTooltip();

    // Проверка на запертость для игроков
    const isLocked = this.actor.getFlag(CONSTANTS.MODULE_NAME, 'data.locked') || false;
    if (isLocked && !game.user.isGM) {
      ui.notifications.warn('Сундук заперт!');
      return;
    }

    const item = this.actor.items.get(id);
    if (!item) {
      return;
    }

    // Показываем индикатор загрузки
    ui.notifications.info(`Забираем предмет: ${item.name}`);

    // Используем наш кастомный менеджер сокетов
    try {
      const mainManager = game.modules.get('treasure-hoard-manager').manager;
      await mainManager.socketManager.executeAsGM(CONSTANTS.SOCKET_HOOKS.LOOT_ITEM, {
        containerUuid: this.actor.uuid,
        itemId: id,
        looterUuid: game.user.character?.uuid || canvas.tokens.controlled[0]?.actor?.uuid,
        userId: game.user.id
      });

    } catch (error) {
      console.error('THM Container | Loot item error:', error);
      ui.notifications.error(`Ошибка при сборе предмета: ${error.message}`);
    }
  }

  /**
   * Debounce для рендеринга "перестраховка"
   */
  _debouncedRender() {
    // ЗАЩИТА: Если окно уже закрывается (например, сундук удаляется),
    // мы запрещаем сокетам прерывать анимацию закрытия.
    if (this._state === Application.RENDER_STATES.CLOSING || this._state === Application.RENDER_STATES.CLOSED) {
      return;
    }

    if (this._renderTimeout) {
      clearTimeout(this._renderTimeout);
    }

    this._renderTimeout = setTimeout(() => {
      // Убеждаемся, что за эти 150мс окно не начало закрываться
      if (this._state === Application.RENDER_STATES.RENDERED || this._state === Application.RENDER_STATES.RENDERING) {
        this.render(true);
      }
    }, 150);
  }

  /**
   * Очистка обработчиков при закрытии
   */
  async close(options = {}) {
    // Очищаем подсказки
    if (this.tooltips) {
      this.tooltips.destroy();
    }

    // Удаляем класс с body при закрытии
    document.body.classList.remove('thm-loot-window-active');

    // Очищаем timeout если есть
    if (this._renderTimeout) {
      clearTimeout(this._renderTimeout);
      this._renderTimeout = null;
    }

    // Закрываем окно
    await super.close(options);
  }

  /**
   * Обработчик переключения замка
   */
  async _onToggleLock(isLocked) {
    if (!game.user.isGM) {
      ui.notifications.warn('Только ГМ может изменять состояние замка!');
      return;
    }

    try {
      await this.actor.update({
        [`flags.${CONSTANTS.MODULE_NAME}.data.locked`]: isLocked
      });

      ui.notifications.info(`Сундук ${this.actor.name} ${isLocked ? 'заперт' : 'отперет'}`);

      // Обновляем интерфейс для всех пользователей
      this.render();
    } catch (error) {
      console.error('THM | Error toggling lock:', error);
      ui.notifications.error('Не удалось изменить состояние замка');
    }
  }
}