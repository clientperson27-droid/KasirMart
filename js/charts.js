/* ==========================================================================
   KasirMart — charts.js
   Grafik batang & garis berbasis SVG murni (tanpa pustaka luar).
   ========================================================================== */
'use strict';
const Charts = (() => {
  function niceMax(v) {
    if (v <= 0) return 0;
    const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
  }
  function frame(W, H, pl, pr, pt, pb, max, fmt) {
    let g = '<g class="grid axis">';
    for (let i = 0; i <= 4; i++) {
      const y = pt + (H - pt - pb) * (1 - i / 4), val = max * i / 4;
      g += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}"/><text x="${pl - 8}" y="${y + 4}" text-anchor="end">${U.esc(fmt(val))}</text>`;
    }
    return g + '</g>';
  }
  function empty(W, H, msg) {
    return `<text class="empty-txt" x="${W / 2}" y="${H / 2}" text-anchor="middle">${U.esc(msg)}</text>`;
  }

  /** values: number[]; labels: string[]; highlight: index yang ditebalkan */
  function bar(values, o = {}) {
    const W = o.width || 640, H = o.height || 240, pl = 52, pr = 12, pt = 14, pb = 30;
    const fmt = o.fmt || U.rpShort, n = values.length, max = niceMax(Math.max(0, ...values));
    const iw = W - pl - pr, ih = H - pt - pb, step = iw / Math.max(1, n), bw = Math.max(2, step * 0.68);
    let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${U.esc(o.title || 'Grafik batang')}">`;
    svg += frame(W, H, pl, pr, pt, pb, max || 1, max ? fmt : () => '0');
    if (!max) return svg + empty(W, H - 10, o.emptyText || 'Belum ada penjualan pada periode ini') + '</svg>';
    const every = Math.ceil(n / 16);
    values.forEach((v, i) => {
      const h = v / max * ih, x = pl + i * step + (step - bw) / 2, y = pt + ih - h;
      const tip = (o.tip ? o.tip(i, v) : `${o.labels ? o.labels[i] : i + 1}: ${U.rp(v)}`);
      svg += `<rect class="bar${i === o.highlight ? ' hl' : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, v > 0 ? 1 : 0).toFixed(1)}"><title>${U.esc(tip)}</title></rect>`;
      if (o.labels && (i % every === 0 || i === n - 1)) svg += `<g class="axis"><text x="${(pl + i * step + step / 2).toFixed(1)}" y="${H - 10}" text-anchor="middle">${U.esc(o.labels[i])}</text></g>`;
    });
    return svg + '</svg>';
  }

  /** series: [{values, cls:'line'|'line2', name}] */
  function line(series, o = {}) {
    const W = o.width || 640, H = o.height || 240, pl = 52, pr = 16, pt = 14, pb = 30;
    const fmt = o.fmt || U.rpShort, n = (series[0] || { values: [] }).values.length;
    const all = series.flatMap(s => s.values), max = niceMax(Math.max(0, ...all));
    const iw = W - pl - pr, ih = H - pt - pb, step = n > 1 ? iw / (n - 1) : iw;
    let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${U.esc(o.title || 'Grafik garis')}">`;
    svg += frame(W, H, pl, pr, pt, pb, max || 1, max ? fmt : () => '0');
    if (!max) return svg + empty(W, H - 10, o.emptyText || 'Belum ada data') + '</svg>';
    const upto = o.upto === undefined ? n - 1 : o.upto;      // titik terakhir yang digambar (bulan berjalan)
    series.forEach(s => {
      const pts = s.values.slice(0, upto + 1).map((v, i) => [pl + i * step, pt + ih - v / max * ih]);
      svg += `<polyline class="${s.cls || 'line'}" points="${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"/>`;
      if ((s.cls || 'line') === 'line') {
        pts.forEach((p, i) => {
          svg += `<circle class="pt" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === o.highlight ? 5 : 3.5}"><title>${U.esc((o.labels ? o.labels[i] : i + 1) + ': ' + U.rp(s.values[i]))}</title></circle>`;
        });
      }
    });
    if (o.labels) o.labels.forEach((l, i) => { svg += `<g class="axis"><text x="${(pl + i * step).toFixed(1)}" y="${H - 10}" text-anchor="middle">${U.esc(l)}</text></g>`; });
    return svg + '</svg>';
  }
  return { bar, line };
})();
