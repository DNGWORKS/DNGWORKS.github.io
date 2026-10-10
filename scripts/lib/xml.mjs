/**
 * A small tokenising XML reader, used instead of matching feeds with regular
 * expressions. It handles CDATA, comments, self-closing tags, attributes,
 * namespaced names and the five XML entities plus numeric references, which
 * is everything an RSS or Atom feed needs.
 *
 * parse(xml) -> { name, attrs, children: [node], text }
 */

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeEntities(input) {
  return String(input).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    const named = ENTITIES[body.toLowerCase()];
    return named === undefined ? match : named;
  });
}

function parseAttributes(source) {
  const attrs = {};
  const re = /([^\s=/>]+)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match;
  while ((match = re.exec(source))) {
    const name = match[1];
    if (!name) continue;
    const raw = match[3] ?? match[4] ?? match[5] ?? '';
    attrs[name.toLowerCase()] = decodeEntities(raw);
  }
  return attrs;
}

export function parse(xml) {
  const source = String(xml);
  const rootNode = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [rootNode];
  let i = 0;

  const pushText = (value) => {
    if (!value) return;
    const node = stack[stack.length - 1];
    node.text += value;
  };

  while (i < source.length) {
    const lt = source.indexOf('<', i);
    if (lt === -1) {
      pushText(decodeEntities(source.slice(i)));
      break;
    }
    if (lt > i) pushText(decodeEntities(source.slice(i, lt)));

    /* --- CDATA: contents are literal text ------------------------------- */
    if (source.startsWith('<![CDATA[', lt)) {
      const end = source.indexOf(']]>', lt);
      const stop = end === -1 ? source.length : end;
      pushText(source.slice(lt + 9, stop));
      i = end === -1 ? source.length : end + 3;
      continue;
    }

    /* --- comment, doctype, processing instruction: skipped -------------- */
    if (source.startsWith('<!--', lt)) {
      const end = source.indexOf('-->', lt);
      i = end === -1 ? source.length : end + 3;
      continue;
    }
    if (source.startsWith('<?', lt) || source.startsWith('<!', lt)) {
      const end = source.indexOf('>', lt);
      i = end === -1 ? source.length : end + 1;
      continue;
    }

    const gt = source.indexOf('>', lt);
    if (gt === -1) {
      pushText(decodeEntities(source.slice(lt)));
      break;
    }

    const inner = source.slice(lt + 1, gt).trim();

    /* --- closing tag ---------------------------------------------------- */
    if (inner.startsWith('/')) {
      const name = inner.slice(1).trim().toLowerCase();
      for (let depth = stack.length - 1; depth > 0; depth -= 1) {
        if (stack[depth].name === name) {
          stack.length = depth;
          break;
        }
      }
      i = gt + 1;
      continue;
    }

    /* --- opening or self-closing tag ------------------------------------ */
    const selfClosing = inner.endsWith('/');
    const body = selfClosing ? inner.slice(0, -1) : inner;
    const space = body.search(/\s/);
    const name = (space === -1 ? body : body.slice(0, space)).toLowerCase();
    const attrs = space === -1 ? {} : parseAttributes(body.slice(space + 1));

    const node = { name, attrs, children: [], text: '' };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);

    i = gt + 1;
  }

  return rootNode;
}

/** All descendants with a given local name, namespace prefix ignored. */
export function findAll(node, name) {
  const target = name.toLowerCase();
  const out = [];
  const walk = (current) => {
    for (const child of current.children) {
      const local = child.name.includes(':') ? child.name.split(':').pop() : child.name;
      if (local === target) out.push(child);
      walk(child);
    }
  };
  walk(node);
  return out;
}

/** Direct child with a given local name. */
export function child(node, name) {
  const target = name.toLowerCase();
  for (const item of node.children) {
    const local = item.name.includes(':') ? item.name.split(':').pop() : item.name;
    if (local === target) return item;
  }
  return null;
}

export function text(node, name) {
  const found = name ? child(node, name) : node;
  return found ? found.text.trim() : '';
}
