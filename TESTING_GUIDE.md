# 🧪 Руководство по тестированию Corpse Looting v1.14.0

## ✅ Что исправлено

### Проблема
Функция Corpse Looting не срабатывала при смерти NPC.

### Исправления
1. ✅ Добавлен хук **createActiveEffect** для отслеживания статуса "dead"
2. ✅ Исправлен метод **isEnabled()** - теперь использует `THMSettings.enableCorpseLooting`
3. ✅ Добавлено детальное логирование для отладки

---

## 🔧 Как тестировать

### Подготовка (для GM)

1. **Перезагрузите Foundry VTT** чтобы загрузить новые изменения
2. Откройте **Module Settings** → **Treasure Hoard Manager**
3. Включите настройку **"🪦 Обыск трупов (D&D 5e)"**
4. Включите **"Включить логирование"** (для отладки)
5. Опционально настройте:
   - ✅ Автоматически оповещать о трупах
   - ✅ Удалять пустые трупы
   - ✅ Визуальные эффекты трупов
   - Время разложения трупа

### Тест 1: Смерть через HP

1. Создайте NPC с предметами/деньгами
2. Поместите его на сцену
3. Откройте консоль (F12)
4. Уменьшите HP до 0
5. **Ожидаемое**: В консоли появятся логи:
   ```
   THM Corpse | updateActor hook - HP changed for [Имя NPC]
   THM Corpse Manager | Converting [Имя NPC] to lootable corpse
   THM Corpse Manager | [Имя NPC] successfully converted to corpse
   ```
6. Токен должен стать серым/прозрачным (если включены визуальные эффекты)
7. Уведомление: "[Имя NPC] стал доступен для обыска"

### Тест 2: Смерть через статус "dead"

1. Создайте NPC с предметами/деньгами
2. Поместите его на сцену
3. Примените статус **"dead"** (например, через Effects панель)
4. **Ожидаемое**: В консоли появятся логи:
   ```
   THM Corpse | createActiveEffect hook - Dead status added to [Имя NPC]
   THM Corpse Manager | Converting [Имя NPC] to lootable corpse
   ```

### Тест 3: Обыск трупа (игрок)

1. Войдите как **игрок** (не GM)
2. Подойдите к трупу
3. **Дважды кликните** по токену трупа
4. **Ожидаемое**: 
   - Откроется интерфейс контейнера THM
   - Видны все предметы и деньги
   - Можно забрать лут

### Тест 4: Пустой труп

1. Создайте NPC **БЕЗ** предметов и денег
2. Убейте его (HP = 0)
3. **Ожидаемое**: 
   - В консоли: "has no loot, skipping corpse conversion"
   - Труп **НЕ** создается

### Тест 5: Воскрешение

1. Создайте NPC с предметами
2. Убейте его (HP = 0)
3. Труп создан
4. Восстановите HP > 0
5. **Ожидаемое**:
   - В консоли: "Reverting [Имя] from corpse state (resurrection)"
   - Токен восстановлен
   - Флаги трупа удалены

---

## 🐛 Отладка

### Если труп не создается

1. Откройте консоль (F12)
2. Выполните команду:
   ```javascript
   game.THM.manager.corpseManager.isEnabled()
   ```
   **Должно вернуть**: `true`

3. Проверьте настройки:
   ```javascript
   game.settings.get('treasure-hoard-manager', 'enableCorpseLooting')
   ```
   **Должно вернуть**: `true`

4. Проверьте, регистрируются ли хуки:
   ```javascript
   console.log(Hooks._hooks['createActiveEffect'])
   ```
   **Должно показать**: массив с зарегистрированными хуками

5. Проверьте HP и статус актера:
   ```javascript
   const actor = canvas.tokens.controlled[0]?.actor;
   console.log('HP:', actor.system.attributes.hp.value);
   console.log('Effects:', actor.effects.map(e => e.name));
   console.log('Is Dead:', game.THM.manager.corpseManager.isDead(actor));
   ```

### Проверка логов

```javascript
// Включите логирование
game.settings.set('treasure-hoard-manager', 'enableLogging', true);

// Покажите логи
game.THM.showLogs();

// Очистите логи
game.THM.clearLogs();
```

---

## 📊 Ожидаемое поведение

### Консольные логи при смерти NPC

```
THM Corpse | updateActor hook - HP changed for Goblin
THM Corpse Manager | Converting Goblin to lootable corpse
THM Corpse Manager | Goblin successfully converted to corpse
```

ИЛИ

```
THM Corpse | createActiveEffect hook - Dead status added to Goblin
THM Corpse Manager | Converting Goblin to lootable corpse
THM Corpse Manager | Goblin successfully converted to corpse
```

### Уведомления

- **GM**: "Goblin стал доступен для обыска"
- **Игроки** (если включено "автоматически оповещать"): "💀 Goblin повержен! Вы можете обыскать труп."

---

## ⚠️ Важные замечания

1. **Только GM** обрабатывает конвертацию трупов
2. **Игроки** могут только обыскивать готовые трупы
3. **NPC без лута** не конвертируются в трупы
4. Функция работает **только в D&D 5e**
5. **По умолчанию выключена** - нужно активировать в настройках

---

## 🎯 Контрольный чеклист

- [ ] Перезагрузил Foundry VTT
- [ ] Включил "Обыск трупов" в настройках
- [ ] Включил логирование для отладки
- [ ] Проверил `isEnabled()` возвращает `true`
- [ ] Создал NPC с предметами/деньгами
- [ ] Убил NPC (HP = 0)
- [ ] Вижу логи в консоли о конвертации
- [ ] Вижу уведомление о трупе
- [ ] Токен изменил внешний вид
- [ ] Игрок может дважды кликнуть и обыскать
- [ ] Пустые NPC не становятся трупами
- [ ] Воскрешение работает корректно

---

## 📝 Сообщение об ошибках

Если что-то не работает, сообщи:

1. **Скриншот консоли** (F12) с логами
2. **Версия Foundry VTT** (из Settings → About)
3. **Версия D&D 5e системы**
4. **Список активных модулей**
5. **Пошаговое описание** что делал

---

**Версия**: 1.14.0  
**Дата**: 2026-07-24  
**Статус**: Готов к тестированию ✅
