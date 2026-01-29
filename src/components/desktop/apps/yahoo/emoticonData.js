const EMOTICON_CODES = [
  ":)",
  ":(",
  ";)",
  ":D",
  ";;)",
  ">:D<",
  ":-/",
  ":x",
  ":\">",
  ":P",
  ":-*",
  "=((",
  ":-O",
  "X(",
  ":>",
  "B-)",
  ":-S",
  "#:-S",
  ">:)",
  ":((",
  ":))",
  ":|",
  "/:)",
  "=))",
  "O:-)",
  ":-B",
  "=;",
  ":-c",
  ":)]",
  "~X(",
  ":-h",
  ":-t",
  "8->",
  "I-)",
  "8-|",
  "L-)",
  ":-&",
  ":-$",
  "[-(",
  ":O)",
  "8-}",
  "<:-P",
  "(|)",
  "=P~",
  ":-?",
  "#-o",
  "=D>",
  ":-SS",
  "@-)",
  ":^o",
  ":-w",
  ":-<",
  ">:P",
  "<):)",
  "X_X",
  "!!",
  "\\m/",
  ":-q",
  ":-bd",
  "^#(^",
  ":ar!",
];

const EMOTICON_MODULES = import.meta.glob("../../../../assets/yahoo/emoticons/*.{png,gif,webp,svg}", {
  eager: true,
});

const parseEmoticonFilename = (path) => {
  const filename = path.split("/").pop() || "";
  return filename.replace(/\.[^.]+$/, "");
};

const normalizeEmoticonEntries = () => {
  const entries = Object.entries(EMOTICON_MODULES).map(([path, mod]) => {
    const name = parseEmoticonFilename(path);
    const numeric = Number.parseInt(name, 10);
    return {
      name,
      src: mod?.default || mod,
      numeric: Number.isNaN(numeric) ? null : numeric,
    };
  });

  entries.sort((a, b) => {
    const aNum = a.numeric;
    const bNum = b.numeric;
    if (aNum !== null && bNum !== null) return aNum - bNum;
    if (aNum !== null) return -1;
    if (bNum !== null) return 1;
    return a.name.localeCompare(b.name);
  });

  return entries;
};

const EMOTICON_FILES = normalizeEmoticonEntries();

const EMOTICON_ENTRIES = EMOTICON_CODES.map((code, index) => {
  const file = EMOTICON_FILES[index];
  return file
    ? {
        code,
        src: file.src,
        name: file.name,
      }
    : null;
}).filter(Boolean);

const EMOTICON_CODE_MAP = EMOTICON_ENTRIES.reduce((acc, entry) => {
  acc[entry.code] = entry;
  return acc;
}, {});

export { EMOTICON_CODES, EMOTICON_ENTRIES, EMOTICON_CODE_MAP };
