const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { CCSEStorage, STORAGE_KEYS, DEFAULT_SETTINGS } = require('../js/storage.js');

// Mock simple de LocalStorage para Node.js
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe('CCSEStorage (Persistencia y Backup)', () => {
  let storage;

  beforeEach(() => {
    global.localStorage = new LocalStorageMock();
    storage = new CCSEStorage();
  });

  test('Configuración por defecto y guardado de ajustes', () => {
    const defaultSettings = storage.getSettings();
    assert.equal(defaultSettings.newCardsPerDay, 20);
    assert.equal(defaultSettings.theme, 'light');
    assert.equal(defaultSettings.randomOrder, true);

    const updated = storage.saveSettings({ theme: 'dark', newCardsPerDay: 30, randomOrder: false });
    assert.equal(updated.theme, 'dark');
    assert.equal(updated.newCardsPerDay, 30);
    assert.equal(updated.randomOrder, false);

    const reloaded = storage.getSettings();
    assert.equal(reloaded.theme, 'dark');
    assert.equal(reloaded.newCardsPerDay, 30);
    assert.equal(reloaded.randomOrder, false);
  });

  test('Guardado y recuperación de tarjetas SRS', () => {
    storage.saveCardState(1001, { reps: 2, interval: 3, state: 'review' });
    const states = storage.getCardsState();
    assert.ok(states[1001]);
    assert.equal(states[1001].reps, 2);
    assert.equal(states[1001].interval, 3);
    assert.ok(states[1001].updatedAt);
  });

  test('Cálculo de racha de estudio (Streak)', () => {
    // Primera sesión de estudio
    storage.recordReview(1001, 3);
    let stats = storage.getStats();
    assert.equal(stats.streak, 1);
    assert.equal(stats.totalReviewsEver, 1);

    // Mismo día no incrementa racha adicional
    storage.recordReview(1002, 4);
    stats = storage.getStats();
    assert.equal(stats.streak, 1);
    assert.equal(stats.totalReviewsEver, 2);
  });

  test('Exportación e importación de copias de seguridad (Backup)', () => {
    storage.saveCardState(1001, { state: 'mastered', reps: 5 });
    storage.saveSettings({ theme: 'dark' });

    const backupJson = storage.exportBackup();
    assert.ok(typeof backupJson === 'string');

    // Limpiar almacenamiento
    storage.resetAllProgress();
    assert.deepEqual(storage.getCardsState(), {});

    // Restaurar copia
    const importRes = storage.importBackup(backupJson);
    assert.equal(importRes.success, true);

    const restoredCards = storage.getCardsState();
    assert.ok(restoredCards[1001]);
    assert.equal(restoredCards[1001].state, 'mastered');
  });
});
