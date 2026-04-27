import { CONSTANTS } from './constants.js';
import { HoardManager } from '../item-management/hoard-manager.js';
import { ItemManager } from '../item-management/item-manager.js';
import { TradeManager } from '../trade/trade-manager.js';
import { ShopManager } from '../shops/shop-manager.js';
import { BlackMarketManager } from '../managers/blackmarket-manager.js';
import { UIManager } from '../ui/ui-manager.js';
import { SocketManager } from '../sockets/socket-manager.js';

export class TreasureHoardManager {
  constructor(systemAdapter) {
    this.systemAdapter = systemAdapter;
    this.itemManager = new ItemManager(this); 
    this.hoardManager = new HoardManager(this);
    this.tradeManager = new TradeManager(this);
    this.shopManager = new ShopManager(this);
    this.blackMarketManager = new BlackMarketManager(this);
    this.uiManager = new UIManager(this);
    this.socketManager = new SocketManager(this);
    
    // Кэш для проверок
    this._validationCache = new Map();
    this._cacheTimeout = 5000; // 5 секунд
    
    // Debounce для оптимизации перерисовки
    this.debouncedRefresh = foundry.utils.debounce(this._refreshRelatedInterfaces.bind(this), 150);
  }

  /**
   * Оптимизированная проверка флагов с кэшированием
   */
  isValidHoard(target) {
    const actor = target.actor || target;
    
    if (!actor) return false;
    
    // Создаем ключ для кэша с учетом токена
    const tokenId = actor.token?.id || actor._sourceToken?.id || 'no-token';
    const cacheKey = `${actor.uuid || actor.id}-${tokenId}`;
    
    // Проверяем кэш
    const cached = this._validationCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this._cacheTimeout) {
      return cached.result;
    }
    
    // Выполняем проверку
    const result = this._performValidation(actor);
    
    // Сохраняем в кэш
    this._validationCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
    
    // Очищаем старые записи из кэша
    this._cleanupCache();
    
    return result;
  }
  
  /**
   * Основная логика валидации (вынесена из isValidHoard)
   */
  _performValidation(actor) {
    // ✅ НОВАЯ ЛОГИКА: СНАЧАЛА ПРОВЕРЯЕМ ТОКЕН 
    let flagTarget = actor;
    if (actor.token) {
      flagTarget = actor.token; // ПРИОРИТЕТ ТОКЕНУ - всегда!
    }
    
    const tokenFlags = foundry.utils.getProperty(flagTarget, 'flags.treasure-hoard-manager');
    
    // ПРОВЕРЯЕМ В data И НА ПРЯМУЮ
    const tokenType = tokenFlags?.data?.type || tokenFlags?.type;
    const tokenEnabled = tokenFlags?.enabled === true || tokenFlags?.data?.enabled === true;
    if (tokenEnabled && tokenType && Object.values(CONSTANTS.PILE_TYPES).some(type => type === tokenType)) {
      return true; // ✅ Нашли флаги на токене - валидно!
    }
    
    // ЕСЛИ НА ТОКЕНЕ НЕТ ФЛАГОВ, ПРОВЕРЯЕМ АКТЕРА (fallback)
    if (actor.token) {
      console.log(`THM | No flags found on token, checking actor fallback for ${actor.name}`);
    }
    
    const actorFlags = foundry.utils.getProperty(actor, 'flags.treasure-hoard-manager');
    
    // ПРОВЕРЯЕМ В data И НА ПРЯМУЮ
    const actorType = actorFlags?.data?.type || actorFlags?.type;
    const actorEnabled = actorFlags?.enabled === true || actorFlags?.data?.enabled === true;
    const isValid = actorEnabled && actorType && Object.values(CONSTANTS.PILE_TYPES).some(type => type === actorType);
    
    return isValid;
  }
  
  /**
   * Очистка кэша от старых записей
   */
  _cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this._validationCache.entries()) {
      if (now - value.timestamp > this._cacheTimeout) {
        this._validationCache.delete(key);
      }
    }
  }
  
  /**
   * Сброс кэша (например, после изменения флагов)
   */
  clearValidationCache() {
    this._validationCache.clear();
  }

  /**
   * Проверка типа контейнера
   */
  isContainerType(target, type) {
    if (!target) return false;
    
    // СНАЧАЛА ПРОВЕРЯЕМ ВАЛИДНОСТЬ ЧЕРЕЗ КЭШ
    if (!this.isValidHoard(target)) return false;
    
    // ЕСЛИ ВАЛИДЕН - ЧИТАЕМ КОНКРЕТНЫЙ ТИП
    const actor = target.actor || target;
    const flagTarget = actor.token || actor;
    const flags = foundry.utils.getProperty(flagTarget, 'flags.treasure-hoard-manager');
    const flagType = flags?.data?.type || flags?.type;
    return flagType === type;
  }

  /**
   * Проверка на контейнер
   */
  isContainer(target) {
    return this.isContainerType(target, CONSTANTS.PILE_TYPES.CONTAINER);
  }

  /**
   * Проверка на магазин
   */
  isShop(target) {
    return this.isContainerType(target, CONSTANTS.PILE_TYPES.SHOP);
  }

  /**
   * Проверка на чёрный рынок
   */
  isBlackMarket(target) {
    return this.isContainerType(target, CONSTANTS.PILE_TYPES.BLACKMARKET);
  }

  /**
   * Проверка на кучу добычи
   */
  isHoard(target) {
    return this.isContainerType(target, CONSTANTS.PILE_TYPES.HOARD);
  }

  /**
   * Вспомогательные функции для работы с canvas
   */
  getCanvasMouse() {
    return canvas?.app?.renderer?.plugins?.interaction?.pointer ?? canvas?.app?.renderer?.events?.pointer;
  }

  getTokensAtLocation(position) {
    const tokens = [...canvas.tokens.placeables].filter((token) => token?.mesh?.visible);
    return tokens.filter((token) => {
      return position.x >= token.x && position.x < token.x + token.document.width * canvas.grid.size && position.y >= token.y && position.y < token.y + token.document.height * canvas.grid.size;
    });
  }

  getDocument(token) {
    return token.document;
  }

  /**
   * Регистрация взаимодействий - хуки
   */
  registerInteractions() {
    console.log(`THM | Registering interactions...`);
    console.log(`THM | User: ${game.user.name} (${game.user.id})`);
    console.log(`THM | User isGM: ${game.user.isGM}`);
    
    // ПРОВЕРЯЕМ НАСТРОЙКИ МОДУЛЯ
    try {
      const moduleSettings = game.settings.get(CONSTANTS.MODULE_NAME, 'settings') || {};
      console.log(`THM | Module settings:`, moduleSettings);
      console.log(`THM | Interaction distance from settings:`, moduleSettings?.general?.interactionDistance || CONSTANTS.DEFAULTS.INTERACTION_DISTANCE);
    } catch (error) {
      console.log(`THM | Settings not available yet:`, error.message);
      console.log(`THM | Using default interaction distance:`, CONSTANTS.DEFAULTS.INTERACTION_DISTANCE);
    }
    
    if (!game.modules.get('lib-wrapper')?.active) {
      console.error('THM | libWrapper not available!');
      return;
    }

    const self = this;

    // ХУК PRE_RENDER_SHEET - перехватываем рендер до открытия листа
    Hooks.on("preRenderActorSheet", (doc, forced, options) => {
      const renderTHMInterface = forced && !options?.bypassTHM && self.isValidHoard(doc);
      if (!renderTHMInterface) return;
      
      console.log(`THM | Pre-render hook blocking sheet for: ${doc.name}`);
      self.renderTHMInterface(doc);
      return false; // БЛОКИРУЕМ СТАНДАРТНЫЙ ЛИСТ
    });

    // ПЕРЕОПРЕДЕЛЯЕМ render ДЛЯ ВСЕХ ЛИСТОВ АКТЕРОВ
    const sheetOverrides = Object.keys(CONFIG.Actor.sheetClasses).reduce((acc, str) => {
      const sheets = Object.keys(CONFIG.Actor.sheetClasses[str]);
      return acc.concat(
        sheets.filter((sheet) => {
          return !acc.some((override) => override.includes(`["${sheet}"]`));
        }).map((sheet) => {
          return `CONFIG.Actor.sheetClasses.${str}.["${sheet}"].cls.prototype.render`;
        })
      );
    }, []).flat();

    // Метод override для рендера
    const sheetOverrideMethod = function(wrapped, forced, options, ...args) {
      const renderTHMInterface = Hooks.call("preRenderActorSheet", this.document, forced, options) === false;
      if (this.state > Application.RENDER_STATES.NONE) {
        if (renderTHMInterface) {
          // Наш интерфейс открыт через хук, НЕ вызываем стандартный
          return;
        } else {
          return wrapped(forced, options, ...args);
        }
      }
      if (renderTHMInterface) return; // КЛЮЧЕВОЕ! БЛОКИРУЕМ СТАНДАРТНЫЙ
      return wrapped(forced, options, ...args);
    };

    // Регистрируем для каждого листа
    for (const override of sheetOverrides) {
      try {
        libWrapper.register(CONSTANTS.MODULE_NAME, override, sheetOverrideMethod, "MIXED");
      } catch (err) {
        console.warn(`THM | Could not override "${override}" due to error: ${err}`);
      }
    }

    // ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ДВОЙНОГО КЛИКА
    if (!game.user.isGM) {
      let clicked = false;
      window.addEventListener("mousedown", (event) => {
        if (!canvas.ready) return;
        if (!(canvas.activeLayer instanceof foundry.canvas.layers.TokenLayer)) return;
        if (game.activeTool !== "select") return;
        
        const hover = document.elementFromPoint(event.clientX, event.clientY);
        if (!hover || hover.id !== "board") return;
        if (event.button !== 0) return; // Только левая кнопка
        
        const pos = self.getCanvasMouse().getLocalPosition(canvas.app.stage);
        const tokens = self.getTokensAtLocation(pos);
        
        if (!tokens.length) return;
        tokens.sort((a, b) => b.zIndex - a.zIndex);
        const token = tokens[0]; // Используем сам токен
        
        if (clicked === token) {
          clicked = false;
          console.log(`THM | Double click detected on token: ${token.name}`);
          
          // Если токен принадлежит текущему игроку (или это Мастер кликает по своему NPC) - не начинаем торговлю!
          if (token.document?.isOwner) {
            return; // Прерываем функцию, позволяя Foundry просто открыть чарник
          }
          
          // (Опционально) Если пользователь пытается начать торговлю, но у него самого не выбран персонаж:
          if (!game.user.character && !game.user.isGM) {
            ui.notifications.warn("Для торговли вам нужно назначить своего персонажа в настройках игрока!");
            return;
          }
          
          // ПРОВЕРКА: ЭТО КОНТЕЙНЕР THM?
          if (self.isValidHoard(token.document)) {
            console.log(`THM | Opening THM interface for: ${token.name}`);
            self.renderTHMInterface(token.document, { bypassPermission: true }); // ОБХОДИМ ПРОВЕРКУ ПРАВ!
            return;
          }
          
          // ПРОВЕРКА: ЭТО ТОКЕН ДРУГОГО ИГРОКА (ДЛЯ ТОРГОВЛИ)?
          if (!game.user.isGM && token.actor && self._isPlayerToken(token) && self._canTradeWith(token)) {
            console.log(`THM | Initiating trade with: ${token.name}`);
            self._initiateTrade(token);
            return;
          }
          
          return;
        }
        clicked = token;
        setTimeout(() => {
          clicked = false;
        }, 500);
      });
    }

    // ПЕРЕХВАТ ДРОПА НА СЦЕНУ
    Hooks.on("dropCanvasData", (canvas, dropData) => {
      return self.handleCanvasDrop(canvas, dropData);
    });

    // ПЕРЕХВАТ КЛИКА - открываем наш интерфейс
    libWrapper.register(CONSTANTS.MODULE_NAME, "CONFIG.Token.objectClass.prototype._onClickLeft2", function (wrapped, ...args) {
      // ПРОВЕРКА ВАЛИДНОСТИ КУЧИ - ОДНА ПРОВЕРКА!
      if (!self.isValidHoard(this.document)) {
        return wrapped(...args);
      }
      
      // ПРОВЕРКА НА ЗАПЕРТОСТЬ для игроков
      const isLocked = this.document.getFlag(CONSTANTS.MODULE_NAME, 'data.locked') || false;
      if (isLocked && !game.user.isGM) {
        ui.notifications.warn('Сундук заперт!');
        return wrapped(...args);
      }
      
      // ПРОВЕРКА ПРАВ НА ВЗАИМОДЕЙСТВИЕ - гибкая проверка как в hoard manager
      let hasPermission = game.user.isGM;
      
      // Если не ГМ, проверяем через hoard manager (без дублирования isValidHoard)
      if (!game.user.isGM) {
        const interactionCheck = self.hoardManager.canInteract(this.document, game.user);
        hasPermission = interactionCheck.allowed;
        
        // Показываем причину отказа если есть
        if (!interactionCheck.allowed) {
          ui.notifications.warn(interactionCheck.reason);
          return wrapped(...args);
        }
      }
      
      // Если нет прав - используем стандартное поведение
      if (!hasPermission) {
        return wrapped(...args);
      }
      
      // Блокируем стандартный лист актера
      event.preventDefault();
      event.stopPropagation();
      
      // Открываем наш интерфейс
      self.renderTHMInterface(this.document);
      
      return false;
    }, "MIXED");
  }

  /**
   * Открываем интерфейс по типу
   */
  async renderTHMInterface(target, options = {}) {
    // ДОБАВЬ ЭТУ СТРОКУ:
    if (Hooks.call("thm.preRenderInterface", target, options) === false) return;

    const actor = target.actor || target;
    
    // ПРОВЕРЯЕМ ПРАВА ДОСТУПА - как в Foundry VTT
    let hasPermission = game.user.isGM;
    
    // ОБХОД ПРОВЕРКИ ПРАВ для двойного клика игрока
    if (options.bypassPermission) {
      hasPermission = true;
    } else {
      // Если это токен, проверяем права токена через testUserPermission
      if (target instanceof TokenDocument) {
        hasPermission = hasPermission || target.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER);
      } else if (target instanceof foundry.canvas.placeables.Token) {
        hasPermission = hasPermission || target.document.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER);
      } else {
        hasPermission = hasPermission || target.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER);
      }
    }
    
    if (!hasPermission) {
      ui.notifications.warn(`У вас нет прав для доступа к ${actor.name}`);
      return;
    }
    
    // Закрываем стандартный лист если открыт
    if (actor.sheet) {
      actor.sheet.close({ force: true });
    }

    // МУЛЬТИПЛЕЕРНАЯ ПОДДЕРЖКА
    const targetUuid = actor.uuid;
    
    // ЕСЛИ ЭТО ИГРОК - открываем через сокет
    if (!game.user.isGM) {
      // ПРОВЕРКА ДИСТАНЦИИ для игроков
      const interactionCheck = this.hoardManager.canInteract(target, game.user);
      if (!interactionCheck.allowed) {
        ui.notifications.warn(interactionCheck.reason);
        return;
      }
      
      // Открываем интерфейс по типу
      if (this.isShop(target)) {
        console.log('THM | Player opening shop interface via socket');
        await this.uiManager.showShopInterface(actor, { bypassPermission: true });
      } else if (this.isBlackMarket(target)) {
        console.log('THM | Player opening black market interface via socket');
        await this.uiManager.showBlackMarketInterface(actor, { bypassPermission: true });
      } else {
        console.log('THM | Player opening container interface via socket');
        await this.uiManager.showContainerInterface(actor, { bypassPermission: true });
      }
      
      return;
    }
    
    // ЕСЛИ ЭТО GM - открываем локально
    
    // ПРОВЕРКА ДИСТАНЦИИ для GM (только если не bypassPermission)
    if (!options.bypassPermission) {
      const interactionCheck = this.hoardManager.canInteract(target, game.user);
      if (!interactionCheck.allowed) {
        ui.notifications.warn(interactionCheck.reason);
        return;
      }
    }
    
    // Открываем интерфейс по типу
    if (this.isContainer(target)) {
      await this.uiManager.showContainerInterface(actor, { bypassPermission: true });
    } else if (this.isHoard(target)) {
      console.log(`THM | Opening hoard interface for: ${actor.name}`);
      // await this.uiManager.showHoardInterface(actor); // ВРЕМЕННО ЗАГЛУШЕНО
      console.log(`THM | Hoard interface not implemented yet - using container as fallback`);
      await this.uiManager.showContainerInterface(actor, { bypassPermission: true });
    } else if (this.isShop(target)) {
      await this.uiManager.showShopInterface(actor, { bypassPermission: true });
    } else if (this.isBlackMarket(target)) {
      await this.uiManager.showBlackMarketInterface(actor, { bypassPermission: true });
    } else {
      await this.uiManager.showContainerInterface(actor, { bypassPermission: true });
    }
    
    // Уведомляем всех об открытии (кроме ГМа)
    if (!game.user.isGM) {
      await this.socketManager.notifyUserOpenedInterface(targetUuid);
    }
  }

  /**
   * Обработка дропа предметов на сцену
   */
  async handleCanvasDrop(canvas, dropData) {
    console.log(`THM | Canvas drop detected:`, dropData);
    
    // Работаем только с предметами
    if (dropData.type !== "Item") return;
    
    try {
      // Получаем предмет из дроп данных
      let item = await Item.implementation.fromDropData(dropData);
      let itemData = item ? item.toObject() : false;
      
      if (!itemData) {
        console.error("THM | Could not get item data from drop:", dropData);
        ui.notifications.error("Не удалось получить данные предмета");
        return;
      }
      
      // Проверяем, есть ли под курсором токены
      const { x, y } = canvas.grid.getTopLeftPoint(dropData);
      const tokensAtLocation = this.getTokensAtLocation({ x, y });
      
      if (tokensAtLocation.length) {
        console.log("THM | Tokens found at drop location, not creating new pile");
        return; // Не создаем новую кучу если есть токены
      }
      
      // Готовим данные для сокета
      const dropDataForSocket = {
        itemData: itemData,
        position: { x, y },
        sceneId: canvas.scene.id,
        userId: game.user.id
      };
      
      // Выполняем через сокет (GM только)
      if (game.user.isGM) {
        await this.socketManager.executeAsGM(CONSTANTS.SOCKET_HOOKS.CREATE_LOOT_PILE, dropDataForSocket);
      } else {
        // Для игроков отправляем запрос GM
        await this.socketManager.executeAsGM(CONSTANTS.SOCKET_HOOKS.CREATE_LOOT_PILE, dropDataForSocket);
      }
      
    } catch (error) {
      console.error("THM | Error handling canvas drop:", error);
      ui.notifications.error("Ошибка при создании лутбокса");
    }
  }

  /**
   * Создание лутбокса из перетаскиваемого предмета
   */
  async createLootPileFromDrop(itemData, position, sceneId = null) {
    try {
      console.log(`THM | Creating loot pile from item: ${itemData.name} at position:`, position);
      console.log(`THM | Item image: ${itemData.img}`);
      
      // Получаем или создаем актера для лутбоксов
      const lootActor = await this.getOrCreateLootActor(itemData.img);
      
      // Определяем сцену
      const scene = game.scenes.get(sceneId || canvas.scene.id);
      if (!scene) {
        throw new Error("Scene not found");
      }
      
      // Создаем токен на сцене
      const tokenData = {
        name: itemData.name,
        x: position.x,
        y: position.y,
        actorId: lootActor.id,
        actorLink: false, // ВАЖНО! Отключаем связь токена с актером
        disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
        img: itemData.img || "icons/svg/item-bag.svg", // Используем изображение предмета
        texture: {
          src: itemData.img || "icons/svg/item-bag.svg"
        },
        flags: {
          "treasure-hoard-manager": {
            type: "container",
            enabled: true,
            data: {
              // Настройки контейнера
              deleteWhenEmpty: true,
              showItemName: true,
              displayOne: true
            }
          }
        }
      };
      
      console.log(`THM | Token data image: ${tokenData.img}`);
      console.log(`THM | Token texture src: ${tokenData.texture.src}`);
      
      const [tokenDocument] = await scene.createEmbeddedDocuments("Token", [tokenData]);
      
      // Проверяем цену перед созданием. Если 0 - генерируем!
      const adapter = this.systemAdapter;
      if (adapter) {
        const currentPrice = typeof itemData.system?.price === 'number' ? itemData.system.price : (itemData.system?.price?.value || 0);
        if (currentPrice === 0) {
          const generatedPrice = await adapter.generateItemPrice(itemData, 'dmg');
          if (typeof itemData.system.price === 'number') {
            itemData.system.price = generatedPrice;
          } else if (itemData.system.price) {
            itemData.system.price.value = generatedPrice;
          } else {
            itemData.system.price = { value: generatedPrice };
          }
          console.log(`THM | Generated price for dropped item ${itemData.name}: ${generatedPrice}`);
        }
      }

      // Добавляем предмет в актера токена
      await tokenDocument.actor.createEmbeddedDocuments("Item", [itemData]);
      
      // Обновляем интерфейсы если есть
      this.uiManager.refreshHoardInterface(tokenDocument.actor);
      
      ui.notifications.info(`Создан лутбокс: ${itemData.name}`);
      
      return tokenDocument;
    } catch (error) {
      console.error("THM | Error in createLootPileFromDrop:", error);
      console.error("THM | Error stack:", error.stack);
      throw error; // Передаем ошибку дальше для обработки в сокете
    }
  }

  /**
   * Получение или создание актера для лутбоксов
   */
  async getOrCreateLootActor(itemImg = null) {
    // Ищем существующего актера для лутбоксов
    let lootActor = game.actors.find(a => 
      a.getFlag("treasure-hoard-manager", "defaultLootActor")
    );
    
    if (!lootActor) {
      console.log("THM | Creating default loot actor");
      
      // Создаем нового актера с изображением предмета если есть
      lootActor = await Actor.create({
        name: "THM Loot Pile",
        type: "npc",
        img: itemImg || "icons/svg/item-bag.svg",
        flags: {
          "treasure-hoard-manager": {
            defaultLootActor: true,
            type: "container",
            enabled: true
          }
        }
      });
    }
    
    return lootActor;
  }

  async postInit() {
    await this.socketManager.init();
    
    // Включаем клики
    this.registerInteractions();
    
    // Вешаем кнопки на листы - ДВА ХУКА
    Hooks.on("getActorSheetHeaderButtons", this._appendTHMHeaderControls.bind(this));
    Hooks.on("getHeaderControlsApplicationV2", this._insertTHMHeaderButtons.bind(this));
    
    // Добавляем хуки для отслеживания изменений инвентаря
    this._setupInventoryHooks();
  }

  /**
   * Настройка хуков для отслеживания изменений инвентаря
   */
  _setupInventoryHooks() {
    const self = this;
    
    // Хук на создание предметов
    Hooks.on("createItem", (item, options, userId) => {
      // Обновляем только если изменение от другого пользователя И это THM контейнер
      if (userId !== game.user.id && item.parent && self.isValidHoard(item.parent)) {
        // Если предмет создан в контейнере THM, возможно нужно удалить его у игрока
        self._handleItemReturnToContainer(item, userId);
        self.debouncedRefresh(item.parent);
        // Сбрасываем кэш после изменений
        self.clearValidationCache();
      }
    });
    
    // Хук на удаление предметов
    Hooks.on("deleteItem", (item, options, userId) => {
      // Обновляем только если изменение от другого пользователя И это THM контейнер
      if (userId !== game.user.id && item.parent && self.isValidHoard(item.parent)) {
        self.debouncedRefresh(item.parent);
        // Сбрасываем кэш после изменений
        self.clearValidationCache();
      }
    });
    
    // Хук на обновление актера (для валюты и других изменений)
    Hooks.on("updateActor", (actor, changes, options, userId) => {
      // Обновляем только если изменение от другого пользователя И это THM контейнер
      if (userId !== game.user.id && self.isValidHoard(actor)) {
        // Проверяем релевантные изменения: флаги THM ИЛИ валюта
        const hasRelevantChanges = changes.system?.currency || changes.flags?.['treasure-hoard-manager'];
        if (!hasRelevantChanges) return;
        
        self.debouncedRefresh(actor);
        // Сбрасываем кэш после изменений
        self.clearValidationCache();
      }
    });
  }

  /**
   * Обработка возврата предмета в контейнер
   */
  _handleItemReturnToContainer(item, gmUserId) {
    // ВАЖНЫЙ ФИКС: Очисткой дубликатов должен заниматься только GM, иначе у игроков будут ошибки прав доступа!
    if (!game.user.isGM) return;

    // Задержка позволяет серверу (GM) завершить официальный трансфер предмета.
    // Если после этого предмет всё ещё дублируется у игрока - это баг, и мы его чистим.
    setTimeout(() => {
      const playersWithItem = game.users.players.filter(player => {
        if (!player.character) return false;
        return player.character.items.some(i => i.name === item.name && i.type === item.type);
      });
      
      if (playersWithItem.length > 0) {
        playersWithItem.forEach(player => {
          const duplicateItem = player.character.items.find(i => 
            i.name === item.name && 
            i.type === item.type
          );
          
          // Проверяем, существует ли предмет в локальной коллекции актера перед удалением
          if (duplicateItem && player.character.items.has(duplicateItem.id)) {
            console.log("THM | Очистка дубликата предмета после сделки/перемещения:", duplicateItem.name);
            duplicateItem.delete().catch(() => {
              // Глушим ошибку, если предмет успел удалиться в процессе
            });
          }
        });
      }
    }, 600); // 600 мс достаточно для синхронизации БД Foundry
  }

  /**
   * Обновление интерфейсов связанных с измененным актером
   */
  _refreshRelatedInterfaces(actor) {
    if (!actor) return;
    
    // Обновляем все открытые окна интерфейсов для этого актера
    Object.values(ui.windows).forEach(window => {
      // Проверяем, является ли окно интерфейсом THM и связано ли с этим актером
      if (window.actor && window.actor.id === actor.id) {
        window.render();
      }
    });
    
    // Если это контейнер THM, обновляем интерфейсы для всех игроков
    if (this.isValidHoard(actor)) {
      // Получаем всех активных игроков
      const activePlayers = game.users.players.filter(user => user.active);
      const playerIds = activePlayers.map(user => user.id);
      
      if (playerIds.length > 0) {
        // Используем broadcast вместо отсутствующего метода
        this.socketManager.broadcast(CONSTANTS.SOCKET_HOOKS.RENDER_INTERFACE, {
          actorUuid: actor.uuid,
          userIds: playerIds
        });
      }
    }
  }

  /**
   * Универсальная вставка кнопок
   */
  _insertTHMHeaderButtons(app, buttons) {
    if (app.document instanceof foundry.documents.BaseActor) {
      return this._appendTHMHeaderControls(app, buttons);
    }
  }

  /**
   * Кнопка в хедере 
   */
  _appendTHMHeaderControls(actorSheet, buttons) {
    if (!game.user.isGM) return;
    
    // ПРАВИЛЬНОЕ получение актера 
    const actor = actorSheet?.actor;
    if (!actor || !(actor instanceof Actor)) {
      console.warn('THM | No valid actor found for header controls');
      return;
    }
    
    console.log(`THM | Adding header controls for actor: ${actor.name} (ID: ${actor.id})`);

    // Кнопка THM настроек
    const thmMethod = () => {
      this.uiManager.showConfig(actor);
    };
    
    buttons.unshift({
      label: "THM",
      icon: "fa-solid fa-coins",
      class: "thm-config-button",
      onClick: thmMethod,
      onclick: thmMethod
    });

    
  }

  /**
   * Проверка: является ли токен токеном игрока
   */
  _isPlayerToken(token) {
    if (!token.actor) return false;
    
    // Проверяем, что это персонаж игрока (не NPC)
    const isCharacter = token.actor.type === 'character';
    const hasPlayerOwner = token.actor.ownership && Object.keys(token.actor.ownership).some(userId => {
      const user = game.users.get(userId);
      return user && user.active && !user.isGM;
    });
    
    return isCharacter && hasPlayerOwner;
  }

  /**
   * Проверка: можно ли торговать с этим токеном
   */
  _canTradeWith(token) {
    if (!token.actor) return false;
    
    // Нельзя торговать сам с собой
    if (game.user.character && token.actor.id === game.user.character.id) {
      return false;
    }
    
    // Проверяем, что владелец токена - активный игрок
    const ownerIds = Object.keys(token.actor.ownership || {}).filter(userId => {
      const user = game.users.get(userId);
      return user && user.active && user.role >= CONST.USER_ROLES.PLAYER;
    });
    
    return ownerIds.length > 0;
  }

  /**
   * Инициация торговли с токеном
   */
  async _initiateTrade(targetToken) {
    if (!game.user.character) {
      ui.notifications.warn('У вас нет персонажа для торговли');
      return;
    }
    
    const targetActor = targetToken.actor;
    const fromActor = game.user.character;
    
    // 1. Ищем активного ИГРОКА (не GM), который является владельцем этого токена
    let targetUser = game.users.find(u => u.active && !u.isGM && targetActor.testUserPermission(u, 'OWNER'));
    
    // 2. Если такого игрока нет (например, это NPC), отправляем запрос активному Мастеру
    if (!targetUser) {
      targetUser = game.users.find(u => u.active && u.isGM);
    }
    
    // 3. Если вообще никого не нашли
    if (!targetUser) {
      ui.notifications.warn("Никто не может принять торговлю за этого персонажа (игрок или Мастер не в сети).");
      return;
    }
    
    try {
      // Создаем запрос на торговлю через TradeManager
      const tradeId = await this.tradeManager.createTradeRequest(
        game.user,
        targetUser,
        fromActor,
        [] // Пока без предметов - только запрос
      );
      
      console.log(`THM | Trade request sent to ${targetUser.name}: ${tradeId}`);
      
    } catch (error) {
      console.error('THM | Error initiating trade:', error);
      ui.notifications.error('Не удалось отправить запрос на торговлю');
    }
  }
}
