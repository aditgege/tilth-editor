      /* ================================================================
   RENDER — SOURCE
   ================================================================ */
      function renderSource() {
        const { w, h } = fitCanvas(cvSrc),
          d = DPR();
        sctx.setTransform(d, 0, 0, d, 0, 0);
        sctx.fillStyle = "#0d0e11";
        sctx.fillRect(0, 0, w, h);
        if (!S.img) return;

        sctx.save();
        sctx.translate(view.x, view.y);
        sctx.fillStyle = getChecker(sctx);
        sctx.fillRect(0, 0, S.iw * view.scale, S.ih * view.scale);
        sctx.restore();

        sctx.setTransform(
          d * view.scale,
          0,
          0,
          d * view.scale,
          d * view.x,
          d * view.y,
        );
        sctx.imageSmoothingEnabled = view.scale < 1;
        sctx.imageSmoothingQuality = "high";
        sctx.drawImage(S.img, 0, 0);
        sctx.strokeStyle = "rgba(255,255,255,.18)";
        sctx.lineWidth = 1 / view.scale;
        sctx.strokeRect(0, 0, S.iw, S.ih);

        if (S.grid.show) drawGridS();
        drawHighlightS();
        drawCalibS();
        drawOriginS();

        sctx.setTransform(d, 0, 0, d, 0, 0);
        if (S.mouse) {
          let line = null;
          if (S.tool === "calib") {
            const n = S.calib.pts.length;
            line =
              n >= 4
                ? "CALIB — applying…"
                : `CALIB ${n}/4 — klik vertex ${["ATAS", "KANAN", "BAWAH", "KIRI"][n]}`;
          } else if (S.tool === "select") {
            const n = selDrag ? marqueeCells(selDrag).length : S.sel.size;
            line = `SELECT ${n} cell`;
          } else if (S.tool === "origin")
            line = `SET ORIGIN  ${Math.round(S.grid.ox)}, ${Math.round(S.grid.oy)}`;
          else if (S.tool === "tile" && S.hoverCell)
            line = `CELL ${S.hoverCell.c},${S.hoverCell.r} → ${S.out.w}×${S.out.h}`;
          else if (S.tool === "patch") {
            if (patchSel) {
              const n = normRect();
              line = `${n.wc}×${n.hc} cells → ${Math.round(((n.wc + n.hc) * S.out.w) / 2)}×${Math.round(((n.wc + n.hc) * S.out.h) / 2)}`;
            } else if (S.hoverCell)
              line = `CELL ${S.hoverCell.c},${S.hoverCell.r}`;
          }
          if (line) hud(sctx, S.mouse.x, S.mouse.y, line);
        }
      }

      function cellPathS(ctx, c, r) {
        const t = cellTop(c, r),
          hw = gHW(),
          hh = gHH();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.x + hw, t.y + hh);
        ctx.lineTo(t.x, t.y + S.grid.h);
        ctx.lineTo(t.x - hw, t.y + hh);
        ctx.closePath();
      }
      function drawGridS() {
        let cMin = 1e9,
          cMax = -1e9,
          rMin = 1e9,
          rMax = -1e9;
        for (const [x, y] of [
          [0, 0],
          [S.iw, 0],
          [0, S.ih],
          [S.iw, S.ih],
        ]) {
          const { c, r } = cellAt(x, y);
          cMin = Math.min(cMin, c);
          cMax = Math.max(cMax, c);
          rMin = Math.min(rMin, r);
          rMax = Math.max(rMax, r);
        }
        cMin--;
        cMax++;
        rMin--;
        rMax++;
        if (cMax - cMin + rMax - rMin > 8000) return;
        sctx.beginPath();
        for (let c = cMin; c <= cMax + 1; c++) {
          const p0 = cellTop(c, rMin),
            p1 = cellTop(c, rMax + 1);
          sctx.moveTo(p0.x, p0.y);
          sctx.lineTo(p1.x, p1.y);
        }
        for (let r = rMin; r <= rMax + 1; r++) {
          const p0 = cellTop(cMin, r),
            p1 = cellTop(cMax + 1, r);
          sctx.moveTo(p0.x, p0.y);
          sctx.lineTo(p1.x, p1.y);
        }
        sctx.strokeStyle = "rgba(255,255,255,.22)";
        sctx.lineWidth = 1 / view.scale;
        sctx.stroke();
      }
      function patchPathS(ctx, cA, rA, wc, hc) {
        const A = cellTop(cA, rA),
          hw = gHW(),
          hh = gHH();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(A.x + wc * hw, A.y + wc * hh);
        ctx.lineTo(A.x + (wc - hc) * hw, A.y + (wc + hc) * hh);
        ctx.lineTo(A.x - hc * hw, A.y + hc * hh);
        ctx.closePath();
      }
      function drawCellsFill(keys, fill, stroke, lw) {
        sctx.beginPath();
        for (const k of keys) {
          const i = k.indexOf(",");
          cellPathS(sctx, +k.slice(0, i), +k.slice(i + 1));
        }
        if (fill) {
          sctx.fillStyle = fill;
          sctx.fill();
        }
        if (stroke) {
          sctx.strokeStyle = stroke;
          sctx.lineWidth = lw;
          sctx.stroke();
        }
      }
      function drawHighlightS() {
        const lw = 1.5 / view.scale;

        /* multi-select persisten */
        if (S.sel.size)
          drawCellsFill(
            S.sel,
            "rgba(168,202,108,.18)",
            "#a8ca6c",
            1.2 / view.scale,
          );

        /* marquee aktif */
        if (selDrag) {
          const cells = marqueeCells(selDrag);
          if (cells.length)
            drawCellsFill(cells, "rgba(168,202,108,.14)", null, 0);
          const x0 = Math.min(selDrag.x0, selDrag.x1),
            y0 = Math.min(selDrag.y0, selDrag.y1);
          const x1 = Math.max(selDrag.x0, selDrag.x1),
            y1 = Math.max(selDrag.y0, selDrag.y1);
          sctx.setLineDash([6 / view.scale, 4 / view.scale]);
          sctx.strokeStyle = "#a8ca6c";
          sctx.lineWidth = 1 / view.scale;
          sctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
          sctx.setLineDash([]);
        }

        if (S.tool === "select" && S.hoverCell) {
          sctx.beginPath();
          cellPathS(sctx, S.hoverCell.c, S.hoverCell.r);
          sctx.strokeStyle = "rgba(255,255,255,.55)";
          sctx.lineWidth = 1 / view.scale;
          sctx.stroke();
        } else if (S.tool === "tile" && S.hoverCell) {
          sctx.beginPath();
          cellPathS(sctx, S.hoverCell.c, S.hoverCell.r);
          sctx.fillStyle = "rgba(240,179,74,.16)";
          sctx.fill();
          sctx.strokeStyle = "#efb34a";
          sctx.lineWidth = lw;
          sctx.stroke();
        } else if (S.tool === "patch") {
          if (patchSel) {
            const n = normRect();
            sctx.beginPath();
            patchPathS(sctx, n.cA, n.rA, n.wc, n.hc);
            sctx.fillStyle = "rgba(240,179,74,.16)";
            sctx.fill();
            sctx.strokeStyle = "#efb34a";
            sctx.lineWidth = lw;
            sctx.stroke();
          } else if (S.hoverCell) {
            sctx.beginPath();
            cellPathS(sctx, S.hoverCell.c, S.hoverCell.r);
            sctx.fillStyle = "rgba(240,179,74,.10)";
            sctx.fill();
          }
        }
      }
      function drawCalibS() {
        const pts = S.calib.pts;
        if (!pts.length) return;
        const s = 1 / view.scale;
        if (pts.length > 1) {
          sctx.setLineDash([6 * s, 4 * s]);
          sctx.strokeStyle = "#7fd1d8";
          sctx.lineWidth = 1.5 * s;
          sctx.beginPath();
          pts.forEach((p, i) =>
            i ? sctx.lineTo(p.x, p.y) : sctx.moveTo(p.x, p.y),
          );
          if (pts.length === 4) sctx.closePath();
          sctx.stroke();
          sctx.setLineDash([]);
        }
        const lbl = ["T", "R", "B", "L"];
        pts.forEach((p, i) => {
          sctx.beginPath();
          sctx.arc(p.x, p.y, 6 * s, 0, Math.PI * 2);
          sctx.fillStyle = "#7fd1d8";
          sctx.fill();
          sctx.fillStyle = "#0d0e11";
          sctx.font = `bold ${9 * s}px monospace`;
          sctx.textAlign = "center";
          sctx.textBaseline = "middle";
          sctx.fillText(lbl[i], p.x, p.y + 0.5);
          sctx.textAlign = "left";
          sctx.textBaseline = "alphabetic";
        });
      }
      function drawOriginS() {
        const { ox, oy } = S.grid,
          s = 1 / view.scale,
          L = 7 * s;
        sctx.lineWidth = 3 * s;
        sctx.strokeStyle = "rgba(10,12,14,.9)";
        sctx.beginPath();
        sctx.moveTo(ox - L, oy);
        sctx.lineTo(ox + L, oy);
        sctx.moveTo(ox, oy - L);
        sctx.lineTo(ox, oy + L);
        sctx.stroke();
        sctx.lineWidth = 1 * s;
        sctx.strokeStyle = "#7fd1d8";
        sctx.beginPath();
        sctx.moveTo(ox - L, oy);
        sctx.lineTo(ox + L, oy);
        sctx.moveTo(ox, oy - L);
        sctx.lineTo(ox, oy + L);
        sctx.stroke();
      }

      /* ================================================================
   SELECTION (multi-diamond) & CALIBRATION
   ================================================================ */
      function marqueeCells(m) {
        const x0 = Math.min(m.x0, m.x1),
          x1 = Math.max(m.x0, m.x1);
        const y0 = Math.min(m.y0, m.y1),
          y1 = Math.max(m.y0, m.y1);
        let cMin = 1e9,
          cMax = -1e9,
          rMin = 1e9,
          rMax = -1e9;
        for (const [px, py] of [
          [x0, y0],
          [x1, y0],
          [x0, y1],
          [x1, y1],
        ]) {
          const cc = cellAt(px, py);
          cMin = Math.min(cMin, cc.c);
          cMax = Math.max(cMax, cc.c);
          rMin = Math.min(rMin, cc.r);
          rMax = Math.max(rMax, cc.r);
        }
        if ((cMax - cMin + 1) * (rMax - rMin + 1) > 4000) return [];
        const out = [];
        for (let r = rMin; r <= rMax; r++)
          for (let c = cMin; c <= cMax; c++) {
            const t = cellTop(c, r),
              cx = t.x,
              cy = t.y + S.grid.h / 2;
            if (
              cx >= x0 &&
              cx <= x1 &&
              cy >= y0 &&
              cy <= y1 &&
              cx >= 0 &&
              cx <= S.iw &&
              cy >= 0 &&
              cy <= S.ih
            )
              out.push(c + "," + r);
          }
        return out;
      }
      function toggleSelCell(c, r) {
        const k = c + "," + r;
        S.sel.has(k) ? S.sel.delete(k) : S.sel.add(k);
        updateSelUI();
      }
      function updateSelUI() {
        $("#kvSel").textContent = `${S.sel.size} cell`;
        const b = $("#btnCropSel");
        b.innerHTML = `<i data-lucide="check-check"></i>Crop ${S.sel.size} → library`;
        b.classList.toggle("dis", !S.sel.size);
        refreshIcons();
      }
      function cropSelection() {
        if (!S.sel.size) {
          toast("Belum ada cell terpilih", "warn");
          return;
        }
        const prefix = ($("#selPrefix").value.trim() || "tile").replace(
          /\s+/g,
          "_",
        );
        const cells = [...S.sel]
          .map((k) => {
            const i = k.indexOf(",");
            return { c: +k.slice(0, i), r: +k.slice(i + 1) };
          })
          .sort((a, b) => a.c + a.r - (b.c + b.r) || a.c - b.c);
        let made = 0,
          skipped = 0,
          last = null;
        for (const cell of cells) {
          const res = cropPipeline(cell.c, cell.r, 1, 1);
          if (!res) {
            skipped++;
            continue;
          }
          last = addAsset(
            res,
            1,
            1,
            cell.c,
            cell.r,
            `${prefix}_${String(++made).padStart(2, "0")}`,
          );
        }
        S.sel.clear();
        updateSelUI();
        renderSource();
        updateLive();
        if (last) setActive(last.uid);
        updateInspectPanels();
        toast(
          `${made} tile dibuat${skipped ? `, ${skipped} dilewati (kosong)` : ""}${skipped ? "" : " → library"}`,
        );
      }
      function applyCalibration() {
        const [T, R, B, L] = S.calib.pts;
        const cx = ((T.x + B.x) / 2 + (R.x + L.x) / 2) / 2;
        const cy = ((T.y + B.y) / 2 + (R.y + L.y) / 2) / 2;
        const hw = (R.x - L.x) / 2,
          hh = (B.y - T.y) / 2;
        if (!isFinite(hw) || !isFinite(hh) || hw < 2 || hh < 1) {
          toast("Kalibrasi tidak valid — coba lagi", "warn");
          S.calib.pts = [];
          renderSource();
          return;
        }
        const skew =
          (Math.abs(T.x - cx) +
            Math.abs(B.x - cx) +
            Math.abs(L.y - cy) +
            Math.abs(R.y - cy)) /
          (R.x - L.x + (B.y - T.y));
        S.grid.w = Math.round(hw * 2);
        S.grid.h = Math.round(hh * 2);
        S.grid.ox = Math.round(cx);
        S.grid.oy = Math.round(cy - hh);
        S.calib.pts = [];
        S.sel.clear();
        patchSel = null;
        syncInputs();
        renderSource();
        updateLive();
        updateStatus();
        updateSelUI();
        updateInspectPanels();
        toast(
          `Kalibrasi: diamond ${S.grid.w}×${S.grid.h} · ratio ${(S.grid.w / S.grid.h).toFixed(2)}:1`,
        );
        if (skew > 0.03)
          toast(
            "Diamond sedikit miring/skew — grid TILTH axis-aligned, periksa hasil crop di live preview",
            "warn",
          );
      }

      /* ================================================================
   CROP PIPELINE
   crop → resize (nearest/average) → BG removal → diamond mask
   → alpha cleanup (threshold / biner). Ukuran output exact.
   ================================================================ */
      function boxAverage(src, dctx, dw, dh) {
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

      function cropPipeline(c0, r0, wc, hc) {
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

      function addAsset(res, wc, hc, c0, r0, name) {
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
      function commitCrop(c0, r0, wc, hc, name) {
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
      function recropTile(t) {
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
      function retileTiles() {
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

      /* ================================================================
   LIVE CROP PREVIEW
   ================================================================ */
      function updateLive() {
        lctx.setTransform(1, 0, 0, 1, 0, 0);
        drawCheckerTo(lctx, 0, 0, 520, 260, 10);
        let res = null,
          label = "—";
        if (S.img && S.tool === "tile" && S.hoverCell) {
          res = cropPipeline(S.hoverCell.c, S.hoverCell.r, 1, 1);
          if (res) label = `cell ${S.hoverCell.c},${S.hoverCell.r}`;
        } else if (S.img && S.tool === "patch") {
          let c0,
            r0,
            wc = 1,
            hc = 1;
          if (patchSel) {
            const n = normRect();
            c0 = n.cA;
            r0 = n.rA;
            wc = n.wc;
            hc = n.hc;
          } else if (S.hoverCell) {
            c0 = S.hoverCell.c;
            r0 = S.hoverCell.r;
          }
          if (c0 !== undefined) {
            res = cropPipeline(c0, r0, wc, hc);
            if (res)
              label =
                wc === 1 && hc === 1
                  ? `cell ${c0},${r0}`
                  : `${wc}×${hc} → ${res.canvas.width}×${res.canvas.height}`;
          }
        }
        if (res) {
          const s = Math.min(
            (520 - 30) / res.canvas.width,
            (260 - 30) / res.canvas.height,
            4,
          );
          const ss = s >= 1 ? Math.max(1, Math.floor(s)) : s;
          const dw = res.canvas.width * ss,
            dh = res.canvas.height * ss;
          lctx.imageSmoothingEnabled = ss < 1;
          lctx.imageSmoothingQuality = "high";
          lctx.drawImage(res.canvas, (520 - dw) / 2, (260 - dh) / 2, dw, dh);
        }
        $("#lpCell").textContent = label;
      }

