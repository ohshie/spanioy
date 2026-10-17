(() => {
  let topic = "all";
  let level = 0;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const drill = window.makeDrill("st", () =>
    pick(window.SENTENCES.filter((s) => s.level === level && (topic === "all" || s.topics.includes(topic)))));

  window.segmented("st-topic", (v) => { topic = v; drill.next(); });
  window.segmented("st-level", (v) => { level = Number(v); drill.next(); });

  drill.next();
})();
