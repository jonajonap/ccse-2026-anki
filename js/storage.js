/**
 * Módulo de almacenamiento y persistencia para la aplicación CCSE 2026.
 * Maneja el estado de las tarjetas SRS, estadísticas diarias y copias de seguridad.
 */

const STORAGE_KEYS = {
  CARDS: 'ccse_srs_cards_v1',
  STATS: 'ccse_srs_stats_v1',
  SETTINGS: 'ccse_srs_settings_v1'
};

const DEFAULT_SETTINGS = {
  newCardsPerDay: 20,
  randomOrder: true,
  theme: 'light',
  soundEnabled: true,
  autoFlipOnSelect: false
};

class CCSEStorage {
  constructor() {
    this.cardsData = [];
    this.tasksInfo = [];
    this.metadata = {};
  }

  async loadQuestionsData() {
    try {
      const res = await fetch('preguntas_ccse_2026.json');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      this.metadata = data.metadata || {};
      this.tasksInfo = data.metadata?.tareas || [];
      this.cardsData = data.preguntas || [];
      return this.cardsData;
    } catch (err) {
      console.error('Error al cargar preguntas_ccse_2026.json:', err);
      return [];
    }
  }

  getCardsState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CARDS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error('Error leyendo estado de tarjetas:', e);
      return {};
    }
  }

  saveCardState(qid, stateObj) {
    const states = this.getCardsState();
    states[qid] = {
      ...states[qid],
      ...stateObj,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(states));
  }

  saveAllCardsState(states) {
    localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(states));
  }

  getStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.STATS);
      const defaultStats = {
        dailyReviews: {},
        streak: 0,
        lastStudyDate: null,
        totalReviewsEver: 0
      };
      return raw ? { ...defaultStats, ...JSON.parse(raw) } : defaultStats;
    } catch (e) {
      return { dailyReviews: {}, streak: 0, lastStudyDate: null, totalReviewsEver: 0 };
    }
  }

  recordReview(qid, grade) {
    const stats = this.getStats();
    const today = new Date().toISOString().split('T')[0];

    // Actualizar reviews diarias
    stats.dailyReviews[today] = (stats.dailyReviews[today] || 0) + 1;
    stats.totalReviewsEver = (stats.totalReviewsEver || 0) + 1;

    // Calcular racha
    if (stats.lastStudyDate !== today) {
      if (stats.lastStudyDate) {
        const lastDate = new Date(stats.lastStudyDate);
        const currDate = new Date(today);
        const diffTime = Math.abs(currDate - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          stats.streak += 1;
        } else if (diffDays > 1) {
          stats.streak = 1;
        }
      } else {
        stats.streak = 1;
      }
      stats.lastStudyDate = today;
    }

    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
  }

  getSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(newSettings) {
    const current = this.getSettings();
    const updated = { ...current, ...newSettings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  }

  exportBackup() {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      cards: this.getCardsState(),
      stats: this.getStats(),
      settings: this.getSettings()
    };
    return JSON.stringify(backup, null, 2);
  }

  importBackup(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.cards) localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(data.cards));
      if (data.stats) localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(data.stats));
      if (data.settings) localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  resetAllProgress() {
    localStorage.removeItem(STORAGE_KEYS.CARDS);
    localStorage.removeItem(STORAGE_KEYS.STATS);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CCSEStorage, STORAGE_KEYS, DEFAULT_SETTINGS };
}
if (typeof window !== 'undefined') {
  window.ccseStorage = new CCSEStorage();
}
