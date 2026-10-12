(() => {
  const $ = (id) => document.getElementById(id);
  const els = {
    english: $("st-english"),
    form: $("st-form"),
    answer: $("st-answer"),
    correct: $("st-correct"),
    feedback: $("st-feedback"),
    submit: $("st-submit"),
    hint: $("st-hint"),
    skeleton: $("st-skeleton"),
    words: $("st-words"),
  };

  let topic = "all";
  let level = 0;
  let current = null;
  let checked = false;
  let hintLevel = 0;

  // Ignore case, punctuation, extra spaces and a leading subject pronoun
  const SUBJECT = /^(yo|tú|él|ella|usted|nosotros|nosotras|vosotros|vosotras|ellos|ellas|ustedes) /;
  const normalize = (s) =>
    s.toLowerCase().replace(/[¿?¡!.,;:"'«»]/g, " ").trim().replace(/\s+/g, " ").replace(SUBJECT, "");
  const stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Hints build up per click: 1 = skeleton, 2 = + shuffled words, 3+ = reveal one more word
  function renderHint() {
    const tokens = current.es[0].split(" ");
    const revealed = Math.max(0, hintLevel - 2);
    els.skeleton.textContent = hintLevel ? tokens.map((t, i) => (i < revealed ? t : mask(t))).join(" ") : "";
    els.words.textContent = hintLevel >= 2 ? shuffle(tokens.map(bare)).join("  ·  ") : "";
    const done = revealed >= tokens.length;
    els.hint.hidden = checked || done;
    els.hint.textContent = hintLevel ? "More" : "Hint";
  }

  // "¿Tienes" -> "¿T_____", keeps punctuation
  const mask = (t) => t.replace(/[\p{L}]/gu, (c, i) => (i === t.search(/\p{L}/u) ? c : "_"));
  const bare = (t) => t.replace(/[¿?¡!.,;:]/g, "");

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function next() {
    const pool = window.SENTENCES.filter((s) => s.level === level && (topic === "all" || s.topics.includes(topic)));
    let item;
    do item = pick(pool); while (pool.length > 1 && item === current);

    current = item;
    checked = false;
    els.english.textContent = item.en;
    els.answer.value = "";
    els.answer.className = "sentence-input";
    els.answer.readOnly = false;
    els.correct.textContent = "";
    els.feedback.className = "feedback";
    els.feedback.textContent = "";
    els.submit.textContent = "Check";
    hintLevel = 0;
    renderHint();
    els.answer.focus();
  }

  function check() {
    const given = normalize(els.answer.value);
    if (!given) return;
    const answers = current.es.map(normalize);
    checked = true;
    els.answer.readOnly = true;
    els.submit.textContent = "Next";
    els.hint.hidden = true;

    if (answers.includes(given)) {
      els.answer.classList.add("good");
      els.feedback.className = "feedback good";
      els.feedback.textContent = "Correct";
    } else {
      els.answer.classList.add("bad");
      els.correct.textContent = current.es[0];
      els.feedback.className = "feedback bad";
      const accentsOnly = answers.some((a) => stripAccents(a) === stripAccents(given));
      els.feedback.textContent = accentsOnly ? "Check the accents" : "Incorrect";
    }
    els.submit.focus();
  }

  els.hint.addEventListener("click", () => {
    hintLevel++;
    // Keep the shuffled order stable while revealing words
    const order = els.words.textContent;
    renderHint();
    if (hintLevel > 2) els.words.textContent = order;
    els.answer.focus();
  });

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    checked ? next() : check();
  });

  document.addEventListener("keydown", (e) => {
    if (els.form.closest("main").hidden || document.querySelector("dialog[open]")) return;
    if (e.key === "Enter" && checked && !els.form.contains(document.activeElement)) {
      e.preventDefault();
      next();
    }
  });

  function segmented(id, onChange) {
    const buttons = document.querySelectorAll(`#${id} button`);
    buttons.forEach((btn) => btn.addEventListener("click", () => {
      buttons.forEach((b) => b.setAttribute("aria-checked", String(b === btn)));
      onChange(btn.dataset.value);
      next();
    }));
  }

  segmented("st-topic", (v) => (topic = v));
  segmented("st-level", (v) => (level = Number(v)));

  next();
})();
