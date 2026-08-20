# Руководство по тестированию системы трупов THM

## Что было исправлено

### 1. **Хуки для автоконвертации NPC в труп**
- ✅ Добавлена проверка типа актера (только `npc`)
- ✅ Убрано дублирование хуков `updateActor`
- ✅ Добавлена защита от множественных обработок одного актера
- ✅ Добавлена проверка `isDead()` для D&D 5e

### 2. **Флаги контейнера THM**
- ✅ Установлен правильный тип: `CONTAINER` вместо `HOARD`
- ✅ Флаги установлены по стандартам THM:
  - `flags.treasure-hoard-manager.enabled = true`
  - `flags.treasure-hoard-manager.data.type = "container"`
  - `flags.treasure-hoard-manager.data.enabled = true`

### 3. **Метод convertToCorpse**
- ✅ Убрано дублирование метода
- ✅ Добавлен метод `isDead()` для проверки HP
- ✅ Правильная структура флагов для распознавания THM

---

## Как тестировать

### Шаг 1: Включить систему трупов
1. Откройте **Module Settings** (настройки модуля)
2. Найдите **"Enable Corpse Looting"**
3. Включите опцию ✅

### Шаг 2: Подготовка NPC
1. Создайте NPC актера (тип: `npc`)
2. Добавьте ему предметы и/или валюту
3. Поместите токен на сцену

### Шаг 3: Убийство NPC
1. Установите HP NPC в 0 (через лист персонажа или урон)
2. **Ожидаемый результат:**
   - В консоли появится: `THM Corpse Manager | Converting [Name] to lootable corpse`
   - Появится уведомление: `[Name] стал доступен для обыска`
   - Токен изменит визуал (если включено в настройках):
     - Прозрачность 0.8
     - Серый оттенок
     - HP bar уберется

### Шаг 4: Двойной клик по трупу
1. **Дважды кликните** по токену трупа
2. **Ожидаемый результат:**
   - Откроется интерфейс контейнера THM
   - Будут видны предметы и валюта NPC
   - Можно забрать лут

### Шаг 5: Проверка флагов (для отладки)
В консоли браузера (F12):
```javascript
// Получите актера трупа
const corpse = game.actors.getName("Goblin"); // Замените на имя

// Проверьте флаги
console.log("Is Valid Hoard:", game.thm.isValidHoard(corpse));
console.log("Is Container:", game.thm.isContainer(corpse));
console.log("Flags:", corpse.flags['treasure-hoard-manager']);
```

**Ожидаемый вывод:**
```javascript
Is Valid Hoard: true
Is Container: true
Flags: {
  enabled: true,
  isCorpse: true,
  data: {
    type: "container",
    enabled: true,
    isCorpse: true,
    hoardName: "Труп: Goblin",
    ...
  },
  corpseData: {
    diedAt: "2026-07-24T...",
    wasLooted: false,
    ...
  }
}
```

---

## Возможные проблемы и решения

### ❌ Интерфейс не открывается при двойном клике

**Причина:** Флаги установлены неправильно или актер не распознается как контейнер.

**Решение:**
```javascript
// Проверьте флаги
const actor = game.actors.getName("Goblin");
console.log("Flags:", actor.flags['treasure-hoard-manager']);
console.log("Is Container:", game.thm.isContainer(actor));

// Если isContainer = false, принудительно установите флаги:
await actor.setFlag('treasure-hoard-manager', 'enabled', true);
await actor.setFlag('treasure-hoard-manager', 'data', {
  type: 'container',
  enabled: true,
  isCorpse: true
});
```

### ❌ NPC не конвертируется в труп при смерти

**Причина:** Хук не сработал или функция отключена.

**Решение:**
1. Убедитесь, что `Enable Corpse Looting` включено в настройках
2. Проверьте консоль на ошибки
3. Перезагрузите мир
4. Принудительно конвертируйте:
```javascript
const npc = game.actors.getName("Goblin");
await game.thm.corpseManager.convertToCorpse(npc);
```

### ❌ Игроки видят NPC как врага, а не труп

**Причина:** Визуальные эффекты не применены.

**Решение:**
1. Включите **"Corpse Visual Effects"** в настройках
2. Или примените вручную:
```javascript
const npc = game.actors.getName("Goblin");
await game.thm.corpseManager.applyCorpseVisuals(npc);
```

---

## Проверка логов

Откройте консоль браузера (F12) и найдите:

✅ **При смерти NPC:**
```
THM Corpse Manager | Converting Goblin to lootable corpse
THM Corpse Manager | Goblin successfully converted to corpse
```

✅ **При двойном клике:**
```
THM | Double-click detected on Goblin
THM | Is Valid Hoard: true
THM | Opening container interface...
```

❌ **Если видите ошибку:**
```
THM | Is Valid Hoard: false
```
→ Проверьте флаги (см. выше)

---

## Дополнительные функции для тестирования

### Воскрешение NPC
1. Восстановите HP NPC выше 0
2. **Ожидаемый результат:**
   - Флаги трупа убираются
   - Визуальные эффекты сбрасываются
   - Уведомление: `[Name] воскрешен и больше не является трупом`

### Разложение трупов (decay)
1. Установите **"Corpse Decay Time"** (например, 1 час)
2. Подождите указанное время
3. **Ожидаемый результат:**
   - Труп автоматически удалится со сцены
   - Уведомление: `Труп [Name] разложился и исчез`

### Проверка дистанции
1. Установите `interactionDistance: 1` в флагах
2. Попытайтесь кликнуть на труп издалека
3. **Ожидаемый результат:**
   - Уведомление: `Вы слишком далеко от трупа`

---

## Команды для быстрого тестирования

```javascript
// Создать тестового NPC с лутом
const testNPC = await Actor.create({
  name: "Test Goblin",
  type: "npc",
  system: { attributes: { hp: { value: 0, max: 10 } } }
});
await testNPC.createEmbeddedDocuments("Item", [
  { name: "Gold Coin", type: "loot" }
]);

// Конвертировать в труп
await game.thm.corpseManager.convertToCorpse(testNPC);

// Проверить статус
console.log("Is Corpse:", game.thm.corpseManager.isCorpse(testNPC));
console.log("Is Container:", game.thm.isContainer(testNPC));

// Открыть интерфейс
await game.thm.corpseManager.openCorpseInterface(testNPC);
```

---

## Ожидаемое поведение (summary)

| Действие | Результат |
|----------|----------|
| NPC умирает (HP = 0) | ✅ Автоматически конвертируется в труп |
| Двойной клик по трупу | ✅ Открывается интерфейс контейнера |
| Забрать предмет | ✅ Предмет перемещается к игроку |
| Забрать весь лут | ✅ Труп опустошается |
| Опустошенный труп | ✅ Удаляется (если включено `deleteEmptyCorpse`) |
| NPC воскрес | ✅ Флаги трупа убираются |
| Игрок далеко | ❌ Уведомление о дистанции |

---

**Дата:** 2026-07-24  
**Версия THM:** 1.0.0  
**Система:** D&D 5e (Foundry VTT)
