# Guía de Desarrollo y Reglas para Agentes (AGENTS.md)
# Proyecto: CCSE 2026 Anki SRS & Simulador Oficial

Este archivo define la arquitectura, las directrices de codificación, los estándares de calidad y la **política obligatoria de pruebas** para cualquier agente o desarrollador que trabaje en este repositorio.

---

## 📌 1. Visión General del Proyecto

**CCSE 2026 Anki SRS & Simulador** es una aplicación web interactiva (Single Page Application - SPA) de código abierto diseñada para preparar y memorizar las **300 preguntas oficiales de la prueba CCSE 2026** (Conocimientos Constitucionales y Socioculturales de España) del Instituto Cervantes.

### Pilares Fundamentales
1. **100% Estático y Client-Side**: Compatible con GitHub Pages y servidores estáticos sencillos (`python3 -m http.server`). Sin backend ni base de datos externa obligatoria.
2. **Privacidad y Persistencia Local**: Todo el progreso del usuario se almacena en `LocalStorage` (`CCSEStorage`). Soporta exportación/importación de copias de seguridad en JSON.
3. **Algoritmo Anki SM-2**: Motor de Repetición Espaciada (`SRSEngine`) fiel al estándar SuperMemo SM-2.
4. **Simulador Oficial Cervantes**: Motor de examen (`ExamEngine`) con 25 preguntas ponderadas exactamente según la distribución oficial y umbral de aprobado oficial (APTO ≥ 15/25).
5. **Experiencia de Usuario Premium**: Soporte para atajos de teclado, animaciones 3D de tarjetas, diseño responsivo móvil/escritorio, modo oscuro/claro y síntesis de audio con Web Audio API.

---

## 🛠 2. Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend** | Vanilla JavaScript (ES6+), HTML5 Semántico, Tailwind CSS (CDN), Lucide Icons, Canvas Confetti |
| **Audio** | Web Audio API (sintetizador de sonido nativo sin dependencias de archivos de audio) |
| **Almacenamiento** | `window.localStorage` con serialización JSON |
| **Extracción PDF** | Python 3 + PyMuPDF (`pymupdf`), expresiones regulares estructuradas |
| **Pruebas** | Node.js Test Runner (`node --test`), Python `unittest` |
| **Despliegue** | GitHub Pages (desde rama `main` en la raíz `/`) |

---

## 📁 3. Estructura de Directorios

```text
cervantes/
├── .agents/                      # Configuración y habilidades locales de agentes
├── js/
│   ├── app.js                   # Orquestador UI, eventos, atajos, renderizado y audio
│   ├── exam-engine.js           # Motor de generación y corrección del simulacro CCSE (25 preguntas)
│   ├── srs-engine.js            # Motor del algoritmo SuperMemo SM-2 (intervalos, colas de repaso)
│   └── storage.js               # Capa de persistencia LocalStorage, rachas y backups JSON
├── tests/
│   ├── data-integrity.test.js   # Pruebas de integridad del banco de 300 preguntas y tareas
│   ├── exam-engine.test.js      # Pruebas unitarias de distribución y calificación del examen
│   ├── srs-engine.test.js       # Pruebas unitarias de cálculo de intervalos y Ease Factor SM-2
│   ├── storage.test.js          # Pruebas de LocalStorage mockeado, rachas y backup
│   └── test_questions.py        # Pruebas de validación en Python para el extractor
├── extract_ccse_questions.py    # Script de extracción desde el PDF oficial
├── index.html                   # Vista principal de la SPA (HTML y componentes UI)
├── manual-ccse-2026-def.pdf     # Manual oficial CCSE Edición 2026 (Instituto Cervantes)
├── package.json                 # Configuración de comandos de prueba (Node.js test runner)
├── preguntas_ccse_2026.json     # Banco oficial de 300 preguntas (Fuente de verdad)
├── preguntas_ccse_2026_por_tarea.json # Banco clasificado por Tareas 1-5
├── requirements.txt             # Dependencias Python (pymupdf)
└── README.md                    # Documentación pública y guía de uso
```

---

## 🧪 4. POLÍTICA OBLIGATORIA DE PRUEBAS (TESTING POLICY)

> [!IMPORTANT]
> **Toda modificación a la lógica del negocio, a los motores (`js/*`), al esquema de persistencia o al banco de preguntas DEBE ser validada ejecutando la suite de pruebas.** No se aceptarán cambios que rompan los tests existentes ni modificaciones que añadan funcionalidad sin sus correspondientes pruebas unitarias.

### 4.1 Comandos de Ejecución de Pruebas

```bash
# Ejecutar todas las pruebas de JavaScript (integridad + motores + almacenamiento)
npm test

# O directamente con Node:
node --test tests/*.test.js

# Ejecutar pruebas de Python (integridad del dataset y extracción)
npm run test:py
# o: python3 -m unittest discover -s tests -p 'test_*.py'

# Ejecutar suite completa (JS + Python)
npm run test:all
```

### 4.2 Invariantes Críticos que las Pruebas Garantizan

#### A. Integridad del Banco de Preguntas (`preguntas_ccse_2026.json`)
1. **Total de Preguntas**: Exactamente 300 preguntas oficiales.
2. **Distribución por Tareas**:
   - **Tarea 1**: 120 preguntas (IDs 1001 – 1120), opción múltiple con 3 opciones (`a`, `b`, `c`).
   - **Tarea 2**: 36 preguntas (IDs 2001 – 2036), Verdadero / Falso con 2 opciones (`a`, `b`).
   - **Tarea 3**: 24 preguntas (IDs 3001 – 3024), opción múltiple con 3 opciones (`a`, `b`, `c`).
   - **Tarea 4**: 36 preguntas (IDs 4001 – 4036), opción múltiple con 3 opciones (`a`, `b`, `c`).
   - **Tarea 5**: 84 preguntas (IDs 5001 – 5084), opción múltiple con 3 opciones (`a`, `b`, `c`).
3. **Consistencia de Respuestas**: La clave `respuesta_correcta` debe existir obligatoriamente en el diccionario `opciones`. Ningún campo puede ser `null`, `undefined` o estar vacío.

#### B. Algoritmo SM-2 (`SRSEngine`)
1. **Límite mínimo de Ease Factor**: `easeFactor` nunca puede ser inferior a `1.3`.
2. **Grado 1 (Otra vez / Again)**: `interval = 1`, `reps = 0`, `lapses += 1`, decremento de `easeFactor` (-0.20), estado `learning`.
3. **Grado 2 (Difícil / Hard)**: Incremento moderado de intervalo (`interval * 1.2`), decremento de `easeFactor` (-0.15), estado `learning`.
4. **Grado 3 (Bien / Good)**: Progresión estándar: Rep 1 → 1 día; Rep 2 → 3 días; Rep 3+ → `Math.round(interval * easeFactor)`.
5. **Grado 4 (Fácil / Easy)**: Progresión acelerada: Rep 1 → 4 días; Rep 2 → 7 días; Rep 3+ → `Math.round(interval * easeFactor * 1.3)`, bonificación de `easeFactor` (+0.15).
6. **Estado Dominada (`mastered`)**: Se alcanza automáticamente cuando `interval >= 21` días.

#### C. Simulacro de Examen Oficial (`ExamEngine`)
1. **Total de Preguntas en Examen**: Exactamente 25 preguntas.
2. **Distribución Estricta**:
   - Tarea 1: 10 preguntas
   - Tarea 2: 3 preguntas
   - Tarea 3: 2 preguntas
   - Tarea 4: 3 preguntas
   - Tarea 5: 7 preguntas
3. **Calificación Oficial**:
   - **APTO**: Aciertos ≥ 15 (≥ 60%).
   - **NO APTO**: Aciertos < 15.
4. **Tiempo Oficial**: 45 minutos (2700 segundos).

#### D. Persistencia y Respaldo (`CCSEStorage`)
1. Los datos se serializan correctamente en `localStorage`.
2. El cálculo de la racha (`streak`) suma 1 por días consecutivos y se reinicia a 1 si transcurre más de un día.
3. El backup exportado debe poder reimportarse íntegramente restaurando el estado exacto de tarjetas y configuraciones.

---

## 📐 5. Reglas de Codificación y Arquitectura

### 5.1 Compatibilidad Dual (Navegador y Node.js)
Para permitir que los motores (`srs-engine.js`, `exam-engine.js`, `storage.js`) se ejecuten tanto en el navegador como en el runner de pruebas sin requerir herramientas de compilación externas (Babel, Webpack, Vite), cada archivo debe mantener la exportación dual:

```javascript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MiModulo };
}
if (typeof window !== 'undefined') {
  window.MiModulo = MiModulo;
}
```

### 5.2 Sin Servidores ni Bundlers Obligatorios
- No introduzcas dependencias de empaquetado (Webpack, Vite, Rollup) que impidan que `index.html` funcione abriéndolo directamente en un servidor estático.
- Todo recurso CSS adicional debe ser Vanilla CSS o clases Tailwind disponibles vía CDN en `index.html`.

### 5.3 Modificaciones de Interfaz (UI/UX)
- Mantén el diseño móvil-primero (*mobile-first*) y la compatibilidad con temas Claro/Oscuro (`dark:` en Tailwind).
- Conserva la accesibilidad: etiquetas descriptivas, contraste visual adecuado y soporte para navegación por teclado (<kbd>Espacio</kbd>, <kbd>Enter</kbd>, <kbd>1-4</kbd>, <kbd>A-C</kbd>).

### 5.4 Flujo de Trabajo para Nuevas Funcionalidades
1. **Análisis**: Revisa el código existente y verifica dependencias en `index.html` y `js/`.
2. **Implementación**: Escribe el código manteniendo el estilo conciso y modular.
3. **Pruebas**: Agrega o actualiza los tests correspondientes en `tests/`.
4. **Verificación**: Ejecuta `npm test` y verifica visualmente en el navegador.

---

## ⌨️ 6. Atajos de Teclado del Modo Anki

| Tecla | Acción |
| :---: | :--- |
| <kbd>Espacio</kbd> / <kbd>Enter</kbd> | Girar tarjeta (mostrar anverso / reverso) |
| <kbd>1</kbd> | Calificar: **Otra vez** (< 10 min / 1 día) |
| <kbd>2</kbd> | Calificar: **Difícil** (1 - 2 días) |
| <kbd>3</kbd> | Calificar: **Bien** (Intervalo estándar) |
| <kbd>4</kbd> | Calificar: **Fácil** (Intervalo ampliado) |
| <kbd>A</kbd> / <kbd>B</kbd> / <kbd>C</kbd> | Seleccionar opción en el anverso |
