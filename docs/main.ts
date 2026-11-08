import { start } from '../src/auto';
import { configure, defaultConfig, getConfig, supportsDistortion } from '../src/core';

// The package's main entry does this on import. Here the source is imported
// directly, where package.json's `sideEffects` would let the bundler drop that.
start();

// Prism comes from the CDN, as on the ripple-effect docs, and is global.
declare const Prism: any;
const prism = () => (typeof Prism === 'undefined' ? undefined : Prism);

// A colour swatch beside each hex value in the CSS, as on the ripple-effect docs.
// Registered once the page has loaded, since Prism's script is deferred.
function addSwatches() {
  prism()?.hooks.add('complete', (env: { language: string; element: HTMLElement }) => {
    if (env.language !== 'css') {
      return;
    }

    textNodes(env.element).forEach((text) => {
      const colour = text.data.match(/#[0-9a-fA-F]{6}/)?.[0];
      if (colour) {
        const swatch = document.createElement('span');
        swatch.className = 'css-color';
        swatch.style.backgroundColor = colour;
        text.before(swatch);
      }
    });
  });
}

function textNodes(root: Node): Text[] {
  return Array.from(root.childNodes).flatMap((child) =>
    child.nodeType === Node.TEXT_NODE ? [child as Text] : textNodes(child)
  );
}
addSwatches();

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const stage = $('stage');
const play = $('play');
const snippet = $('snippet');
const supported = supportsDistortion();

// Browsers without the distortion get the plain blur, so say so.
$('notice').hidden = supported;
$('support-status').textContent = supported
  ? 'This browser draws the distortion.'
  : 'This browser does not draw the distortion, so the examples on this page show the plain blur.';

// The distortion box is on only where it can be drawn.
const distortion = $<HTMLInputElement>('distortion');
distortion.checked = supported;
distortion.disabled = !supported;
if (!supported) {
  distortion.title = 'This browser cannot draw the distortion';
}

// --- Playground -----------------------------------------------------------

const DEFAULT_GLOW_COLOUR = '#ffffff';
const defaults = { blur: 12, width: 300, height: 180, radius: 32 };
const element = { ...defaults };
let glowColour = DEFAULT_GLOW_COLOUR;

function readout(name: string, value: number | string) {
  const output = document.querySelector<HTMLOutputElement>(`output[data-for="${name}"]`);
  if (output) {
    output.textContent = String(value);
  }
}

function renderElement() {
  play.setAttribute('data-liquid-glass', String(element.blur));
  play.style.width = `${element.width}px`;
  play.style.height = `${element.height}px`;
  play.style.borderRadius = `${element.radius}px`;
  Object.entries(element).forEach(([name, value]) => readout(name, value));
  renderSnippet();
}

type Block = { language: string; code: string };
let blocks: Block[] = [];

function renderSnippet() {
  const config = getConfig();
  const changes: string[] = [];

  (Object.keys(defaultConfig) as (keyof typeof defaultConfig)[]).forEach((key) => {
    if (key === 'distortion') {
      // 'auto' is the default, so only a choice that differs from what this browser does is worth showing.
      if (config.distortion !== 'auto' && config.distortion !== supported) {
        changes.push(`  distortion: ${config.distortion}`);
      }
    } else if (config[key] !== defaultConfig[key]) {
      changes.push(`  ${key}: ${config[key]}`);
    }
  });

  blocks = [
    { language: 'html', code: `<div class="glass" data-liquid-glass="${element.blur}">...</div>` },
    {
      language: 'css',
      code: [
        '.glass {',
        `  width: ${element.width}px;`,
        `  height: ${element.height}px;`,
        `  border-radius: ${element.radius}px;`,
        '}'
      ].join('\n')
    }
  ];

  if (glowColour !== DEFAULT_GLOW_COLOUR) {
    blocks.push({ language: 'css', code: `.glass { --liquid-glass-glow-color: ${glowColour}; }` });
  }

  if (changes.length) {
    blocks.push({
      language: 'js',
      code: [
        "import { configure } from '@gabrielfins/liquid-glass';",
        '',
        'configure({',
        changes.join(',\n'),
        '});'
      ].join('\n')
    });
  }

  // Rebuilt each time, since Prism rewrites a block's markup when it highlights it.
  snippet.replaceChildren(
    ...blocks.map(({ language, code }) => {
      const pre = document.createElement('pre');
      const codeElement = document.createElement('code');
      codeElement.className = `language-${language}`;
      codeElement.textContent = code;
      pre.append(codeElement);
      prism()?.highlightElement(codeElement);
      return withCopy(pre);
    })
  );
}

function bindElement(name: keyof typeof element) {
  $<HTMLInputElement>(name).addEventListener('input', (event) => {
    element[name] = Number((event.target as HTMLInputElement).value);
    renderElement();
  });
}

function bindConfig(id: string, key: keyof typeof defaultConfig, read: (input: HTMLInputElement) => number | boolean) {
  const input = $<HTMLInputElement>(id);
  input.addEventListener('input', () => {
    configure({ [key]: read(input) });
    readout(key, input.value);
    renderSnippet();
  });
}

(['blur', 'width', 'height', 'radius'] as const).forEach(bindElement);
bindConfig('brightness', 'brightness', (input) => Number(input.value));
bindConfig('glowSize', 'glowSize', (input) => Number(input.value));
bindConfig('glowStrength', 'glowStrength', (input) => Number(input.value));
bindConfig('glow', 'glow', (input) => input.checked);
bindConfig('aberration', 'chromaticAberration', (input) => input.checked);
bindConfig('distortion', 'distortion', (input) => input.checked);

$<HTMLInputElement>('glowColour').addEventListener('input', (event) => {
  glowColour = (event.target as HTMLInputElement).value;
  // Set on the page, so the glass in the examples and the top bar follows too.
  document.documentElement.style.setProperty('--liquid-glass-glow-color', glowColour);
  renderSnippet();
});

// Dragging the glass over the background is the quickest way to see it bend.
let offset = { x: 0, y: 0 };

function place() {
  play.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
}

play.addEventListener('pointerdown', (event) => {
  play.setPointerCapture(event.pointerId);
  play.classList.add('dragging');
  const start = { x: event.clientX - offset.x, y: event.clientY - offset.y };

  const move = (next: PointerEvent) => {
    const stageBox = stage.getBoundingClientRect();
    const limitX = Math.max(0, (stageBox.width - play.offsetWidth) / 2);
    const limitY = Math.max(0, (stageBox.height - play.offsetHeight) / 2);
    offset = {
      x: Math.min(limitX, Math.max(-limitX, next.clientX - start.x)),
      y: Math.min(limitY, Math.max(-limitY, next.clientY - start.y))
    };
    place();
  };

  const stop = () => {
    play.classList.remove('dragging');
    play.removeEventListener('pointermove', move);
    play.removeEventListener('pointerup', stop);
    play.removeEventListener('pointercancel', stop);
  };

  play.addEventListener('pointermove', move);
  play.addEventListener('pointerup', stop);
  play.addEventListener('pointercancel', stop);
});

$('reset').addEventListener('click', () => {
  Object.assign(element, defaults);
  offset = { x: 0, y: 0 };
  glowColour = DEFAULT_GLOW_COLOUR;
  document.documentElement.style.removeProperty('--liquid-glass-glow-color');
  configure({ ...defaultConfig });

  const config = getConfig();
  const set = (id: string, value: string | number) => ($<HTMLInputElement>(id).value = String(value));
  (Object.keys(defaults) as (keyof typeof defaults)[]).forEach((name) => set(name, defaults[name]));
  set('brightness', config.brightness);
  set('glowSize', config.glowSize);
  set('glowStrength', config.glowStrength);
  set('glowColour', DEFAULT_GLOW_COLOUR);
  $<HTMLInputElement>('glow').checked = config.glow;
  $<HTMLInputElement>('aberration').checked = config.chromaticAberration;
  distortion.checked = supported;

  readout('brightness', config.brightness);
  readout('glowSize', config.glowSize);
  readout('glowStrength', config.glowStrength);
  place();
  renderElement();
});

readout('brightness', getConfig().brightness);
readout('glowSize', getConfig().glowSize);
readout('glowStrength', getConfig().glowStrength);
renderElement();

// --- Copy buttons ---------------------------------------------------------

function wireCopy(button: HTMLElement, text: () => string) {
  let reset: number | undefined;

  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text());
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Press Ctrl+C';
    }
    clearTimeout(reset);
    reset = window.setTimeout(() => (button.textContent = 'Copy'), 1400);
  });
}

// Puts a block in a wrapper with a Copy button in its corner. The button sits
// outside the <pre>, so it stays put when a long line scrolls. What it copies is
// the block's text, so the highlighting and colour swatches are left out.
function withCopy(pre: HTMLElement) {
  const wrapper = document.createElement('div');
  wrapper.className = 'code-block';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy';
  button.textContent = 'Copy';
  button.setAttribute('aria-label', 'Copy code');
  wireCopy(button, () => pre.querySelector('code')?.textContent ?? '');

  // Takes the block's place if it is already in the page.
  pre.parentNode?.insertBefore(wrapper, pre);
  wrapper.append(pre, button);
  return wrapper;
}

wireCopy($('copy-install'), () => $('install-cmd').textContent ?? '');
wireCopy($('copy-snippet'), () => blocks.map((block) => block.code).join('\n\n'));
// The snippets in the playground get theirs as they are built.
document.querySelectorAll<HTMLElement>('pre').forEach((pre) => {
  if (!snippet.contains(pre)) {
    withCopy(pre);
  }
});

// --- Switch example -------------------------------------------------------

// The knob is a plain white pill, and glass only while it is pressed. It stays
// glass until it has finished sliding across.
const toggle = $('toggle');
const knob = toggle.querySelector<HTMLElement>('.knob')!;
let settle: number | undefined;

function press(pressed: boolean) {
  toggle.classList.toggle('pressed', pressed);
  knob.setAttribute('data-liquid-glass-enabled', String(pressed));
}

function release() {
  clearTimeout(settle);
  settle = window.setTimeout(() => press(false), 300);
}

function hold() {
  clearTimeout(settle);
  press(true);
}

toggle.addEventListener('pointerdown', () => {
  hold();
  window.addEventListener('pointerup', release, { once: true });
  window.addEventListener('pointercancel', release, { once: true });
});
toggle.addEventListener('keydown', (event) => {
  if (event.key === ' ' || event.key === 'Enter') {
    hold();
  }
});
toggle.addEventListener('keyup', release);
toggle.addEventListener('click', () => {
  toggle.setAttribute('aria-checked', String(toggle.getAttribute('aria-checked') !== 'true'));
});

// --- Menu on narrow screens -----------------------------------------------

const menu = $('menu');
const menuToggle = document.querySelector<HTMLButtonElement>('.menu-toggle')!;
const menuIcon = menuToggle.querySelector<HTMLElement>('.material-symbols-outlined')!;
const narrow = window.matchMedia('(max-width: 760px)');

function setMenuOpen(open: boolean) {
  menu.classList.toggle('is-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  menuIcon.textContent = open ? 'close' : 'menu';
}

menuToggle.addEventListener('click', () => setMenuOpen(!menu.classList.contains('is-open')));
// Choosing something closes the menu, as does clicking away, Escape, or widening the window.
menu.addEventListener('click', (event) => {
  if ((event.target as HTMLElement).closest('a, button')) {
    setMenuOpen(false);
  }
});
document.addEventListener('click', (event) => {
  if (!(event.target as HTMLElement).closest('.topbar')) {
    setMenuOpen(false);
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setMenuOpen(false);
  }
});
narrow.addEventListener('change', () => {
  setMenuOpen(false);
  syncGlass();
});
// The panel is glass only when it is a panel; on a wide screen it is the bar's own links.
function syncGlass() {
  menu.setAttribute('data-liquid-glass-enabled', String(narrow.matches));
}
syncGlass();
setMenuOpen(false);
