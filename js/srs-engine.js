/**
 * Motor de Repetición Espaciada (Spaced Repetition System - SRS)
 * Basado en el algoritmo SuperMemo SM-2 (el estándar utilizado en Anki).
 */

class SRSEngine {
  constructor(storage) {
    this.storage = storage;
  }

  /**
   * Obtiene o inicializa el estado SRS de una pregunta.
   */
  getCardSRS(qid) {
    const states = this.storage.getCardsState();
    if (states[qid]) {
      return states[qid];
    }
    return {
      id: qid,
      reps: 0,
      interval: 0, // En días
      easeFactor: 2.5,
      state: 'new', // 'new' | 'learning' | 'review' | 'mastered'
      lapses: 0,
      nextReviewDate: null,
      lastReviewedDate: null,
      history: []
    };
  }

  /**
   * Procesa la calificación de una tarjeta según el algoritmo SM-2.
   * @param {number} qid - ID de la pregunta.
   * @param {number} grade - Calificación: 1 (Otra vez), 2 (Difícil), 3 (Bien), 4 (Fácil).
   * @returns {Object} Nuevo estado de la tarjeta con la próxima fecha de repaso.
   */
  rateCard(qid, grade) {
    const card = this.getCardSRS(qid);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    let { reps, interval, easeFactor, lapses, state } = card;

    // Ajustar factor de facilidad (Ease Factor) con límites
    if (grade === 1) {
      // Otra vez (Again): Fracaso / Olvido
      reps = 0;
      interval = 1;
      lapses += 1;
      state = 'learning';
      easeFactor = Math.max(1.3, easeFactor - 0.2);
    } else if (grade === 2) {
      // Difícil (Hard)
      if (reps === 0) {
        interval = 1;
      } else {
        interval = Math.max(1, Math.round(interval * 1.2));
      }
      state = 'learning';
      easeFactor = Math.max(1.3, easeFactor - 0.15);
    } else if (grade === 3) {
      // Bien (Good)
      if (reps === 0) {
        interval = 1;
      } else if (reps === 1) {
        interval = 3;
      } else {
        interval = Math.max(1, Math.round(interval * easeFactor));
      }
      reps += 1;
      state = interval >= 21 ? 'mastered' : 'review';
    } else if (grade === 4) {
      // Fácil (Easy)
      if (reps === 0) {
        interval = 4;
      } else if (reps === 1) {
        interval = 7;
      } else {
        interval = Math.max(1, Math.round(interval * easeFactor * 1.3));
      }
      reps += 1;
      easeFactor += 0.15;
      state = interval >= 21 ? 'mastered' : 'review';
    }

    // Calcular próxima fecha de revisión
    const nextDate = new Date(now);
    nextDate.setDate(nextDate.getDate() + interval);
    const nextDateStr = nextDate.toISOString().split('T')[0];

    const updatedCard = {
      ...card,
      reps,
      interval,
      easeFactor: parseFloat(easeFactor.toFixed(2)),
      lapses,
      state,
      lastReviewedDate: todayStr,
      nextReviewDate: nextDateStr,
      history: [
        ...(card.history || []).slice(-15),
        { date: todayStr, grade, interval, easeFactor: parseFloat(easeFactor.toFixed(2)) }
      ]
    };

    this.storage.saveCardState(qid, updatedCard);
    this.storage.recordReview(qid, grade);

    return updatedCard;
  }

  /**
   * Genera la cola de estudio para el día actual.
   * Incluye tarjetas pendientes (due) + tarjetas nuevas según el límite diario.
   */
  getStudyQueue(allQuestions, options = {}) {
    const { taskFilter = null, mode = 'srs', limit = null } = options;
    const todayStr = new Date().toISOString().split('T')[0];
    const states = this.storage.getCardsState();
    const settings = this.storage.getSettings();

    let filtered = allQuestions;
    if (taskFilter && taskFilter !== 'all') {
      filtered = allQuestions.filter(q => q.tarea === parseInt(taskFilter));
    }

    if (mode === 'all') {
      // Modo libre: todas las preguntas filtradas
      return filtered.map(q => ({
        ...q,
        srs: this.getCardSRS(q.id)
      }));
    }

    if (mode === 'difficult') {
      // Modo difíciles: tarjetas con lapsos o marcadas como 'learning'
      return filtered
        .filter(q => {
          const srs = states[q.id];
          return srs && (srs.lapses > 0 || srs.state === 'learning' || srs.easeFactor < 2.0);
        })
        .map(q => ({ ...q, srs: this.getCardSRS(q.id) }));
    }

    // Modo SRS estándar Anki:
    const dueCards = [];
    const newCards = [];

    filtered.forEach(q => {
      const srs = states[q.id] || this.getCardSRS(q.id);
      if (!srs.lastReviewedDate || srs.state === 'new') {
        newCards.push({ ...q, srs });
      } else if (srs.nextReviewDate <= todayStr) {
        dueCards.push({ ...q, srs });
      }
    });

    // Barajar nuevas tarjetas y aplicar límite de nuevas por día
    const maxNew = settings.newCardsPerDay || 20;
    const selectedNew = newCards.slice(0, maxNew);

    // Prioridad: primero las pendientes de repaso (due), luego las nuevas
    let queue = [...dueCards, ...selectedNew];

    if (limit && limit > 0) {
      queue = queue.slice(0, limit);
    }

    return queue;
  }

  /**
   * Calcula estadísticas generales de dominio y estado de las 300 tarjetas.
   */
  calculateStats(allQuestions) {
    const states = this.storage.getCardsState();
    const statsObj = {
      total: allQuestions.length,
      new: 0,
      learning: 0,
      review: 0,
      mastered: 0,
      dueToday: 0,
      byTask: {}
    };

    const todayStr = new Date().toISOString().split('T')[0];

    // Inicializar por tarea
    for (let t = 1; t <= 5; t++) {
      statsObj.byTask[t] = { total: 0, mastered: 0, learning: 0, review: 0, new: 0 };
    }

    allQuestions.forEach(q => {
      const srs = states[q.id] || { state: 'new' };
      const st = srs.state || 'new';

      statsObj[st] = (statsObj[st] || 0) + 1;

      if (srs.nextReviewDate && srs.nextReviewDate <= todayStr && st !== 'new') {
        statsObj.dueToday += 1;
      }

      if (statsObj.byTask[q.tarea]) {
        statsObj.byTask[q.tarea].total += 1;
        statsObj.byTask[q.tarea][st] += 1;
      }
    });

    return statsObj;
  }

  /**
   * Previsualiza los intervalos aproximados para los 4 botones de calificación.
   */
  getIntervalPreviews(qid) {
    const card = this.getCardSRS(qid);
    const { reps, interval, easeFactor } = card;

    let againDays = 1;
    let hardDays = reps === 0 ? 1 : Math.max(1, Math.round(interval * 1.2));
    let goodDays = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(1, Math.round(interval * easeFactor));
    let easyDays = reps === 0 ? 4 : reps === 1 ? 7 : Math.max(1, Math.round(interval * easeFactor * 1.3));

    const formatDays = (d) => d === 1 ? '1 día' : `${d} días`;

    return {
      again: '< 10 min',
      hard: formatDays(hardDays),
      good: formatDays(goodDays),
      easy: formatDays(easyDays)
    };
  }
}

window.SRSEngine = SRSEngine;
