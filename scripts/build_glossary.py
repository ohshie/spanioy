#!/usr/bin/env python3
"""Build data/glossary.js: English meaning for every Spanish word in data/sentences.js.

Dictionary: English Wiktionary via kaikki.org (wiktextract), CC BY-SA 4.0
  https://kaikki.org/dictionary/Spanish/
Word frequency (to pick the likely lemma): FrequencyWords es_50k, CC BY-SA 4.0

Conjugated forms are resolved to their base word: tengo -> "to have" (tener).

Usage: python3 scripts/build_glossary.py [path/to/kaikki.org-dictionary-Spanish.jsonl]
  Without a path the ~1 GB file is downloaded to a temp file.
"""
import json
import pathlib
import re
import sys
import tempfile
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SENTENCES = ROOT / "data" / "sentences.js"
OUT = ROOT / "data" / "glossary.js"
DICT_URL = "https://kaikki.org/dictionary/Spanish/kaikki.org-dictionary-Spanish.jsonl"
FREQ_URL = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt"

SKIP_TAGS = {"obsolete", "archaic", "rare", "dated", "with-voseo", "misspelling", "nonstandard",
             "abbreviation", "initialism", "acronym", "letter", "alt-of", "alternative"}
SKIP_POS = {"character", "symbol", "prefix", "suffix", "infix", "interfix", "punct"}
# Function words: their own meaning beats being a form of something else (nos = us, not plural of no)
CLOSED_POS = {"pron", "det", "article", "prep", "conj", "adv", "contraction", "particle"}
# Show a second meaning when it comes from a different, common base word (acuerdo: agreement / acordar)
# Infinitives are rarer than their forms in the frequency list, so verbs get a looser limit
ALT_MAX_RANK = 3000
ALT_MAX_RANK_VERB = 20000
SKIP_GLOSS = re.compile(r"^(abbreviation|initialism|acronym|alternative form|apocopic form|the name of)", re.I)
MAX_LEN = 60
# Hand-written meanings for very common words where a context-free automatic pick goes wrong
# (e.g. mi -> Greek letter mu, sé -> "yes"). Format: word: (gloss, base word or None)
OVERRIDES = {
    "se": ("himself, herself, itself, oneself, themselves", None),
    "me": ("me, myself", None), "te": ("you, yourself", None),
    "nos": ("us, ourselves", None), "os": ("you all, yourselves", None),
    "lo": ("it, him", None), "la": ("the; her, it", None),
    "los": ("the; them", None), "las": ("the; them", None),
    "le": ("to him, to her, to you", None), "les": ("to them, to you all", None),
    "el": ("the", None), "un": ("a, an", None), "una": ("a, an", None),
    "unos": ("some", None), "unas": ("some", None),
    "mi": ("my", None), "mis": ("my", None), "tu": ("your", None), "tus": ("your", None),
    "su": ("his, her, its, your, their", None), "sus": ("his, her, its, your, their", None),
    "nuestro": ("our", None), "nuestra": ("our", None),
    "yo": ("I", None), "tú": ("you", None), "él": ("he, him", None), "ella": ("she, her", None),
    "usted": ("you (formal)", None), "ustedes": ("you all (formal)", None),
    "nosotros": ("we, us", None), "vosotros": ("you all", None),
    "ellos": ("they, them", None), "ellas": ("they, them", None),
    "esto": ("this", None), "este": ("this", None), "esta": ("this", None),
    "estos": ("these", None), "estas": ("these", None),
    "eso": ("that", None), "ese": ("that", None), "esa": ("that", None),
    "sé": ("I know", "saber"), "hay": ("there is, there are", "haber"),
    "al": ("to the", None), "del": ("of the, from the", None),
    "de": ("of, from", None), "a": ("to, at", None), "en": ("in, on, at", None),
    "que": ("that, which", None), "qué": ("what", None), "no": ("no, not", None),
    "sí": ("yes", None), "si": ("if", None), "y": ("and", None), "o": ("or", None),
    "pero": ("but", None), "porque": ("because", None), "muy": ("very", None),
    "más": ("more", None), "nada": ("nothing", None), "algo": ("something", None),
    "todo": ("all, everything", None), "mucho": ("a lot, much", None),
    "ya": ("already, now", None), "bien": ("well, good", None), "buen": ("good", "bueno"),
    "gran": ("big, great", "grande"), "algún": ("some", "alguno"), "ningún": ("no, not any", "ninguno"),
    "aquí": ("here", None), "allí": ("there", None), "ahí": ("there", None),
    "cuando": ("when", None), "como": ("like, as", None), "donde": ("where", None),
    "también": ("also, too", None), "por": ("for, by, through", None), "para": ("for, to", None),
    "con": ("with", None), "sin": ("without", None),
    "llama": ("calls; is called", "llamar"), "café": ("coffee", None),
    "tía": ("aunt", None), "tío": ("uncle", None), "vete": ("go away!", "irse"),
}
# Hand-written meanings for base words whose first dictionary sense is not the common one
LEMMA_OVERRIDES = {"deber": "must, should; to owe", "solo": "alone, only"}
TOKEN = re.compile(r"[A-Za-záéíóúüñÁÉÍÓÚÜÑ]+")


def vocabulary():
    data = json.loads(SENTENCES.read_text(encoding="utf-8").split("window.SENTENCES = ", 1)[1].rstrip(";\n"))
    return {t.lower() for item in data for es in item["es"] for t in TOKEN.findall(es)}


def short(gloss):
    gloss = re.sub(r"\s*\([^)]*\)", "", re.split(r";", gloss)[0]).strip().rstrip(".")
    # Long meanings: keep the first item (dog, domesticated for ... -> dog)
    if len(gloss) > 30 and "," in gloss:
        gloss = gloss.split(",")[0]
    gloss = gloss.strip(" ,:")
    return gloss if len(gloss) <= MAX_LEN else gloss[: MAX_LEN - 1].rstrip(" ,") + "…"


def usable(sense):
    return (sense.get("glosses") and not SKIP_TAGS & set(sense.get("tags", []))
            and not SKIP_GLOSS.match(sense["glosses"][-1]))


def main():
    words = vocabulary()
    rank = {}
    for i, line in enumerate(urllib.request.urlopen(FREQ_URL).read().decode("utf-8").splitlines()):
        rank.setdefault(line.split(" ")[0], i + 1)

    path = sys.argv[1] if len(sys.argv) > 1 else None
    if not path:
        path = tempfile.mktemp(suffix=".jsonl")
        print("downloading", DICT_URL)
        urllib.request.urlretrieve(DICT_URL, path)

    # Pass 1: senses of our words; note which base words (lemmas) they point to
    forms = {}  # word -> [(lemma, pos)] in dictionary order
    lemma_senses = {}  # (lemma, pos) -> first usable plain gloss
    with open(path, encoding="utf-8") as f:
        for line in f:
            e = json.loads(line)
            w = e["word"].lower()
            if w not in words or e.get("pos") in SKIP_POS:
                continue
            for s in e.get("senses", []):
                if not usable(s):
                    continue
                base = s.get("form_of", [{}])[0].get("word")
                forms.setdefault(w, []).append((base.lower() if base else w, e.get("pos")))
                if not base:
                    lemma_senses.setdefault((w, e.get("pos")), s["glosses"][-1])
    needed = {k for v in forms.values() for k in v} - set(lemma_senses)
    for (lemma, pos) in list(lemma_senses) + list(needed):
        if lemma in LEMMA_OVERRIDES:
            lemma_senses[(lemma, pos)] = LEMMA_OVERRIDES[lemma]

    # Pass 2: glosses of base words not covered in pass 1
    if needed:
        with open(path, encoding="utf-8") as f:
            for line in f:
                e = json.loads(line)
                key = (e["word"].lower(), e.get("pos"))
                if e.get("pos") in SKIP_POS or key not in needed or key in lemma_senses:
                    continue
                for s in e.get("senses", []):
                    if usable(s) and not s.get("form_of"):
                        lemma_senses[key] = s["glosses"][-1]
                        break

    glossary = {}
    for w, cands in forms.items():
        cands = [c for c in cands if c in lemma_senses]
        # A word's own entry beats being a form of another word with the same part of speech (tía = aunt, not tío)
        own_pos = {p for l, p in cands if l == w}
        cands = [c for c in cands if c[0] == w or c[1] not in own_pos]
        if not cands:
            continue
        closed = [c for c in cands if c[0] == w and c[1] in CLOSED_POS]
        # Most frequent base word wins (pies -> pie "foot", not piar); ties keep dictionary order
        ordered = sorted(cands, key=lambda c: (rank.get(c[0], 10**9), cands.index(c)))
        lemma, pos = closed[0] if closed else ordered[0]
        entry = {"g": short(lemma_senses[(lemma, pos)])}
        if lemma != w:
            entry["l"] = lemma
        alt = next((c for c in ordered if c[0] != lemma and rank.get(c[0], 10**9)
                    <= (ALT_MAX_RANK_VERB if c[1] == "verb" else ALT_MAX_RANK)
                    and short(lemma_senses[c]).lower() != w and c[1] != "name"
                    and not re.search(r"surname|given name", lemma_senses[c])), None)
        if alt:
            entry["alt"] = {"g": short(lemma_senses[alt]), **({"l": alt[0]} if alt[0] != w else {})}
        glossary[w] = entry

    for w, (g, base) in OVERRIDES.items():
        if w in words:
            glossary[w] = {"g": g, **({"l": base} if base else {})}

    OUT.write_text(
        "// Generated by scripts/build_glossary.py — do not edit.\n"
        "// Data: English Wiktionary via kaikki.org, CC BY-SA 4.0\n"
        "window.GLOSSARY = " + json.dumps(glossary, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    missing = sorted(words - set(glossary))
    print(f"{len(glossary)}/{len(words)} words -> {OUT}")
    print("missing:", " ".join(missing[:80]))


if __name__ == "__main__":
    main()
