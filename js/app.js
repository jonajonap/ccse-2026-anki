/**
 * Controlador Principal de la Aplicación CCSE 2026 Anki.
 * Gestiona el flujo de vistas, eventos de usuario, catálogo, examen y atajos de teclado.
 * Estilo: Industrial Brutalism & Tactical Telemetry UI.
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

    // 3. Inicializar componentes y badges
    this.updateGlobalBadges();
    this.initKeyboardShortcuts();
    this.switchView('anki');
    this.startAnkiSession(this.currentDeckFilter);

    // 4. Renderizar iconos de Lucide
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // =========================================================================
  // VISTAS Y NAVEGACIÓN
  // =========================================================================
  switchView(viewName) {
    this.currentView = viewName;

    const views = ['anki', 'catalog', 'exam', 'stats'];
    views.forEach(v => {
      const btn = document.getElementById(`nav-btn-${v}`);
      const mobBtn = document.getElementById(`mob-btn-${v}`);
      const section = document.getElementById(`view-${v}`);
      
      const isActive = v === viewName;

      // Desktop Nav (Industrial Sidebar Item)
      if (btn) {
        if (isActive) {
          btn.className = 'px-3.5 py-3 text-xs font-mono font-black uppercase tracking-wider border-2 border-black bg-black text-white shadow-brutal-sm flex items-center justify-between transition active:translate-x-0.5 active:translate-y-0.5 w-full text-left';
        } else {
          btn.className = 'px-3.5 py-3 text-xs font-mono font-bold uppercase tracking-wider border-2 border-black bg-white text-black shadow-brutal-sm hover:bg-[#EAE8E3] flex items-center justify-between transition active:translate-x-0.5 active:translate-y-0.5 w-full text-left';
        }
      }

      // Mobile Nav (Rigid Segmented Grid)
      if (mobBtn) {
        if (isActive) {
          mobBtn.className = 'py-2.5 flex flex-col items-center justify-center font-mono text-[10px] font-black uppercase bg-black text-white';
        } else {
          mobBtn.className = 'py-2.5 flex flex-col items-center justify-center font-mono text-[10px] font-black uppercase bg-white text-black hover:bg-[#EAE8E3]';
        }
      }

      // Secciones
      if (section) {
        if (isActive) {
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

    // Reset scroll position al cambiar de sección
    const mainWrapper = document.getElementById('main-content-wrapper');
    if (mainWrapper) mainWrapper.scrollTop = 0;
    window.scrollTo(0, 0);

    this.updateGlobalBadges();
    if (window.lucide) window.lucide.createIcons();
  }

  updateGlobalBadges() {
    const stats = this.storage.getStats();
    const srsStats = this.srsEngine.calculateStats(this.allQuestions);

    // Racha (Desktop & Mobile)
    const streakEl = document.getElementById('streak-counter');
    if (streakEl) streakEl.textContent = stats.streak || 0;
    const streakMob = document.getElementById('streak-counter-mob');
    if (streakMob) streakMob.textContent = stats.streak || 0;

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
    if (taskBadge) taskBadge.textContent = `TAREA ${card.tarea}`;
    if (typeBadge) typeBadge.textContent = card.tipo === 'verdadero_falso' ? 'V / F' : 'OPCIÓN MÚLTIPLE';
    
    if (intervalBadge) {
      if (srs.state === 'new') intervalBadge.textContent = 'NUEVA';
      else if (srs.state === 'mastered') intervalBadge.textContent = `DOMINADA (${srs.interval}D)`;
      else intervalBadge.textContent = `REPASO (${srs.interval}D)`;
    }

    if (qText) qText.textContent = card.pregunta;

    // Renderizar opciones interactivas en el Front
    if (optionsContainer) {
      optionsContainer.innerHTML = '';
      Object.entries(card.opciones).forEach(([key, val]) => {
        const optBtn = document.createElement('button');
        optBtn.className = 'w-full p-2 sm:p-3.5 border-2 border-black bg-[#F4F4F0] text-left font-mono text-xs sm:text-sm font-bold flex items-center justify-between hover:bg-[#EAE8E3] hover:shadow-brutal-sm transition cursor-pointer text-black';
        optBtn.setAttribute('data-option-key', key);
        optBtn.onclick = () => this.selectOptionOnFront(key);

        optBtn.innerHTML = `
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <span class="w-6 h-6 sm:w-7 sm:h-7 bg-black text-white font-mono font-black text-xs flex items-center justify-center uppercase shrink-0 border border-black">${key}</span>
            <span class="leading-tight sm:leading-snug font-sans text-xs sm:text-base font-bold uppercase text-black truncate sm:whitespace-normal">${val}</span>
          </div>
          <span class="opt-check-indicator hidden w-5 h-5 sm:w-6 sm:h-6 bg-black text-white items-center justify-center shrink-0 border border-black">
            <i data-lucide="check" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
          </span>
        `;
        optionsContainer.appendChild(optBtn);
      });
    }

    // Renderizar estado inicial del reverso (sin selección previa todavía)
    this.updateBackFaceState();

    // Previsualizaciones de Intervalos en los 4 botones
    const previews = this.srsEngine.getIntervalPreviews(card.id);
    const pAgain = document.getElementById('preview-interval-again');
    const pHard = document.getElementById('preview-interval-hard');
    const pGood = document.getElementById('preview-interval-good');
    const pEasy = document.getElementById('preview-interval-easy');
    if (pAgain) pAgain.textContent = previews.again;
    if (pHard) pHard.textContent = previews.hard;
    if (pGood) pGood.textContent = previews.good;
    if (pEasy) pEasy.textContent = previews.easy;

    this.updateSessionCounters();
    if (window.lucide) window.lucide.createIcons();
  }

  selectOptionOnFront(key) {
    this.selectedOption = key;
    const card = this.studyQueue[this.currentIndex];
    const isCorrect = key === card.respuesta_correcta;

    // Resaltar visualmente la opción seleccionada en el anverso
    const optionsContainer = document.getElementById('card-options-front');
    if (optionsContainer) {
      Array.from(optionsContainer.children).forEach(btn => {
        const optKey = btn.getAttribute('data-option-key');
        const indicator = btn.querySelector('.opt-check-indicator');

        if (optKey === key) {
          if (isCorrect) {
            btn.className = 'w-full p-2 sm:p-3.5 border-2 border-black bg-[#EBF5EB] text-left font-mono text-xs sm:text-sm font-bold flex items-center justify-between text-emerald-950 shadow-brutal-sm transition';
          } else {
            btn.className = 'w-full p-2 sm:p-3.5 border-2 border-black bg-[#FFEBEB] text-left font-mono text-xs sm:text-sm font-bold flex items-center justify-between text-[#991B1B] shadow-brutal-sm transition';
          }
          if (indicator) {
            indicator.className = 'opt-check-indicator flex w-5 h-5 sm:w-6 sm:h-6 items-center justify-center shrink-0 border border-black ' + (isCorrect ? 'bg-emerald-700 text-white' : 'bg-[#E61919] text-white');
            indicator.innerHTML = isCorrect ? '<i data-lucide="check" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>' : '<i data-lucide="x" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>';
          }
        } else {
          btn.style.opacity = '0.35';
          btn.style.pointerEvents = 'none';
        }
      });
    }

    // Actualizar el estado del reverso con la respuesta seleccionada por el usuario
    this.updateBackFaceState();

    // Auto-flip hacia la respuesta tras breve pausa para ver la pulsación
    setTimeout(() => {
      if (!this.isCardFlipped) {
        this.flipCard();
      }
    }, 420);
  }

  updateBackFaceState() {
    if (this.currentIndex >= this.studyQueue.length) return;
    const card = this.studyQueue[this.currentIndex];

    // Datos del Back
    const backIdBadge = document.getElementById('back-card-id-badge');
    const backTaskBadge = document.getElementById('back-card-task-badge');
    const backQText = document.getElementById('back-card-question-text');
    const backStatusPill = document.getElementById('back-status-pill');
    const backRecap = document.getElementById('back-options-recap');

    if (backIdBadge) backIdBadge.textContent = `#${card.id}`;
    if (backTaskBadge) backTaskBadge.textContent = `TAREA ${card.tarea}: ${card.tarea_nombre}`;
    if (backQText) backQText.textContent = card.pregunta;

    // Actualizar píldora de estado en la cabecera del reverso
    if (backStatusPill) {
      if (this.selectedOption !== null) {
        const isCorrect = this.selectedOption === card.respuesta_correcta;
        if (isCorrect) {
          backStatusPill.className = 'px-2 sm:px-2.5 py-0.5 sm:py-1 bg-emerald-600 text-white font-mono text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1 sm:gap-1.5 border border-black shadow-brutal-sm';
          backStatusPill.innerHTML = '<i data-lucide="check" class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white"></i><span>ACIERTO</span>';
        } else {
          backStatusPill.className = 'px-2 sm:px-2.5 py-0.5 sm:py-1 bg-[#E61919] text-white font-mono text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1 sm:gap-1.5 border border-black shadow-brutal-sm';
          backStatusPill.innerHTML = '<i data-lucide="x" class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white"></i><span>FALLO</span>';
        }
      } else {
        backStatusPill.className = 'px-2 sm:px-2.5 py-0.5 sm:py-1 bg-black text-white font-mono text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1 sm:gap-1.5 border border-black shadow-brutal-sm';
        backStatusPill.innerHTML = '<i data-lucide="shield-check" class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400"></i><span>SOLUCIÓN OFICIAL</span>';
      }
    }

    // Recap de Opciones en el Back con distinciones de tu elección vs correcta
    if (backRecap) {
      backRecap.innerHTML = '';
      Object.entries(card.opciones).forEach(([key, val]) => {
        const isCorrect = (key === card.respuesta_correcta);
        const isSelected = (key === this.selectedOption);
        const row = document.createElement('div');

        if (isSelected && isCorrect) {
          row.className = 'p-1.5 sm:p-2.5 border-2 border-black bg-emerald-100 text-emerald-950 font-bold flex items-center justify-between gap-1.5 shadow-brutal-sm';
          row.innerHTML = `
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-5 h-5 sm:w-6 sm:h-6 font-mono font-black text-[10px] sm:text-xs flex items-center justify-center uppercase border border-black shrink-0 bg-emerald-700 text-white">${key}</span>
              <span class="leading-tight font-sans text-xs sm:text-sm font-bold uppercase truncate">${val}</span>
            </div>
            <span class="px-1.5 py-0.5 bg-emerald-800 text-white font-mono text-[9px] sm:text-[10px] font-black uppercase border border-black flex items-center gap-1 shrink-0">
              <i data-lucide="check-circle-2" class="w-3 h-3 text-emerald-300"></i>
              <span>TU RESPUESTA (CORRECTA)</span>
            </span>
          `;
        } else if (isSelected && !isCorrect) {
          row.className = 'p-1.5 sm:p-2.5 border-2 border-black bg-[#FFEBEB] text-red-950 font-bold flex items-center justify-between gap-1.5 shadow-brutal-sm';
          row.innerHTML = `
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-5 h-5 sm:w-6 sm:h-6 font-mono font-black text-[10px] sm:text-xs flex items-center justify-center uppercase border border-black shrink-0 bg-[#E61919] text-white">${key}</span>
              <span class="leading-tight font-sans text-xs sm:text-sm font-bold uppercase truncate">${val}</span>
            </div>
            <span class="px-1.5 py-0.5 bg-[#E61919] text-white font-mono text-[9px] sm:text-[10px] font-black uppercase border border-black flex items-center gap-1 shrink-0">
              <i data-lucide="x-circle" class="w-3 h-3 text-white"></i>
              <span>TU ELECCIÓN</span>
            </span>
          `;
        } else if (isCorrect) {
          row.className = 'p-1.5 sm:p-2.5 border-2 border-black bg-emerald-50 text-emerald-950 font-bold flex items-center justify-between gap-1.5 shadow-brutal-sm';
          row.innerHTML = `
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-5 h-5 sm:w-6 sm:h-6 font-mono font-black text-[10px] sm:text-xs flex items-center justify-center uppercase border border-black shrink-0 bg-emerald-700 text-white">${key}</span>
              <span class="leading-tight font-sans text-xs sm:text-sm font-bold uppercase truncate">${val}</span>
            </div>
            <span class="px-1.5 py-0.5 bg-emerald-700 text-white font-mono text-[9px] sm:text-[10px] font-black uppercase border border-black flex items-center gap-1 shrink-0">
              <i data-lucide="check" class="w-3 h-3 text-emerald-300"></i>
              <span>RESPUESTA CORRECTA</span>
            </span>
          `;
        } else {
          row.className = 'p-1.5 sm:p-2.5 border-2 border-neutral-300 bg-[#F4F4F0] text-ink-muted font-medium flex items-center gap-2 opacity-60';
          row.innerHTML = `
            <span class="w-5 h-5 sm:w-6 sm:h-6 font-mono font-bold text-[10px] sm:text-xs flex items-center justify-center uppercase border border-neutral-400 shrink-0 bg-neutral-200 text-neutral-600">${key}</span>
            <span class="leading-tight font-sans text-xs sm:text-sm uppercase truncate">${val}</span>
          `;
        }
        backRecap.appendChild(row);
      });
    }

    if (window.lucide) window.lucide.createIcons();
  }

  flipCard() {
    const flashcard = document.getElementById('flashcard');
    if (!flashcard) return;
    this.isCardFlipped = !this.isCardFlipped;
    flashcard.classList.toggle('is-flipped', this.isCardFlipped);
    this.updateBackFaceState();
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
    this.updateSessionCounters();

    if (window.confetti) {
      window.confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }

  updateSessionCounters() {
    const total = this.studyQueue.length;
    const current = this.currentIndex;
    const progress = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 100;

    const bar = document.getElementById('session-progress-bar');
    if (bar) bar.style.width = `${progress}%`;

    const doneCount = document.getElementById('session-done-count');
    if (doneCount) doneCount.textContent = this.sessionCompletedCount;

    const newCards = this.studyQueue.filter(c => this.srsEngine.getCardSRS(c.id).state === 'new').length;
    const newCount = document.getElementById('session-new-count');
    if (newCount) newCount.textContent = newCards;

    const remaining = total - current;
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
        row.className = 'p-4 border-2 border-black bg-white shadow-brutal-sm';
        row.innerHTML = `
          <div class="flex items-center justify-between text-xs font-mono font-bold uppercase text-black mb-2">
            <span class="flex items-center gap-2">
              <span class="w-6 h-6 bg-black text-white flex items-center justify-center font-mono text-xs font-black">[${t}]</span>
              <span>TAREA ${t}: ${taskNames[t-1]}</span>
            </span>
            <span class="text-black font-black">${taskData.mastered} / ${taskData.total} (${masteredPct}%)</span>
          </div>

          <div class="w-full border-2 border-black bg-white h-3 flex overflow-hidden p-0.5">
            <div style="width: ${masteredPct}%" class="bg-emerald-600 h-full" title="Dominadas: ${taskData.mastered}"></div>
            <div style="width: ${reviewPct}%" class="bg-black h-full" title="En Repaso: ${taskData.review}"></div>
            <div style="width: ${learningPct}%" class="bg-yellow-400 h-full" title="Aprendiendo: ${taskData.learning}"></div>
          </div>
        `;
        tasksContainer.appendChild(row);
      }
    }
  }

  // =========================================================================
  // AJUSTES Y BACKUP
  // =========================================================================
  openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const input = document.getElementById('setting-new-cards');
    if (input) input.value = this.storage.getSettings().newCardsPerDay || 20;
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
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
    if (window.lucide) window.lucide.createIcons();
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
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (this.currentView === 'anki') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          this.flipCard();
        } else if (this.isCardFlipped) {
          if (e.key === '1') this.rateCard(1);
          if (e.key === '2') this.rateCard(2);
          if (e.key === '3') this.rateCard(3);
          if (e.key === '4') this.rateCard(4);
        } else {
          const k = e.key.toLowerCase();
          const card = this.studyQueue[this.currentIndex];
          if (card && card.tipo === 'verdadero_falso') {
            if (k === 'v' || k === 'a') this.selectOptionOnFront('a');
            else if (k === 'f' || k === 'b') this.selectOptionOnFront('b');
          } else if (['a', 'b', 'c'].includes(k)) {
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
        btn.className = 'cat-task-btn px-4 py-2 border-2 border-black bg-black text-white font-mono text-xs font-black uppercase whitespace-nowrap shadow-brutal-sm';
      } else {
        btn.className = 'cat-task-btn px-4 py-2 border-2 border-black bg-white text-black font-mono text-xs font-black uppercase whitespace-nowrap shadow-brutal-sm hover:bg-[#EAE8E3]';
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
      if (btnText) btnText.textContent = 'OCULTAR TODAS LAS RESPUESTAS';
      if (icon) icon.setAttribute('data-lucide', 'eye-off');
    } else {
      if (btnText) btnText.textContent = 'MOSTRAR TODAS LAS RESPUESTAS';
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

    if (counter) counter.textContent = `${filtered.length} ITEMS`;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full p-12 text-center border-2 border-black bg-white shadow-brutal-lg font-mono">
          <i data-lucide="search-x" class="w-12 h-12 text-black mx-auto mb-3"></i>
          <p class="text-base font-black uppercase text-black">NO SE ENCONTRARON ELEMENTOS</p>
          <p class="text-xs text-ink-muted mt-1">Prueba a modificar los términos del filtro o la tarea seleccionada.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = filtered.map(q => {
      return `
        <div class="border-2 border-black bg-white p-5 sm:p-6 flex flex-col justify-between shadow-brutal">
          <div>
            <div class="flex items-center justify-between mb-3 border-b-2 border-black pb-2">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 text-xs font-mono font-black text-white bg-black">#${q.id}</span>
                <span class="px-2 py-0.5 text-xs font-mono font-bold text-black border border-black bg-[#F4F4F0]">TAREA ${q.tarea}</span>
              </div>
              <span class="text-[10px] font-mono text-ink-muted uppercase font-black tracking-wider">${q.tipo === 'verdadero_falso' ? 'V / F' : 'OPCIÓN MÚLTIPLE'}</span>
            </div>

            <h3 class="text-base font-display uppercase tracking-tight text-black mb-4 leading-snug">${q.pregunta}</h3>

            <div class="space-y-2 mb-4 font-mono text-xs">
              ${Object.entries(q.opciones).map(([k, val]) => {
                const isCorrect = k === q.respuesta_correcta;
                const shouldHighlight = this.showAllAnswers && isCorrect;
                return `
                  <div class="p-2.5 border-2 border-black flex items-center gap-2.5 ${
                    shouldHighlight 
                      ? 'bg-emerald-50 text-emerald-950 font-black' 
                      : 'bg-[#F4F4F0] text-black font-semibold'
                  }">
                    <span class="w-6 h-6 border border-black flex items-center justify-center font-mono font-black text-xs uppercase shrink-0 ${
                      shouldHighlight ? 'bg-emerald-700 text-white' : 'bg-black text-white'
                    }">${k}</span>
                    <span class="leading-snug font-sans text-xs sm:text-sm font-bold uppercase">${val}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="pt-3 border-t-2 border-black flex items-center justify-between text-xs font-mono">
            <button onclick="catalog.toggleSingleAnswer(${q.id})" class="px-3 py-1.5 border-2 border-black bg-white text-black font-black uppercase shadow-brutal-sm hover:bg-black hover:text-white transition flex items-center gap-1.5">
              <i data-lucide="help-circle" class="w-3.5 h-3.5"></i>
              <span>SOLUCIÓN</span>
            </button>
            <div id="cat-ans-${q.id}" class="hidden text-xs font-black text-emerald-950 bg-emerald-50 px-2.5 py-1 border-2 border-black">
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
        alert('¡El tiempo límite del examen ha expirado!');
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

      let cls = 'w-full py-1.5 text-center text-xs font-mono font-black border-2 border-black transition cursor-pointer ';
      if (isCurrent) {
        cls += 'bg-black text-white shadow-brutal-hazard';
      } else if (isFlagged) {
        cls += 'bg-yellow-300 text-black shadow-brutal-sm';
      } else if (isAnswered) {
        cls += 'bg-black text-white shadow-brutal-sm';
      } else {
        cls += 'bg-white text-black shadow-brutal-sm hover:bg-[#EAE8E3]';
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

    document.getElementById('exam-q-number').textContent = `[ ${String(this.currentQuestionIdx + 1).padStart(2, '0')} / 25 ]`;
    document.getElementById('exam-q-task').textContent = `TAREA ${q.tarea}: ${q.tarea_nombre}`;
    document.getElementById('exam-current-id-badge').textContent = `#${q.id}`;
    document.getElementById('exam-current-task-badge').textContent = `TAREA ${q.tarea}`;
    document.getElementById('exam-current-question-text').textContent = q.pregunta;

    // Flag button state
    const flagBtn = document.getElementById('exam-flag-btn');
    if (flagBtn) {
      if (exam.flagged[q.id]) {
        flagBtn.className = 'px-3 py-1.5 border-2 border-black bg-yellow-300 text-black font-mono text-xs font-black uppercase shadow-brutal-sm flex items-center gap-1.5';
      } else {
        flagBtn.className = 'px-3 py-1.5 border-2 border-black bg-white text-black font-mono text-xs font-black uppercase shadow-brutal-sm hover:bg-[#EAE8E3] flex items-center gap-1.5';
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
          <button onclick="examUI.selectExamOption('${k}')" class="w-full p-4 border-2 border-black text-left font-mono text-xs sm:text-sm font-bold flex items-center justify-between transition cursor-pointer ${
            isSelected 
              ? 'bg-black text-white shadow-brutal font-black' 
              : 'bg-[#F4F4F0] text-black hover:bg-[#EAE8E3] hover:shadow-brutal-sm'
          }">
            <div class="flex items-center gap-3">
              <span class="w-7 h-7 border border-black font-mono font-black text-xs flex items-center justify-center uppercase shrink-0 ${
                isSelected ? 'bg-white text-black' : 'bg-black text-white'
              }">${k}</span>
              <span class="leading-snug font-sans text-sm sm:text-base font-bold uppercase">${val}</span>
            </div>
            <div class="w-5 h-5 border-2 border-black flex items-center justify-center shrink-0 ${
              isSelected ? 'bg-white text-black' : 'bg-white'
            }">
              ${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5"></i>' : ''}
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

    let msg = '¿Deseas finalizar y entregar el simulacro de examen?';
    if (unanswered > 0) {
      msg = `Quedan ${unanswered} pregunta(s) sin responder. ¿Deseas entregar el examen de todas formas?`;
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
    const badgeIcon = document.getElementById('exam-result-badge-icon');
    const tag = document.getElementById('exam-verdict-tag');
    const title = document.getElementById('exam-score-title');
    const feedback = document.getElementById('exam-feedback-text');

    title.textContent = `${result.score} / 25 ACIERTOS (${result.percentage}%)`;

    if (result.isPassed) {
      tag.textContent = 'APTO (APROBADO)';
      tag.className = 'font-mono text-xs font-black tracking-widest px-4 py-1.5 bg-emerald-700 text-white mb-3 inline-block border-2 border-black shadow-brutal-sm';
      badgeIcon.className = 'w-16 h-16 bg-emerald-600 text-white border-2 border-black mx-auto flex items-center justify-center mb-4 shadow-brutal';
      badgeIcon.innerHTML = '<i data-lucide="award" class="w-8 h-8"></i>';
      feedback.textContent = '¡Enhorabuena! Has superado el simulacro oficial CCSE con los estándares del Instituto Cervantes (mínimo 15/25 aciertos).';
      
      if (window.confetti) {
        window.confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      }
    } else {
      tag.textContent = 'NO APTO (SUSPENSO)';
      tag.className = 'font-mono text-xs font-black tracking-widest px-4 py-1.5 bg-[#E61919] text-white mb-3 inline-block border-2 border-black shadow-brutal-sm';
      badgeIcon.className = 'w-16 h-16 bg-[#E61919] text-white border-2 border-black mx-auto flex items-center justify-center mb-4 shadow-brutal';
      badgeIcon.innerHTML = '<i data-lucide="alert-triangle" class="w-8 h-8"></i>';
      feedback.textContent = 'No has alcanzado los 15 aciertos mínimos necesarios. Te recomendamos practicar las preguntas falladas en el Modo Anki.';
    }

    // Desglose por tareas
    const breakdownContainer = document.getElementById('exam-task-breakdown');
    if (breakdownContainer) {
      breakdownContainer.innerHTML = Object.entries(result.taskBreakdown).map(([t, data]) => {
        const isPass = data.correct >= Math.ceil(data.total * 0.6);
        return `
          <div class="p-3 border-2 border-black ${isPass ? 'bg-emerald-50' : 'bg-red-50'} text-center font-mono">
            <span class="text-[10px] font-black text-black uppercase block mb-1">TAREA ${t}</span>
            <strong class="text-base font-black ${isPass ? 'text-emerald-950' : 'text-red-950'}">
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
          <div class="p-4 border-2 border-black ${d.isCorrect ? 'bg-emerald-50' : 'bg-red-50'}">
            <div class="flex items-center justify-between mb-2 font-mono">
              <span class="text-xs font-black text-black">#${d.number}. [REF: ${q.id}] TAREA ${q.tarea}</span>
              <span class="text-[10px] font-black uppercase px-2 py-0.5 border border-black ${d.isCorrect ? 'bg-emerald-600 text-white' : 'bg-[#E61919] text-white'}">
                ${d.isCorrect ? 'ACIERTO' : 'FALLO'}
              </span>
            </div>
            <p class="text-sm font-display uppercase tracking-tight text-black mb-2">${q.pregunta}</p>
            <div class="text-xs font-mono space-y-1 text-black">
              <div>TU RESPUESTA: <strong class="${d.isCorrect ? 'text-emerald-800' : 'text-red-800'}">${d.userAnswer ? d.userAnswer.toUpperCase() + ') ' + (q.opciones[d.userAnswer] || '') : 'SIN RESPONDER'}</strong></div>
              ${!d.isCorrect ? `<div class="text-emerald-900 font-black">RESPUESTA CORRECTA: ${q.respuesta_correcta.toUpperCase()}) ${q.respuesta_correcta_texto}</div>` : ''}
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
