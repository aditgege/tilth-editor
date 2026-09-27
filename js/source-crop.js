import { $, S, makeCanvas, tctx, toast } from './core.js';
import { cellTop, gHH, gHW } from './geo.js';
import { renderPreview, updateInspectPanels } from './inspect.js';
import { renderLibrary, setActive, updateBrushBox } from './library.js';

      /* ================================================================
   CROP PIPELINE
   crop → resize (nearest/average) → BG removal → diamond mask
   → alpha cleanup (threshold / biner). Ukuran output exact.
   ================================================================ */

      export function boxAverage(src, dctx, dw, dh) {
        const sw = src.width,
          sh = src.height;
        const sd = src.getContext("2d").getImageData(0, 0, sw, sh).data;
        const out = dctx.createImageData(dw, dh),
          d = out.data;
        const fx = sw / dw,
          fy = sh / dh;
        for (let y = 0; y < dh; y++) {
          const y0 = Math.floor(y * fy),
            y1 = Math.min(sh, Math.max(y0 + 1, Math.floor((y + 1) * fy)));
          for (let x = 0; x < dw; x++) {
            const x0 = Math.floor(x * fx),
              x1 = Math.min(sw, Math.max(x0 + 1, Math.floor((x + 1) * fx)));
            let r = 0,
              g = 0,
              b = 0,
              a = 0,
              n = 0;
            for (let yy = y0; yy < y1; yy++) {
              let i = (yy * sw + x0) * 4;
              for (let xx = x0; xx < x1; xx++) {
                r += sd[i];
                g += sd[i + 1];
                b += sd[i + 2];
                a += sd[i + 3];
                n++;
                i += 4;
              }
            }
            const j = (y * dw + x) * 4;
            d[j] = r / n;
            d[j + 1] = g / n;
            d[j + 2] = b / n;
            d[j + 3] = a / n;
          }
        }
        dctx.putImageData(out, 0, 0);
      }

      export function cropPipeline(c0, r0, wc, hc) {
        if (!S.img) return null;
        const sHW = gHW(),
          sHH = gHH();
        const A = cellTop(c0, r0);
        const bx = A.x - hc * sHW,
          by = A.y;
        const bw = (wc + hc) * sHW,
          bh = (wc + hc) * sHH;
        if (bw <= 0 || bh <= 0) return null;
        if (bx >= S.iw || by >= S.ih || bx + bw <= 0 || by + bh <= 0)
          return null;

        const P = wc + hc;
        const ow = Math.max(1, Math.round((P * S.out.w) / 2));
        const oh = Math.max(1, Math.round((P * S.out.h) / 2));

        const temp = makeCanvas(bw, bh),
          tctx = temp.getContext("2d");
        tctx.setTransform(1, 0, 0, 1, -bx, -by);
        tctx.drawImage(S.img, 0, 0);
        tctx.setTransform(1, 0, 0, 1, 0, 0);

        const out = makeCanvas(ow, oh),
          octx = out.getContext("2d");
        if (
          S.out.resample === "average" &&
          temp.width > ow &&
          temp.height > oh
        ) {
          boxAverage(temp, octx, ow, oh);
        } else {
          octx.imageSmoothingEnabled = false;
          octx.drawImage(temp, 0, 0, temp.width, temp.height, 0, 0, ow, oh);
        }

        /* BG removal — sebelum mask (hanya utk source ber-bg solid) */
        if (S.proc.bg !== "none") {
          const img = octx.getImageData(0, 0, ow, oh),
            d = img.data;
          const k = S.proc.bg === "black" ? [0, 0, 0] : [255, 255, 255];
          const t2 = 3 * S.proc.tol * S.proc.tol;
          for (let i = 0; i < d.length; i += 4) {
            const dr = d[i] - k[0],
              dg = d[i + 1] - k[1],
              db = d[i + 2] - k[2];
            if (dr * dr + dg * dg + db * db <= t2) d[i + 3] = 0;
          }
          octx.putImageData(img, 0, 0);
        }

        /* mask parallelogram di ruang output */
        const mcv = makeCanvas(ow, oh),
          mc = mcv.getContext("2d");
        mc.fillStyle = "#fff";
        mc.beginPath();
        mc.moveTo((hc / P) * ow, 0);
        mc.lineTo(ow, (wc / P) * oh);
        mc.lineTo((wc / P) * ow, oh);
        mc.lineTo(0, (hc / P) * oh);
        mc.closePath();
        mc.fill();
        const md = mc.getImageData(0, 0, ow, oh).data;
        const od = octx.getImageData(0, 0, ow, oh),
          dd = od.data;
        let any = false;
        for (let i = 3; i < md.length; i += 4) {
          if (md[i] < 128) dd[i] = 0;
          else {
            if (md[i] < 255 && dd[i] > 0) dd[i] = 255;
            if (dd[i] > 0) any = true;
          }
        }
        if (!any) return null;

        /* alpha cleanup: threshold + biner */
        if (S.proc.ath > 0 || S.proc.bin) {
          for (let i = 3; i < dd.length; i += 4) {
            if (S.proc.ath > 0 && dd[i] > 0 && dd[i] < S.proc.ath) dd[i] = 0;
            if (S.proc.bin) dd[i] = dd[i] >= 128 ? 255 : 0;
          }
        }
        octx.putImageData(od, 0, 0);
        return { canvas: out, ax: (hc / P) * ow, ay: 0 };
      }

      export function addAsset(res, wc, hc, c0, r0, name) {
        const type = wc === 1 && hc === 1 ? "tile" : "patch";
        const t = {
          uid: S.uidSeq++,
          name:
            name ||
            `${type}_${String(S.tiles.filter((x) => x.type === type).length + 1).padStart(2, "0")}`,
          type,
          wc,
          hc,
          canvas: res.canvas,
          ax: res.ax,
          ay: res.ay,
          src: {
            c0,
            r0,
            gw: S.grid.w,
            gh: S.grid.h,
            gox: S.grid.ox,
            goy: S.grid.oy,
            imgId: S.imgId,
          },
        };
        S.tiles.push(t);
        S.lastAdded = t.uid;
        return t;
      }
      export function commitCrop(c0, r0, wc, hc, name) {
        const res = cropPipeline(c0, r0, wc, hc);
        if (!res) {
          toast("Tidak ada konten gambar di area ini", "warn");
          return;
        }
        const t = addAsset(res, wc, hc, c0, r0, name);
        setActive(t.uid);
        updateInspectPanels();
        toast(
          `${t.name} ditambahkan · ${res.canvas.width}×${res.canvas.height}px`,
        );
      }

      /* re-crop tile dari snapshot grid-nya sendiri (imgId harus cocok) */
      export function recropTile(t) {
        if (!S.img || !t.src || t.src.imgId !== S.imgId) return false;
        const g = S.grid,
          sv = { w: g.w, h: g.h, ox: g.ox, oy: g.oy };
        g.w = t.src.gw;
        g.h = t.src.gh;
        g.ox = t.src.gox;
        g.oy = t.src.goy;
        const res = cropPipeline(t.src.c0, t.src.r0, t.wc, t.hc);
        g.w = sv.w;
        g.h = sv.h;
        g.ox = sv.ox;
        g.oy = sv.oy;
        if (res) {
          t.canvas = res.canvas;
          t.ax = res.ax;
          t.ay = res.ay;
          return true;
        }
        return false;
      }
      export function retileTiles() {
        if (!S.tiles.length) return;
        for (const t of S.tiles) {
          if (recropTile(t)) continue;
          const P = t.wc + t.hc,
            ow = Math.max(1, Math.round((P * S.out.w) / 2)),
            oh = Math.max(1, Math.round((P * S.out.h) / 2));
          const cv = makeCanvas(ow, oh),
            c = cv.getContext("2d");
          c.imageSmoothingEnabled = false;
          c.drawImage(
            t.canvas,
            0,
            0,
            t.canvas.width,
            t.canvas.height,
            0,
            0,
            ow,
            oh,
          );
          t.canvas = cv;
          t.ax = (t.hc / P) * ow;
          t.ay = 0;
        }
        renderLibrary();
        updateBrushBox();
        renderPreview();
        updateInspectPanels();
      }

