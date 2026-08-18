/**
 * Controlador Principal de la Aplicación CCSE 2026 Anki.
 * Gestiona el flujo de vistas, eventos de usuario, catálogo, examen y atajos de teclado.
 */

class CCSEApp {
  constructor() {
    this.storage = window.ccseStorage;
    this.srsEngine = null;
    this.examEngine = null;

    this.allQuestions = [];
    this.currentView = 'anki';
    
    // Estado de la sesión de Anki
    this.studyQueue = [];
    this.currentIndex = 0;
    this.isCardFlipped = false;
    this.selectedOption = null;
    this.currentDeckFilter = 'all';
    this.sessionCompletedCount = 0;

    // Inicializar
    document.addEventListener('DOMContentLoaded', () => this.init());
  }

  async init() {
    // 1. Cargar preguntas desde el archivo JSON
    this.allQuestions = await this.storage.loadQuestionsData();
    if (!this.allQuestions.length) {
      alert('Error cargando preguntas_ccse_2026.json');
      return;
    }

    // 2. Inicializar motores
    this.srsEngine = new SRSEngine(this.storage);
    this.examEngine = new ExamEngine(this.allQuestions);

    // 3. Aplicar tema guardado
    this.applyTheme(this.storage.getSettings().theme);

    // 4. Inicializar componentes
    this.updateGlobalBadges();
    this.initKeyboardShortcuts();
    this.startAnkiSession(this.currentDeckFilter);

    // 5. Renderizar iconos de Lucide
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // =========================================================================
  // VISTAS Y NAVEGACIÓN
  // =========================================================================
  switchView(viewName) {
    this.currentView = viewName;

    // Actualizar tabs en header
    const views = ['anki', 'catalog', 'exam', 'stats'];
    views.forEach(v => {
      const btn = document.getElementById(`nav-btn-${v}`);
      const section = document.getElementById(`view-${v}`);
      
      if (btn) {
        if (v === viewName) {
          btn.className = 'nav-tab px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all bg-brand-600 text-white shadow-sm';
        } else {
          btn.className = 'nav-tab px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all text-slate-300 hover:text-white hover:bg-slate-800/60';
        }
      }

      if (section) {
        if (v === viewName) {
          section.classList.remove('hidden');
        } else {
          section.classList.add('hidden');
        }
      }
    });

    // Acciones específicas al entrar a una vista
    if (viewName === 'catalog') {
      window.catalog.init(this.allQuestions);
    } else if (viewName === 'stats') {
      this.renderStatsView();
    }

    this.updateGlobalBadges();
    if (window.lucide) window.lucide.createIcons();
  }

  updateGlobalBadges() {
    const stats = this.storage.getStats();
    const srsStats = this.srsEngine.calculateStats(this.allQuestions);

    // Racha
    const streakEl = document.getElementById('streak-counter');
    if (streakEl) streakEl.textContent = stats.streak || 0;

    // Dominadas
    const masteredEl = document.getElementById('mastered-counter');
    if (masteredEl) masteredEl.textContent = `${srsStats.mastered}/${this.allQuestions.length}`;

    // Badge Due Count en pestaña Anki
    const dueCountBadge = document.getElementById('badge-due-count');
    if (dueCountBadge) dueCountBadge.textContent = srsStats.dueToday;
  }

  // =========================================================================
  // MODO ANKI / REPETICIÓN ESPACIADA
  // =========================================================================
  startAnkiSession(deckFilter = 'all') {
    this.currentDeckFilter = deckFilter;
    const mode = deckFilter === 'difficult' ? 'difficult' : 'srs';
    const taskFilter = deckFilter === 'difficult' || deckFilter === 'all' ? null : deckFilter;

    this.studyQueue = this.srsEngine.getStudyQueue(this.allQuestions, {
      mode,
      taskFilter
    });

    this.currentIndex = 0;
    this.sessionCompletedCount = 0;

    const wrapper = document.getElementById('flashcard-wrapper');
    const completedView = document.getElementById('session-completed-view');

    if (this.studyQueue.length === 0) {
      if (wrapper) wrapper.classList.add('hidden');
      if (completedView) completedView.classList.remove('hidden');
    } else {
      if (wrapper) wrapper.classList.remove('hidden');
      if (completedView) completedView.classList.add('hidden');
      this.renderCurrentCard();
    }

    this.updateSessionCounters();
  }

  changeDeckFilter(filterValue) {
    this.startAnkiSession(filterValue);
  }

  restartSession(deckMode = 'all') {
    if (deckMode === 'all') {
      this.studyQueue = this.srsEngine.getStudyQueue(this.allQuestions, { mode: 'all' });
      this.currentIndex = 0;
      this.sessionCompletedCount = 0;
      
      const wrapper = document.getElementById('flashcard-wrapper');
      const completedView = document.getElementById('session-completed-view');
      if (wrapper) wrapper.classList.remove('hidden');
      if (completedView) completedView.classList.add('hidden');
      
      this.renderCurrentCard();
      this.updateSessionCounters();
    } else {
      this.startAnkiSession(this.currentDeckFilter);
    }
  }

  renderCurrentCard() {
    if (this.currentIndex >= this.studyQueue.length) {
      this.onSessionFinished();
      return;
    }

    const card = this.studyQueue[this.currentIndex];
    const srs = this.srsEngine.getCardSRS(card.id);
    this.isCardFlipped = false;
    this.selectedOption = null;

    // Resetear giro 3D de la tarjeta
    const flashcard = document.getElementById('flashcard');
    if (flashcard) flashcard.classList.remove('is-flipped');

    // Datos del Front
    const idBadge = document.getElementById('card-id-badge');
    const taskBadge = document.getElementById('card-task-badge');
    const typeBadge = document.getElementById('card-type-badge');
    const intervalBadge = document.getElementById('card-interval-badge');
    const qText = document.getElementById('card-question-text');
    const optionsContainer = document.getElementById('card-options-front');

    if (idBadge) idBadge.textContent = `#${card.id}`;
    if (taskBadge) taskBadge.textContent = `Tarea ${card.tarea}`;
    if (typeBadge) typeBadge.textContent = card.tipo === 'verdadero_falso' ? 'Verdadero / Falso' : 'Opción Múltiple';
    
    if (intervalBadge) {
      if (srs.state === 'new') intervalBadge.textContent = 'Nueva';
      else if (srs.state === 'mastered') intervalBadge.textContent = `Dominada (${srs.interval}d)`;
      else intervalBadge.textContent = `Repaso (${srs.interval}d)`;
    }

    if (qText) qText.textContent = card.pregunta;

    // Renderizar opciones interactivas en el Front
    if (optionsContainer) {
      optionsContainer.innerHTML = '';
      Object.entries(card.opciones).forEach(([key, val]) => {
        const optBtn = document.createElement('button');
        optBtn.className = 'option-btn w-full p-3.5 rounded-2xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 text-left text-xs sm:text-sm font-medium flex items-center justify-between text-slate-200 transition cursor-pointer';
        optBtn.setAttribute('data-option-key', key);
        optBtn.onclick = () => this.selectOptionOnFront(key);

        optBtn.innerHTML = `
          <div class="flex items-center gap-3">
            <span class="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-bold text-xs uppercase text-slate-300">${key}</span>
            <span>${val}</span>
          </div>
          <span class="opt-check-indicator hidden w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 items-center justify-center">
            <i data-lucide="check" class="w-3.5 h-3.5"></i>
          </span>
        `;
        optionsContainer.appendChild(optBtn);
      });
    }

    // Datos del Back
    const backIdBadge = document.getElementById('back-card-id-badge');
    const backTaskBadge = document.getElementById('back-card-task-badge');
    const backQText = document.getElementById('back-card-question-text');
    const backCorrectAns = document.getElementById('back-correct-answer');
    const backRecap = document.getElementById('back-options-recap');

    if (backIdBadge) backIdBadge.textContent = `#${card.id}`;
    if (backTaskBadge) backTaskBadge.textContent = `Tarea ${card.tarea}: ${card.tarea_nombre}`;
    if (backQText) backQText.textContent = card.pregunta;
    if (backCorrectAns) backCorrectAns.textContent = `${card.respuesta_correcta.toUpperCase()}) ${card.respuesta_correcta_texto}`;

    // Recap de opciones en el Back
    if (backRecap) {
      backRecap.innerHTML = '';
      Object.entries(card.opciones).forEach(([key, val]) => {
        const isCorrect = key === card.respuesta_correcta;
        const row = document.createElement('div');
        row.className = `p-2 rounded-xl border flex items-center gap-2 ${
          isCorrect 
            ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 font-semibold' 
            : 'bg-slate-900/40 border-slate-800/60 text-slate-400'
        }`;
        row.innerHTML = `
          <span class="w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-bold uppercase ${
            isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
          }">${key}</span>
          <span>${val}</span>
        `;
        backRecap.appendChild(row);
      });
    }

    // Previsualizaciones de Intervalos en los 4 botones
    const previews = this.srsEngine.getIntervalPreviews(card.id);
    document.getElementById('preview-interval-again').textContent = previews.again;
    document.getElementById('preview-interval-hard').textContent = previews.hard;
    document.getElementById('preview-interval-good').textContent = previews.good;
    document.getElementById('preview-interval-easy').textContent = previews.easy;

    this.updateSessionCounters();
    if (window.lucide) window.lucide.createIcons();
  }

  selectOptionOnFront(key) {
    this.selectedOption = key;
    const card = this.studyQueue[this.currentIndex];
    const isCorrect = key === card.respuesta_correcta;

    // Resaltar visualmente la opción seleccionada
    const optionsContainer = document.getElementById('card-options-front');
    if (!optionsContainer) return;

    Array.from(optionsContainer.children).forEach(btn => {
      const optKey = btn.getAttribute('data-option-key');
      if (optKey === key) {
        btn.className = `option-btn w-full p-3.5 rounded-2xl border text-left text-xs sm:text-sm font-medium flex items-center justify-between transition ${
          isCorrect ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200' : 'bg-rose-950/60 border-rose-500 text-rose-200'
        }`;
      } else {
        btn.className = 'option-btn w-full p-3.5 rounded-2xl bg-slate-950/30 border border-slate-800/40 text-left text-xs sm:text-sm text-slate-500 transition opacity-50';
      }
    });

    // Auto-flip opcional o girar suavemente
    setTimeout(() => {
      this.flipCard();
    }, 450);
  }

  flipCard() {
    const flashcard = document.getElementById('flashcard');
    if (!flashcard) return;
    this.isCardFlipped = !this.isCardFlipped;
    flashcard.classList.toggle('is-flipped', this.isCardFlipped);
    if (window.lucide) window.lucide.createIcons();
  }

  rateCard(grade) {
    if (this.currentIndex >= this.studyQueue.length) return;

    const currentCard = this.studyQueue[this.currentIndex];
    
    // 1. Aplicar algoritmo SM-2
    this.srsEngine.rateCard(currentCard.id, grade);
    this.sessionCompletedCount += 1;

    // 2. Si la calificación fue 1 (Otra vez / Again), reencolar en la sesión actual
    if (grade === 1) {
      this.studyQueue.push(currentCard);
    }

    // 3. Avanzar
    this.currentIndex += 1;
    this.updateGlobalBadges();

    if (this.currentIndex >= this.studyQueue.length) {
      this.onSessionFinished();
    } else {
      this.renderCurrentCard();
    }
  }

  onSessionFinished() {
    const wrapper = document.getElementById('flashcard-wrapper');
    const completedView = document.getElementById('session-completed-view');
    if (wrapper) wrapper.classList.add('hidden');
    if (completedView) completedView.classList.remove('hidden');

    // Confetti de celebración
    if (window.confetti) {
      window.confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    this.updateGlobalBadges();
  }

  updateSessionCounters() {
    const remaining = this.studyQueue.length - this.currentIndex;
    const total = this.studyQueue.length;

    const progressBar = document.getElementById('session-progress-bar');
    if (progressBar && total > 0) {
      const pct = Math.min(100, Math.round((this.currentIndex / total) * 100));
      progressBar.style.width = `${pct}%`;
    }

    const doneCount = document.getElementById('session-done-count');
    if (doneCount) doneCount.textContent = this.sessionCompletedCount;

    const dueCount = document.getElementById('session-due-count');
    if (dueCount) dueCount.textContent = remaining > 0 ? remaining : 0;
  }

  // =========================================================================
  // VISTA ESTADÍSTICAS
  // =========================================================================
  renderStatsView() {
    const srsStats = this.srsEngine.calculateStats(this.allQuestions);

    document.getElementById('stat-mastered-val').textContent = srsStats.mastered;
    document.getElementById('stat-review-val').textContent = srsStats.review;
    document.getElementById('stat-learning-val').textContent = srsStats.learning;
    document.getElementById('stat-new-val').textContent = srsStats.new;

    const tasksContainer = document.getElementById('stats-tasks-bars');
    if (tasksContainer) {
      tasksContainer.innerHTML = '';

      const taskNames = [
        'Gobierno, legislación y participación ciudadana',
        'Derechos y deberes fundamentales',
        'Organización territorial de España. Geografía física y política',
        'Cultura e historia de España',
        'Sociedad española'
      ];

      for (let t = 1; t <= 5; t++) {
        const taskData = srsStats.byTask[t];
        const masteredPct = Math.round((taskData.mastered / taskData.total) * 100);
        const reviewPct = Math.round((taskData.review / taskData.total) * 100);
        const learningPct = Math.round((taskData.learning / taskData.total) * 100);

        const row = document.createElement('div');
        row.className = 'p-4 rounded-2xl bg-slate-900/60 border border-slate-800';
        row.innerHTML = `
          <div class="flex items-center justify-between text-xs font-semibold text-slate-200 mb-2">
            <span class="flex items-center gap-2">
              <span class="w-5 h-5 rounded bg-brand-500/20 text-brand-400 flex items-center justify-center font-mono text-[10px] font-bold">${t}</span>
              <span>Tarea ${t}: ${taskNames[t-1]}</span>
            </span>
            <span class="font-mono text-slate-400">${taskData.mastered} / ${taskData.total} dominadas (${masteredPct}%)</span>
          </div>

          <div class="w-full bg-slate-950 rounded-full h-2 flex overflow-hidden border border-slate-800/80">
            <div style="width: ${masteredPct}%" class="bg-emerald-500 h-full" title="Dominadas: ${taskData.mastered}"></div>
            <div style="width: ${reviewPct}%" class="bg-blue-500 h-full" title="En Repaso: ${taskData.review}"></div>
            <div style="width: ${learningPct}%" class="bg-amber-500 h-full" title="Aprendiendo: ${taskData.learning}"></div>
          </div>
        `;
        tasksContainer.appendChild(row);
      }
    }
  }

  // =========================================================================
  // AJUSTES, TEMAS Y BACKUP
  // =========================================================================
  toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    const newTheme = isDark ? 'light' : 'dark';
    this.applyTheme(newTheme);
    this.storage.saveSettings({ theme: newTheme });
  }

  applyTheme(theme) {
    const icon = document.getElementById('theme-icon');
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      if (icon) icon.setAttribute('data-lucide', 'moon');
    } else {
      document.documentElement.classList.add('dark');
      if (icon) icon.setAttribute('data-lucide', 'sun');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const input = document.getElementById('setting-new-cards');
    if (input) input.value = this.storage.getSettings().newCardsPerDay || 20;
    if (modal) modal.classList.remove('hidden');
  }

  closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.add('hidden');
  }

  saveSettingsFromModal() {
    const input = document.getElementById('setting-new-cards');
    const val = parseInt(input.value, 10) || 20;
    this.storage.saveSettings({ newCardsPerDay: val });
    this.closeSettingsModal();
    this.startAnkiSession(this.currentDeckFilter);
  }

  exportBackup() {
    const jsonStr = this.storage.exportBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ccse_anki_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  openImportModal() {
    const modal = document.getElementById('import-modal');
    if (modal) modal.classList.remove('hidden');
  }

  closeImportModal() {
    const modal = document.getElementById('import-modal');
    if (modal) modal.classList.add('hidden');
  }

  processImport() {
    const textarea = document.getElementById('import-json-textarea');
    if (!textarea || !textarea.value.trim()) return;

    const res = this.storage.importBackup(textarea.value.trim());
    if (res.success) {
      alert('¡Progreso restaurado correctamente!');
      this.closeImportModal();
      location.reload();
    } else {
      alert(`Error al importar datos: ${res.error}`);
    }
  }

  confirmResetProgress() {
    if (confirm('¿Estás seguro de que deseas reiniciar todo el progreso de las tarjetas? Esta acción no se puede deshacer.')) {
      this.storage.resetAllProgress();
      location.reload();
    }
  }

  // =========================================================================
  // ATAJOS DE TECLADO (POWER USERS)
  // =========================================================================
  initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ignorar si el usuario está escribiendo en un input o textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (this.currentView === 'anki') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          this.flipCard();
        } else if (this.isCardFlipped) {
          // Tarjeta volteada: Teclas 1, 2, 3, 4 califican
          if (e.key === '1') this.rateCard(1);
          if (e.key === '2') this.rateCard(2);
          if (e.key === '3') this.rateCard(3);
          if (e.key === '4') this.rateCard(4);
        } else {
          // Tarjeta no volteada: Teclas a, b, c seleccionan opción
          const k = e.key.toLowerCase();
          if (['a', 'b', 'c'].includes(k)) {
            this.selectOptionOnFront(k);
          }
        }
      }
    });
  }
}

// =========================================================================
// MÓDULO CATÁLOGO Y EXPLORADOR DE PREGUNTAS POR CATEGORÍA
// =========================================================================
class CCSECatalog {
  constructor() {
    this.allQuestions = [];
    this.currentTask = 'all';
    this.currentType = 'all';
    this.searchQuery = '';
    this.showAllAnswers = false;
  }

  init(questions) {
    this.allQuestions = questions;
    this.render();
  }

  filterByTask(task) {
    this.currentTask = task;
    document.querySelectorAll('.cat-task-btn').forEach(btn => {
      if (btn.getAttribute('data-task') === task) {
        btn.className = 'cat-task-btn px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition bg-brand-600 text-white shadow-sm';
      } else {
        btn.className = 'cat-task-btn px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800';
      }
    });
    this.render();
  }

  filterByType(type) {
    this.currentType = type;
    this.render();
  }

  onSearchInput(query) {
    this.searchQuery = query.toLowerCase().trim();
    this.render();
  }

  toggleAllAnswers() {
    this.showAllAnswers = !this.showAllAnswers;
    const btnText = document.getElementById('toggle-all-answers-text');
    const icon = document.getElementById('toggle-all-answers-icon');

    if (this.showAllAnswers) {
      if (btnText) btnText.textContent = 'Ocultar todas las respuestas';
      if (icon) icon.setAttribute('data-lucide', 'eye-off');
    } else {
      if (btnText) btnText.textContent = 'Mostrar todas las respuestas';
      if (icon) icon.setAttribute('data-lucide', 'eye');
    }

    this.render();
  }

  render() {
    const container = document.getElementById('catalog-cards-container');
    const counter = document.getElementById('catalog-results-count');
    if (!container) return;

    let filtered = this.allQuestions;

    // Filtro por Tarea
    if (this.currentTask !== 'all') {
      filtered = filtered.filter(q => q.tarea === parseInt(this.currentTask));
    }

    // Filtro por Tipo
    if (this.currentType !== 'all') {
      filtered = filtered.filter(q => q.tipo === this.currentType);
    }

    // Filtro por Búsqueda
    if (this.searchQuery) {
      filtered = filtered.filter(q => {
        const idMatch = q.id.toString().includes(this.searchQuery);
        const textMatch = q.pregunta.toLowerCase().includes(this.searchQuery);
        const ansMatch = (q.respuesta_correcta_texto || '').toLowerCase().includes(this.searchQuery);
        const optMatch = Object.values(q.opciones).some(v => v.toLowerCase().includes(this.searchQuery));
        return idMatch || textMatch || ansMatch || optMatch;
      });
    }

    if (counter) counter.textContent = `${filtered.length} preguntas`;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full p-12 text-center glass-panel rounded-3xl border border-slate-800">
          <i data-lucide="search-x" class="w-12 h-12 text-slate-500 mx-auto mb-3"></i>
          <p class="text-sm font-semibold text-slate-300">No se encontraron preguntas con los filtros seleccionados.</p>
          <p class="text-xs text-slate-500 mt-1">Prueba a cambiar el término de búsqueda o seleccionar otra tarea.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = filtered.map(q => {
      return `
        <div class="glass-panel p-5 rounded-3xl border border-slate-800/80 flex flex-col justify-between hover:border-slate-700 transition">
          <div>
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 text-xs font-mono font-bold bg-slate-800 text-brand-400 rounded-lg border border-slate-700">#${q.id}</span>
                <span class="px-2 py-0.5 text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">Tarea ${q.tarea}</span>
              </div>
              <span class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">${q.tipo === 'verdadero_falso' ? 'V / F' : 'Opción Múltiple'}</span>
            </div>

            <h3 class="text-sm font-bold text-white mb-3">${q.pregunta}</h3>

            <div class="space-y-1.5 mb-4 text-xs">
              ${Object.entries(q.opciones).map(([k, val]) => {
                const isCorrect = k === q.respuesta_correcta;
                const shouldHighlight = this.showAllAnswers && isCorrect;
                return `
                  <div class="p-2 rounded-xl flex items-center gap-2.5 ${
                    shouldHighlight 
                      ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 font-semibold' 
                      : 'bg-slate-900/60 border border-slate-800/60 text-slate-300'
                  }">
                    <span class="w-5 h-5 rounded flex items-center justify-center font-mono font-bold text-[10px] uppercase ${
                      shouldHighlight ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }">${k}</span>
                    <span>${val}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <button onclick="catalog.toggleSingleAnswer(${q.id})" class="text-slate-400 hover:text-brand-400 text-[11px] font-medium flex items-center gap-1">
              <i data-lucide="help-circle" class="w-3.5 h-3.5"></i>
              <span>Ver Solución</span>
            </button>
            <div id="cat-ans-${q.id}" class="hidden text-xs font-bold text-emerald-400">
              ${q.respuesta_correcta.toUpperCase()}) ${q.respuesta_correcta_texto}
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  toggleSingleAnswer(qid) {
    const el = document.getElementById(`cat-ans-${qid}`);
    if (el) el.classList.toggle('hidden');
  }
}

// =========================================================================
// MÓDULO SIMULADOR DE EXAMEN CCSE
// =========================================================================
class CCSEExamUI {
  constructor() {
    this.timerInterval = null;
    this.remainingSeconds = 45 * 60;
    this.currentQuestionIdx = 0;
  }

  startExam() {
    const exam = window.app.examEngine.startNewExam();
    this.remainingSeconds = exam.durationSeconds;
    this.currentQuestionIdx = 0;

    document.getElementById('exam-intro-screen').classList.add('hidden');
    document.getElementById('exam-results-screen').classList.add('hidden');
    document.getElementById('exam-active-screen').classList.remove('hidden');

    this.startTimer();
    this.renderQuestionPalette();
    this.renderCurrentExamQuestion();
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      this.remainingSeconds -= 1;
      const mins = Math.floor(this.remainingSeconds / 60);
      const secs = this.remainingSeconds % 60;
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      const timerEl = document.getElementById('exam-timer');
      if (timerEl) timerEl.textContent = formatted;

      if (this.remainingSeconds <= 0) {
        clearInterval(this.timerInterval);
        alert('¡El tiempo del examen ha finalizado!');
        this.finishExam();
      }
    }, 1000);
  }

  renderQuestionPalette() {
    const palette = document.getElementById('exam-palette');
    if (!palette) return;

    const exam = window.app.examEngine.currentExam;
    palette.innerHTML = exam.questions.map((q, idx) => {
      const isAnswered = !!exam.userAnswers[q.id];
      const isFlagged = !!exam.flagged[q.id];
      const isCurrent = idx === this.currentQuestionIdx;

      let cls = 'w-full py-1.5 text-center text-xs font-mono font-bold rounded-lg border transition cursor-pointer ';
      if (isCurrent) {
        cls += 'bg-brand-600 text-white border-brand-400 ring-2 ring-brand-500/50';
      } else if (isFlagged) {
        cls += 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      } else if (isAnswered) {
        cls += 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      } else {
        cls += 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800';
      }

      return `<button onclick="examUI.jumpToQuestion(${idx})" class="${cls}">${idx + 1}</button>`;
    }).join('');

    // Actualizar contador respondidas
    const answeredCount = Object.keys(exam.userAnswers).length;
    const answeredEl = document.getElementById('exam-answered-count');
    if (answeredEl) answeredEl.textContent = answeredCount;
  }

  renderCurrentExamQuestion() {
    const exam = window.app.examEngine.currentExam;
    const q = exam.questions[this.currentQuestionIdx];

    document.getElementById('exam-q-number').textContent = `Pregunta ${this.currentQuestionIdx + 1} de 25`;
    document.getElementById('exam-q-task').textContent = `Tarea ${q.tarea}: ${q.tarea_nombre}`;
    document.getElementById('exam-current-id-badge').textContent = `#${q.id}`;
    document.getElementById('exam-current-task-badge').textContent = `Tarea ${q.tarea}`;
    document.getElementById('exam-current-question-text').textContent = q.pregunta;

    // Flag button state
    const flagBtn = document.getElementById('exam-flag-btn');
    if (flagBtn) {
      if (exam.flagged[q.id]) {
        flagBtn.className = 'px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition';
      } else {
        flagBtn.className = 'px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition';
      }
    }

    // Prev / Next button state
    const prevBtn = document.getElementById('exam-prev-btn');
    const nextBtn = document.getElementById('exam-next-btn');
    if (prevBtn) prevBtn.disabled = this.currentQuestionIdx === 0;
    if (nextBtn) nextBtn.disabled = this.currentQuestionIdx === 24;

    // Render Options
    const optionsContainer = document.getElementById('exam-current-options');
    const selectedAns = exam.userAnswers[q.id];

    if (optionsContainer) {
      optionsContainer.innerHTML = Object.entries(q.opciones).map(([k, val]) => {
        const isSelected = selectedAns === k;
        return `
          <button onclick="examUI.selectExamOption('${k}')" class="w-full p-4 rounded-2xl border text-left text-xs sm:text-sm font-medium flex items-center justify-between transition cursor-pointer ${
            isSelected 
              ? 'bg-brand-600/20 border-brand-500 text-white shadow-md' 
              : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-300'
          }">
            <div class="flex items-center gap-3">
              <span class="w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center uppercase ${
                isSelected ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-400'
              }">${k}</span>
              <span>${val}</span>
            </div>
            <div class="w-5 h-5 rounded-full border flex items-center justify-center ${
              isSelected ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-700'
            }">
              ${isSelected ? '<i data-lucide="check" class="w-3 h-3"></i>' : ''}
            </div>
          </button>
        `;
      }).join('');
    }

    this.renderQuestionPalette();
    if (window.lucide) window.lucide.createIcons();
  }

  selectExamOption(key) {
    const exam = window.app.examEngine.currentExam;
    const q = exam.questions[this.currentQuestionIdx];
    window.app.examEngine.selectAnswer(q.id, key);
    this.renderCurrentExamQuestion();
  }

  toggleFlagCurrent() {
    const exam = window.app.examEngine.currentExam;
    const q = exam.questions[this.currentQuestionIdx];
    window.app.examEngine.toggleFlag(q.id);
    this.renderCurrentExamQuestion();
  }

  jumpToQuestion(idx) {
    this.currentQuestionIdx = idx;
    this.renderCurrentExamQuestion();
  }

  prevQuestion() {
    if (this.currentQuestionIdx > 0) {
      this.currentQuestionIdx -= 1;
      this.renderCurrentExamQuestion();
    }
  }

  nextQuestion() {
    if (this.currentQuestionIdx < 24) {
      this.currentQuestionIdx += 1;
      this.renderCurrentExamQuestion();
    }
  }

  confirmFinishExam() {
    const exam = window.app.examEngine.currentExam;
    const answeredCount = Object.keys(exam.userAnswers).length;
    const unanswered = 25 - answeredCount;

    let msg = '¿Deseas entregar y finalizar el simulacro de examen?';
    if (unanswered > 0) {
      msg = `Aún tienes ${unanswered} pregunta(s) sin responder. ¿Deseas entregar el examen de todas formas?`;
    }

    if (confirm(msg)) {
      this.finishExam();
    }
  }

  finishExam() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    const result = window.app.examEngine.finishExam();

    document.getElementById('exam-active-screen').classList.add('hidden');
    document.getElementById('exam-results-screen').classList.remove('hidden');

    // Banner de resultado
    const banner = document.getElementById('exam-result-banner');
    const badgeIcon = document.getElementById('exam-result-badge-icon');
    const tag = document.getElementById('exam-verdict-tag');
    const title = document.getElementById('exam-score-title');
    const feedback = document.getElementById('exam-feedback-text');

    title.textContent = `${result.score} / 25 Aciertos (${result.percentage}%)`;

    if (result.isPassed) {
      tag.textContent = 'APTO (APROBADO)';
      tag.className = 'text-xs uppercase font-extrabold tracking-widest px-3 py-1 rounded-full border mb-2 inline-block bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      badgeIcon.className = 'w-20 h-20 rounded-3xl mx-auto flex items-center justify-center mb-4 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
      badgeIcon.innerHTML = '<i data-lucide="award" class="w-10 h-10"></i>';
      feedback.textContent = '¡Enhorabuena! Has superado el simulacro oficial CCSE con los estándares del Instituto Cervantes (mínimo 15/25 aciertos).';
      
      if (window.confetti) {
        window.confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      }
    } else {
      tag.textContent = 'NO APTO';
      tag.className = 'text-xs uppercase font-extrabold tracking-widest px-3 py-1 rounded-full border mb-2 inline-block bg-rose-500/20 text-rose-300 border-rose-500/40';
      badgeIcon.className = 'w-20 h-20 rounded-3xl mx-auto flex items-center justify-center mb-4 bg-rose-500/20 text-rose-400 border border-rose-500/40';
      badgeIcon.innerHTML = '<i data-lucide="alert-triangle" class="w-10 h-10"></i>';
      feedback.textContent = 'No has alcanzado los 15 aciertos mínimos necesarios. Te recomendamos practicar las preguntas falladas en el Modo Anki.';
    }

    // Desglose por tareas
    const breakdownContainer = document.getElementById('exam-task-breakdown');
    if (breakdownContainer) {
      breakdownContainer.innerHTML = Object.entries(result.taskBreakdown).map(([t, data]) => {
        return `
          <div class="p-3 bg-slate-900 rounded-2xl border border-slate-800 text-center">
            <span class="text-[11px] text-slate-400 block mb-1">Tarea ${t}</span>
            <strong class="text-base font-mono font-bold ${data.correct >= Math.ceil(data.total * 0.6) ? 'text-emerald-400' : 'text-rose-400'}">
              ${data.correct}/${data.total}
            </strong>
          </div>
        `;
      }).join('');
    }

    // Revisión detallada de preguntas
    const reviewList = document.getElementById('exam-review-list');
    if (reviewList) {
      reviewList.innerHTML = result.details.map(d => {
        const q = d.question;
        return `
          <div class="p-4 rounded-2xl border ${d.isCorrect ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-rose-950/20 border-rose-500/30'}">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-mono font-bold text-slate-300">#${d.number}. [ID ${q.id}] Tarea ${q.tarea}</span>
              <span class="text-xs font-bold px-2 py-0.5 rounded ${d.isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
                ${d.isCorrect ? 'Acierto' : 'Fallo'}
              </span>
            </div>
            <p class="text-xs font-semibold text-white mb-2">${q.pregunta}</p>
            <div class="text-xs space-y-1 text-slate-300">
              <div>Tu respuesta: <strong class="${d.isCorrect ? 'text-emerald-400' : 'text-rose-400'}">${d.userAnswer ? d.userAnswer.toUpperCase() + ') ' + (q.opciones[d.userAnswer] || '') : 'Sin responder'}</strong></div>
              ${!d.isCorrect ? `<div class="text-emerald-400 font-semibold">Respuesta correcta: ${q.respuesta_correcta.toUpperCase()}) ${q.respuesta_correcta_texto}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    if (window.lucide) window.lucide.createIcons();
  }
}

// Inicializar instancias globales
window.app = new CCSEApp();
window.catalog = new CCSECatalog();
window.examUI = new CCSEExamUI();
