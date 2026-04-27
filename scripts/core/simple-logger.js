/**
 * Treasure Hoard Manager - Simple Logger
 * Простая система логирования с включением/выключением через настройки
 */

class SimpleLogger {
  constructor() {
    this.enabled = false;
    this.logs = [];
    this.maxLogs = 100;
  }

  /**
   * Проверяет включены ли логи
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Включает/выключает логирование
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.logs = []; // Очищаем логи при выключении
    }
  }

  /**
   * Добавляет лог
   */
  log(level, message, data = null) {
    if (!this.enabled) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level,
      message: message,
      data: data
    };

    this.logs.unshift(logEntry);
    
    // Ограничиваем количество логов
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Вывод в консоль
    const consoleMethod = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log';
    console[consoleMethod](`[THM ${level}] ${message}`, data || '');
  }

  info(message, data) {
    this.log('INFO', message, data);
  }

  warn(message, data) {
    this.log('WARN', message, data);
  }

  error(message, data) {
    this.log('ERROR', message, data);
  }

  debug(message, data) {
    this.log('DEBUG', message, data);
  }

  /**
   * Получает все логи
   */
  getLogs() {
    return [...this.logs];
  }

  /**
   * Очищает логи
   */
  clear() {
    this.logs = [];
  }
}

// Экспортируем единственный экземпляр
export const logger = new SimpleLogger();
