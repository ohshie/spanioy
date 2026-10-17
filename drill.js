// Shared English -> Spanish drill: check, skip, step-by-step hints, per-word meanings.
// makeDrill("st", nextItem, glossary) uses elements #st-english, #st-answer, ... ; nextItem() returns { en, es: [answers] }.
// `glossary` (optional) is checked before the shared window.GLOSSARY.
window.makeDrill = (prefix, nextItem, glossary = {}) => {
  const $ = (id) => document.getElementById(`${prefix}-${id}`);
  const els = {
    english: $("english"),
    form: $("form"),
    answer: $("answer"),
    correct: $("correct"),
    feedback: $("feedback"),
    submit: $("submit"),
    skip: $("skip"),
    hint: $("hint"),
    skeleton: $("skeleton"),
    words: $("words"),
  };

  let current = null;
  let checked = false;
  let hintLevel = 0;
  let bank = [];

  // Ignore case, punctuation, extra spaces and a leading subject pronoun
  const SUBJECT = /^(yo|tú|él|ella|usted|nosotros|nosotras|vosotros|vosotras|ellos|ellas|ustedes) /;
  const normalize = (s) =>
    s.toLowerCase().replace(/[¿?¡!.,;:"'«»]/g, " ").trim().replace(/\s+/g, " ").replace(SUBJECT, "");
  const stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
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

  // Hints build up per click: 1 = skeleton, 2 = + shuffled words, 3+ = reveal one more word.
  // Shuffled and revealed words show their meaning on hover / hold.
  function renderHint() {
    const tokens = current.es[0].split(" ");
    const revealed = Math.max(0, hintLevel - 2);
    els.skeleton.replaceChildren(...(hintLevel ? tokens : []).flatMap((t, i) =>
      [i ? " " : "", i < revealed ? wordEl(t) : mask(t)]));
    if (hintLevel === 2) bank = shuffle(tokens.map(bare));
    els.words.replaceChildren(...(hintLevel >= 2 ? bank : []).flatMap((t, i) => [i ? "  ·  " : "", wordEl(t)]));
    els.hint.hidden = checked || revealed >= tokens.length;
    els.hint.textContent = hintLevel ? "More" : "Hint";
  }

  // A word with its meaning in a popup, or plain text when it's not in the glossary
  function wordEl(token) {
    const word = document.createElement("span");
    word.textContent = token;
    const k = bare(token).toLowerCase();
    const entry = glossary[k] || window.GLOSSARY[k];
    if (!entry) return word;
    word.className = "word";
    const tip = document.createElement("span");
    tip.className = "tip";
    [entry, entry.alt].filter(Boolean).forEach((m, k) => {
      const meaning = document.createElement("span");
      meaning.className = "meaning-line" + (k ? " alt" : "");
      meaning.textContent = m.g;
      if (m.l) {
        const base = document.createElement("em");
        base.textContent = m.l;
        meaning.append(base);
      }
      tip.append(meaning);
    });
    word.append(tip);
    return word;
  }

  // Word-level comparison of the user's text with an answer (longest common subsequence)
  const key = (t) => t.toLowerCase().replace(/[¿?¡!.,;:"'«»]/g, "");
  const PRONOUNS = new Set(SUBJECT.source.slice(2, -2).split("|"));

  function lcs(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--)
      for (let j = b.length - 1; j >= 0; j--)
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const aOk = new Array(a.length).fill(false);
    const bOk = new Array(b.length).fill(false);
    for (let i = 0, j = 0; i < a.length && j < b.length;) {
      if (a[i] === b[j]) { aOk[i++] = true; bOk[j++] = true; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    return { aOk, bOk, length: dp[0][0] };
  }

  function compare(givenText, answer) {
    const given = givenText.trim().split(/\s+/);
    const g = given.map(key);
    const a = answer.split(" ").map(key);
    const { aOk, bOk } = lcs(g, a);
    const missed = new Set(a.filter((_, j) => !bOk[j]).map(stripAccents));
    const givenState = g.map((w, i) => {
      if (aOk[i]) return "ok";
      if (i === 0 && PRONOUNS.has(w) && !PRONOUNS.has(a[0])) return "ok"; // optional subject pronoun
      return missed.has(stripAccents(w)) ? "accent-miss" : "miss";
    });
    return { given, givenState, answerOk: bOk };
  }

  // The accepted answer closest to what the user typed
  function closest(givenText) {
    const g = givenText.trim().split(/\s+/).map(key);
    let best = current.es[0], bestScore = -1;
    for (const es of current.es) {
      const a = es.split(" ").map(key);
      const score = 2 * lcs(g, a).length - a.length;
      if (score > bestScore) { best = es; bestScore = score; }
    }
    return best;
  }

  function next() {
    let item;
    do item = nextItem(); while (current && item.en === current.en && Math.random() < 0.95);

    current = item;
    checked = false;
    els.english.textContent = item.en;
    els.answer.value = "";
    els.answer.hidden = false;
    els.form.querySelector(".answer-view")?.remove();
    els.answer.className = "sentence-input";
    els.answer.readOnly = false;
    els.correct.textContent = "";
    els.feedback.className = "feedback";
    els.feedback.textContent = "";
    els.submit.textContent = "Check";
    els.skip.hidden = false;
    hintLevel = 0;
    renderHint();
    els.answer.focus({ preventScroll: true });
  }

  function check() {
    const given = normalize(els.answer.value);
    if (!given) return;
    const answers = current.es.map(normalize);
    checked = true;
    els.answer.readOnly = true;
    els.submit.textContent = "Next";
    els.skip.hidden = true;
    els.hint.hidden = true;

    const match = answers.indexOf(given);
    const answer = match >= 0 ? current.es[match] : closest(els.answer.value);
    const diff = compare(els.answer.value, answer);

    // Spanish sentence with per-word meanings; words the user missed are tinted
    els.correct.replaceChildren(...answer.split(" ").flatMap((t, i) => {
      const w = wordEl(t);
      if (match < 0 && !diff.answerOk[i]) w.classList.add("fix");
      return [i ? " " : "", w];
    }));

    if (match >= 0) {
      els.answer.classList.add("good");
      els.feedback.className = "feedback good";
      els.feedback.textContent = "Correct";
    } else {
      // Show the user's own text with the wrong words underlined
      const view = document.createElement("div");
      view.className = "sentence-input bad answer-view";
      view.append(...diff.given.flatMap((t, i) => {
        const span = document.createElement("span");
        span.textContent = t;
        if (diff.givenState[i] !== "ok") span.className = diff.givenState[i];
        return [i ? " " : "", span];
      }));
      els.answer.hidden = true;
      els.answer.after(view);
      els.feedback.className = "feedback bad";
      const accentsOnly = answers.some((a) => stripAccents(a) === stripAccents(given));
      els.feedback.textContent = accentsOnly ? "Check the accents" : "Incorrect";
    }
    els.submit.focus();
  }

  // Hover on desktop; press-and-hold on touch
  [els.correct, els.skeleton, els.words].forEach((box) => {
    box.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      e.target.closest(".word")?.classList.add("open");
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((type) =>
      box.addEventListener(type, () => box.querySelectorAll(".word.open").forEach((w) => w.classList.remove("open"))));
    box.addEventListener("contextmenu", (e) => e.preventDefault());
  });

  els.hint.addEventListener("click", () => {
    hintLevel++;
    renderHint();
    els.answer.focus({ preventScroll: true });
  });

  els.skip.addEventListener("click", next);

  // Tapping Skip / Hint must not take focus from the input: on iOS that closes the
  // keyboard, and focusing again reopens it and scrolls the page
  [els.skip, els.hint].forEach((b) => b.addEventListener("mousedown", (e) => e.preventDefault()));

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

  return { next };
};

// Wire a segmented control: updates aria-checked and calls onChange(value)
window.segmented = (id, onChange) => {
  const buttons = document.querySelectorAll(`#${id} button`);
  buttons.forEach((btn) => btn.addEventListener("click", () => {
    buttons.forEach((b) => b.setAttribute("aria-checked", String(b === btn)));
    onChange(btn.dataset.value);
  }));
};
