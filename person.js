(() => {
  const P = window.PERSON;
  const verbs = Object.fromEntries(window.VERBS.map((v) => [v.inf, v.tenses.present]));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const REFLEXIVE = ["me", "te", "se", "nos", "os", "se"];

  // pi: Spanish person indexes accepted (You = tú or usted), g: genders accepted
  const SUBJECTS = [
    { en: "I", be: "am", third: false, pos: "My", pi: [0], g: ["m", "f"] },
    { en: "You", be: "are", third: false, pos: "Your", pi: [1, 2], g: ["m", "f"] },
    { en: "He", be: "is", third: true, pos: "His", pi: [2], g: ["m"] },
    { en: "She", be: "is", third: true, pos: "Her", pi: [2], g: ["f"] },
    { en: "We", be: "are", third: false, pi: [3], g: ["m", "f"], plural: true },
    { en: "They", be: "are", third: false, pi: [5], g: ["m", "f"], plural: true },
  ];

  function nameSubject() {
    const g = pick(["m", "f"]);
    const name = pick(P.names[g]);
    return { en: name, es: name, be: "is", third: true, pi: [2], g: [g] };
  }

  // Gender/number slot in [m, f, m pl, f pl]
  const slot = (s, g) => (s.plural ? 2 : 0) + (g === "f" ? 1 : 0);
  const verb3 = (s, base, third) => (s.third ? third : base);

  // Each fact: en(subject) -> English predicate, es(subject, pi, g) -> Spanish predicates
  const FACTS = {
    age: (s) => {
      const n = 15 + Math.floor(Math.random() * 56);
      return { en: `${s.be} ${n} years old`, es: (pi) => [`${verbs.tener[pi]} ${n} años`] };
    },
    from: () => {
      const c = pick(P.countries);
      return { en: (s) => `${s.be} from ${c.en}`, es: (pi) => c.es.map((x) => `${verbs.ser[pi]} de ${x}`) };
    },
    nationality: () => {
      const c = pick(P.countries);
      return { en: (s) => `${s.be} ${c.nat}`, es: (pi, g, s) => [`${verbs.ser[pi]} ${c.natEs[slot(s, g)]}`] };
    },
    lives: () => {
      const c = pick(P.cities);
      return { en: (s) => `${verb3(s, "live", "lives")} in ${c.en}`, es: (pi) => [`${verbs.vivir[pi]} en ${c.es}`] };
    },
    job: () => {
      const j = pick(P.jobs);
      return {
        en: (s) => (s.plural ? `${s.be} ${j.enPl}` : `${s.be} ${j.a} ${j.en}`),
        es: (pi, g, s) => [`${verbs.ser[pi]} ${j.es[slot(s, g)]}`],
      };
    },
    works: () => {
      const p = pick(P.places);
      return { en: (s) => `${verb3(s, "work", "works")} in ${p.a} ${p.en}`, es: (pi) => p.es.map((x) => `${verbs.trabajar[pi]} en ${x}`) };
    },
    speaks: () => {
      const l = pick(P.languages);
      return { en: (s) => `${verb3(s, "speak", "speaks")} ${l.en}`, es: (pi) => l.es.map((x) => `${verbs.hablar[pi]} ${x}`) };
    },
    studies: () => {
      const l = pick(P.languages);
      return { en: (s) => `${verb3(s, "study", "studies")} ${l.en}`, es: (pi) => l.es.map((x) => `${verbs.estudiar[pi]} ${x}`) };
    },
  };

  function item() {
    const useName = Math.random() < 0.25;
    let s = useName ? nameSubject() : pick(SUBJECTS);
    const kinds = Object.keys(FACTS).filter((k) => !(k === "age" && s.plural));
    const count = Math.random() < 0.5 ? 1 : 2;
    const chosen = [];
    while (chosen.length < count) {
      const k = pick(kinds);
      // "Colombian and from Russia" contradicts itself
      const clash = (k === "from" && chosen.includes("nationality")) || (k === "nationality" && chosen.includes("from"));
      if (!chosen.includes(k) && !clash) chosen.push(k);
    }
    const facts = chosen.map((k) => (k === "age" ? FACTS.age(s) : FACTS[k]()));
    const enPred = (f) => (typeof f.en === "function" ? f.en(s) : f.en);

    // "My name is Ana" opens some I / You / He / She sentences instead of the subject
    let nameClause = null;
    if (!useName && !s.plural && Math.random() < 0.3) {
      const g = s.g.length === 1 ? s.g[0] : pick(["m", "f"]);
      const name = pick(P.names[g]);
      s = { ...s, g: [g] };
      nameClause = { en: `${s.pos} name is ${name}`, es: (pi) => `${REFLEXIVE[pi]} ${verbs.llamar[pi]} ${name}` };
      facts.length = 1;
    }

    const en = nameClause
      ? `${nameClause.en} and ${s.en === "I" ? "I" : s.en.toLowerCase()} ${enPred(facts[0])}.`
      : `${s.en} ${facts.map(enPred).join(" and ")}.`;

    // Every combination of accepted person / gender / wording
    const es = [];
    for (const pi of s.pi) {
      for (const g of s.g) {
        let parts = [[nameClause ? nameClause.es(pi) : null].filter(Boolean)];
        for (const f of facts) {
          const options = f.es(pi, g, s);
          parts = parts.flatMap((done) => options.map((o) => [...done, o]));
        }
        for (const p of parts) es.push(cap((s.es ? `${s.es} ` : "") + p.join(" y ")) + ".");
      }
    }
    return { en, es: [...new Set(es)] };
  }

  // Exact meanings from the word lists (Wiktionary alone picks "scientific" for científico, etc.)
  const SKIP = new Set(["de", "del", "la", "el", "los", "las", "un", "una"]);
  const glossary = {};
  function add(spanish, g, base) {
    for (const t of spanish.toLowerCase().split(" ")) {
      if (SKIP.has(t)) continue;
      const l = base && base.toLowerCase() !== t ? base : undefined;
      const prev = glossary[t];
      if (!prev) glossary[t] = { g, ...(l ? { l } : {}) };
      else if (!prev.g.split("; ").includes(g)) prev.g += `; ${g}`;
    }
  }
  P.jobs.forEach((j) => j.es.forEach((x, i) => add(x, i < 2 ? j.en : j.enPl, j.es[0])));
  P.countries.forEach((c) => {
    c.es.forEach((x) => add(x, c.en.replace(/^the /, "")));
    c.natEs.forEach((x) => add(x, c.nat, c.natEs[0]));
  });
  P.cities.forEach((c) => add(c.es, c.en));
  P.languages.forEach((l) => l.es.forEach((x) => add(x, `${l.en} (language)`)));
  P.places.forEach((p) => p.es.forEach((x) => add(x, p.en, x.split(" ").length > 2 ? x.replace(/^(un|una) /, "") : undefined)));

  window.personItem = item;
  window.makeDrill("ps", item, glossary).next();
})();
