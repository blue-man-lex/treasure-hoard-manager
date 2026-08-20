# План адаптации Treasure Hoard Manager для Foundry VTT v14

**Дата создания:** 2026-07-24  
**Текущая версия модуля:** 1.13.5  
**Целевая версия Foundry:** v14  
**Целевая версия D&D 5e:** 4.x+

---

## 📋 ЗАДАЧА 1: АДАПТАЦИЯ ПОД FOUNDRY VTT V14

### 🔍 Анализ изменений Foundry v14

#### **Ключевые изменения API в v14:**

1. **Document Model Changes**
   - Улучшенная система DataModel
   - Новые методы работы с embedded documents
   - Изменения в структуре flags

2. **Application v2 (полный переход)**
   - Замена FormApplication → ApplicationV2
   - Новая система рендеринга
   - Handlebars → возможность использования других темплейтов

3. **Hooks изменения**
   - Некоторые хуки переименованы/удалены
   - Новые preCreate/preUpdate хуки

4. **Canvas и Token изменения**
   - Улучшенная работа с токенами
   - Новые методы расчета дистанций

5. **Socket система**
   - Улучшенная встроенная система (socketlib все еще актуален)

### 📊 Текущее состояние модуля

**Совместимость:**
```json
"compatibility": {
  "minimum": "12",
  "verified": "13",
  "maximum": "13"
}
```

**Проблемные области для v14:**
1. ❌ **UI Components** - используют старые FormApplication
2. ❌ **Dialog API** - старый Dialog v1
3. ⚠️ **Hooks** - могут требовать обновления
4. ✅ **System Adapters** - должны работать (используют базовые API)
5. ✅ **Socket Manager** - socketlib совместим с v14

---

## 🎯 ПЛАН АДАПТАЦИИ

### **Этап 1: Обновление манифеста**
```json
{
  "compatibility": {
    "minimum": "12",
    "verified": "14",
    "maximum": "14"
  }
}
```

### **Этап 2: Миграция UI компонентов (КРИТИЧНО)**

#### **2.1 Создание адаптационного слоя**
Создать `scripts/ui/app-v2-adapter.js` - обертка для совместимости:
- Определение версии Foundry
- Автоматический выбор FormApplication (v12-13) или ApplicationV2 (v14)
- Единый интерфейс для обоих

#### **2.2 Последовательная миграция интерфейсов**
**Приоритет:**
1. ContainerInterface (самый используемый)
2. ShopInterface
3. TradeInterface
4. BlackMarketInterface
5. TreasureHoardConfig

**Для каждого:**
- Создать версию v2 рядом с оригиналом
- Добавить условную загрузку в UIManager
- Тестирование на v14

#### **2.3 Dialog API обновление**
- Заменить `new Dialog()` на `DialogV2` для v14
- Создать хелпер `createDialog()` с автоопределением версии

### **Этап 3: Проверка и обновление хуков**

**Критичные хуки модуля:**
```javascript
// Проверить актуальность:
- 'createItem' (pricing-hook.js)
- 'updateToken' (ui-manager.js)
- 'changeScene' (ui-manager.js)
- 'renderTokenHUD' (main.js)
```

**План действий:**
1. Проверить changelog Foundry v14 на изменения хуков
2. Обновить если необходимо
3. Добавить fallback для старых версий

### **Этап 4: D&D 5e система - анализ изменений**

**Текущая поддержка:** 4.0.0  
**Проверить актуальность:**
1. Структура `actor.system.currency`
2. Структура `item.system.price`
3. Методы `item.system.quantity`
4. Новые типы предметов
5. Изменения в редкостях (rarity)

**Если есть изменения:**
- Обновить `systems/dnd5e/adapter.js`
- Добавить версионную проверку
- Обеспечить обратную совместимость

### **Этап 5: Тестирование**

**Тестовые сценарии:**
1. ✅ Создание хранилища
2. ✅ Открытие интерфейса контейнера
3. ✅ Сбор лута (все предметы)
4. ✅ Сбор валюты
5. ✅ Создание магазина
6. ✅ Покупка предметов
7. ✅ Обмен между игроками
8. ✅ Черный рынок
9. ✅ Автоцены при создании предметов
10. ✅ Обновление ассортимента магазина

**Тестовые окружения:**
- Foundry v12 + D&D 5e 3.x
- Foundry v13 + D&D 5e 4.x
- Foundry v14 + D&D 5e 4.x+ (целевое)

---

## 📋 ЗАДАЧА 2: ФУНКЦИЯ "ОБЫСКАТЬ ТРУП"

### 🎯 Требования

**Функциональность:**
- Враг с HP = 0 или статусом "dead" → автоматически становится контейнером THM
- Игроки могут обыскать его (открыть интерфейс контейнера)
- **ТОЛЬКО для D&D 5e** (не Generic, не CPR)

**Настройка:**
- Добавить в Settings: "Enable Corpse Looting" (вкл/выкл)
- Только для GM (world scope)

### 🏗️ Архитектура решения

#### **1. Новая настройка**
Файл: `scripts/core/settings.js`

```javascript
game.settings.register('treasure-hoard-manager', 'enableCorpseLooting', {
  name: 'THM.Settings.EnableCorpseLooting.Name',
  hint: 'THM.Settings.EnableCorpseLooting.Hint',
  scope: 'world',
  config: true,
  type: Boolean,
  default: false,
  requiresReload: false,
  // Показывать только для D&D 5e
  visible: () => game.system.id === 'dnd5e'
});
```

#### **2. Новый модуль - Corpse Manager**
Файл: `scripts/item-management/corpse-manager.js`

**Функции:**
- `checkActorDeath(actor)` - проверка мертв ли актер
- `convertToCorpse(actor)` - конвертация в контейнер
- `revertFromCorpse(actor)` - возврат к нормальному состоянию (если оживили)
- `autoOpenCorpseInterface(actor, user)` - открытие интерфейса при клике

**Логика определения смерти:**
```javascript
isDead(actor) {
  // Проверка 1: HP = 0
  const hp = actor.system.attributes.hp.value;
  if (hp <= 0) return true;
  
  // Проверка 2: Статус "dead"
  const hasDeadStatus = actor.effects.some(e => 
    e.statuses?.has('dead') || 
    e.label?.toLowerCase().includes('dead') ||
    e.label?.toLowerCase().includes('мертв')
  );
  
  return hasDeadStatus;
}
```

#### **3. Хуки для отслеживания**

**В главном файле `main.js`:**

```javascript
// При изменении HP или эффектов
Hooks.on('updateActor', async (actor, updateData, options, userId) => {
  // Проверяем настройку и систему
  if (game.system.id !== 'dnd5e') return;
  if (!THMSettings.enableCorpseLooting) return;
  
  // Проверяем изменился ли HP или эффекты
  const hpChanged = foundry.utils.hasProperty(updateData, 'system.attributes.hp');
  const effectsChanged = foundry.utils.hasProperty(updateData, 'effects');
  
  if (hpChanged || effectsChanged) {
    await game.THM.corpseManager.handleActorUpdate(actor);
  }
});

// При удалении эффекта (воскрешение)
Hooks.on('deleteActiveEffect', async (effect, options, userId) => {
  if (game.system.id !== 'dnd5e') return;
  if (!THMSettings.enableCorpseLooting) return;
  
  const actor = effect.parent;
  if (actor instanceof Actor) {
    await game.THM.corpseManager.handleActorUpdate(actor);
  }
});
```

#### **4. Интеграция с UI**

**Варианты открытия интерфейса:**

**А) Автоматически при смерти** (опция в настройках):
```javascript
if (THMSettings.autoOpenCorpseOnDeath) {
  // Открыть всем активным игрокам
  game.users.filter(u => u.active && !u.isGM).forEach(user => {
    socketManager.executeForUsers('openCorpseInterface', [user.id], {
      actorUuid: actor.uuid
    });
  });
}
```

**Б) Через Token HUD** (правый клик на токене):
```javascript
// В TokenHUD добавить кнопку "Обыскать труп"
if (actor.getFlag('treasure-hoard-manager', 'isCorpse')) {
  const searchButton = createHUDButton({
    icon: 'fas fa-skull',
    title: 'Обыскать труп',
    onClick: () => openCorpseInterface(actor)
  });
}
```

**В) Через обычный клик по токену** (если настройка активна):
```javascript
Hooks.on('clickToken', (token, event) => {
  const actor = token.actor;
  if (actor.getFlag('treasure-hoard-manager', 'isCorpse')) {
    if (event.button === 0) { // Левый клик
      openCorpseInterface(actor);
      return false; // Предотвратить стандартное поведение
    }
  }
});
```

#### **5. Визуальная индикация трупа**

**Изменение токена:**
```javascript
// Опционально - затемнить токен
await token.document.update({
  'alpha': 0.7, // Полупрозрачность
  'lockRotation': true,
  'bar1.attribute': null // Убрать HP bar
});

// Добавить иконку черепа
await token.document.update({
  'texture.tint': '#808080' // Серый оттенок
});
```

#### **6. Флаги для отслеживания**

```javascript
// При конвертации в труп
await actor.setFlag('treasure-hoard-manager', 'isCorpse', true);
await actor.setFlag('treasure-hoard-manager', 'corpseData', {
  diedAt: new Date().toISOString(),
  convertedBy: game.user.id,
  originalType: actor.type,
  wasAlreadyLooted: false
});

// При обыске
await actor.setFlag('treasure-hoard-manager', 'corpseData.lootedBy', [
  ...lootedBy,
  { userId: game.user.id, timestamp: new Date().toISOString() }
]);
```

#### **7. Дополнительные настройки**

```javascript
// Автоматическое удаление пустого трупа
game.settings.register('treasure-hoard-manager', 'deleteEmptyCorpse', {
  name: 'Удалять пустые трупы',
  hint: 'Автоматически удалять токен когда все предметы собраны',
  scope: 'world',
  config: true,
  type: Boolean,
  default: false,
  visible: () => game.system.id === 'dnd5e' && THMSettings.enableCorpseLooting
});

// Время разложения (опционально)
game.settings.register('treasure-hoard-manager', 'corpseDecayTime', {
  name: 'Время до разложения трупа (часы)',
  hint: 'Через сколько игровых часов труп исчезнет (0 = никогда)',
  scope: 'world',
  config: true,
  type: Number,
  default: 0,
  visible: () => game.system.id === 'dnd5e' && THMSettings.enableCorpseLooting
});
```

---

## 📁 НОВЫЕ/ИЗМЕНЯЕМЫЕ ФАЙЛЫ

### Новые файлы:
1. `docs/FOUNDRY_V14_ADAPTATION_PLAN.md` (этот файл)
2. `scripts/item-management/corpse-manager.js` (новый менеджер)
3. `scripts/ui/app-v2-adapter.js` (адаптер для v14)
4. `scripts/ui/container-interface-v2.js` (версия для v14)

### Изменяемые файлы:
1. `module.json` - обновление compatibility
2. `scripts/core/settings.js` - новые настройки
3. `scripts/core/main.js` - интеграция corpseManager
4. `scripts/treasure-hoard-manager.js` - регистрация хуков
5. `scripts/ui/ui-manager.js` - поддержка v14 интерфейсов
6. `languages/en.json` - переводы
7. `languages/ru.json` - переводы

---

## 🔄 ПОРЯДОК РЕАЛИЗАЦИИ

### **Фаза 1: Подготовка** (1-2 дня)
1. ✅ Изучение changelog Foundry v14
2. ✅ Изучение changelog D&D 5e latest
3. ✅ Создание плана адаптации
4. ⬜ Настройка тестового окружения v14

### **Фаза 2: Corpse Looting** (2-3 дня)
1. ⬜ Создание corpse-manager.js
2. ⬜ Добавление настроек в settings.js
3. ⬜ Регистрация хуков
4. ⬜ Интеграция с UI
5. ⬜ Тестирование функциональности
6. ⬜ Добавление локализации

### **Фаза 3: Адаптация под v14** (5-7 дней)
1. ⬜ Обновление манифеста
2. ⬜ Создание app-v2-adapter.js
3. ⬜ Миграция ContainerInterface
4. ⬜ Миграция других интерфейсов
5. ⬜ Проверка хуков
6. ⬜ Обновление D&D 5e адаптера (если нужно)
7. ⬜ Тестирование на v14

### **Фаза 4: Тестирование и релиз** (2-3 дня)
1. ⬜ Полное тестирование на v12/v13/v14
2. ⬜ Исправление багов
3. ⬜ Обновление документации
4. ⬜ Релиз версии 1.14.0

---

## 📝 ЧЕКЛИСТ ФИНАЛЬНОЙ ПРОВЕРКИ

### Совместимость:
- [ ] Работает на Foundry v12
- [ ] Работает на Foundry v13
- [ ] Работает на Foundry v14
- [ ] D&D 5e 3.x поддержка
- [ ] D&D 5e 4.x+ поддержка
- [ ] Cyberpunk RED работает
- [ ] Generic adapter работает

### Функция Corpse Looting:
- [ ] Настройка включения/выключения
- [ ] Определение смерти по HP
- [ ] Определение смерти по статусу
- [ ] Автоконвертация в контейнер
- [ ] Открытие интерфейса работает
- [ ] Визуальная индикация трупа
- [ ] Удаление пустого трупа (если включено)
- [ ] Работает ТОЛЬКО в D&D 5e

### Обратная совместимость:
- [ ] Старые хранилища работают
- [ ] Старые магазины работают
- [ ] Сохраненные настройки не ломаются
- [ ] Миграция данных не требуется

---

## 🚀 ИТОГОВАЯ ВЕРСИЯ

**Версия:** 1.14.0  
**Название:** "Foundry v14 & Corpse Looting"

**Changelog:**
```
v1.14.0 (2026-07-24)
- ✨ [NEW] Corpse Looting feature для D&D 5e
- ✨ [NEW] Полная поддержка Foundry VTT v14
- 🔄 [IMPROVED] Обновлен D&D 5e адаптер для последней версии системы
- 🔄 [IMPROVED] Миграция UI на ApplicationV2 (v14)
- 🐛 [FIX] Различные улучшения совместимости
- 📚 [DOCS] Обновлена документация
```

---

## ⚠️ ВАЖНЫЕ ЗАМЕТКИ

1. **Обратная совместимость** - модуль должен работать на v12-v14
2. **Corpse Looting** - опциональная функция, по умолчанию выключена
3. **Только D&D 5e** - corpse looting не активируется в других системах
4. **Тестирование** - обязательно протестировать на всех версиях перед релизом
5. **Документация** - обновить README с описанием новой функции

---

**Автор плана:** AI Assistant  
**Дата:** 2026-07-24  
**Статус:** 📋 План создан, ожидается реализация
