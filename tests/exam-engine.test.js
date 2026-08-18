const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ExamEngine, EXAM_DISTRIBUTION } = require('../js/exam-engine.js');

describe('ExamEngine (Simulador Oficial CCSE)', () => {
  const jsonPath = path.join(__dirname, '..', 'preguntas_ccse_2026.json');
  const allQuestions = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).preguntas;

  test('La distribución oficial suma exactamente 25 preguntas', () => {
    const sum = Object.values(EXAM_DISTRIBUTION).reduce((a, b) => a + b, 0);
    assert.equal(sum, 25);
    assert.equal(EXAM_DISTRIBUTION[1], 10);
    assert.equal(EXAM_DISTRIBUTION[2], 3);
    assert.equal(EXAM_DISTRIBUTION[3], 2);
    assert.equal(EXAM_DISTRIBUTION[4], 3);
    assert.equal(EXAM_DISTRIBUTION[5], 7);
  });

  test('startNewExam genera un examen con 25 preguntas válidas y distribución estricta', () => {
    const engine = new ExamEngine(allQuestions);
    const exam = engine.startNewExam();

    assert.ok(exam.id);
    assert.equal(exam.questions.length, 25);
    assert.equal(exam.isFinished, false);
    assert.equal(exam.durationSeconds, 45 * 60);

    const taskCount = {};
    const seenIds = new Set();

    exam.questions.forEach(q => {
      assert.ok(!seenIds.has(q.id), 'No debe haber preguntas repetidas en el examen');
      seenIds.add(q.id);
      taskCount[q.tarea] = (taskCount[q.tarea] || 0) + 1;
    });

    for (let t = 1; t <= 5; t++) {
      assert.equal(taskCount[t], EXAM_DISTRIBUTION[t], `Distribución incorrecta para tarea ${t}`);
    }
  });

  test('Interacción: selección de respuestas y marcado (flag)', () => {
    const engine = new ExamEngine(allQuestions);
    const exam = engine.startNewExam();
    const firstQ = exam.questions[0];

    engine.selectAnswer(firstQ.id, 'a');
    assert.equal(exam.userAnswers[firstQ.id], 'a');

    const flagState1 = engine.toggleFlag(firstQ.id);
    assert.equal(flagState1, true);
    assert.equal(exam.flagged[firstQ.id], true);

    const flagState2 = engine.toggleFlag(firstQ.id);
    assert.equal(flagState2, false);
    assert.equal(exam.flagged[firstQ.id], false);
  });

  test('Evaluación de examen: APTO (>= 15 aciertos) y NO APTO (< 15 aciertos)', () => {
    const engine = new ExamEngine(allQuestions);
    const exam = engine.startNewExam();

    // 15 respuestas correctas, 10 incorrectas
    exam.questions.forEach((q, idx) => {
      if (idx < 15) {
        engine.selectAnswer(q.id, q.respuesta_correcta);
      } else {
        // Opción diferente
        const wrongOpt = q.respuesta_correcta === 'a' ? 'b' : 'a';
        engine.selectAnswer(q.id, wrongOpt);
      }
    });

    const result = engine.finishExam();
    assert.equal(result.score, 15);
    assert.equal(result.total, 25);
    assert.equal(result.isPassed, true);
    assert.equal(result.verdict, 'APTO');
    assert.equal(exam.isFinished, true);

    // Prueba de caso NO APTO (14 aciertos)
    const engineFail = new ExamEngine(allQuestions);
    const examFail = engineFail.startNewExam();
    examFail.questions.forEach((q, idx) => {
      if (idx < 14) {
        engineFail.selectAnswer(q.id, q.respuesta_correcta);
      }
    });
    const resultFail = engineFail.finishExam();
    assert.equal(resultFail.score, 14);
    assert.equal(resultFail.isPassed, false);
    assert.equal(resultFail.verdict, 'NO APTO');
  });
});
