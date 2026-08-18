/**
 * Motor del Simulacro de Examen Oficial CCSE (Instituto Cervantes).
 * Genera 25 preguntas ponderadas con tiempo límite y evaluación oficial.
 */

const EXAM_DISTRIBUTION = {
  1: 10, // Tarea 1: 10 preguntas
  2: 3,  // Tarea 2: 3 preguntas
  3: 2,  // Tarea 3: 2 preguntas
  4: 3,  // Tarea 4: 3 preguntas
  5: 7   // Tarea 5: 7 preguntas
};

class ExamEngine {
  constructor(allQuestions) {
    this.allQuestions = allQuestions;
    this.currentExam = null;
  }

  /**
   * Genera un nuevo simulacro de examen oficial con 25 preguntas.
   */
  startNewExam() {
    const examQuestions = [];

    // Agrupar preguntas por tarea
    const grouped = {};
    for (let t = 1; t <= 5; t++) {
      grouped[t] = this.allQuestions.filter(q => q.tarea === t);
    }

    // Seleccionar aleatoriamente según la distribución oficial
    for (let t = 1; t <= 5; t++) {
      const needed = EXAM_DISTRIBUTION[t];
      const available = [...grouped[t]];
      // Barajar
      for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [available[i], available[j]] = [available[j], available[i]];
      }
      examQuestions.push(...available.slice(0, needed));
    }

    // Barajar el orden de las 25 preguntas
    for (let i = examQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [examQuestions[i], examQuestions[j]] = [examQuestions[j], examQuestions[i]];
    }

    this.currentExam = {
      id: Date.now(),
      startTime: Date.now(),
      durationSeconds: 45 * 60, // 45 minutos oficiales
      questions: examQuestions,
      userAnswers: {}, // { [questionId]: 'a' | 'b' | 'c' }
      flagged: {},     // { [questionId]: boolean }
      isFinished: false,
      result: null
    };

    return this.currentExam;
  }

  /**
   * Registra o cambia la respuesta del usuario en una pregunta del examen.
   */
  selectAnswer(qid, optionKey) {
    if (!this.currentExam || this.currentExam.isFinished) return;
    this.currentExam.userAnswers[qid] = optionKey;
  }

  /**
   * Marca o desmarca una pregunta para revisión posterior.
   */
  toggleFlag(qid) {
    if (!this.currentExam) return false;
    this.currentExam.flagged[qid] = !this.currentExam.flagged[qid];
    return this.currentExam.flagged[qid];
  }

  /**
   * Finaliza y califica el examen.
   */
  finishExam() {
    if (!this.currentExam) return null;

    let score = 0;
    const taskBreakdown = {
      1: { correct: 0, total: 10 },
      2: { correct: 0, total: 3 },
      3: { correct: 0, total: 2 },
      4: { correct: 0, total: 3 },
      5: { correct: 0, total: 7 }
    };

    const details = this.currentExam.questions.map((q, idx) => {
      const userAns = this.currentExam.userAnswers[q.id] || null;
      const isCorrect = userAns === q.respuesta_correcta;

      if (isCorrect) {
        score += 1;
        if (taskBreakdown[q.tarea]) {
          taskBreakdown[q.tarea].correct += 1;
        }
      }

      return {
        number: idx + 1,
        question: q,
        userAnswer: userAns,
        isCorrect
      };
    });

    const isPassed = score >= 15; // Mínimo 15/25 para APTO en CCSE
    const timeSpent = Math.round((Date.now() - this.currentExam.startTime) / 1000);

    const result = {
      score,
      total: 25,
      percentage: Math.round((score / 25) * 100),
      isPassed,
      verdict: isPassed ? 'APTO' : 'NO APTO',
      timeSpentSeconds: timeSpent,
      taskBreakdown,
      details
    };

    this.currentExam.isFinished = true;
    this.currentExam.result = result;

    return result;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ExamEngine, EXAM_DISTRIBUTION };
}
if (typeof window !== 'undefined') {
  window.ExamEngine = ExamEngine;
}
