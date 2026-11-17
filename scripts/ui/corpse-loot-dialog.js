/**
 * Treasure Hoard Manager - Corpse Loot Review Dialog
 * Интерактивное окно настройки и фильтрации добычи с поверженного существа (GM Only)
 */

import { CONSTANTS } from '../core/constants.js';

export class CorpseLootDialog extends FormApplication {

  constructor(actor, options = {}) {
    super(actor, options);
    this.actor = actor;
    this.token = actor.token || (canvas.tokens?.placeables.find(t => t.actor?.id === actor.id)?.document) || null;
    this.options.id = `thm-corpse-dialog-${actor.id}`;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sheet", "thm-corpse-dialog-window", "thm-window-fix"],
      template: `modules/${CONSTANTS.MODULE_NAME}/templates/corpse-loot-dialog.hbs`,
      width: 580,
      height: 640,
      resizable: true,
      closeOnSubmit: true,
      title: "Настройка добычи поверженного существа"
    });
  }

  get id() {
    return `thm-corpse-dialog-${this.actor.id}`;
  }

  get title() {
    return `Добыча: ${this.actor.name}`;
  }

  /**
   * Переопределение рендера: гарантируем вывод окна на передний план по центру
   */
  async render(force = false, options = {}) {
    if (this._state === Application.RENDER_STATES.CLOSING) return;
    options.focus = true;
    return super.render(force, options);
  }

  /**
   * Подготовка данных для Handlebars-шаблона
   */
  async getData(options = {}) {
    const mainManager = game.THM?.manager || game.modules.get(CONSTANTS.MODULE_NAME)?.manager;
    const adapter = mainManager?.systemAdapter;

    // Читаем уже сохраненный список исключений (если окно открыто повторно)
    const savedExcluded = this.actor.getFlag(CONSTANTS.MODULE_NAME, 'data.excludedItemIds')
      || this.actor.getFlag(CONSTANTS.MODULE_NAME, 'excludedItemIds');
    const hasPriorConfiguration = Array.isArray(savedExcluded);
    const excludedSet = hasPriorConfiguration ? new Set(savedExcluded) : null;

    // Фильтруем предметы существа (исключаем заклинания, расы, классы, умения)
    const technicalExcludedTypes = ["spell", "feat", "class", "subclass", "background", "race"];
    const rawItems = this.actor.items.contents.filter(i => !technicalExcludedTypes.includes(i.type));

    let selectedCount = 0;

    const items = rawItems.map(item => {
      const isNatural = adapter && typeof adapter.isNaturalItem === 'function'
        ? adapter.isNaturalItem(item)
        : false;

      // Если окно открывается впервые: умный выбор по умолчанию (природные атаки сняты, вещи включены)
      // Если мастер уже настраивал этот труп: используем ранее сохраненный выбор мастера
      let included = false;
      if (hasPriorConfiguration) {
        included = !excludedSet.has(item.id);
      } else {
        included = !isNatural;
      }

      if (included) selectedCount++;

      // Редкость
      let rarity = 'common';
      if (adapter && typeof adapter.getItemRarity === 'function') {
        rarity = (adapter.getItemRarity(item) || 'common').replace(/\s+/g, '').replace(/-/g, '');
      } else {
        const rarityVal = item.system?.rarity?.toLowerCase?.() || item.system?.rarity?.value?.toLowerCase?.() || '';
        if (rarityVal) rarity = rarityVal.replace(/\s+/g, '').replace(/-/g, '');
      }

      // Количество и цена
      const qty = (adapter && typeof adapter.getItemQuantity === 'function')
        ? adapter.getItemQuantity(item)
        : (item.system?.quantity || 1);

      const price = (adapter && typeof adapter.getItemPrice === 'function')
        ? adapter.getItemPrice(item)
        : (item.system?.price?.value || 0);

      const formattedPrice = (adapter && typeof adapter.formatPrice === 'function')
        ? adapter.formatPrice(price)
        : `${price} gp`;

      const typeName = (adapter && typeof adapter.getItemTypeName === 'function')
        ? adapter.getItemTypeName(item)
        : (item.type || "Предмет");

      return {
        id: item.id,
        name: item.name,
        img: item.img || "icons/svg/item-bag.svg",
        quantity: qty,
        price: price,
        formattedPrice: formattedPrice,
        rarity: rarity,
        typeName: typeName,
        isNatural: isNatural,
        included: included
      };
    });

    // Валюта существа
    const currencyData = (adapter && typeof adapter.getActorCurrency === 'function')
      ? adapter.getActorCurrency(this.actor)
      : (this.actor.system?.currency || {});

    const currencyConfig = (adapter && typeof adapter.getCurrencyConfig === 'function')
      ? adapter.getCurrencyConfig()
      : { gp: { label: "Золото" } };

    const currencyList = Object.keys(currencyConfig).map(key => {
      return {
        key: key,
        label: currencyConfig[key]?.label || key.toUpperCase(),
        img: currencyConfig[key]?.img || null,
        value: currencyData[key] || 0
      };
    });

    const portraitImg = this.token?.texture?.src || this.actor.img || "icons/svg/skull.svg";

    return {
      actor: this.actor,
      portraitImg: portraitImg,
      items: items,
      selectedCount: selectedCount,
      totalCount: items.length,
      currencyList: currencyList
    };
  }

  /**
   * Подключение обработчиков событий
   */
  activateListeners(html) {
    super.activateListeners(html);

    const updateCounter = () => {
      const total = html.find('.item-loot-checkbox').length;
      const checked = html.find('.item-loot-checkbox:checked').length;
      html.find('.selected-count').text(checked);
      html.find('.total-count').text(total);
    };

    // Изменение чекбокса отдельного предмета
    html.find('.item-loot-checkbox').on('change', (ev) => {
      const checkbox = ev.currentTarget;
      const row = $(checkbox).closest('.corpse-item-row');
      if (checkbox.checked) {
        row.removeClass('excluded-item');
      } else {
        row.addClass('excluded-item');
      }
      updateCounter();
    });

    // Кнопка: Умный выбор
    html.find('.smart-select-btn').on('click', () => {
      html.find('.item-loot-checkbox').each((_, el) => {
        const isNatural = el.dataset.isNatural === 'true';
        el.checked = !isNatural;
        const row = $(el).closest('.corpse-item-row');
        if (el.checked) row.removeClass('excluded-item');
        else row.addClass('excluded-item');
      });
      updateCounter();
    });

    // Кнопка: Выбрать все
    html.find('.select-all-btn').on('click', () => {
      html.find('.item-loot-checkbox').each((_, el) => {
        el.checked = true;
        $(el).closest('.corpse-item-row').removeClass('excluded-item');
      });
      updateCounter();
    });

    // Кнопка: Снять все
    html.find('.deselect-all-btn').on('click', () => {
      html.find('.item-loot-checkbox').each((_, el) => {
        el.checked = false;
        $(el).closest('.corpse-item-row').addClass('excluded-item');
      });
      updateCounter();
    });

    // Кнопка: Закрыть без сохранения изменений
    html.find('.cancel-btn').on('click', (ev) => {
      ev.preventDefault();
      this.close();
    });
  }

  /**
   * Применение изменений после нажатия "Сформировать добычу"
   */
  async _updateObject(event, formData) {
    const mainManager = game.THM?.manager || game.modules.get(CONSTANTS.MODULE_NAME)?.manager;
    const adapter = mainManager?.systemAdapter;

    // 1. Вычисляем список исключенных ID предметов
    const excludedItemIds = [];
    for (const item of this.actor.items) {
      const formKey = `item_${item.id}`;
      // Если чекбокс НЕ отмечен (в formData значение false или undefined) - добавляем в исключения
      if (!formData[formKey]) {
        excludedItemIds.push(item.id);
      }
    }

    // 2. Сохраняем флаг исключений на целевом контейнере (и токена, и актера)
    await this.actor.setFlag(CONSTANTS.MODULE_NAME, 'data.excludedItemIds', excludedItemIds);
    await this.actor.setFlag(CONSTANTS.MODULE_NAME, 'excludedItemIds', excludedItemIds);
    if (this.token) {
      await this.token.setFlag(CONSTANTS.MODULE_NAME, 'data.excludedItemIds', excludedItemIds);
      await this.token.setFlag(CONSTANTS.MODULE_NAME, 'excludedItemIds', excludedItemIds);
    }
    if (this.actor.isToken && this.actor.baseActor) {
      await this.actor.baseActor.setFlag(CONSTANTS.MODULE_NAME, 'data.excludedItemIds', excludedItemIds);
      await this.actor.baseActor.setFlag(CONSTANTS.MODULE_NAME, 'excludedItemIds', excludedItemIds);
    }

    // 3. Обновление валюты (если введены новые значения)
    if (adapter && typeof adapter.updateActorCurrency === 'function') {
      const currentCurrency = adapter.getActorCurrency(this.actor) || {};
      const newCurrency = { ...currentCurrency };
      let currencyChanged = false;

      for (const [key, value] of Object.entries(formData)) {
        if (key.startsWith('currency_')) {
          const currKey = key.replace('currency_', '');
          const numVal = Math.max(0, parseInt(value, 10) || 0);
          if (newCurrency[currKey] !== numVal) {
            newCurrency[currKey] = numVal;
            currencyChanged = true;
          }
        }
      }

      if (currencyChanged) {
        await adapter.updateActorCurrency(this.actor, newCurrency);
        if (this.token?.actor && this.token.actor !== this.actor) {
          await adapter.updateActorCurrency(this.token.actor, newCurrency);
        }
      }
    }

    // 4. Помечаем труп как готовый и сконфигурированный
    await this.actor.setFlag(CONSTANTS.MODULE_NAME, 'corpseData.configuredByGM', true);
    if (this.token) {
      await this.token.setFlag(CONSTANTS.MODULE_NAME, 'corpseData.configuredByGM', true);
    }
    if (this.actor.isToken && this.actor.baseActor) {
      await this.actor.baseActor.setFlag(CONSTANTS.MODULE_NAME, 'corpseData.configuredByGM', true);
    }

    // 5. Оповещение мастера
    const totalItems = this.actor.items.size;
    const includedCount = totalItems - excludedItemIds.length;
    ui.notifications.info(`Добыча для "${this.actor.name}" сформирована: ${includedCount} предм. доступно для игроков.`);

    // 6. Обновляем любые открытые окна интерфейса контейнера
    Object.values(ui.windows).forEach(w => {
      const matchActor = w.actor && (
        w.actor.id === this.actor.id ||
        w.actor.uuid === this.actor.uuid ||
        w.actor.id === this.token?.id ||
        w.actor.id === this.token?.actor?.id
      );
      if (matchActor && typeof w.render === 'function') {
        w.render(false);
      }
    });
  }
}

