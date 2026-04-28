import { CONSTANTS } from '../core/constants.js';

export class TreasureHoardConfig extends FormApplication {
  constructor(actor, options = {}) {
    super(actor, options);
    this.actor = actor;
    this.guiState = { isHoard: null, hoardType: null };
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "thm-config",
      classes: ["sheet", "thm-config-window"],
      template: `modules/${CONSTANTS.MODULE_NAME}/templates/config.hbs`,
      width: 500,
      height: "auto",
      resizable: true,
      closeOnSubmit: true,
      tabs: [{ navSelector: ".tabs", contentSelector: ".content", initial: "general" }]
    });
  }

  getData() {
    // ✅ Работаем ТОЛЬКО с токеном чтобы не читать флаги прототипа
    if (!this.actor.token) {
      console.warn(`THM Config | No token found for actor ${this.actor.name} - showing empty config`);
      return {
        actor: this.actor,
        currentImg: this.actor.img || this.actor.prototypeToken?.texture?.src || "icons/svg/item-bag.svg",
        isHoard: false,
        hoardType: 'container',
        isContainer: true,
        isShop: false,
        isBlackMarket: false,
        hasTypeSpecific: false,
        typeSpecific: {},
        shopTypes: {},
        settings: CONSTANTS.DEFAULTS,
        types: {
          container: "Контейнер / Сундук",
          shop: "Магазин / Торговец",
          blackmarket: "Чёрный рынок"
        },
        warning: '⚠️ Настройки THM доступны только для токенов на сцене. Глобальные актеры-прототипы остаются нетронутыми.'
      };
    }

    const doc = this.actor.token; // ✅ Только токен
    const savedData = doc.getFlag(CONSTANTS.MODULE_NAME, 'data') || {};
    const savedSettings = doc.getFlag(CONSTANTS.MODULE_NAME, 'settings') || {};

    console.log(`THM Config | Getting data for actor: ${this.actor.name} (ID: ${this.actor.id})`);
    console.log(`THM Config | Using token: ${doc.name || doc.id}`);

    const isHoard = this.guiState.isHoard !== null ? this.guiState.isHoard : (savedData.enabled || false);
    const hoardType = this.guiState.hoardType || savedData.type || 'container';

    // 1. Базовые дефолты для магазина
    const shopDefaults = {
      shopType: 'general',
      priceMarkup: 100,
      priceBuyback: 50,
      overwriteName: false,
      shopGender: 'any',
      useNpcCurrency: true,
      merchantLevel: 1,
      // Дефолтная редкость (сумма 100% для баланса)
      rarityCommon: 70,
      rarityUncommon: 20,
      rarityRare: 7,
      rarityVeryRare: 2,
      rarityLegendary: 1,
      // Дефолтные лимиты
      maxItemTypes: 20,
      // Услуги Чёрного рынка
      services: {
        srv1: { enabled: false, price: 500, img: '', desc: 'Получите помощь от теневых сил в сложной ситуации' },
        srv2: { enabled: false, price: 2000, img: '', desc: 'Устраните конкурентов или мешающих персонажей' },
        srv3: { enabled: false, price: 300, img: '', desc: 'Узнайте тайны и получите ценную информацию' },
        srv4: { enabled: false, price: 1000, img: '', desc: 'Закажите уникальный товар или услугу' }
      },
      maxItemQuantity: 10,
      minItemQuantity: 1,
      // Адаптивность (базовые значения, но галочка выключена)
      levelMultiplier: 2,
      baseCommon: 70,
      baseUncommon: 30,
      baseRare: 10,
      baseVeryRare: 2,
      baseLegendary: 1,
      // Категории товаров (дефолтные значения)
      categoryWeapons: false,
      categoryArmor: false,
      categoryPotions: false,
      categoryScrolls: false,
      categoryFood: false,
      categoryGems: false,
      categoryMaterials: false
    };

    // 2. Умное слияние: берем сохраненные данные и накладываем их на дефолты
    // Это заполнит пустые поля, но не затрет то, что мастер уже ввел
    const typeSpecific = foundry.utils.mergeObject(shopDefaults, savedSettings.specific || {});

    // Добавляем данные о типах торговцев из адаптера
    const shopConfiguration = game.THM?.manager?.systemAdapter?.getShopConfiguration() || { shopTypes: {}, categoryConfig: {} };
    const shopTypes = shopConfiguration.shopTypes;

    // Проверяем что typeSpecific имеет значение по умолчанию для shopType
    if (!typeSpecific.shopType) {
      typeSpecific.shopType = 'general';
    }

    return {
      actor: this.actor,
      currentImg: this.actor.img || this.actor.prototypeToken?.texture?.src || "icons/svg/item-bag.svg",
      isHoard: isHoard,
      hoardType: hoardType,
      isContainer: hoardType === 'container',
      isShop: hoardType === 'shop',
      isBlackMarket: hoardType === 'blackmarket', // <-- НОВОЕ
      hasTypeSpecific: !!hoardType,
      typeSpecific: typeSpecific,
      shopTypes: shopTypes,
      pricingConfig: game.THM?.manager?.systemAdapter?.getPricingConfig() || { methods: ['default'] },
      settings: savedSettings.general || CONSTANTS.DEFAULTS,
      types: {
        container: "Контейнер / Сундук",
        shop: "Магазин / Торговец",
        blackmarket: "Чёрный рынок" // <-- Новинка
      }
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // --- ЛОГИКА ТЕГОВ КОМПЕНДИУМОВ ---
    this._renderTags(html); // Отрисовать начальные теги

    // === НОВОЕ: Раскрытие папок компендиума ===
    html.on('click', '.btn-toggle-folders', (e) => {
      e.preventDefault();
      const targetId = $(e.currentTarget).data('target');
      // Плавно раскрываем/скрываем div с папками
      html.find(`#folders-${targetId}`).slideToggle(200);
    });

    // 1. Поиск (Клик по кнопке)
    html.find('#btn-search-compendiums').on('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._searchCompendiums(html);
    });

    // 1.1 Поиск (Enter в поле)
    html.find('#compendium-search-input').on('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation(); // Блокируем отправку формы
        this._searchCompendiums(html);
      }
    });

    // 2. Удаление тега (Делегирование)
    html.on('click', '.remove-tag', (e) => {
      e.preventDefault();
      const idToRemove = $(e.currentTarget).data('id');
      this._removeCompendium(html, idToRemove);
    });

    // 3. Добавление из результатов (Делегирование)
    html.on('click', '.btn-add-compendium', (e) => {
      e.preventDefault();
      const btn = e.currentTarget;
      const idToAdd = $(btn).data('id');
      // Передаем кнопку третьим аргументом для анимации
      this._addCompendium(html, idToAdd, btn);
    });

    // 4. Кнопка "Свернуть / Готово" внизу списка папок
    html.on('click', '.btn-close-folders', (e) => {
      e.preventDefault();
      const targetId = $(e.currentTarget).data('target');
      html.find(`#${targetId}`).slideUp(200); // Плавно скрываем список папок
    });

    // --- ОСТАЛЬНЫЕ ЛИСЕНЕРЫ ---
    html.find('input[name="isHoard"]').change(ev => {
      this.guiState.isHoard = ev.target.checked;
      this.render();
      // Фикс пересчета высоты окна
      setTimeout(() => this.setPosition({ height: "auto" }), 50);
    });

    html.find('select[name="hoardType"]').change(ev => {
      this.guiState.hoardType = ev.target.value;
      this.render();
      // Фикс пересчета высоты окна
      setTimeout(() => this.setPosition({ height: "auto" }), 50);
    });

    html.find('input[name="shopType"]').change(ev => {
      this.autoConfigureCategories(html, ev.target.value);
      // Фикс пересчета высоты окна
      setTimeout(() => this.setPosition({ height: "auto" }), 50);
    });

    // ФИКС БАГА ПОЛЗУНКОВ: Обновление значений при движении
    html.find('.rarity-row input[type="range"]').on('input', (e) => {
      $(e.currentTarget).siblings('.rarity-value').text(e.target.value + '%');
    });
  }

  // --- МЕТОДЫ УПРАВЛЕНИЯ ТЕГАМИ ---

  _getSources(html) {
    const hiddenInput = html.find('input[name="inventorySources"]');
    const val = hiddenInput.val();
    return val ? val.split(',').filter(s => s.trim()) : [];
  }

  _setSources(html, sources) {
    const hiddenInput = html.find('input[name="inventorySources"]');
    hiddenInput.val(sources.join(','));
    this._renderTags(html);
  }

  _renderTags(html) {
    const sources = this._getSources(html);
    const container = html.find('#active-compendium-tags');

    // Если пусто, просто очищаем
    if (sources.length === 0) {
      container.empty();
      return;
    }

    let tagsHtml = '';

    sources.forEach(sourceId => {
      let packId = sourceId;
      let folderId = null;
      let isFolder = false;

      if (sourceId.includes(':')) {
        [packId, folderId] = sourceId.split(':');
        isFolder = true;
      }

      const pack = game.packs.get(packId);
      let label = pack ? pack.title : packId;
      let icon = isFolder ? "fa-folder-open" : "fa-book";

      if (isFolder && pack && pack.folders) {
        const folder = pack.folders.get(folderId);
        if (folder) {
          label = `${pack.title} 📁 ${folder.name}`;
        }
      }

      // Сборка строки вместо jQuery объектов
      tagsHtml += `
        <div class="compendium-tag" title="${sourceId}" style="${isFolder ? 'border-color: #c0a060;' : ''}">
          <i class="fas ${icon}" style="${isFolder ? 'color: #c0a060;' : ''}"></i> ${label}
          <i class="fas fa-times remove-tag" data-id="${sourceId}"></i>
        </div>`;
    });

    // Отрисовка тегов одним махом
    container.html(tagsHtml);
  }

  _removeCompendium(html, id) {
    let sources = this._getSources(html);
    sources = sources.filter(s => s !== id);
    this._setSources(html, sources);
  }

  /**
   * Добавление компендиума/папки в список источников с анимацией кнопки
   */
  _addCompendium(html, id, btnElement) {
    const sources = this._getSources(html);
    if (!sources.includes(id)) {
      sources.push(id);
      this._setSources(html, sources);
    }

    // Если передали кнопку, меняем её вид на "Добавлено" (зеленая галочка)
    if (btnElement) {
      const $btn = $(btnElement);
      $btn.removeClass('btn-add-compendium'); // Убираем класс, чтобы не кликалось дважды
      $btn.css({
        'background': 'rgba(76, 209, 55, 0.15)',
        'color': '#4cd137',
        'border-color': '#4cd137'
      });
      $btn.html('<i class="fas fa-check"></i>');
      $btn.prop('disabled', true); // Блокируем кнопку
    }

    // Логирование для отладки
    console.log(`THM Config | Added compendium/folder: ${id}`);
    console.log(`THM Config | Current sources:`, sources);

    // ВАЖНО: Мы убрали отсюда очистку поиска (html.find('#compendium-search-results').empty()),
    // теперь список не будет закрываться сам по себе!
  }

  _searchCompendiums(html) {
    const query = html.find('#compendium-search-input').val().toLowerCase().trim();
    const resultsDiv = html.find('#compendium-search-results');

    if (!query) return;

    resultsDiv.html('<div style="color:#888; padding: 10px;"><i class="fas fa-spinner fa-spin"></i> Поиск...</div>');

    // Ищем совпадения (в памяти, это очень быстро)
    const matches = game.packs.filter(p =>
      p.title.toLowerCase().includes(query) ||
      p.metadata.id.toLowerCase().includes(query)
    );

    if (matches.length === 0) {
      resultsDiv.html('<div style="color:#ff6b6b; padding: 10px;">Ничего не найдено</div>');
      return;
    }

    // === ОПТИМИЗАЦИЯ: Собираем ВЕСЬ HTML в одну текстовую строку ===
    let finalHtml = '';

    matches.forEach(pack => {
      const hasFolders = pack.folders && pack.folders.size > 0;
      const packIdSafed = pack.metadata.id.replace(/\./g, '-');

      // Добавляем шапку компендиума
      finalHtml += `
        <div class="compendium-search-item" style="display: flex; flex-direction: column; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; margin-bottom: 8px; padding: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong style="font-size: 1.1em;">${pack.title}</strong>
              <br><small style="color:#aaa;">${pack.metadata.id}</small>
            </div>
            <div style="display: flex; gap: 5px;">
              ${hasFolders ? `<button type="button" class="btn-toggle-folders" data-target="${packIdSafed}" style="width: max-content; padding: 0 8px; font-size: 0.9em;"><i class="fas fa-folder-open"></i> Папки</button>` : ''}
              <button type="button" class="btn-add-compendium" data-id="${pack.metadata.id}" style="width: max-content; padding: 0 8px; font-size: 0.9em;">
                <i class="fas fa-plus"></i> Весь
              </button>
            </div>
          </div>`;

      // Если есть папки, добавляем их сразу как текст
      if (hasFolders) {
        const foldersListId = `folders-${packIdSafed}`;
        finalHtml += `
          <div id="${foldersListId}" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
            <div style="font-size: 0.8em; color: #888; margin-bottom: 5px; text-transform: uppercase;">Содержимое:</div>`;

        // Сортировка быстрая, на скорость не влияет
        const sortedFolders = Array.from(pack.folders.values()).sort((a, b) => a.name.localeCompare(b.name));

        sortedFolders.forEach(folder => {
          finalHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding-left: 10px; border-left: 2px solid #555;">
              <span style="color: #ddd;"><i class="fas fa-folder" style="color: #c0a060;"></i> ${folder.name}</span>
              <button type="button" class="btn-add-compendium" data-id="${pack.metadata.id}:${folder.id}" style="width: max-content; padding: 0 6px; height: 22px; line-height: 20px; font-size: 0.8em; background: rgba(0,0,0,0.3);">
                <i class="fas fa-plus"></i>
              </button>
            </div>`;
        });

        // Добавляем кнопку "Свернуть"
        finalHtml += `
            <div style="margin-top: 8px; text-align: center;">
              <button type="button" class="btn-close-folders" data-target="${foldersListId}" style="width: 100%; padding: 4px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #aaa; font-size: 0.85em;">
                <i class="fas fa-chevron-up"></i> Свернуть папки
              </button>
            </div>
          </div>`;
      }

      // Закрываем карточку компендиума
      finalHtml += `</div>`;
    });

    // === ЕДИНСТВЕННЫЙ вызов отрисовки в браузере (это убирает лаги) ===
    resultsDiv.html(finalHtml);
  }

  async _updateObject(event, formData) {
    const isHoard = formData.isHoard;
    const type = formData.hoardType;

    // === НОВАЯ ЛОГИКА ГЕНЕРАЦИИ ИМЕНИ ===
    let finalShopName = this.actor.name;
    if (isHoard && type === 'shop' && formData.overwriteName) {
      try {
        const { generateShopkeeperName } = await import('../shops/name-generators.js');
        finalShopName = generateShopkeeperName(formData.shopGender || 'any');
        console.log(`THM Config | Сгенерировано новое имя: ${finalShopName}`);

        // В v12 для синтетических актеров (токенов) нужно обновлять ТОЛЬКО токен.
        if (this.actor.token) {
          await this.actor.token.update({
            name: finalShopName,
            "delta.name": finalShopName
          });
        } else {
          // Для базовых актеров в боковой панели
          await this.actor.update({
            name: finalShopName,
            "prototypeToken.name": finalShopName
          });
        }
      } catch (err) {
        console.error("THM Config | Ошибка генерации имени:", err);
      }
    }
    // =====================================

    // 1. Подготовка данных флагов
    const flagsData = {
      enabled: isHoard,
      type: isHoard ? formData.hoardType : CONSTANTS.PILE_TYPES.CONTAINER,
      version: "1.0.0",
      shopName: finalShopName // <-- Сохраняем имя для интерфейса магазина
    };
    const settingsData = {
      general: {
        interactionDistance: formData.interactionDistance,
        showItemCards: formData.showItemCards,
        stackItems: formData.stackItems,
        deleteWhenEmpty: formData.deleteWhenEmpty
      },
      specific: {
        moneySplit: formData.moneySplit,
        access: { online: formData.accessOnline, scene: formData.accessScene },
        // Магазин настройки
        inventorySources: formData.inventorySources,
        shopType: formData.shopType,
        priceMarkup: Number(formData.priceMarkup) || 100,
        priceBuyback: Number(formData.priceBuyback) || 50,
        alwaysOpen: formData.alwaysOpen,
        useReputation: formData.useReputation,
        useNpcCurrency: formData.useNpcCurrency,
        merchantLevel: Number(formData.merchantLevel) || 1,
        overwriteName: formData.overwriteName || false,
        shopGender: formData.shopGender || 'any',
        // Категории
        categoryWeapons: formData.categoryWeapons,
        categoryArmor: formData.categoryArmor,
        categoryPotions: formData.categoryPotions,
        categoryScrolls: formData.categoryScrolls,
        categoryFood: formData.categoryFood,
        categoryGems: formData.categoryGems,
        categoryMaterials: formData.categoryMaterials,
        // Умная адаптивность
        smartAdaptive: formData.smartAdaptive,
        levelMultiplier: formData.levelMultiplier,
        baseCommon: formData.baseCommon,
        baseUncommon: formData.baseUncommon,
        baseRare: formData.baseRare,
        baseVeryRare: formData.baseVeryRare,
        baseLegendary: formData.baseLegendary,
        // Ограничения
        maxItemTypes: formData.maxItemTypes,
        maxItemQuantity: formData.maxItemQuantity,
        minItemQuantity: formData.minItemQuantity,
        // Услуги Чёрного рынка
        services: {
          srv1: { enabled: formData.srv1_enabled, price: formData.srv1_price, img: formData.srv1_img, desc: formData.srv1_desc },
          srv2: { enabled: formData.srv2_enabled, price: formData.srv2_price, img: formData.srv2_img, desc: formData.srv2_desc },
          srv3: { enabled: formData.srv3_enabled, price: formData.srv3_price, img: formData.srv3_img, desc: formData.srv3_desc },
          srv4: { enabled: formData.srv4_enabled, price: formData.srv4_price, img: formData.srv4_img, desc: formData.srv4_desc }
        }
      }
    };

    // 2. ВАЖНО: Работаем ТОЛЬКО с токеном чтобы не перезаписывать прототип
    if (!this.actor.token) {
      ui.notifications.warn('⚠️ Настройки магазинов можно сохранять только на токенах на сцене, а не на глобальных актерах-прототипах!');
      console.warn('THM Config | Attempted to save shop settings on global actor - blocked to preserve prototype');
      return;
    }

    const targetDoc = this.actor.token; // ✅ Работаем только с токеном

    // Пишем во флаги ОДНИМ пакетом (минимизирует риск конфликтов EmbeddedCollection в v12)
    await targetDoc.update({
      [`flags.${CONSTANTS.MODULE_NAME}.data`]: flagsData,
      [`flags.${CONSTANTS.MODULE_NAME}.settings`]: settingsData
    });

    // 3. ГЕНЕРАЦИЯ ПРЕДМЕТОВ (НОВАЯ ЛОГИКА)
    if (isHoard && type === 'shop') {
      const module = game.modules.get(CONSTANTS.MODULE_NAME);
      const shopManager = game.THM.manager?.shopManager;

      // Проверяем, генерировался ли инвентарь ранее
      const hasGenerated = targetDoc.getFlag(CONSTANTS.MODULE_NAME, 'data.inventoryGenerated');

      // Если инвентарь еще не создавался и указаны источники - генерируем его!
      if (!hasGenerated && settingsData.specific.inventorySources && shopManager) {
        console.log(`THM | Initializing first-time inventory for ${this.actor.name}`);
        ui.notifications.info(`Генерация товаров для "${this.actor.name}"...`);
        // ВАЖНО: передаем this.actor, так как предметы создаются именно на актере
        await shopManager.generateInitialInventory(this.actor, settingsData);
      }

      // ✅ НОВАЯ ЛОГИКА: Применяем портрет если включена генерация имени
      if (settingsData.specific.overwriteName && shopManager) {
        console.log(`THM Config | Applying portrait due to name generation being enabled`);
        console.log(`THM Config | Actor: ${this.actor.name}, has token: ${!!this.actor.token}`);

        // Определяем тип магазина для портрета
        const shopType = shopManager.detectShopType(settingsData.specific);
        console.log(`THM Config | Detected shop type for portrait: ${shopType}`);
        console.log(`THM Config | Settings specific:`, settingsData.specific);

        // ТЕСТ: Проверяем доступность папок перед применением
        const folderCheck = await shopManager.appearanceManager.checkFolders();
        console.log(`THM Config | Portrait folder availability:`, folderCheck);

        // Проверяем токен перед применением
        if (this.actor.token && this.actor.token.document) {
          console.log(`THM Config | Token exists before portrait:`, {
            name: this.actor.token.name,
            img: this.actor.token.document.img,
            texture: this.actor.token.document.texture?.src
          });
        }

        // Применяем портрет и токен
        await shopManager.appearanceManager.applyShopAppearance(this.actor, shopType, {
          name: this.actor.name,
          gender: settingsData.specific.shopGender || 'any' // ✅ Передаем пол из настроек
        });

        // Проверяем результат
        if (this.actor.token && this.actor.token.document) {
          console.log(`THM Config | Token after portrait:`, {
            name: this.actor.token.name,
            img: this.actor.token.document.img,
            texture: this.actor.token.document.texture?.src
          });
        }
      }
    }

    // 3.5 ГЕНЕРАЦИЯ ЭКСКЛЮЗИВА ДЛЯ ЧЁРНОГО РЫНКА
    if (isHoard && type === 'blackmarket') {
      const bmManager = game.THM.manager?.blackMarketManager;
      const dataFlag = targetDoc.getFlag(CONSTANTS.MODULE_NAME, 'data') || {};
      const currentOffers = dataFlag.currentOffers || [];
      const hasActiveOffer = currentOffers.some(o => o.status === 'active');

      const compendiums = formData.inventorySources ? formData.inventorySources.split(',').map(s => s.trim()) : [];
      const firstCompendium = compendiums[0];

      if (!hasActiveOffer && firstCompendium && bmManager) {
        console.log(`THM Config | Генерация эксклюзива из: ${firstCompendium}`);
        const durationHours = formData.bmOfferDuration || 24;

        try {
          // ПЕРЕДАЕМ targetDoc ТОКЕН
          await bmManager.createExclusiveOffer(targetDoc, firstCompendium, durationHours);
          ui.notifications.info("Эксклюзивный товар успешно сгенерирован!");
        } catch (err) {
          console.error("THM Config | Ошибка генерации эксклюзива:", err);
          ui.notifications.error(err.message || "Не удалось сгенерировать эксклюзив.");
        }
      }
    }

    // 4. Если включена умная адаптивность - настраиваем автообновление
    if (isHoard && type === 'shop' && formData.smartAdaptive) {
      this.setupSmartAdaptive(this.actor, settingsData.specific);
    }

    // 5. АВТОМАТИЧЕСКИ ЗАКРЫВАЕМ СТАНДАРТНЫЙ ЛИСТ
    if (flagsData.enabled) {
      if (this.actor.sheet) {
        this.actor.sheet.close({ force: true });
      }
      // Открываем наш интерфейс по типу
      if (type === 'shop') {
        game.THM.uiManager.showShopInterface(this.actor);
      } else if (type === 'blackmarket') {
        game.THM.uiManager.showBlackMarketInterface(this.actor);
      } else {
        game.THM.uiManager.showContainerInterface(this.actor);
      }
    } else if (!flagsData.enabled && this.actor.sheet) {
      this.actor.sheet.render(true, { bypassTHM: true });
    }

    ui.notifications.info(`THM | Сохранено для ${this.actor.name}`);
  }

  setupSmartAdaptive(actor, settings) {
    // Создаем или обновляем хук для отслеживания входа игроков
    Hooks.off('updateActor', this.adaptiveUpdateHandler);
    this.adaptiveUpdateHandler = (actor, changes) => {
      if (actor.hasPlayerOwner && changes.system?.details?.level) {
        this.updateShopInventory(actor, settings);
      }
    };
    Hooks.on('updateActor', this.adaptiveUpdateHandler);

    // Также обновляем при входе игрока в игру
    Hooks.on('userConnected', (user) => {
      if (user.character && user.character.hasPlayerOwner) {
        this.updateShopInventory(user.character, settings);
      }
    });
  }

  async updateShopInventory(actor, settings) {
    if (!settings.smartAdaptive) return;

    const level = actor.system?.details?.level || 1;
    const multiplier = settings.levelMultiplier || 2;

    // Вычисляем новые проценты редкости
    let newRarity = {
      common: Math.max(5, settings.baseCommon - (level * multiplier)),
      uncommon: Math.min(50, settings.baseUncommon + (level * multiplier * 0.5)),
      rare: Math.min(40, settings.baseRare + (level * multiplier * 0.8)),
      veryRare: Math.min(30, settings.baseVeryRare + (level * multiplier * 1.2)),
      legendary: level >= 15 ? Math.min(25, settings.baseLegendary + ((level - 15) * multiplier * 1.5)) : 0
    };

    // Нормализуем до 100%
    const total = Object.values(newRarity).reduce((a, b) => a + b, 0);
    Object.keys(newRarity).forEach(key => {
      newRarity[key] = Math.round((newRarity[key] / total) * 100);
    });

    // Обновляем ассортимент магазина
    console.log(`THM | Обновлен ассортимент для ${actor.name} (уровень ${level}):`, newRarity);



  }

  _getDefaultImage(type) {
    const icons = {
      container: "icons/containers/chest/chest-reinforced-box-brown.webp",
      hoard: "icons/commodities/currency/coins-assorted-mix-copper-silver-gold.webp",
      shop: "icons/environment/settlement/market-stall.webp"
    };
    return icons[type] || "icons/svg/item-bag.svg";
  }

  /**
   * Проверка доступности компендиумов
   */
  async checkCompendiums(html) {
    try {
      const input = html.find('#compendium-input');
      const statusDiv = html.find('#compendium-status');

      // Разбиваем ввод по запятым, чистим пробелы и убираем пустые
      const rawSources = input.val().split(',').map(s => s.trim()).filter(s => s);

      if (rawSources.length === 0) {
        statusDiv.html('<div class="compendium-error" style="color: #ff6b6b;">⚠️ Введите названия компендиумов</div>').show();
        return;
      }

      statusDiv.html('<div class="compendium-loading" style="color: #888;"><i class="fas fa-spinner fa-spin"></i> Поиск...</div>').show();

      const results = [];
      const validIds = new Set(); // Уникальные валидные ID

      for (const source of rawSources) {
        // 1. Проверяем, является ли это уже валидным ID
        let pack = game.packs.get(source);

        if (pack) {
          const itemCount = pack.index.size || (await pack.getIndex()).size;
          results.push({
            name: pack.metadata.id,
            title: pack.title,
            found: true,
            count: itemCount,
            type: pack.documentName,
            status: '✅ Подключен'
          });
          validIds.add(pack.metadata.id);
          continue;
        }

        // 2. Ищем по частичному совпадению (название или ID)
        const searchLower = source.toLowerCase();
        const matches = game.packs.filter(p =>
          p.title.toLowerCase().includes(searchLower) ||
          p.metadata.id.toLowerCase().includes(searchLower)
        );

        if (matches.length === 1) {
          // Нашли ровно одно совпадение - АВТОЗАМЕНА
          pack = matches[0];
          const itemCount = pack.index.size || (await pack.getIndex()).size;
          results.push({
            name: pack.metadata.id,
            title: pack.title,
            found: true,
            count: itemCount,
            type: pack.documentName,
            status: '✅ Исправлено (было "' + source + '")'
          });
          validIds.add(pack.metadata.id);
        } else if (matches.length > 1) {
          // Нашли несколько - предлагаем выбор
          const suggestions = matches.map(m =>
            `<a href="#" class="thm-compendium-suggestion" data-id="${m.metadata.id}" style="color: #c0a060; text-decoration: underline; margin-right: 5px;">${m.metadata.id}</a>`
          ).join(', ');

          results.push({
            name: source,
            found: false,
            status: `⚠️ Уточните:<br><small>${suggestions}</small>`
          });
          // Оставляем исходный текст в поле, чтобы пользователь сам исправил
          validIds.add(source);
        } else {
          // Ничего не нашли
          results.push({ name: source, found: false, status: '❌ Не найден' });
          // Оставляем исходный текст
          validIds.add(source);
        }
      }

      // Обновляем поле ввода (собираем обратно в строку)
      if (validIds.size > 0) {
        input.val(Array.from(validIds).join(', '));
      }

      // Рисуем красивый отчет
      const resultsHtml = results.map(result => {
        const color = result.found ? '#4cd137' : '#ff6b6b';
        return `
          <div class="compendium-result" style="margin-bottom: 5px; padding: 5px; background: rgba(0,0,0,0.2); border-left: 3px solid ${color};">
            <div style="display: flex; justify-content: space-between;">
              <span style="font-weight: bold;">${result.name}</span>
              <span style="color: ${color}; font-size: 12px;">${result.status}</span>
            </div>
            ${result.found ?
            `<div style="font-size: 11px; opacity: 0.7;">${result.title} — ${result.count} предметов</div>` : ''}
          </div>
        `;
      }).join('');

      statusDiv.html(`<div class="compendium-results" style="margin-top: 10px;">${resultsHtml}</div>`);

    } catch (error) {
      console.error('THM | Error in checkCompendiums:', error);
      html.find('#compendium-status').html('<div class="compendium-error" style="color: red;">❌ Ошибка скрипта</div>').show();
    }
  }

  /**
   * Автоматическая настройка категорий на основе типа торговца
   */
  autoConfigureCategories(html, shopType) {
    const shopConfiguration = game.THM?.manager?.systemAdapter?.getShopConfiguration() || { categoryConfig: {} };
    const categoryConfig = shopConfiguration.categoryConfig;

    const config = categoryConfig[shopType];
    if (config) {
      Object.keys(config).forEach(category => {
        const checkbox = html.find(`input[name="${category}"]`);
        if (checkbox.length > 0) {
          checkbox.prop('checked', config[category]);
        }
      });

      // ❌ НЕ меняем иконку для магазинов - иконки теперь только для контейнеров!
      // Магазины используют свою систему портретов из папок shop-portraits
      console.log(`THM Config | Categories auto-configured for shop type: ${shopType} (icon change disabled)`);

      // Показываем уведомление
      ui.notifications.info(`Категории автоматически настроены для типа: ${shopType}`);
    }
  }
}
