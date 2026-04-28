import { CONSTANTS } from '../core/constants.js';
import ShopTooltipsNew from './shop-tooltips-new.js';

export class ShopInterface extends FormApplication {

  constructor(actor, options = {}) {
    super(actor, options);
    this.actor = actor;

    // Проверяем доступность shopManager
    const module = game.modules.get('treasure-hoard-manager');
    if (!module || !module.manager || !module.manager.shopManager) {
      console.error('THM Shop Interface | ShopManager not available');
      this.shopManager = null;
    } else {
      this.shopManager = module.manager.shopManager;
    }

    this.rarityFilter = '';
    this.categoryFilter = '';
    this.filteredItems = [];

    // Данные для бартера
    this.playerData = null;
    this.playerTradeItems = [];
    this.merchantTradeItems = [];
    this.currentModalItem = null;
    this.isBalancedMode = false; // Режим весов (по умолчанию выключен)

    // Инициализация новой системы подсказок
    this.tooltipsNew = new ShopTooltipsNew(this);
  }

  /**
   * Получение текущего активного персонажа игрока
   */
  getPlayerActor() {
    return game.user.character || canvas.tokens.controlled[0]?.actor;
  }

  /**
   * Проверка прав доступа пользователя
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
   * Переопределяем рендер для проверки прав
   */
  async render(force = false, options = {}) {
    // Проверяем права перед рендером
    if (!this._canUserView()) {
      ui.notifications.warn(`У вас нет прав для доступа к магазину ${this.actor.name}`);
      return;
    }

    // Добавляем класс для активации стилей подсказок
    document.body.classList.add('thm-barter-window-active');

    const result = await super.render(force, options);

    return result;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "thm-shop-interface",
      classes: ["sheet", "thm-barter-window", "thm-window-fix"],
      template: `modules/${CONSTANTS.MODULE_NAME}/templates/shop-interface-barter.hbs`,
      width: 1050,
      height: 'auto',
      resizable: true,
      closeOnSubmit: false,
      scrollY: [".inventory-grid", ".trade-items"],
      scale: 1.0 // <-- 100% масштаб по умолчанию
    });
  }

  getData() {
    const shopData = this.shopManager.getShopInfo(this.actor);
    // Для ГМа берем любого подконтрольного персонажа или просто заглушку
    const player = game.user.character || canvas.tokens.controlled[0]?.actor || { name: "Мастер", system: { currency: {} }, items: [] };

    if (!shopData) return {};

    // ✅ ПРАВИЛЬНО: Читаем настройки с токена, а не с актера
    const settings = this.actor.token?.getFlag(CONSTANTS.MODULE_NAME, 'settings') ||
      this.actor.getFlag(CONSTANTS.MODULE_NAME, 'settings');

    // 1. Получаем инвентари
    const adapter = this.shopManager.mainManager.systemAdapter;
    let playerItems = (player.items?.contents || player.items || [])
      .filter(i => adapter.canItemBeInHoard(i))
      .map(i => {
        const o = i.toObject ? i.toObject() : i;
        const raw = (adapter && typeof adapter.getItemRarity === 'function') ? adapter.getItemRarity(o) : (o.system?.rarity?.value || o.system?.rarity || 'common');
        o.rarityClass = String(raw).toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
        
        // Нормализация количества
        o.system = o.system || {};
        o.system.quantity = (adapter && typeof adapter.getItemQuantity === 'function') 
          ? adapter.getItemQuantity(o) 
          : (o.system?.quantity || 1);
          
        return o;
      });

    let merchantItems = foundry.utils.deepClone(shopData.inventory || [])
      .filter(i => adapter.canItemBeInHoard(i))
      .map(o => {
        const raw = (adapter && typeof adapter.getItemRarity === 'function') ? adapter.getItemRarity(o) : (o.system?.rarity?.value || o.system?.rarity || 'common');
        o.rarityClass = String(raw).toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
        
        // Нормализация количества
        o.system = o.system || {};
        o.system.quantity = (adapter && typeof adapter.getItemQuantity === 'function') 
          ? adapter.getItemQuantity(o) 
          : (o.system?.quantity || 1);
          
        return o;
      });

    // 2. Логика вычитания для «стола»
    this.playerTradeItems.forEach(tradeItem => {
      const item = playerItems.find(i => i._id === tradeItem._id);
      if (item && item.system) item.system.quantity -= tradeItem.quantity;
    });
    this.merchantTradeItems.forEach(tradeItem => {
      const item = merchantItems.find(i => i._id === tradeItem._id);
      if (item && item.system) item.system.quantity -= tradeItem.quantity;
    });

    // 3. Сохраняем отфильтрованные предметы в переменную класса для кликов!
    // ВАЖНО: фильтруем ПОСЛЕ вычитания, чтобы товары уходили из сетки. Проверить, есть локальный баг!!!
    this.filteredItems = this.filterItems(merchantItems.filter(i => i.system?.quantity > 0));

    const playerTotalValue = this.calculateTradeValue(this.playerTradeItems, 'player');
    const merchantTotalValue = this.calculateTradeValue(this.merchantTradeItems, 'merchant');

    return {
      isGM: game.user.isGM,
      shopData: {
        ...shopData,
        inventory: this.filteredItems
      },
      playerData: {
        id: player.id || "gm",
        name: player.name,
        img: player.img || "icons/svg/mystery-man.svg",
        currency: adapter.getActorCurrency(player),
        items: this.filterPlayerItems(playerItems.filter(i => (i.system?.quantity || 0) > 0))
      },
      playerTotalValue: adapter.formatCurrencyHtml(playerTotalValue),
      merchantTotalValue: adapter.formatCurrencyHtml(merchantTotalValue),
      currencyHtmlPlayer: adapter.formatCurrencyHtml(adapter.getActorCurrency(player)),
      currencyHtmlMerchant: adapter.formatCurrencyHtml(adapter.getActorCurrency(this.actor)),
      rarityFilter: this.rarityFilter,
      categoryFilter: this.categoryFilter,
      isBalancedMode: this.isBalancedMode,
      useNpcCurrency: shopData.settings?.specific?.useNpcCurrency ?? true,
      calculateItemPrice: (basePrice) => this.calculatePrice(basePrice, shopData.settings?.specific?.priceMarkup || 100)
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Сохраняем ссылку на html для будущих вызовов
    this.html = html;

    html.find('.rarity-filter').on('change', (e) => {
      this.rarityFilter = e.target.value;
      this.render(true);
    });

    html.find('.category-filter').on('change', (e) => {
      this.categoryFilter = e.target.value;
      this.render(true);
    });

    // Клик по предметам игрока
    html.find('.player-inventory .inventory-item').on('click', (e) => {
      const itemId = e.currentTarget.dataset.itemId;
      const actorId = e.currentTarget.dataset.actorId;
      this.onPlayerItemClick(itemId, actorId);
    });

    // Клик по предметам торговца
    html.find('.merchant-inventory .inventory-item').on('click', (e) => {
      const itemId = e.currentTarget.dataset.itemId;
      this.onMerchantItemClick(itemId);
    });

    // Кнопки управления бартером
    html.find('#balanceTrade').on('click', (e) => {
      e.preventDefault();
      this.isBalancedMode = true; // Включаем режим взаимозачета
      this.updateTradeDisplay();
      this.updateTradeValues(); // Обновляем расчеты
    });

    html.find('#resetTrade').on('click', () => {
      this.resetTrade();
    });

    html.find('#confirmTrade').on('click', () => {
      this.confirmTrade();
    });

    // Кнопка обновления ассортимента ТОРГОВЦА (под стрелкой обмена)
    html.find('.sync-trade-center #refreshInventory').on('click', async (e) => {
      e.preventDefault();
      if (!game.user.isGM) return;

      // ✅ ПРАВИЛЬНО: Читаем настройки с токена, а не с актера
      const settings = this.actor.token?.getFlag(CONSTANTS.MODULE_NAME, 'settings') ||
        this.actor.getFlag(CONSTANTS.MODULE_NAME, 'settings');
      const hasCompendiums = settings?.specific?.inventorySources && settings?.specific?.inventorySources.trim() !== '';
      const currentItemCount = this.actor.items.length;

      let content = `<p><strong>Обновить ассортимент магазина "${this.actor.name}"?</strong></p>`;
      content += `<p>Текущее количество товаров: ${currentItemCount}</p>`;

      if (hasCompendiums) {
        content += `<p>🔄 Будут загружены новые предметы из компендиумов:</p>`;
        content += `<ul>`;
        content += `<li>• Источники: ${settings.specific.inventorySources}</li>`;
        content += `<li>• Категории: согласно настройкам магазина</li>`;
        content += `<li>• Редкость: согласно настройкам магазина</li>`;
        content += `<li>• Адаптивность: ${settings.specific.smartAdaptive ? 'включена' : 'выключена'}</li>`;
        content += `</ul>`;
        content += `<p>⚠️ Все текущие товары будут заменены новыми из компендиумов</p>`;
        content += `<p>💡 Имя, токен и портрет останутся без изменений</p>`;
      } else {
        content += `<p>❌ Настройки магазина не найдены!</p>`;
        content += `<p>Укажите источники компендиумов в настройках магазина.</p>`;
        content += `<p>💡 Откройте настройки магазина через кнопку THM в шапке.</p>`;
      }
      content += `<p><em>Продолжить?</em></p>`;

      // ✅ Используем V2 Application framework
      const confirm = await foundry.applications.api.DialogV2.confirm({
        title: "Обновить ассортимент?",
        content: content,
        modal: true
      });

      if (confirm && this.shopManager && hasCompendiums) {
        ui.notifications.info("Обновление ассортимента...");
        await this.shopManager.refreshInventory(this.actor);
        this.render(true); // Перерисовываем интерфейс после создания предметов
      }
    });

    html.find('#manageReputation').on('click', () => {
      this.manageReputation();
    });

    // Кнопка открытия листа актера
    html.find('#openActorSheet').on('click', () => {
      this.openActorSheet();
    });

    // Модальное окно выбора количества
    this.setupQuantityModal(html);

    // Drag and Drop
    this.setupDragAndDrop(html);

    // Обновляем отображение торговых зон после рендера
    this.updateTradeDisplay();

    // Включаем новую систему подсказок (каждый раз при рендере)
    console.log('THM Shop | Инициализация системы подсказок...');
    this.tooltipsNew.setupTooltips(html);
  }


  /**
   * Открытие быстрого меню настроек торговца
   */
  async openShopQuickSettings() {
    const settings = this.getShopSettings();
    const reputation = this.actor.getFlag(CONSTANTS.MODULE_NAME, 'reputation') || 0;

    // HTML контент для диалога
    const content = `
      <div class="thm-quick-settings" style="display: flex; flex-direction: column; gap: 15px;">
        
        <!-- Секция 1: Управление Ассортиментом -->
        <fieldset style="border: 1px solid #7a7971; padding: 10px; border-radius: 5px;">
          <legend style="font-weight: bold; padding: 0 5px;">📦 Ассортимент</legend>
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span>Обновить товары:</span>
            <button type="button" id="qs-refresh-stock" style="width: auto; padding: 5px 10px;">
              <i class="fas fa-sync"></i> Пересоздать
            </button>
          </div>

          <div class="drop-zone" style="border: 2px dashed #7a7971; padding: 15px; text-align: center; background: rgba(0,0,0,0.1); border-radius: 5px; color: #999; transition: all 0.3s ease;">
            <i class="fas fa-box-open" style="font-size: 24px; margin-bottom: 5px;"></i><br>
            Перетащите сюда предметы<br>из компендиума или инвентаря
          </div>
          
          <button type="button" disabled style="margin-top: 10px; opacity: 0.6;">
            <i class="fas fa-magic"></i> Сгенерировать предмет (WIP)
          </button>
        </fieldset>

        <!-- Секция 2: Время работы -->
        <fieldset style="border: 1px solid #7a7971; padding: 10px; border-radius: 5px;">
          <legend style="font-weight: bold; padding: 0 5px;">🕒 Время работы</legend>
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
            <input type="checkbox" id="qs-always-open" ${settings.alwaysOpen ? 'checked' : ''}>
            <label for="qs-always-open">Круглосуточно</label>
          </div>
          
          <div id="qs-hours-container" style="display: ${settings.alwaysOpen ? 'none' : 'flex'}; gap: 10px; align-items: center;">
            <label>С: <input type="time" id="qs-time-open" value="${settings.openingTime || '08:00'}" style="background: rgba(0,0,0,0.3); border: 1px solid #555; color: #fff;"></label>
            <label>До: <input type="time" id="qs-time-close" value="${settings.closingTime || '20:00'}" style="background: rgba(0,0,0,0.3); border: 1px solid #555; color: #fff;"></label>
          </div>
        </fieldset>

        <!-- Секция 3: Репутация -->
        <fieldset style="border: 1px solid #7a7971; padding: 10px; border-radius: 5px;">
          <legend style="font-weight: bold; padding: 0 5px;">⭐ Репутация</legend>
          
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <input type="checkbox" id="qs-use-reputation" ${settings.useReputation ? 'checked' : ''}>
            <label for="qs-use-reputation">Влияет на цены</label>
          </div>

          <div style="display: flex; align-items: center; gap: 10px;">
            <label>Текущая:</label>
            <input type="range" id="qs-reputation-slider" min="-100" max="100" value="${reputation}" style="flex: 1;">
            <span id="qs-reputation-val" style="width: 30px; text-align: right;">${reputation}</span>
          </div>
          <div style="font-size: 11px; color: #888; text-align: center; margin-top: 2px;">
            Вражда (-100) ... Нейтрально (0) ... Дружба (100)
          </div>
        </fieldset>
      </div>
    `;

    // Создаем диалог
    const d = new Dialog({
      title: `Настройки: ${this.actor.name}`,
      content: content,
      buttons: {
        save: {
          icon: '<i class="fas fa-check"></i>',
          label: "Сохранить",
          callback: async (html) => {
            // 1. Собираем данные формы
            const newSpecificSettings = {
              alwaysOpen: html.find('#qs-always-open').is(':checked'),
              useReputation: html.find('#qs-use-reputation').is(':checked'),
              openingTime: html.find('#qs-time-open').val(),
              closingTime: html.find('#qs-time-close').val()
            };

            const newRep = parseInt(html.find('#qs-reputation-slider').val()) || 0;

            // 2. ОПРЕДЕЛЯЕМ ЦЕЛЬ: Если у актера есть токен (мы на сцене), работаем с токеном!
            // Это критически важно, так как getData() читает именно с токена.
            const targetDoc = this.actor.token ? this.actor.token : this.actor;

            // 3. Получаем текущие настройки с ПРАВИЛЬНОГО документа
            let currentSettings = targetDoc.getFlag(CONSTANTS.MODULE_NAME, 'settings') || {};

            // 4. Гарантируем структуру
            if (!currentSettings.specific) currentSettings.specific = {};

            // 5. Обновляем объект (merge)
            currentSettings.specific = foundry.utils.mergeObject(currentSettings.specific, newSpecificSettings);

            // 6. Сохраняем настройки в ПРАВИЛЬНЫЙ документ
            await targetDoc.setFlag(CONSTANTS.MODULE_NAME, 'settings', currentSettings);

            // Репутацию дублируем и на актера (для совместимости), и на токен (для надежности)
            await this.actor.setFlag(CONSTANTS.MODULE_NAME, 'reputation', newRep);
            if (this.actor.token) {
              await this.actor.token.setFlag(CONSTANTS.MODULE_NAME, 'reputation', newRep);
            }

            ui.notifications.info("Настройки магазина обновлены");
            this.render(true);
          }
        }
      },
      render: (html) => {
        // Обработчик обновления товаров
        html.find('#qs-refresh-stock').on('click', async () => {
          if (this.shopManager) {
            ui.notifications.info("Обновление ассортимента...");
            await this.shopManager.refreshInventory(this.actor);
            this.render(true);
            d.close(); // Закрываем настройки после обновления
          }
        });

        // Обработчик галочки времени
        html.find('#qs-always-open').on('change', (e) => {
          const container = html.find('#qs-hours-container');
          if (e.target.checked) container.slideUp();
          else container.slideDown().css('display', 'flex');
        });

        // Обработчик слайдера репутации
        html.find('#qs-reputation-slider').on('input', (e) => {
          html.find('#qs-reputation-val').text(e.target.value);
        });

        // ==========================================
        // ОБРАБОТЧИКИ DRAG & DROP
        // ==========================================
        const dropZone = html.find('.drop-zone');

        dropZone.on('dragover', (e) => {
          e.preventDefault();
          dropZone.css({
            'background': 'rgba(159, 130, 78, 0.2)',
            'border-color': '#e8dcc0',
            'color': '#e8dcc0'
          });
        });

        dropZone.on('dragleave', (e) => {
          e.preventDefault();
          dropZone.css({
            'background': 'rgba(0,0,0,0.1)',
            'border-color': '#7a7971',
            'color': '#999'
          });
        });

        dropZone.on('drop', async (e) => {
          e.preventDefault();

          // Возвращаем стиль обратно
          dropZone.css({
            'background': 'rgba(0,0,0,0.1)',
            'border-color': '#7a7971',
            'color': '#999'
          });

          try {
            const dataText = e.originalEvent.dataTransfer.getData('text/plain');
            if (!dataText) return;

            const data = JSON.parse(dataText);

            if (data.type !== 'Item' || !data.uuid) {
              ui.notifications.warn("В магазин можно добавлять только Предметы (Item)!");
              return;
            }

            // Получаем исходный предмет (из компендиума или другого актера)
            const sourceItem = await fromUuid(data.uuid);
            if (!sourceItem) {
              ui.notifications.error("Не удалось найти исходный предмет.");
              return;
            }

            // Клонируем данные и очищаем от системных ID
            const itemData = sourceItem.toObject();
            delete itemData._id;

            // Проверяем цену. Если её нет (0), генерируем новую!
            if (!itemData.system) itemData.system = {};
            if (!itemData.system.price) itemData.system.price = {};

            let currentPrice = typeof itemData.system.price === 'number' ? itemData.system.price : (itemData.system.price.value || 0);

            if (currentPrice === 0 && this.shopManager) {
              const settings = this.getShopSettings();
              const priceMethod = settings.priceMethod || 'dmg';
              const generatedPrice = await this.shopManager.generateItemPrice(itemData, priceMethod);

              if (typeof itemData.system.price === 'number') {
                itemData.system.price = generatedPrice;
              } else {
                itemData.system.price.value = generatedPrice;
              }
            }

            // Создаем предмет в инвентаре торговца
            await this.actor.createEmbeddedDocuments("Item", [itemData]);

            // Визуальный фидбек
            const originalHtml = dropZone.html();
            dropZone.html('<i class="fas fa-check" style="color: #4cd137; font-size: 24px;"></i><br><span style="color: #4cd137;">Успешно добавлено!</span>');

            setTimeout(() => {
              dropZone.html(originalHtml);
              // Перерисовываем главное окно магазина, чтобы предмет появился в списке
              this.render(true);
            }, 1500);

          } catch (err) {
            console.error("THM | Error dropping item:", err);
            ui.notifications.error("Ошибка при добавлении предмета. См. консоль (F12).");
          }
        });
      }
    });

    d.render(true);
  }

  /**
   * Добавляем кнопки в хедер - как в container-interface
   */
  _getHeaderButtons() {
    const buttons = super._getHeaderButtons();

    // Кнопка настроек магазина (только для ГМ)
    if (game.user.isGM) {
      buttons.unshift({
        label: "Настройки",
        class: "thm-shop-settings",
        icon: "fas fa-cog",
        onclick: () => {
          this.openShopQuickSettings(); // <--- ТЕПЕРЬ ВЫЗЫВАЕМ НОВОЕ МЕНЮ
        }
      });
    }

    // Кнопка доступа к стандартному листу актера (только для ГМ)
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

  /**
   * Открытие настроек магазина
   */
  openShopSettings() {
    // Открываем конфигурацию магазина
    const configApp = game.modules.get('treasure-hoard-manager').manager.uiManager.configApp;
    if (configApp) {
      configApp.render(true, { actor: this.actor });
    } else {
      ui.notifications.warn('Настройки магазина временно недоступны');
    }
  }

  /**
   * Открытие листа актера
   */
  openActorSheet() {
    this.actor.sheet?.render(true);
  }

  /**
   * Обработка клика по предмету игрока
   */
  onPlayerItemClick(itemId, actorId) {
    const actor = game.actors.get(actorId);
    const item = actor?.items.get(itemId);

    if (!item) return;

    // 1. Получаем оригинальное количество предмета
    const originalQuantity = item.system?.quantity || 1;

    // 2. Считаем, сколько таких предметов УЖЕ на столе
    const existingTradeItem = this.playerTradeItems.find(i => i._id === itemId);
    const inTradeQuantity = existingTradeItem ? existingTradeItem.quantity : 0;

    // 3. Вычисляем ДОСТУПНОЕ количество
    const availableQuantity = originalQuantity - inTradeQuantity;

    // Если доступных предметов больше нет - игнорируем клик
    if (availableQuantity <= 0) {
      ui.notifications.warn('Вы уже добавили все эти предметы к сделке!');
      return;
    }

    // Если доступен только 1 предмет - сразу кидаем на стол
    if (availableQuantity === 1) {
      this.addToTrade(item.toObject(), 'player', actorId);
      return;
    }

    // Если доступно больше 1 - открываем модалку, передавая ДОСТУПНОЕ количество
    this.currentModalItem = {
      item: item.toObject(),
      source: 'player',
      actorId: actorId,
      availableQuantity: availableQuantity // <--- НОВОЕ СВОЙСТВО
    };

    this.showQuantityModal();
  }

  /**
   * Обработка клика по предмету торговца
   */
  onMerchantItemClick(itemId) {
    const item = this.actor.items.get(itemId);
    if (!item) return;

    const originalQuantity = item.system?.quantity || 1;

    // Считаем, сколько уже на столе
    const existingTradeItem = this.merchantTradeItems.find(i => i._id === itemId);
    const inTradeQuantity = existingTradeItem ? existingTradeItem.quantity : 0;

    const availableQuantity = originalQuantity - inTradeQuantity;

    if (availableQuantity <= 0) {
      ui.notifications.warn('У торговца больше нет этого предмета!');
      return;
    }

    if (availableQuantity === 1) {
      this.addToTrade(item.toObject(), 'merchant', this.actor.id);
    } else {
      this.currentModalItem = {
        item: item.toObject(),
        source: 'merchant',
        actorId: this.actor.id,
        availableQuantity: availableQuantity // <--- НОВОЕ СВОЙСТВО
      };
      this.showQuantityModal();
    }
  }

  /**
   * Показ модального окна выбора количества
   */
  showQuantityModal() {
    const modal = this.element.find('#quantityModal');
    const item = this.currentModalItem.item;

    const isIdentified = item.system?.identified !== false;
    const displayName = isIdentified ? item.name : (item.system.unidentified?.name || 'Неопознанный предмет');
    const displayRarity = isIdentified ? (item.system?.rarity || 'common') : '???';
    const cleanRarity = displayRarity.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');

    modal.find('#modalItemImage').attr('src', item.img);
    modal.find('#modalItemName').text(displayName);
    modal.find('#modalItemRarity').text(displayRarity.toUpperCase()).attr('class', `item-rarity-badge rarity-${cleanRarity}`);

    // ИСПОЛЬЗУЕМ ДОСТУПНОЕ КОЛИЧЕСТВО вместо максимального
    const maxAllowed = this.currentModalItem.availableQuantity || 1;

    modal.find('#quantityInput').attr('max', maxAllowed);
    modal.find('#quantitySlider').attr('max', maxAllowed);
    modal.find('#quantityInput').val(1);
    modal.find('#quantitySlider').val(1);

    modal.addClass('active');
  }

  /**
   * Настройка модального окна выбора количества
   */
  setupQuantityModal(html) {
    // Закрытие модального окна
    html.find('#closeQuantityModal, #cancelQuantity').on('click', () => {
      html.find('#quantityModal').removeClass('active');
    });

    // Контролы количества
    html.find('#decreaseQuantity').on('click', () => {
      const input = html.find('#quantityInput');
      const current = parseInt(input.val()) || 1;
      if (current > 1) {
        input.val(current - 1);
        html.find('#quantitySlider').val(current - 1);
      }
    });

    html.find('#increaseQuantity').on('click', () => {
      const input = html.find('#quantityInput');
      const current = parseInt(input.val()) || 1;
      const max = parseInt(input.attr('max')) || 1;
      if (current < max) {
        input.val(current + 1);
        html.find('#quantitySlider').val(current + 1);
      }
    });

    // Синхронизация ползунка и поля ввода
    html.find('#quantityInput').on('input', (e) => {
      const value = parseInt(e.target.value) || 1;
      html.find('#quantitySlider').val(value);
    });

    html.find('#quantitySlider').on('input', (e) => {
      const value = parseInt(e.target.value) || 1;
      html.find('#quantityInput').val(value);
    });

    // Подтверждение выбора
    html.find('#confirmQuantity').on('click', () => {
      this.confirmQuantitySelection();
    });

    // Добавляем обработчики для удаления предметов из торговой зоны
    html.on('click', '.trade-item-remove', (e) => {
      e.stopPropagation();
      const itemId = e.currentTarget.dataset.itemId;
      const source = e.currentTarget.dataset.source;
      this.removeFromTrade(itemId, source);
    });

    // Обработчики для репутации
    html.on('click', '.reputation-set-btn', (e) => {
      const level = e.currentTarget.dataset.level;
      this.setReputation(this.getReputationMultiplier(level));
    });
  }

  /**
   * Подтверждение выбора количества
   */
  confirmQuantitySelection() {
    const modal = this.element.find('#quantityModal');
    const quantity = parseInt(modal.find('#quantityInput').val()) || 1;
    const modalData = this.currentModalItem;

    if (modalData.source === 'player') {
      this.addToPlayerTrade(modalData.item, quantity, modalData.actorId);
    } else {
      this.addToMerchantTrade(modalData.item, quantity);
    }

    modal.removeClass('active');
    this.currentModalItem = null;
  }

  /**
   * Добавление предмета в торговую зону (универсальная функция)
   */
  addToTrade(item, source, actorId) {
    if (source === 'player') {
      this.addToPlayerTrade(item, 1, actorId);
    } else {
      this.addToMerchantTrade(item, 1);
    }
    this.updateTradeDisplay();
  }

  /**
   * Добавление предмета в торговую зону игрока
   */
  async addToPlayerTrade(item, quantity, actorId) {
    const adapter = this.shopManager.mainManager.systemAdapter;
    const actor = actorId ? (await fromUuid(actorId) || game.actors.get(actorId)) : this.getPlayerActor();
    const sourceItem = actor?.items?.get(item._id || item.id);
    
    if (!sourceItem) return;

    const available = adapter.getItemQuantity(sourceItem);
    const existingInTrade = this.playerTradeItems.find(i => i._id === item._id);
    const currentOnTable = existingInTrade ? existingInTrade.quantity : 0;

    if (currentOnTable + quantity > available) {
      ui.notifications.warn(`У вас нет столько предметов! Доступно: ${available}`);
      return;
    }

    if (existingInTrade) {
      existingInTrade.quantity += quantity;
    } else {
      const cleanItem = item.toObject ? item.toObject() : foundry.utils.deepClone(item);
      cleanItem.quantity = quantity;
      cleanItem._id = item._id || item.id;
      cleanItem.actorId = actorId;
      
      this.playerTradeItems.push(cleanItem);
    }

    this.isBalancedMode = false;
    this.updateTradeDisplay();
  }

  /**
   * Добавление предмета в торговую зону торговца
   */
  async addToMerchantTrade(item, quantity) {
    const adapter = this.shopManager.mainManager.systemAdapter;
    const merchant = this.actor;
    const sourceItem = merchant.items.get(item._id || item.id);

    if (!sourceItem) return;

    const available = adapter.getItemQuantity(sourceItem);
    const existingInTrade = this.merchantTradeItems.find(i => i._id === item._id);
    const currentOnTable = existingInTrade ? existingInTrade.quantity : 0;

    if (currentOnTable + quantity > available) {
      ui.notifications.warn(`У торговца нет столько предметов! Доступно: ${available}`);
      return;
    }

    if (existingInTrade) {
      existingInTrade.quantity += quantity;
    } else {
      const cleanItem = item.toObject ? item.toObject() : foundry.utils.deepClone(item);
      cleanItem.quantity = quantity;
      cleanItem._id = item._id || item.id;
      
      this.merchantTradeItems.push(cleanItem);
    }

    this.isBalancedMode = false;
    this.updateTradeDisplay();
  }

  /**
   * Удаление предмета из торговой зоны
   */
  removeFromTrade(itemId, source) {
    if (source === 'player') {
      this.playerTradeItems = this.playerTradeItems.filter(item => item._id !== itemId);
    } else {
      this.merchantTradeItems = this.merchantTradeItems.filter(item => item._id !== itemId);
    }
    this.isBalancedMode = false; // Сбрасываем весы при изменении стола
    this.updateTradeDisplay(); // Обновляем только торговую зону, не весь интерфейс
  }

  /**
   * Обновление отображения торговой зоны
   */
  updateTradeDisplay() {
    // Очищаем существующие подсказки перед обновлением DOM
    if (this.tooltipsNew) {
      this.tooltipsNew._removeTooltip();
    }

    const playerTradeZone = $('#player-trade-items');
    const merchantTradeZone = $('#merchant-trade-items');

    // Очищаем зоны
    playerTradeZone.empty();
    merchantTradeZone.empty();

    // Отображаем предметы игрока
    this.playerTradeItems.forEach(item => {
      const itemElement = this.createTradeItemElement(item, 'player');
      playerTradeZone.append(itemElement);
    });

    // Отображаем предметы торговца
    this.merchantTradeItems.forEach(item => {
      const itemElement = this.createTradeItemElement(item, 'merchant');
      merchantTradeZone.append(itemElement);
    });

    // Обновляем стоимости
    this.updateTradeValues();

    // Пересоздаем обработчики подсказок только если есть новые элементы
    if (this.html && this.tooltipsNew && (this.playerTradeItems.length > 0 || this.merchantTradeItems.length > 0)) {
      // Небольшая задержка чтобы DOM успел обновиться
      setTimeout(() => {
        this.tooltipsNew.setupTooltips(this.html);
      }, 10);
    }
  }

  /**
   * Обновление стоимостей сделки и Баланса (С учетом режима ВЕСОВ)
   */
  updateTradeValues() {
    const playerTotalAtoms = this.calculateTradeValue(this.playerTradeItems, 'player');
    const merchantTotalAtoms = this.calculateTradeValue(this.merchantTradeItems, 'merchant');

    // Получаем адаптер
    const adapter = this.shopManager.mainManager.systemAdapter;

    // Обновляем значения в шапках зон
    const playerHtml = adapter.formatCurrencyHtml(playerTotalAtoms);
    const merchantHtml = adapter.formatCurrencyHtml(merchantTotalAtoms);

    const playerZone = $('.player-trade .zone-value');
    const merchantZone = $('.merchant-trade .zone-value');

    if (playerZone.length > 0) playerZone.html(playerHtml);
    if (merchantZone.length > 0) merchantZone.html(merchantHtml);

    const balanceElement = $('.balance-amount');
    const tradeButton = $('#confirmTrade');
    const balanceButton = $('#balanceTrade');

    // Достаем атомы (деньги в минимальных единицах системы)
    const playerWalletAtoms = adapter.convertCurrencyToAtoms(adapter.getActorCurrency(game.user.character));
    const merchantWalletAtoms = adapter.convertCurrencyToAtoms(adapter.getActorCurrency(this.actor));
    const useNpcCurrency = this.getShopSettings().useNpcCurrency ?? true;

    if (!this.isBalancedMode) {
      balanceButton.removeClass('active-balance');

      if (merchantTotalAtoms > 0 && playerTotalAtoms > 0) {
        balanceElement.html(`Покупка: <span style="color:#ff6b6b">-${adapter.formatCurrencyHtml(merchantTotalAtoms)}</span> | Продажа: <span style="color:#4cd137">+${adapter.formatCurrencyHtml(playerTotalAtoms)}</span>`);
        balanceElement.removeClass('positive negative');
        tradeButton.removeClass('disabled').prop('disabled', false);
      } else if (merchantTotalAtoms > 0) {
        balanceElement.html(`К оплате: <span style="color:#ff6b6b">${adapter.formatCurrencyHtml(merchantTotalAtoms)}</span>`);
        if (Number(playerWalletAtoms) >= Number(merchantTotalAtoms)) {
          tradeButton.removeClass('disabled').prop('disabled', false);
        } else {
          balanceElement.append(`<br><span style="color: #ff4444; font-size: 11px;">Не хватает ${adapter.formatCurrencyHtml(merchantTotalAtoms - playerWalletAtoms)}!</span>`);
          tradeButton.addClass('disabled').prop('disabled', true);
        }
      } else if (playerTotalAtoms > 0) {
        balanceElement.html(`Выручка: <span style="color:#4cd137">+${adapter.formatCurrencyHtml(playerTotalAtoms)}</span>`);
        if (!useNpcCurrency || Number(merchantWalletAtoms) >= Number(playerTotalAtoms)) {
          tradeButton.removeClass('disabled').prop('disabled', false);
        } else {
          balanceElement.append(`<br><span style="color: #ff4444; font-size: 11px;">У торговца не хватает ${adapter.formatCurrencyHtml(playerTotalAtoms - merchantWalletAtoms)}!</span>`);
          tradeButton.addClass('disabled').prop('disabled', true);
        }
      } else {
        balanceElement.text('Добавьте предметы для сделки');
        tradeButton.removeClass('disabled').prop('disabled', false);
      }

    } else {
      balanceButton.addClass('active-balance');

      if (playerTotalAtoms >= merchantTotalAtoms) {
        const profitAtoms = playerTotalAtoms - merchantTotalAtoms;
        balanceElement.html(`С учетом бартера ваша выгода: ${adapter.formatCurrencyHtml(profitAtoms)}`);
        balanceElement.removeClass('negative').addClass('positive');

        if (!useNpcCurrency || Number(merchantWalletAtoms) >= Number(profitAtoms)) {
          tradeButton.removeClass('disabled').prop('disabled', false);
        } else {
          balanceElement.html(`У торговца не хватает: ${adapter.formatCurrencyHtml(profitAtoms - merchantWalletAtoms)}!`);
          tradeButton.addClass('disabled').prop('disabled', true);
        }
      } else {
        const deficitAtoms = merchantTotalAtoms - playerTotalAtoms;
        balanceElement.html(`С учетом бартера доплатить: ${adapter.formatCurrencyHtml(deficitAtoms)}`);
        balanceElement.removeClass('positive').addClass('negative');

        if (Number(playerWalletAtoms) >= Number(deficitAtoms)) {
          tradeButton.removeClass('disabled').prop('disabled', false);
        } else {
          balanceElement.html(`Вам не хватает: ${adapter.formatCurrencyHtml(deficitAtoms - playerWalletAtoms)}!`);
          tradeButton.addClass('disabled').prop('disabled', true);
        }
      }
    }





    const tradeBtn = $('#confirmTrade');
    tradeBtn.removeClass('buy-mode sell-mode exchange-mode');

    if (this.isBalancedMode) {
      tradeBtn.addClass('exchange-mode').html('<i class="fas fa-balance-scale"></i> ОБМЕНЯТЬ');
    } else if (this.merchantTradeItems.length > 0) {
      tradeBtn.addClass('buy-mode').html('<i class="fas fa-shopping-cart"></i> КУПИТЬ');
    } else if (this.playerTradeItems.length > 0) {
      tradeBtn.addClass('sell-mode').html('<i class="fas fa-coins"></i> ПРОДАТЬ');
    } else {
      tradeBtn.html('<i class="fas fa-handshake"></i> ТОРГОВАТЬ');
    }
  }



  /**
   * Фильтрация товаров игрока
   */
  filterPlayerItems(items) {
    let filtered = [...items];

    // Фильтр по редкости
    if (this.rarityFilter) {
      filtered = filtered.filter(item =>
        item.system?.rarity === this.rarityFilter
      );
    }

    return filtered;
  }

  /**
   * Фильтрация товаров
   */
  filterItems(items) {
    let filtered = [...items];

    // Фильтр по редкости
    if (this.rarityFilter) {
      filtered = filtered.filter(item => {
        const adapter = this.shopManager.mainManager.systemAdapter;
        return adapter.getItemRarity(item) === this.rarityFilter;
      });
    }

    // Фильтр по категории
    if (this.categoryFilter) {
      const adapter = this.shopManager.mainManager.systemAdapter;

      filtered = filtered.filter(item => {
        switch (this.categoryFilter) {
          case 'weapons':
            return adapter.isWeapon(item);

          case 'armor':
            return adapter.isArmor(item);

          case 'potions':
            return adapter.isPotion(item);

          case 'scrolls':
            return adapter.isScroll(item);

          case 'food':
            return adapter.isFood(item);

          case 'gems':
            return adapter.isGem(item);

          case 'materials':
            return adapter.isMaterial(item);

          default:
            return true;
        }
      });
    }

    return filtered;
  }

  /**
   * Сброс сделки
   */
  resetTrade() {
    this.playerTradeItems = [];
    this.merchantTradeItems = [];
    this.isBalancedMode = false; // Сбрасываем режим весов
    this.updateTradeDisplay(); // Обновляем только торговую зону
    ui.notifications.info('Сделка сброшена');
  }



  /**
   * Показ диалога нехватки средств
   */
  async showInsufficientFundsDialog(playerValue, merchantValue) {
    const difference = playerValue - merchantValue;
    const adapter = this.shopManager.mainManager.systemAdapter;

    return new Promise((resolve) => {
      // ✅ Используем V2 Application framework
      const dialog = new foundry.applications.api.DialogV2({
        window: {
          title: "Недостаточно средств у торговца",
          content: `
            <div style="text-align: center; padding: 10px;">
              <p><strong>Торговцу не хватает ${adapter.formatCurrencyHtml(difference)} для завершения сделки!</strong></p>
              <p>Вы можете принять сделку себе в убыток, чтобы торговец доплатил из своих средств.</p>
              <p><strong>Вы получите: ${adapter.formatCurrencyHtml(this.calculatePlayerGain(playerValue, merchantValue))}</strong></p>
              <div style="margin-top: 15px;">
                <button id="accept-loss" style="margin-right: 10px; background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                  Принять убыток
                </button>
                <button id="decline-trade" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                  Отменить
                </button>
              </div>
            </div>
          `,
          modal: true
        },
        buttons: []
      });

      dialog.render(true);

      // Обработчики кнопок
      setTimeout(() => {
        $('#accept-loss').on('click', () => {
          dialog.close();
          resolve(true);
        });

        $('#decline-trade').on('click', () => {
          dialog.close();
          resolve(false);
        });
      }, 100);
    });
  }

  /**
   * Расчет выигрыша игрока в атомах
   */
  calculatePlayerGain(playerValue, merchantValue) {
    return playerValue - merchantValue;
  }




  /**
   * Обновление валют после сделки
   */
  async updateCurrencies(playerValueAtoms, merchantValueAtoms, playerActor) {
    const player = playerActor || this.getPlayerActor();
    const merchant = this.actor;
    const adapter = this.shopManager.mainManager.systemAdapter;

    if (!player || !player.system) {
      console.error("THM | No valid player actor found for currency update");
      return false;
    }

    // Расчет разницы
    const differenceAtoms = playerValueAtoms - merchantValueAtoms;

    if (differenceAtoms > 0) {
      // Игрок получает сдачу от торговца
      // 1. У торговца списываем (если используем валюту НПС)
      const useNpcCurrency = this.getShopSettings().useNpcCurrency ?? true;
      if (useNpcCurrency) {
        if (game.user.isGM) {
          await adapter.spendWealth(merchant, differenceAtoms);
        } else {
          await this.shopManager.mainManager.socketManager.executeAsGM('spendWealthAsGM', {
            actorUuid: merchant.uuid,
            amount: differenceAtoms
          });
        }
      }
      // 2. Игроку добавляем
      const currentAtoms = adapter.convertCurrencyToAtoms(adapter.getActorCurrency(player));
      const newCurrency = adapter.convertAtomsToCurrency(currentAtoms + differenceAtoms);
      await adapter.updateActorCurrency(player, newCurrency);

    } else if (differenceAtoms < 0) {
      // Игрок платит торговцу
      const amountToPay = Math.abs(differenceAtoms);
      // 1. Списываем у игрока (умное списание)
      const success = await adapter.spendWealth(player, amountToPay);
      if (!success) {
        ui.notifications.error("Недостаточно средств для совершения сделки!");
        return false;
      }
      
      // 2. Добавляем торговцу
      const currentAtoms = adapter.convertCurrencyToAtoms(adapter.getActorCurrency(merchant));
      const newCurrency = adapter.convertAtomsToCurrency(currentAtoms + amountToPay);
      
      // Используем socket для обновления актера НПС
      if (game.user.isGM) {
        await adapter.updateActorCurrency(merchant, newCurrency);
      } else {
        await this.shopManager.mainManager.socketManager.executeAsGM('updateActorCurrency', {
          actorUuid: merchant.uuid,
          currency: newCurrency
        });
      }
    }
    
    return true;
  }

  /**
   * Управление репутацией
   */
  manageReputation() {
    const reputation = this.actor.getFlag(CONSTANTS.MODULE_NAME, 'reputation') || 0;
    const reputationLevel = this.getReputationLevel(reputation);

    const content = `
      <h2>Управление репутацией</h2>
      <p>Текущая репутация: ${reputation} (${reputationLevel})</p>
      <p>Влияние на цены:</p>
      <ul>
        <li>Враждебная: x1.0</li>
        <li>Дружелюбивая: x0.9</li>
        <li>Дружественная: x0.8</li>
        <li>Нейтральная: x0.7</li>
        <li>Враждебная: x0.6</li>
        <li>Враждебная: x0.5</li>
        <li>Нейтральная: x0.4</li>
        <li>Дружелюбивая: x0.3</li>
        <li>Дружественная: x0.2</li>
        <li>Нейтральная: x0.1</li>
      </ul>
      <div style="margin-top: 15px;">
        <button type="button" class="reputation-set-btn" data-level="hostile">Враждебный</button>
        <button type="button" class="reputation-set-btn" data-level="unfriendly">Дружелюбивый</button>
        <button type="button" class="reputation-set-btn" data-level="neutral">Нейтральный</button>
      </div>
    `;

    new Dialog({
      title: 'Управление репутацией',
      content: content,
      buttons: [
        {
          label: 'Закрыть',
          callback: () => { }
        }
      ]
    }).render(true);
  }

  /**
   * Получение уровня репутации
   */
  getReputationLevel(reputation) {
    if (reputation >= 50) return 'Враждебный';
    if (reputation >= 30) return 'Враждебный';
    if (reputation >= 20) return 'Нейтральный';
    if (reputation >= 10) return 'Нейтральный';
    if (reputation >= 0) return 'Нейтральный';
    return 'Дружелюбивый';
  }

  /**
   * Установка репутации
   */
  setReputation(level) {
    const oldReputation = this.actor.getFlag(CONSTANTS.MODULE_NAME, 'reputation') || 0;
    const newReputation = Math.max(-100, Math.min(100, level));

    this.actor.setFlag(CONSTANTS.MODULE_NAME, 'reputation', newReputation);
    ui.notifications.info(`Репутация изменена с ${oldReputation} до ${newReputation}`);
  }

  /**
   * Получение настроек магазина из флагов актера (Бронебойно)
   */
  getShopSettings() {
    const settings = this.actor.getFlag(CONSTANTS.MODULE_NAME, 'settings') || {};
    return {
      priceMarkup: Number(settings.specific?.priceMarkup) || 100,
      priceBuyback: Number(settings.specific?.priceBuyback) || 50,
      priceMethod: settings.specific?.priceMethod || 'dmg', // Новая настройка
      alwaysOpen: settings.specific?.alwaysOpen || false,
      openingTime: settings.specific?.openingTime || '08:00',
      closingTime: settings.specific?.closingTime || '20:00',
      useReputation: settings.specific?.useReputation || false
    };
  }

  /**
   * Генерирует стабильное случайное число на основе ID предмета.
   * Цена будет разной для разных предметов, но не будет меняться при перерисовке.
   */
  _getDeterministicPrice(itemId, min, max) {
    if (min === max) return min;
    // Создаем число на основе символов ID
    let hash = 0;
    for (let i = 0; i < itemId.length; i++) {
      hash = ((hash << 5) - hash) + itemId.charCodeAt(i);
      hash |= 0;
    }
    const absHash = Math.abs(hash);
    return Math.floor(min + (absHash % (max - min + 1)));
  }

  /**
   * Умное извлечение базовой цены с приоритетом на карточку предмета
   */
  getBasePrice(item) {
    if (!item) return 0;
    return this.shopManager.mainManager.systemAdapter.getItemPrice(item);
  }

  /**
   * Расчет цены продажи (с учетом репутации)
   */
  calculatePrice(item, markup = 100) {
    // Если передали объект предмета, берем его базу, иначе считаем что передали число
    const base = (typeof item === 'object') ? this.getBasePrice(item) : Number(item);
    const markupMultiplier = markup / 100;
    const reputationMod = this.actor.getFlag(CONSTANTS.MODULE_NAME, 'reputationModifier') || 1.0;

    return Math.round(base * markupMultiplier * reputationMod);
  }

  /**
   * Расчет цены выкупа у игрока
   */
  calculateBuybackPrice(item, buybackRate = 50) {
    // Если передали объект предмета, берем его базу, иначе считаем что передали число
    const base = (typeof item === 'object') ? this.getBasePrice(item) : Number(item);
    const multiplier = buybackRate / 100;
    return Math.round(base * multiplier);
  }


  /**
   * Конвертирует объект цены предмета в базовую стоимость (в "атомах" системы - CP для 5е)
   */
  convertPriceToAtoms(item, priceOverride = null) {
    const adapter = this.shopManager.mainManager.systemAdapter;
    
    // Если есть переопределение цены (ручной ввод на столе)
    if (priceOverride !== null && priceOverride !== undefined && priceOverride !== '') {
      if (adapter.systemId === 'dnd5e') {
        return Math.floor(Number(priceOverride) * 100);
      }
      return Number(priceOverride);
    }

    // Если у адаптера есть getItemPrice, используем его
    let value = 0;
    let denom = 'gp';
    
    if (adapter && typeof adapter.getItemPrice === 'function') {
      value = adapter.getItemPrice(item);
    } else {
      const priceData = item?.system?.price;
      if (!priceData) return 0;
      if (typeof priceData === 'number') {
        value = priceData;
      } else if (typeof priceData === 'object') {
        value = Number(priceData.value) || 0;
        denom = priceData.denomination || (adapter.systemId === 'cyberpunk-red-core' ? 'eb' : 'gp');
      }
    }

    if (adapter.systemId === 'dnd5e') {
      if (adapter && typeof adapter.getItemPrice === 'function') {
        // getItemPrice для dnd5e возвращает gp
        return value * 100; 
      }
      const rates = { pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 };
      const multiplier = rates[String(denom).toLowerCase()] || 100;
      return value * multiplier;
    }
    
    return value;
  }


  /**
   * Централизованный расчет цены предмета (в атомах) с учетом репутации
   */
  getCalculatedItemPriceAtoms(item, baseValAtoms, mode) {
    const settings = this.getShopSettings();
    let repModifier = 1.0; 

    // Если включено влияние репутации, высчитываем модификатор
    if (settings.useReputation) {
      const rep = this.actor.getFlag('treasure-hoard-manager', 'reputation') || 0;
      if (rep < 0) {
        repModifier = 1 + (Math.abs(rep) / 100) * 0.5;
      } else if (rep > 0) {
        repModifier = 1 - (rep / 100) * 0.2;
      }
    }

    if (mode === 'merchant') {
      const markup = (settings.priceMarkup ?? 100) / 100;
      return Math.round(baseValAtoms * markup * repModifier);
    } else {
      const buyback = (settings.priceBuyback ?? 50) / 100;
      const sellModifier = settings.useReputation ? (1 / repModifier) : 1.0;
      return Math.round(baseValAtoms * buyback * sellModifier);
    }
  }

  /**
   * Расчет стоимости торговых предметов (возвращает сумму в атомах)
   */
  calculateTradeValue(tradeItems, source = null) {
    return tradeItems.reduce((total, item) => {
      if (item.isCurrency) return total;

      const quantity = Number(item.quantity) || 1;
      const baseValAtoms = this.convertPriceToAtoms(item, item.price);
      const finalPriceAtoms = this.getCalculatedItemPriceAtoms(item, baseValAtoms, source);

      return total + (finalPriceAtoms * quantity);
    }, 0);
  }

  /**
   * Создание элемента предмета для торговой зоны
   */
  createTradeItemElement(item, source) {
    const isIdentified = item.system?.identified !== false;
    const displayName = isIdentified ? item.name : (item.system.unidentified?.name || 'Неопознанный предмет');
    const displayRarity = isIdentified ? (item.system?.rarity || 'common') : 'common';
    const cleanRarity = displayRarity.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
    const actorId = item.actorId || (source === 'merchant' ? this.actor.id : '');

    const adapter = this.shopManager.mainManager.systemAdapter;
    const itemQty = item.quantity || adapter.getItemQuantity(item) || 1;

    return `
      <div class="thm-item-slot rarity-${cleanRarity} trade-item" data-item-id="${item._id}" data-actor-id="${actorId}" data-source="${source}">
        <div class="thm-rarity-bg"></div>
        <img class="thm-item-icon" src="${item.img}" alt="${displayName}">
        <div class="thm-item-qty">${itemQty}</div>
        <button class="trade-item-remove" data-item-id="${item._id}" data-source="${source}" title="Убрать из сделки">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  }

  /**
   * Подтверждение сделки
   */
  async confirmTrade() {
    const tradeBtn = this.html.find('#confirmTrade');
    const adapter = this.shopManager.mainManager.systemAdapter;

    // Блокируем кнопку и включаем анимацию загрузки
    tradeBtn.prop('disabled', true);
    const originalHtml = tradeBtn.html();
    tradeBtn.html('<i class="fas fa-spinner fa-spin"></i> СДЕЛКА...');

    const player = this.getPlayerActor();
    if (!player) {
      ui.notifications.warn("Для совершения сделки выделите свой токен или назначьте персонажа в настройках игрока!");
      tradeBtn.prop('disabled', false).html(originalHtml);
      return;
    }

    const playerTotalAtoms = this.calculateTradeValue(this.playerTradeItems, 'player');
    const merchantTotalAtoms = this.calculateTradeValue(this.merchantTradeItems, 'merchant');

    try {
      // Получаем результат выполнения (true/false)
      const success = await this.executeTrade(playerTotalAtoms, merchantTotalAtoms, this.isBalancedMode);

      if (success) {
        ui.notifications.success('Сделка успешно совершена!');
      } else {
        // Если сделка отменена (нет денег и т.д.), возвращаем кнопку
        tradeBtn.prop('disabled', false).html(originalHtml);
      }
    } catch (error) {
      console.error('THM Shop Interface | Error confirming trade:', error);
      ui.notifications.error('Ошибка при совершении сделки');
      // В случае краша возвращаем кнопку
      tradeBtn.prop('disabled', false).html(originalHtml);
    }
  }

  /**
   * Выполнение сделки
   */
  async executeTrade(playerValueAtoms, merchantValueAtoms, balancedMode = false) {
    const player = this.getPlayerActor();
    const merchant = this.actor;
    const itemManager = game.modules.get(CONSTANTS.MODULE_NAME).manager.itemManager;
    const adapter = this.shopManager.mainManager.systemAdapter;

    const useNpcCurrency = this.getShopSettings().useNpcCurrency ?? true;
    const differenceAtoms = playerValueAtoms - merchantValueAtoms;

    // 1. ПРОВЕРКА КОШЕЛЬКА ТОРГОВЦА ПЕРЕД СДЕЛКОЙ
    if (useNpcCurrency && differenceAtoms > 0) {
      const merchantWalletAtoms = adapter.convertCurrencyToAtoms(adapter.getActorCurrency(merchant));
      if (merchantWalletAtoms < differenceAtoms) {
        ui.notifications.error(`У торговца недостаточно средств! Не хватает: ${adapter.formatCurrencyHtml(differenceAtoms - merchantWalletAtoms)}`);
        return false;
      }
    }

    // 2. СНАЧАЛА ОБНОВЛЯЕМ ВАЛЮТУ (ОСОБЕННО СПИСАНИЕ)
    // Если игрок должен заплатить, списываем деньги ДО перемещения предметов
    const currencySuccess = await this.updateCurrencies(playerValueAtoms, merchantValueAtoms, player);
    if (!currencySuccess) {
      // updateCurrencies сам выведет ошибку "Недостаточно средств"
      return false;
    }

    try {
      // 3. ПЕРЕМЕЩЕНИЕ ПРЕДМЕТОВ (только после успешного списания денег)
      if (balancedMode) {
        if (this.playerTradeItems.length > 0) {
          const itemsToSell = this.playerTradeItems.map(i => ({
            uuid: player.items.get(i._id)?.uuid || `Actor.${player.id}.Item.${i._id}`,
            quantity: i.quantity,
            _id: i._id
          }));
          await itemManager.transferItems(player, merchant, itemsToSell);
        }
        if (this.merchantTradeItems.length > 0) {
          const itemsToBuy = this.merchantTradeItems.map(i => ({
            uuid: merchant.items.get(i._id)?.uuid || `Actor.${merchant.id}.Item.${i._id}`,
            quantity: i.quantity,
            _id: i._id
          }));
          await itemManager.transferItems(merchant, player, itemsToBuy);
        }
      } else if (this.merchantTradeItems.length > 0) {
        const itemsToBuy = this.merchantTradeItems.map(i => ({
          uuid: merchant.items.get(i._id)?.uuid || `Actor.${merchant.id}.Item.${i._id}`,
          quantity: i.quantity,
          _id: i._id
        }));
        await itemManager.transferItems(merchant, player, itemsToBuy);
      } else if (this.playerTradeItems.length > 0) {
        const itemsToSell = this.playerTradeItems.map(i => ({
          uuid: player.items.get(i._id)?.uuid,
          _id: i._id,
          quantity: i.quantity
        })).filter(i => i.uuid || i._id);
        await itemManager.transferItems(player, merchant, itemsToSell);
      }

      // 3. Очистка стола обмена
      this.playerTradeItems = [];
      this.merchantTradeItems = [];
      this.isBalancedMode = false;
      
      // Рендерим изменения
      this.render(true);

      // 4. Оповещение через сокеты
      const module = game.modules.get(CONSTANTS.MODULE_NAME);
      if (module.manager?.socketManager) {
        module.manager.socketManager.broadcast('updateHoard', {
          actorUuid: merchant.uuid,
          action: "inventory_refreshed"
        }).catch(err => console.warn("THM | Broadcast omitted:", err));
      }

      return true;
    } catch (error) {
      console.error('THM | Trade Error:', error);
      throw error;
    }
  }

  /**
   * Получение настроек магазина
   */
  getShopSettings() {
    if (!this.shopManager || !this.actor) return {};
    const info = this.shopManager.getShopInfo(this.actor);
    return info?.settings?.specific || {};
  }

  /**
   * Настройка Drag and Drop (Заглушка) Не актуальна. Drag and Drop перенесена в настройки магазина
   */
  setupDragAndDrop(html) {
    // Здесь будет логика drag and drop
  }

  /**
   * Заглушка для перехвата случайных отправок формы (нажатие Enter или кнопок без типа)
   * Предотвращает краш "must implement the _updateObject method"
   */
  async _updateObject(event, formData) {
    event.preventDefault();
    // Мы ничего не сохраняем стандартным путем формы,
    // так как вся торговля обрабатывается нашими собственными функциями.
  }

  /**
   * Очистка подсказок при закрытии окна
   */
  async close(options = {}) {
    // Очищаем подсказки
    if (this.tooltipsNew) {
      this.tooltipsNew.destroy();
    }

    // Убираем класс активации стилей
    document.body.classList.remove('thm-barter-window-active');

    // Вызываем родительский метод
    return await super.close(options);
  }
}
