const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('CCSE 2026 Data Integrity Tests', () => {
  const jsonPath = path.join(__dirname, '..', 'preguntas_ccse_2026.json');
  assert.ok(fs.existsSync(jsonPath), 'preguntas_ccse_2026.json debe existir');

  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(rawData);

  test('Metadatos generales son válidos', () => {
    assert.equal(data.metadata.edicion, 2026);
    assert.equal(data.metadata.total_preguntas, 300);
    assert.equal(data.metadata.fuente, 'Instituto Cervantes');
    assert.equal(data.metadata.tareas.length, 5);
  });

  test('El banco contiene exactamente 300 preguntas', () => {
    assert.equal(Array.isArray(data.preguntas), true);
    assert.equal(data.preguntas.length, 300);
  });

  test('Distribución exacta y rangos de IDs por tarea', () => {
    const expectedTasks = {
      1: { count: 120, min: 1001, max: 1120, type: 'opcion_multiple', optionsCount: 3 },
      2: { count: 36, min: 2001, max: 2036, type: 'verdadero_falso', optionsCount: 2 },
      3: { count: 24, min: 3001, max: 3024, type: 'opcion_multiple', optionsCount: 3 },
      4: { count: 36, min: 4001, max: 4036, type: 'opcion_multiple', optionsCount: 3 },
      5: { count: 84, min: 5001, max: 5084, type: 'opcion_multiple', optionsCount: 3 }
    };

    const taskCounts = {};
    const seenIds = new Set();

    data.preguntas.forEach(q => {
      // Unicidad de ID
      assert.ok(!seenIds.has(q.id), `ID duplicado detectado: ${q.id}`);
      seenIds.add(q.id);

      const exp = expectedTasks[q.tarea];
      assert.ok(exp, `Tarea no válida: ${q.tarea} en pregunta ${q.id}`);

      // Rango de ID
      assert.ok(q.id >= exp.min && q.id <= exp.max, `ID ${q.id} fuera de rango [${exp.min}, ${exp.max}] para Tarea ${q.tarea}`);

      // Tipo de pregunta
      assert.equal(q.tipo, exp.type, `Tipo incorrecto en pregunta ${q.id}`);

      // Enunciado válido
      assert.ok(typeof q.pregunta === 'string' && q.pregunta.trim().length > 3, `Enunciado vacío o muy corto en ${q.id}`);

      // Opciones válidas
      const optionKeys = Object.keys(q.opciones);
      assert.equal(optionKeys.length, exp.optionsCount, `Número de opciones incorrecto en ${q.id}`);

      // Respuesta correcta válida
      assert.ok(optionKeys.includes(q.respuesta_correcta), `Respuesta correcta '${q.respuesta_correcta}' no está en opciones para ${q.id}`);
      assert.ok(typeof q.respuesta_correcta_texto === 'string' && q.respuesta_correcta_texto.length > 0);

      taskCounts[q.tarea] = (taskCounts[q.tarea] || 0) + 1;
    });

    for (let t = 1; t <= 5; t++) {
      assert.equal(taskCounts[t], expectedTasks[t].count, `Conteo incorrecto para Tarea ${t}: esperado ${expectedTasks[t].count}, obtenido ${taskCounts[t]}`);
    }
  });

  test('preguntas_ccse_2026_por_tarea.json está sincronizado con el JSON principal', () => {
    const porTareaPath = path.join(__dirname, '..', 'preguntas_ccse_2026_por_tarea.json');
    assert.ok(fs.existsSync(porTareaPath), 'preguntas_ccse_2026_por_tarea.json debe existir');

    const porTareaData = JSON.parse(fs.readFileSync(porTareaPath, 'utf8'));
    let totalAgrupado = 0;

    for (let t = 1; t <= 5; t++) {
      const taskGroup = porTareaData[t] || porTareaData[String(t)];
      assert.ok(taskGroup, `Falta la tarea ${t} en preguntas_ccse_2026_por_tarea.json`);
      totalAgrupado += taskGroup.preguntas.length;
    }

    assert.equal(totalAgrupado, 300, 'El archivo por tareas debe sumar exactamente 300 preguntas');
  });
});
