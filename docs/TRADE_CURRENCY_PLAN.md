# План реализации передачи валюты в системе трейда (THM)

Этот документ описывает шаги, необходимые для добавления возможности передачи денег между игроками через интерфейс обмена.

## 1. Архитектура данных
В `TradeManager.js`, метод `createTradeRequest`, необходимо расширить объект `tradeData`:
- `fromCurrencyAtoms`: Number (сумма в меди/базовой валюте)
- `toCurrencyAtoms`: Number

## 2. Изменения в интерфейсе (TradeInterface.js + .hbs)
- **Шаблон (.hbs):** 
    - Добавить блок `currency-input-container` под инвентарем каждого игрока.
    - Для **CPR**: Одно поле ввода (Eurobucks).
    - Для **DnD 5e**: Либо 5 полей (cp, sp, ep, gp, pp), либо одно поле "Золото" с автоматической конвертацией в атомы.
- **Логика (.js):**
    - Добавить слушатель `change` на поля ввода валюты.
    - При изменении отправлять событие через сокет `TRADE_UPDATE` с обновленным значением атомов.
    - Добавить валидацию: если введенная сумма больше, чем есть у актера (`actor.system.currency` или `wealth`), подсвечивать поле красным и блокировать кнопку "Подтвердить".

## 3. Синхронизация (SocketManager.js)
- Расширить обработчики обновлений трейда, чтобы они корректно обновляли значения валюты в окнах обоих участников.

## 4. Завершение сделки (TradeManager.js)
В методе `_processTradeItemsAsGM` добавить логику переноса валюты:
```javascript
// Пример логики для переноса валюты
if (trade.fromCurrencyAtoms > 0) {
    await adapter.spendWealth(fromActor, trade.fromCurrencyAtoms);
    await adapter.addWealth(toActor, trade.fromCurrencyAtoms);
}
if (trade.toCurrencyAtoms > 0) {
    await adapter.spendWealth(toActor, trade.toCurrencyAtoms);
    await adapter.addWealth(fromActor, trade.toCurrencyAtoms);
}
```

## 5. Визуализация в чате
Обновить метод `sendTradeCompletionMessage`, чтобы в итоговом сообщении в чате отображалось, сколько денег было передано каждой стороной.

---
*Документ создан автоматически в ходе сессии адаптации под Foundry v12/v13.*
