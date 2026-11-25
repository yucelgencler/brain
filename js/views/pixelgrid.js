'use strict';
/* ------------------------------------------------------------------
   Ortak: 5×7 çizilebilir göz (seviye 14 ve sonrası için).
   pixelGridHTML(id) iskeleti verir; wirePixelGrid(id, get, set) dokunma,
   sürükleme ve klavye (Enter/Boşluk) ile çizmeyi bağlar.
   Görünüm css/views/shapes.css içindeki .sh-grid / .sh-cell.
------------------------------------------------------------------- */
function pixelGridHTML(id) {
  let cells = '';
  for (let i = 0; i < 35; i++)
    cells += `<button class="sh-cell" data-i="${i}" aria-label="Piksel ${Math.floor(i / 5) + 1}. satır ${(i % 5) + 1}. sütun" aria-pressed="false"></button>`;
  return `<div class="sh-grid" id="${id}">${cells}</div>`;
}
let pgPaint = null,
  pgUpOn = false;
function wirePixelGrid(id, getBits, setBit) {
  const grid = document.getElementById(id);
  const paintAt = el => {
    if (!el || !el.classList.contains('sh-cell') || !grid.contains(el) || pgPaint === null) return;
    const i = +el.dataset.i;
    if (getBits()[i] !== pgPaint) setBit(i, pgPaint);
  };
  grid.addEventListener('pointerdown', e => {
    const el = e.target.closest('.sh-cell');
    if (!el) return;
    e.preventDefault();
    pgPaint = 1 - getBits()[+el.dataset.i];
    paintAt(el);
  });
  grid.addEventListener('pointermove', e => {
    if (pgPaint !== null) paintAt(document.elementFromPoint(e.clientX, e.clientY));
  });
  if (!pgUpOn) {
    pgUpOn = true;
    window.addEventListener('pointerup', () => (pgPaint = null));
  }
  grid.addEventListener('keydown', e => {
    const el = e.target.closest('.sh-cell');
    if (!el || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    const i = +el.dataset.i;
    setBit(i, 1 - getBits()[i]);
  });
}
function paintPixelGrid(id, bits) {
  const cells = document.getElementById(id).children;
  for (let i = 0; i < 35; i++) {
    cells[i].classList.toggle('on', !!bits[i]);
    cells[i].setAttribute('aria-pressed', bits[i] ? 'true' : 'false');
  }
}
