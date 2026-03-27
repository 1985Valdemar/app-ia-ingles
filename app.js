const STORAGE_KEY = "falaja-progress-v3";
const THEME_STORAGE_KEY = "falaja-theme";

// Camada de dados estaticos com as frases e licoes do app.
const AppData = {
  phraseLessons: (window.AppLessons || []).map((lesson) => ({ ...lesson, type: lesson.type || "phrase" })),
  qaLessons: window.AppQuestionActivities || [],
  itLessons: window.AppITActivities || []
};

// Camada de persistencia responsavel por salvar e recuperar o estado local.
const StorageLayer = {
  createDefaultState() {
    return {
      lessonIndex: 0,
      mode: "phrase",
      xp: 0,
      completedLessons: [],
      recognition: null
    };
  },

  loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return this.createDefaultState();

    try {
      const parsed = JSON.parse(saved);
      return {
        lessonIndex: parsed.lessonIndex || 0,
        mode: parsed.mode || "phrase",
        xp: parsed.xp || 0,
        completedLessons: Array.isArray(parsed.completedLessons) ? parsed.completedLessons : [],
        recognition: null
      };
    } catch {
      return this.createDefaultState();
    }
  },

  persistState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      lessonIndex: state.lessonIndex,
      mode: state.mode,
      xp: state.xp,
      completedLessons: state.completedLessons
    }));
  }
};

const state = StorageLayer.loadState();

// Camada de interface que centraliza leitura e atualizacao do DOM.
const UiLayer = {
  elements: {
    phraseCounter: document.getElementById("phraseCounter"),
    lessonLevel: document.getElementById("lessonLevel"),
    lessonTitle: document.getElementById("lessonTitle"),
    activityTypeLabel: document.getElementById("activityTypeLabel"),
    promptLabel: document.getElementById("promptLabel"),
    lessonPhrase: document.getElementById("lessonPhrase"),
    lessonTranslation: document.getElementById("lessonTranslation"),
    expectedAnswerCard: document.getElementById("expectedAnswerCard"),
    expectedAnswer: document.getElementById("expectedAnswer"),
    expectedAnswerTranslation: document.getElementById("expectedAnswerTranslation"),
    speechTranscript: document.getElementById("speechTranscript"),
    speechFeedback: document.getElementById("speechFeedback"),
    phraseModeButton: document.getElementById("phraseModeButton"),
    qaModeButton: document.getElementById("qaModeButton"),
    itModeButton: document.getElementById("itModeButton"),
    themeToggleButton: document.getElementById("themeToggleButton"),
    xpValue: document.getElementById("xpValue"),
    completedLessonsValue: document.getElementById("completedLessonsValue")
  },

  renderLesson(lesson, lessonIndex, totalLessons, xp, completedCount) {
    const isQuestionActivity = lesson.type === "qa";
    this.elements.phraseCounter.textContent = `${lessonIndex + 1} / ${totalLessons}`;
    this.elements.lessonLevel.textContent = lesson.level;
    this.elements.lessonTitle.textContent = lesson.title;
    this.elements.activityTypeLabel.textContent = isQuestionActivity ? "Pergunta e resposta" : "Frase para repetir";
    this.elements.promptLabel.textContent = isQuestionActivity ? "Pergunta em ingles" : "Frase em ingles";
    this.elements.lessonPhrase.textContent = isQuestionActivity ? lesson.prompt : lesson.phrase;
    this.elements.lessonTranslation.textContent = lesson.translation;
    this.elements.expectedAnswerCard.classList.toggle("hidden", !isQuestionActivity);
    this.elements.expectedAnswer.textContent = isQuestionActivity ? lesson.expectedAnswer : "";
    this.elements.expectedAnswerTranslation.textContent = isQuestionActivity ? lesson.answerTranslation : "";
    this.elements.speechTranscript.textContent = "Nenhuma fala capturada ainda.";
    this.elements.speechFeedback.innerHTML = isQuestionActivity
      ? `<p>Toque em "Falar agora" para responder a pergunta em voz alta.</p>`
      : `<p>Toque em "Falar agora" para comparar sua fala com a frase.</p>`;
    this.elements.xpValue.textContent = xp;
    this.elements.completedLessonsValue.textContent = completedCount;
  },

  renderProgress(xp, completedCount) {
    this.elements.xpValue.textContent = xp;
    this.elements.completedLessonsValue.textContent = completedCount;
  },

  setTranscript(text) {
    this.elements.speechTranscript.textContent = text;
  },

  renderSpeechFeedback(result) {
    this.elements.speechFeedback.innerHTML = `
      <p><strong>Origem:</strong> Simulacao local</p>
      <p><strong>Semelhanca:</strong> ${result.score}/100</p>
      <p><strong>Forma correta:</strong> ${result.corrected}</p>
      <p><strong>Avaliacao:</strong> ${result.quality}</p>
      <ul class="list-disc space-y-1 pl-5">
        ${result.tips.map((tip) => `<li>${tip}</li>`).join("")}
      </ul>
    `;
  },

  renderMode(mode) {
    const isPhrase = mode === "phrase";
    const isQa = mode === "qa";
    const isIt = mode === "it";
    this.elements.phraseModeButton.className = isPhrase
      ? "rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700"
      : "rounded-2xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-100";
    this.elements.qaModeButton.className = isQa
      ? "rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700"
      : "rounded-2xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-100";
    this.elements.itModeButton.className = isIt
      ? "rounded-2xl bg-brand-600 px-4 py-2 font-semibold text-white transition hover:bg-brand-700"
      : "rounded-2xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-100";
  },

  renderTheme(theme) {
    document.body.classList.toggle("dark", theme === "dark");
    this.elements.themeToggleButton.textContent = theme === "dark" ? "Claro" : "Escuro";
  }
};

// Servicos locais de pratica: audio, similaridade e feedback basico.
const PracticeService = {
  speakText(text, rate = 1) {
    if (!("speechSynthesis" in window)) {
      alert("Seu navegador nao suporta leitura em voz.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = rate;
    utterance.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  },

  levenshtein(a, b) {
    const matrix = Array.from({ length: b.length + 1 }, () => []);
    for (let i = 0; i <= b.length; i += 1) matrix[i][0] = i;
    for (let j = 0; j <= a.length; j += 1) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i += 1) {
      for (let j = 1; j <= a.length; j += 1) {
        const indicator = a[j - 1] === b[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
          matrix[i - 1][j - 1] + indicator
        );
      }
    }

    return matrix[b.length][a.length];
  },

  similarityScore(input, expected) {
    const cleanInput = input.trim().toLowerCase();
    const cleanExpected = expected.trim().toLowerCase();
    if (!cleanInput) return 0;

    const distance = this.levenshtein(cleanInput, cleanExpected);
    const maxLength = Math.max(cleanInput.length, cleanExpected.length) || 1;
    return Math.max(0, Math.round((1 - distance / maxLength) * 100));
  },

  buildLocalSpeechFeedback(transcript, lesson) {
    const targetText = lesson.type === "qa" ? lesson.expectedAnswer : lesson.phrase;
    const score = this.similarityScore(transcript, targetText);
    const quality = score >= 90
      ? "Pronuncia muito proxima do alvo."
      : score >= 70
        ? "Boa tentativa. Ajuste ritmo e algumas palavras."
        : "Repita ouvindo em velocidade lenta antes de gravar de novo.";

    return {
      score,
      quality,
      corrected: targetText,
      tips: lesson.speakingTips
    };
  }
};

// Controlador principal que conecta estado, interface, voz e simulacao local.
const AppController = {
  getCurrentLesson() {
    return this.getCurrentList()[state.lessonIndex];
  },

  getCurrentList() {
    if (state.mode === "qa") return AppData.qaLessons;
    if (state.mode === "it") return AppData.itLessons;
    return AppData.phraseLessons;
  },

  syncState() {
    StorageLayer.persistState(state);
  },

  render() {
    UiLayer.renderLesson(
      this.getCurrentLesson(),
      state.lessonIndex,
      this.getCurrentList().length,
      state.xp,
      state.completedLessons.length
    );
    UiLayer.renderMode(state.mode);
  },

  markLessonComplete() {
    const title = this.getCurrentLesson().title;
    if (!state.completedLessons.includes(title)) {
      state.completedLessons.push(title);
      state.xp += 20;
    }

    UiLayer.renderProgress(state.xp, state.completedLessons.length);
    this.syncState();
  },

  handleSpeechAnalysis(transcript) {
    const lesson = this.getCurrentLesson();
    const result = PracticeService.buildLocalSpeechFeedback(transcript, lesson);

    UiLayer.renderSpeechFeedback(result);
    state.xp += 10;
    UiLayer.renderProgress(state.xp, state.completedLessons.length);
    this.syncState();
  },

  startRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Seu navegador nao suporta reconhecimento de voz. Teste no Chrome.");
      return;
    }

    if (!state.recognition) {
      state.recognition = new SpeechRecognition();
      state.recognition.lang = "en-US";
      state.recognition.interimResults = true;
      state.recognition.maxAlternatives = 1;

      state.recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join(" ")
          .trim();

        UiLayer.setTranscript(transcript || "Ouvindo...");

        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal && transcript) {
          this.handleSpeechAnalysis(transcript);
          this.markLessonComplete();
        }
      };

      state.recognition.onerror = () => {
        UiLayer.setTranscript("Nao foi possivel capturar a fala. Tente novamente.");
      };
    }

    UiLayer.setTranscript("Ouvindo...");
    state.recognition.start();
  },

  stopRecognition() {
    if (state.recognition) {
      state.recognition.stop();
    }
  },

  nextLesson() {
    state.lessonIndex = (state.lessonIndex + 1) % this.getCurrentList().length;
    this.render();
    this.syncState();
  },

  prevLesson() {
    state.lessonIndex = (state.lessonIndex - 1 + this.getCurrentList().length) % this.getCurrentList().length;
    this.render();
    this.syncState();
  },

  setMode(mode) {
    state.mode = mode;
    state.lessonIndex = 0;
    this.render();
    this.syncState();
  },

  resetProgress() {
    const fresh = StorageLayer.createDefaultState();
    state.lessonIndex = fresh.lessonIndex;
    state.mode = fresh.mode;
    state.xp = fresh.xp;
    state.completedLessons = [];
    this.render();
    this.syncState();
  },

  toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_STORAGE_KEY, state.theme);
    UiLayer.renderTheme(state.theme);
  },

  bindEvents() {
    document.getElementById("prevLessonButton").addEventListener("click", () => {
      this.prevLesson();
    });

    document.getElementById("phraseModeButton").addEventListener("click", () => {
      this.setMode("phrase");
    });

    document.getElementById("qaModeButton").addEventListener("click", () => {
      this.setMode("qa");
    });

    document.getElementById("itModeButton").addEventListener("click", () => {
      this.setMode("it");
    });

    document.getElementById("themeToggleButton").addEventListener("click", () => {
      this.toggleTheme();
    });

    document.getElementById("listenButton").addEventListener("click", () => {
      const lesson = this.getCurrentLesson();
      const promptText = lesson.type === "qa" ? lesson.prompt : lesson.phrase;
      PracticeService.speakText(promptText, 1);
    });

    document.getElementById("slowListenButton").addEventListener("click", () => {
      const lesson = this.getCurrentLesson();
      const promptText = lesson.type === "qa" ? lesson.prompt : lesson.phrase;
      PracticeService.speakText(promptText, 0.55);
    });

    document.getElementById("recordButton").addEventListener("click", () => {
      this.startRecognition();
    });

    document.getElementById("stopButton").addEventListener("click", () => {
      this.stopRecognition();
    });

    document.getElementById("nextLessonButton").addEventListener("click", () => {
      this.nextLesson();
    });

    document.getElementById("resetProgressButton").addEventListener("click", () => {
      this.resetProgress();
    });
  },

  init() {
    if (!AppData.phraseLessons.length && !AppData.qaLessons.length && !AppData.itLessons.length) {
      return;
    }

    state.theme = localStorage.getItem(THEME_STORAGE_KEY) || "light";
    UiLayer.renderTheme(state.theme);
    this.render();
    this.bindEvents();
    this.syncState();
  }
};

AppController.init();
