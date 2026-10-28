/**
 * The widget's stylesheet, inlined in its shadow root. Host pages restyle it through
 * custom properties on the element: --murmur-accent, --murmur-accent-ink, --murmur-font,
 * --murmur-radius, --murmur-z.
 */
export const STYLES = /* css */ `
:host {
  --accent: var(--murmur-accent, #211c17);
  --accent-ink: var(--murmur-accent-ink, #f6efe0);
  --lamp: var(--murmur-lamp, #e0a032);
  --surface: #fbf8f1;
  --raised: #f2ece0;
  --ink: #211c17;
  --muted: #675c4f;
  --line: #e2d8c5;
  --focus: #b4541d;
  --danger: #a1301f;
  --radius: var(--murmur-radius, 16px);
  --shadow: 0 18px 48px -12px rgb(33 28 23 / 0.28), 0 4px 12px -4px rgb(33 28 23 / 0.16);
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
  all: initial;
  position: fixed;
  z-index: var(--murmur-z, 2147483000);
  inset: auto 20px 20px auto;
  font-family: var(--murmur-font, inherit);
  font-size: 15px;
  line-height: 1.5;
  color: var(--ink);
  color-scheme: light;
  -webkit-font-smoothing: antialiased;
}
:host([position="bottom-left"]) { inset: auto auto 20px 20px; }
:host([inline]) { position: relative; inset: auto; z-index: auto; display: block; height: 100%; }
:host([theme="dark"]) { --surface: #1c1814; --raised: #26211b; --ink: #f2ead9; --muted: #b8ab95; --line: #3b342b; --focus: #f0a35c; --danger: #f08a73; color-scheme: dark; }
@media (prefers-color-scheme: dark) {
  :host(:not([theme="light"])) { --surface: #1c1814; --raised: #26211b; --ink: #f2ead9; --muted: #b8ab95; --line: #3b342b; --focus: #f0a35c; --danger: #f08a73; color-scheme: dark; }
  :host(:not([theme="light"])) { --murmur-accent-default: #f2ead9; }
}
@media print { :host { display: none !important; } }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
::selection { background: color-mix(in oklab, var(--lamp) 45%, transparent); color: inherit; }
button, input, select, textarea { font: inherit; color: inherit; }
button { cursor: pointer; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
a { color: inherit; text-underline-offset: 0.2em; text-decoration-thickness: 1px; }

/* Launcher */
.launcher {
  display: inline-flex; align-items: center; gap: 10px;
  height: 52px; padding: 0 20px 0 16px; border: 0; border-radius: 26px;
  background: var(--accent); color: var(--accent-ink);
  box-shadow: var(--shadow); font-weight: 600; letter-spacing: 0.01em;
  transition: transform 220ms var(--ease), box-shadow 220ms var(--ease);
}
.launcher:hover { transform: translateY(-2px); }
.launcher:active { transform: translateY(0); }
.launcher[aria-expanded="true"] { display: none; }
.lamp {
  width: 8px; height: 8px; border-radius: 50%; flex: none;
  background: var(--lamp); box-shadow: 0 0 0 3px color-mix(in oklab, var(--lamp) 28%, transparent);
}
.lamp.off { background: transparent; box-shadow: inset 0 0 0 1.5px var(--muted); }
.lamp.busy { animation: blink 1.1s steps(2, jump-none) infinite; }
@keyframes blink { 50% { opacity: 0.25; } }

/* Panel */
.panel {
  position: absolute; right: 0; bottom: 0;
  display: flex; flex-direction: column;
  width: min(400px, calc(100vw - 40px)); height: min(640px, calc(100dvh - 40px));
  background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow);
  overflow: hidden; transform-origin: bottom right;
  animation: rise 320ms var(--ease);
}
:host([position="bottom-left"]) .panel { right: auto; left: 0; transform-origin: bottom left; }
:host([inline]) .panel { position: static; width: 100%; height: 100%; box-shadow: none; animation: none; border-radius: inherit; }
@keyframes rise { from { opacity: 0; transform: translateY(12px) scale(0.98); } }
@media (max-width: 480px) {
  :host(:not([inline])) { inset: auto 12px 12px auto; }
  :host(:not([inline])[position="bottom-left"]) { inset: auto auto 12px 12px; }
  :host(:not([inline])) .panel { position: fixed; inset: 0; width: 100%; height: 100dvh; border-radius: 0; }
}

header {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 10px 14px 18px; background: var(--accent); color: var(--accent-ink);
}
header h2 { flex: 1; margin: 0; font-size: 16px; font-weight: 650; letter-spacing: 0.005em; line-height: 1.25; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.icon-btn {
  display: inline-grid; place-items: center; width: 36px; height: 36px; flex: none;
  border: 0; border-radius: 10px; background: transparent; color: inherit;
  transition: background 160ms;
}
.icon-btn:hover { background: color-mix(in oklab, currentColor 14%, transparent); }
header .icon-btn:focus-visible { outline-color: var(--accent-ink); }

/* Conversation */
.log {
  flex: 1; overflow-y: auto; overscroll-behavior: contain;
  padding: 18px 18px 8px; display: flex; flex-direction: column; gap: 16px;
  scrollbar-width: thin; scrollbar-color: var(--line) transparent;
}
.msg { max-width: 100%; overflow-wrap: anywhere; }
.msg p { margin: 0 0 0.6em; }
.msg p:last-child { margin-bottom: 0; }
.msg ul, .msg ol { margin: 0 0 0.6em; padding-left: 1.3em; }
.msg li + li { margin-top: 0.2em; }
.msg code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.88em; background: var(--raised); padding: 0.1em 0.35em; border-radius: 5px; }
.msg pre { margin: 0 0 0.6em; padding: 10px 12px; background: var(--raised); border-radius: 10px; overflow-x: auto; }
.msg pre code { background: none; padding: 0; }
.msg .table { margin: 0 0 0.6em; overflow-x: auto; border-radius: 10px; box-shadow: inset 0 0 0 1px var(--line); }
.msg table { width: 100%; border-collapse: collapse; font-size: 14px; }
.msg th, .msg td { padding: 6px 10px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--line); }
.msg tr:last-child td { border-bottom: 0; }
.msg th { font-weight: 650; background: var(--raised); }
.msg blockquote { margin: 0 0 0.6em; padding: 2px 0 2px 12px; color: var(--muted); box-shadow: inset 1px 0 0 var(--line); }
.msg hr { margin: 0.8em 0; border: 0; border-top: 1px solid var(--line); }
.user {
  align-self: flex-end; max-width: 85%;
  padding: 9px 14px; border-radius: 16px 16px 4px 16px;
  background: var(--accent); color: var(--accent-ink); white-space: pre-wrap;
}
.bot { align-self: stretch; }
.greeting { color: var(--muted); }

.cite {
  display: inline-grid; place-items: center; min-width: 1.45em; height: 1.45em; padding: 0 0.3em;
  margin: 0 0.1em; vertical-align: 0.12em;
  border-radius: 1em; box-shadow: inset 0 0 0 1.25px currentColor;
  font-size: 0.72em; font-weight: 700; line-height: 1; text-decoration: none;
  font-variant-numeric: tabular-nums; color: var(--muted);
  transition: background 160ms, color 160ms;
}
.cite:hover, .cite:focus-visible { background: var(--lamp); color: #211c17; box-shadow: none; }

.sources { margin: 12px 0 0; padding: 0; list-style: none; display: grid; gap: 2px; }
.sources-label { margin: 18px 0 2px; font-size: 12px; font-weight: 650; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.sources a {
  display: grid; grid-template-columns: auto 1fr; align-items: baseline; gap: 10px;
  padding: 7px 10px; margin: 0 -10px; border-radius: 10px; text-decoration: none;
}
.sources a:hover { background: var(--raised); }
.sources .cite { margin: 0; }
.sources .where { min-width: 0; font-size: 14px; line-height: 1.35; }
.sources .where span { color: var(--muted); }

.status { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 14px; }
.error { color: var(--danger); }
.error p { margin: 0 0 8px; }
.text-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 9px;
  border: 0; background: var(--raised); color: var(--ink); font-size: 14px; font-weight: 600;
}
.text-btn:hover { background: var(--line); }

/* Composer */
form.composer {
  display: flex; align-items: flex-end; gap: 8px; margin: 8px 12px 0; padding: 6px 6px 6px 14px;
  border-radius: 14px; background: var(--raised);
  box-shadow: inset 0 0 0 1px var(--line); transition: box-shadow 160ms;
}
form.composer:focus-within { box-shadow: inset 0 0 0 1.5px var(--focus); }
textarea {
  flex: 1; min-height: 38px; max-height: 140px; padding: 8px 0; resize: none;
  border: 0; background: transparent; outline: none; line-height: 1.4;
}
textarea:focus-visible { outline: none; }
textarea::placeholder, input::placeholder { color: var(--muted); opacity: 1; }
.send {
  display: inline-grid; place-items: center; width: 38px; height: 38px; flex: none;
  border: 0; border-radius: 10px; background: var(--accent); color: var(--accent-ink);
  transition: opacity 160ms;
}
.send:disabled { opacity: 0.35; cursor: default; }
footer { padding: 8px 18px 12px; font-size: 12px; color: var(--muted); text-align: center; }
footer a { text-decoration: none; }
footer a:hover { text-decoration: underline; }

/* Settings */
.setup { flex: 1; overflow-y: auto; padding: 18px; display: grid; gap: 16px; align-content: start; }
.setup p.intro { margin: 0; color: var(--muted); font-size: 14px; }
.field { display: grid; gap: 6px; }
.field > span { font-size: 13px; font-weight: 650; }
.field small { color: var(--muted); font-size: 12.5px; }
.field input:not([type="checkbox"]), .field select {
  width: 100%; height: 40px; padding: 0 12px; border-radius: 10px;
  border: 0; background: var(--raised); box-shadow: inset 0 0 0 1px var(--line);
}
.field input:focus-visible, .field select:focus-visible { outline: none; box-shadow: inset 0 0 0 1.5px var(--focus); }
.check { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.check input { width: 18px; height: 18px; accent-color: var(--accent); margin: 0; }
.presets { display: flex; gap: 8px; flex-wrap: wrap; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.primary {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 42px; padding: 0 18px; border: 0; border-radius: 11px;
  background: var(--accent); color: var(--accent-ink); font-weight: 650;
}
.primary:disabled { opacity: 0.4; cursor: default; }
.result { font-size: 14px; }
.result.ok { color: inherit; }
.result.ok::before { content: ""; display: inline-block; width: 8px; height: 8px; margin-right: 8px; border-radius: 50%; background: var(--lamp); }
.result.fail { color: var(--danger); }
.local-choice { display: grid; gap: 6px; padding: 14px; border-radius: 12px; background: var(--raised); }
.local-choice small { color: var(--muted); font-size: 12.5px; }
.local-choice .link-btn { margin-top: 2px; }
p.or { margin: 0; color: var(--muted); font-size: 13px; text-align: center; }
.consent { display: grid; gap: 10px; padding: 14px; border-radius: 12px; background: var(--raised); }
.consent p { margin: 0; }
.status .grow { display: grid; gap: 6px; flex: 1; }
progress { width: 100%; height: 6px; appearance: none; border: 0; border-radius: 3px; background: var(--line); overflow: hidden; }
progress::-webkit-progress-bar { background: var(--line); }
progress::-webkit-progress-value { background: var(--lamp); }
progress::-moz-progress-bar { background: var(--lamp); }
.link-btn { padding: 0; border: 0; background: none; color: var(--muted); font-size: 13px; text-decoration: underline; text-underline-offset: 0.2em; justify-self: start; }

.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

@media (prefers-reduced-motion: reduce) {
  *, .panel { animation: none !important; transition: none !important; }
}
`;
