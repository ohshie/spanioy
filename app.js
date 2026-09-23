(() => {
  const PRONOUNS = ["yo", "tú", "él / ella / usted", "nosotros", "vosotros", "ellos / ellas / ustedes"];
  const TENSE = "present";

  const $ = (id) => document.getElementById(id);
  const els = {
    infinitive: $("infinitive"),
    meaning: $("meaning"),
    form: $("answer-form"),
    rows: $("rows"),
    feedback: $("feedback"),
    submit: $("submit"),
  };

  let group = "all";
  let mode = "one";
  let current = null; // { verb, persons: [index, ...] }
  let checked = false;

  const normalize = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function inputs() {
    return [...els.rows.querySelectorAll("input")];
  }

  function next() {
    const pool = window.VERBS.filter((v) => group === "all" || v.group === group);
    let verb, available, persons;
    do {
      verb = pick(pool);
      // Only forms that exist (e.g. llover has 3rd singular only)
      available = verb.tenses[TENSE].map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
      persons = mode === "one" ? [pick(available)] : shuffle(available);
    } while (current && mode === "one" && verb.inf === current.verb.inf && persons[0] === current.persons[0]);

    current = { verb, persons };
    checked = false;

    els.infinitive.textContent = verb.inf;
    els.meaning.textContent = verb.en;
    els.rows.className = "rows " + mode;
    els.rows.replaceChildren(...persons.map((p) => {
      const row = document.createElement("label");
      row.className = "row";
      const pronoun = document.createElement("span");
      pronoun.className = "pronoun";
      pronoun.textContent = PRONOUNS[p];
      const input = document.createElement("input");
      input.type = "text";
      input.spellcheck = false;
      input.autocapitalize = "off";
      input.setAttribute("autocorrect", "off");
      input.dataset.person = p;
      const answer = document.createElement("span");
      answer.className = "answer";
      row.append(pronoun, input, answer);
      return row;
    }));
    els.feedback.className = "feedback";
    els.feedback.textContent = "";
    els.submit.textContent = "Check";
    inputs()[0].focus();
  }

  function check() {
    const fields = inputs();
    if (fields.every((f) => !normalize(f.value))) return;
    checked = true;
    els.submit.textContent = "Next";

    let correct = 0;
    let accentsOnly = false;
    fields.forEach((f) => {
      const expected = current.verb.tenses[TENSE][f.dataset.person];
      const given = normalize(f.value);
      f.readOnly = true;
      const ok = given === normalize(expected);
      f.classList.add(ok ? "good" : "bad");
      if (ok) {
        correct++;
      } else {
        f.nextElementSibling.textContent = expected;
        if (given && stripAccents(given) === stripAccents(normalize(expected))) accentsOnly = true;
      }
    });

    const allGood = correct === fields.length;
    els.feedback.className = "feedback " + (allGood ? "good" : "bad");
    if (fields.length === 1) {
      els.feedback.textContent = allGood ? "Correct" : accentsOnly ? "Check the accents" : "Incorrect";
    } else {
      els.feedback.textContent = `${correct} of ${fields.length} correct` + (accentsOnly ? " — check the accents" : "");
    }
    els.submit.focus();
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (checked) return next();
    // Enter moves through the fields; on the last one it checks
    const fields = inputs();
    const i = fields.indexOf(document.activeElement);
    if (i >= 0 && i < fields.length - 1) fields[i + 1].focus();
    else check();
  });

  // Enter advances even if focus left the form
  document.addEventListener("keydown", (e) => {
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
      current = null;
      next();
    }));
  }

  segmented("group", (v) => (group = v));
  segmented("mode", (v) => (mode = v));

  next();
})();
