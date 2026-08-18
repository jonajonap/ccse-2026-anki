const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { SRSEngine } = require('../js/srs-engine.js');

class MockStorage {
  constructor() {
    this.cards = {};
    this.reviews = [];
    this.settings = { newCardsPerDay: 20 };
  }
  getCardsState() {
    return this.cards;
  }
  saveCardState(qid, state) {
    this.cards[qid] = state;
  }
  recordReview(qid, grade) {
    this.reviews.push({ qid, grade, date: new Date().toISOString() });
  }
  getSettings() {
    return this.settings;
  }
}

describe('SRSEngine (SuperMemo SM-2 Algorithm)', () => {
  let storage;
  let srs;

  beforeEach(() => {
    storage = new MockStorage();
    srs = new SRSEngine(storage);
  });

  test('Inicialización de tarjeta nueva', () => {
    const card = srs.getCardSRS(1001);
    assert.equal(card.id, 1001);
    assert.equal(card.reps, 0);
    assert.equal(card.interval, 0);
    assert.equal(card.easeFactor, 2.5);
    assert.equal(card.state, 'new');
    assert.equal(card.lapses, 0);
  });

  test('Calificación "Otra vez" (Grade 1 - Again)', () => {
    // Primer repaso con fallo
    const card1 = srs.rateCard(1001, 1);
    assert.equal(card1.reps, 0);
    assert.equal(card1.interval, 1);
    assert.equal(card1.lapses, 1);
    assert.equal(card1.state, 'learning');
    assert.equal(card1.easeFactor, 2.3); // 2.5 - 0.2
    assert.ok(card1.nextReviewDate);

    // Repetido no baja de EF 1.3
    for (let i = 0; i < 10; i++) {
      srs.rateCard(1001, 1);
    }
    const finalCard = srs.getCardSRS(1001);
    assert.equal(finalCard.easeFactor, 1.3);
  });

  test('Calificación "Difícil" (Grade 2 - Hard)', () => {
    const card = srs.rateCard(1002, 2);
    assert.equal(card.state, 'learning');
    assert.equal(card.easeFactor, 2.35); // 2.5 - 0.15
  });

  test('Calificación "Bien" (Grade 3 - Good) - Progresión de intervalos', () => {
    // Rep 1
    const r1 = srs.rateCard(1003, 3);
    assert.equal(r1.reps, 1);
    assert.equal(r1.interval, 1);

    // Rep 2
    const r2 = srs.rateCard(1003, 3);
    assert.equal(r2.reps, 2);
    assert.equal(r2.interval, 3);

    // Rep 3: interval = round(3 * 2.5) = 8
    const r3 = srs.rateCard(1003, 3);
    assert.equal(r3.reps, 3);
    assert.equal(r3.interval, 8);
    assert.equal(r3.state, 'review');

    // Rep 4: interval = round(8 * 2.5) = 20 -> review
    const r4 = srs.rateCard(1003, 3);
    assert.equal(r4.interval, 20);
    assert.equal(r4.state, 'review');

    // Rep 5: interval = round(20 * 2.5) = 50 -> mastered (interval >= 21)
    const r5 = srs.rateCard(1003, 3);
    assert.equal(r5.state, 'mastered');
    assert.ok(r5.interval >= 21);
  });

  test('Calificación "Fácil" (Grade 4 - Easy) - Bonificación de intervalo y EaseFactor', () => {
    const r1 = srs.rateCard(1004, 4);
    assert.equal(r1.reps, 1);
    assert.equal(r1.interval, 4);
    assert.equal(r1.easeFactor, 2.65); // 2.5 + 0.15

    const r2 = srs.rateCard(1004, 4);
    assert.equal(r2.reps, 2);
    assert.equal(r2.interval, 7);
  });

  test('Generación de cola de estudio (Study Queue)', () => {
    const mockQuestions = [
      { id: 1001, tarea: 1 },
      { id: 1002, tarea: 1 },
      { id: 2001, tarea: 2 }
    ];

    // Nuevas tarjetas
    const queue = srs.getStudyQueue(mockQuestions, { mode: 'srs' });
    assert.equal(queue.length, 3);

    // Tarjeta vencida hoy
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    storage.saveCardState(1001, {
      id: 1001,
      reps: 1,
      interval: 1,
      state: 'review',
      lastReviewedDate: yesterday.toISOString().split('T')[0],
      nextReviewDate: yesterday.toISOString().split('T')[0]
    });

    const queueWithDue = srs.getStudyQueue(mockQuestions, { mode: 'srs' });
    // La primera debe ser la vencida
    assert.equal(queueWithDue[0].id, 1001);
  });

  test('Cálculo de estadísticas generales', () => {
    const mockQuestions = [
      { id: 1001, tarea: 1 },
      { id: 1002, tarea: 1 },
      { id: 2001, tarea: 2 }
    ];

    storage.saveCardState(1001, { state: 'mastered' });
    storage.saveCardState(1002, { state: 'learning' });

    const stats = srs.calculateStats(mockQuestions);
    assert.equal(stats.total, 3);
    assert.equal(stats.mastered, 1);
    assert.equal(stats.learning, 1);
    assert.equal(stats.new, 1);
    assert.equal(stats.byTask[1].total, 2);
    assert.equal(stats.byTask[2].total, 1);
  });
});
