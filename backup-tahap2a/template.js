      /* ================================================================
   TEMPLATE STUDIO
   ================================================================ */
      function updateTGeom() {
        tp.dh = clamp(Math.round(tp.dh), 4, 512);
        tp.dw = 2 * tp.dh;
        const hw = tp.dw / 2;
        tp.ox = tp.W / 2 + ((tp.rows - tp.cols) * hw) / 2;
        tp.oy = (tp.H - ((tp.cols + tp.rows) * tp.dh) / 2) / 2;
      }
      function autoDiamond() {
        const pad = 48;
        tp.dh = Math.max(
          4,
          Math.floor(
            Math.min(tp.H - 2 * pad, (tp.W - 2 * pad) / 2) /
              (tp.cols + tp.rows),
          ),
        );
        updateTGeom();
      }
      function pruneTMap() {
        for (const k of [...tp.map.keys()]) {
          const i = k.indexOf(","),
            c = +k.slice(0, i),
            r = +k.slice(i + 1);
          if (c >= tp.cols || r >= tp.rows || c < 0 || r < 0) tp.map.delete(k);
        }
      }
      function applyTLayout(kind) {
        tp.map.clear();
        if (kind === "garden") {
          for (let r = 0; r < tp.rows; r++)
            for (let c = 0; c < tp.cols; c++) {
              let m = "grass";
              if (c >= tp.cols - 2) m = "water";
              if (r >= 1 && r <= 2 && c >= 1 && c <= 3) m = "soil";
              if (r === tp.rows - 2 && c < tp.cols - 2) m = "path";
              tp.map.set(c + "," + r, m);
            }
        } else if (kind === "grass") {
          for (let r = 0; r < tp.rows; r++)
            for (let c = 0; c < tp.cols; c++) tp.map.set(c + "," + r, "grass");
        }
        renderTemplate();
        updateTInfo();
      }
      function connectedT() {
        const seen = new Set(),
          out = [];
        for (let r = 0; r < tp.rows; r++)
          for (let c = 0; c < tp.cols; c++) {
            const k = c + "," + r,
              m = tp.map.get(k);
            if (!m || seen.has(k)) continue;
            const cells = [],
              q = [[c, r]];
            seen.add(k);
            while (q.length) {
              const [cc, rr] = q.pop();
              cells.push({ c: cc, r: rr });
              for (const [dc, dr] of [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
              ]) {
                const nk = cc + dc + "," + (rr + dr);
                if (!seen.has(nk) && tp.map.get(nk) === m) {
                  seen.add(nk);
                  q.push([cc + dc, rr + dr]);
                }
              }
            }
            let sx = 0,
              sy = 0;
            for (const cell of cells) {
              const t = cellTopT(cell.c, cell.r);
              sx += t.x;
              sy += t.y + tp.dh / 2;
            }
            out.push({
              mat: m,
              cells,
              cx: sx / cells.length,
              cy: sy / cells.length,
            });
          }
        return out;
      }
      function borderEdgesT() {
        const out = [];
        for (let r = 0; r < tp.rows; r++)
          for (let c = 0; c < tp.cols; c++) {
            const m = tp.map.get(c + "," + r);
            if (!m) continue;
            for (const e of tEdges(c, r)) {
              const [nc, nr] = e.n;
              if (nc < 0 || nc >= tp.cols || nr < 0 || nr >= tp.rows) continue;
              const nm = tp.map.get(nc + "," + nr);
              if (nm && nm !== m) out.push(e);
            }
          }
        return out;
      }
      function fitTemplate() {
        const r = cvTmpl.getBoundingClientRect();
        if (r.width < 10) return;
        tpv.scale = clamp(
          Math.min((r.width - 40) / tp.W, (r.height - 40) / tp.H),
          0.02,
          8,
        );
        tpv.x = (r.width - tp.W * tpv.scale) / 2;
        tpv.y = (r.height - tp.H * tpv.scale) / 2;
        tp.moved = false;
      }
      function tGridPath(c2d) {
        c2d.beginPath();
        for (let c = 0; c <= tp.cols; c++) {
          const a = cellTopT(c, 0),
            b = cellTopT(c, tp.rows);
          c2d.moveTo(a.x, a.y);
          c2d.lineTo(b.x, b.y);
        }
        for (let r = 0; r <= tp.rows; r++) {
          const a = cellTopT(0, r),
            b = cellTopT(tp.cols, r);
          c2d.moveTo(a.x, a.y);
          c2d.lineTo(b.x, b.y);
        }
      }
      function renderTemplate() {
        if (S.mode !== "template") return;
        const { w, h } = fitCanvas(cvTmpl),
          d = DPR();
        tctx.setTransform(d, 0, 0, d, 0, 0);
        tctx.fillStyle = "#0d0e11";
        tctx.fillRect(0, 0, w, h);
        tctx.setTransform(
          d * tpv.scale,
          0,
          0,
          d * tpv.scale,
          d * tpv.x,
          d * tpv.y,
        );
        tctx.fillStyle = "#101214";
        tctx.fillRect(0, 0, tp.W, tp.H);
        tctx.strokeStyle = "rgba(255,255,255,.25)";
        tctx.lineWidth = 1 / tpv.scale;
        tctx.strokeRect(0, 0, tp.W, tp.H);
        for (let r = 0; r < tp.rows; r++)
          for (let c = 0; c < tp.cols; c++) {
            const m = tp.map.get(c + "," + r);
            tctx.beginPath();
            cellPathT(tctx, c, r);
            tctx.fillStyle = m ? MATS[m].color : "#23262a";
            tctx.fill();
          }
        tGridPath(tctx);
        tctx.strokeStyle = "rgba(255,255,255,.5)";
        tctx.lineWidth = 1.2 / tpv.scale;
        tctx.stroke();
        if (tp.borders) {
          const be = borderEdgesT();
          if (be.length) {
            tctx.beginPath();
            for (const e of be) {
              tctx.moveTo(e.p1.x, e.p1.y);
              tctx.lineTo(e.p2.x, e.p2.y);
            }
            tctx.strokeStyle = "#ffffff";
            tctx.lineWidth = 3 / tpv.scale;
            tctx.stroke();
          }
        }
        if (tp.labels) drawTLabels(tctx);
        if (tp.hover) {
          tctx.beginPath();
          cellPathT(tctx, tp.hover.c, tp.hover.r);
          tctx.fillStyle = "rgba(240,179,74,.22)";
          tctx.fill();
          tctx.strokeStyle = "#efb34a";
          tctx.lineWidth = 1.5 / tpv.scale;
          tctx.stroke();
        }
        tctx.setTransform(d, 0, 0, d, 0, 0);
        if (tp.mouse && tp.hover) {
          const m = tp.map.get(tp.hover.c + "," + tp.hover.r);
          hud(
            tctx,
            tp.mouse.x,
            tp.mouse.y,
            `CELL ${tp.hover.c},${tp.hover.r}${m ? " · " + MATS[m].label : ""}`,
          );
        }
      }
      function drawTLabels(c) {
        const zones = connectedT();
        if (!zones.length) return;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.lineJoin = "round";
        for (const z of zones) {
          const size = clamp(
            tp.dh * 0.18 * Math.sqrt(z.cells.length),
            9,
            tp.dh * 0.45,
          );
          c.font = `bold ${size}px Arial, sans-serif`;
          const cx = clamp(z.cx, 40, tp.W - 40),
            cy = clamp(z.cy, size, tp.H - size);
          c.strokeStyle = "rgba(0,0,0,.85)";
          c.lineWidth = size * 0.16;
          c.strokeText(MATS[z.mat].label, cx, cy);
          c.fillStyle = "#ffffff";
          c.fillText(MATS[z.mat].label, cx, cy);
        }
      }

      /* ---------- export template ---------- */
      function buildTemplateImage(kind) {
        const cv = makeCanvas(tp.W, tp.H),
          c = cv.getContext("2d");
        c.fillStyle = kind === "lines" ? "#060607" : "#101214";
        c.fillRect(0, 0, tp.W, tp.H);
        if (kind === "zones") {
          for (let r = 0; r < tp.rows; r++)
            for (let col = 0; col < tp.cols; col++) {
              const m = tp.map.get(col + "," + r);
              c.beginPath();
              cellPathT(c, col, r);
              c.fillStyle = m ? MATS[m].color : "#262a2e";
              c.fill();
            }
        }
        tGridPath(c);
        c.strokeStyle = kind === "lines" ? "#ffffff" : "rgba(255,255,255,.65)";
        c.lineWidth = kind === "lines" ? 2 : 1.5;
        c.stroke();
        if (tp.borders) {
          const be = borderEdgesT();
          if (be.length) {
            c.beginPath();
            for (const e of be) {
              c.moveTo(e.p1.x, e.p1.y);
              c.lineTo(e.p2.x, e.p2.y);
            }
            c.strokeStyle = "#ffffff";
            c.lineWidth = kind === "lines" ? 4 : 3;
            c.stroke();
          }
        }
        if (kind === "zones" && tp.labels) drawTLabels(c);
        return cv;
      }
      function buildManifest() {
        const byMat = {};
        for (const [k, m] of tp.map) {
          const i = k.indexOf(",");
          (byMat[m] ||= []).push([+k.slice(0, i), +k.slice(i + 1)]);
        }
        return {
          generator: "TILTH — isometric template",
          canvas: { width: tp.W, height: tp.H },
          grid: {
            diamond_w: tp.dw,
            diamond_h: tp.dh,
            origin_x: +tp.ox.toFixed(1),
            origin_y: +tp.oy.toFixed(1),
            cols: tp.cols,
            rows: tp.rows,
          },
          zones: byMat,
          note: "Import file ini di TILTH mode Source (Import manifest) sebelum cropping hasil AI.",
        };
      }
      function buildTemplatePrompt(kind) {
        const zones = connectedT();
        const used = [...new Set(zones.map((z) => z.mat))];
        const L = [];
        L.push(
          `Use the attached image as an EXACT structural template for a top-down isometric game ground asset. The image shows an isometric diamond grid (${tp.dw}x${tp.dh} px diamonds, ${tp.cols}x${tp.rows} cells). Every straight line is a structural edge: keep every line EXACTLY where it is — do not move, rotate, rescale, or remove any line, do not merge or add cells, and keep the composition, framing and proportions of the template unchanged.`,
        );
        if (kind === "zones") {
          L.push(
            "",
            "Fill each flat color-coded zone with exactly one ground material (render the material texture, keep the zone shape):",
          );
          for (const m of used)
            L.push(`- the ${MATS[m].cname} zone -> ${MATS[m].prompt}.`);
          if (tp.map.size < tp.cols * tp.rows)
            L.push(
              "- the dark grey cells -> any single natural garden ground material of your choice that fits the scene.",
            );
        } else {
          L.push(
            "",
            "The thicker lines mark boundaries between different ground material zones. Assign materials per zone as follows:",
          );
          if (used.length)
            for (const m of used)
              L.push(`- one zone type -> ${MATS[m].prompt}.`);
          else
            L.push(
              "- render the whole diamond area as one cohesive garden ground material of your choice.",
            );
          L.push(
            "You may freely decide which zone gets which material, but never cross a thick boundary line.",
          );
        }
        L.push(
          "",
          "Render as flat 16-bit pixel art game asset, orthographic isometric 2:1 projection with zero perspective distortion, cohesive earthy palette, even ambient lighting, flat ground textures only — seamless and tileable.",
        );
        L.push(
          "Strictly no cast shadows, no vignette, no frame or border, do not reproduce any text or labels from the template, no watermark, no elevated objects, no plants with height, no characters.",
        );
        return L.join("\n");
      }
      async function exportTemplateAll() {
        const files = [
          [
            `zone_map_${tp.W}x${tp.H}.png`,
            await canvasBlob(buildTemplateImage("zones")),
          ],
          [
            `grid_lines_${tp.W}x${tp.H}.png`,
            await canvasBlob(buildTemplateImage("lines")),
          ],
          [
            "template_manifest.json",
            new Blob([JSON.stringify(buildManifest(), null, 2)], {
              type: "application/json",
            }),
          ],
          [
            "template_prompt.txt",
            new Blob([buildPromptFileText()], { type: "text/plain" }),
          ],
        ];
        for (const [name, blob] of files) {
          download(blob, name);
          await sleep(350);
        }
        toast(`Export ${files.length} file template — siap dikirim ke AI`);
      }
      function buildPromptFileText() {
        return [
          "=== PROMPT A — pakai bersama zone_map PNG (image reference / img2img) ===",
          "",
          buildTemplatePrompt("zones"),
          "",
          "=== PROMPT B — pakai bersama grid_lines PNG (ControlNet Lineart / Canny) ===",
          "",
          buildTemplatePrompt("lines"),
          "",
          "Setting TILTH setelah hasil AI diimport: diamond sesuai manifest JSON (tombol Import manifest di mode Source).",
        ].join("\n");
      }

      /* ---------- prompt preset single-material (pendekatan B) ---------- */
      function buildMaterialPrompt() {
        const custom = $("#pmCustom").value.trim();
        const m = MATS[$("#pmMat").value];
        const desc = custom || m.prompt;
        const variants = custom
          ? "berikan variasi alami yang halus antar diamond yang berdekatan"
          : m.variants;
        const style = $("#pmStyle").value;
        const STYLE = {
          pixel: "Flat 16-bit pixel art, warm earthy palette.",
          paint:
            "Soft hand-painted style with visible brushwork, earthy palette.",
          flat: "Clean flat style with solid colors and minimal shading.",
          snes: "Retro 16-bit SNES style with a limited palette.",
        }[style];
        return [
          "Create a single-material isometric ground source image for a cozy garden game.",
          "",
          "Strict orthographic isometric projection on a 2:1 diamond lattice (~256×128 px diamonds), flat ground plane only, camera looking straight down the isometric axis, zero perspective distortion. Wide landscape composition.",
          "",
          `The ENTIRE image is ONE material: ${desc}.`,
          `Provide natural variation between neighboring diamonds — ${variants} — so several diamonds can be cropped as distinct tile variants of the same material.`,
          "",
          `${STYLE} Even ambient lighting, no cast shadows, no vignette, full-bleed texture to the very edges.`,
          "",
          "Absolutely no other materials, no paths, no water, no zone borders, no elevated objects, no plants with height, no characters, no text, no UI, no watermark.",
          `This image will be diamond-cropped into ${S.out.w}×${S.out.h} isometric ground tiles — keep the texture evenly detailed across the whole surface, including the outer edges.`,
        ].join("\n");
      }

      /* ---------- edit zone + undo ---------- */
      function serializeT() {
        return JSON.stringify([...tp.map]);
      }
      function loadT(s) {
        tp.map = new Map(JSON.parse(s));
      }
      function pushTUndo() {
        tp.undo.push(serializeT());
        if (tp.undo.length > 60) tp.undo.shift();
        tp.redo.length = 0;
        updateTUndoBtns();
      }
      function doTUndo() {
        if (!tp.undo.length) return;
        tp.redo.push(serializeT());
        loadT(tp.undo.pop());
        renderTemplate();
        updateTInfo();
        updateTUndoBtns();
      }
      function doTRedo() {
        if (!tp.redo.length) return;
        tp.undo.push(serializeT());
        loadT(tp.redo.pop());
        renderTemplate();
        updateTInfo();
        updateTUndoBtns();
      }
      function updateTUndoBtns() {
        $("#tbTUndo").classList.toggle("dis", !tp.undo.length);
        $("#tbTRedo").classList.toggle("dis", !tp.redo.length);
      }
      function paintT(c, r) {
        if (c >= 0 && r >= 0 && c < tp.cols && r < tp.rows)
          tp.map.set(c + "," + r, tp.mat);
      }
      function eraseT(c, r) {
        tp.map.delete(c + "," + r);
      }
      function fillT(c, r) {
        if (c < 0 || r < 0 || c >= tp.cols || r >= tp.rows) return false;
        const target = tp.map.get(c + "," + r);
        if (target === tp.mat) return false;
        const q = [[c, r]],
          seen = new Set([c + "," + r]);
        while (q.length) {
          const [cc, rr] = q.pop();
          tp.map.set(cc + "," + rr, tp.mat);
          for (const [dc, dr] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const nk = cc + dc + "," + (rr + dr);
            if (!seen.has(nk) && tp.map.get(nk) === target) {
              seen.add(nk);
              q.push([cc + dc, rr + dr]);
            }
          }
        }
        return true;
      }
      function applyTStroke(p) {
        const cell = cellAtT(...toWorldT(p));
        if (ptrT.kind === "paint") {
          if (!ptrT.pushed) {
            pushTUndo();
            ptrT.pushed = true;
          }
          paintT(cell.c, cell.r);
        } else if (ptrT.kind === "erase") {
          if (!ptrT.pushed) {
            pushTUndo();
            ptrT.pushed = true;
          }
          eraseT(cell.c, cell.r);
        }
        renderTemplate();
        updateTInfo();
      }
      function updateTInfo() {
        $("#kvTOrigin").textContent =
          `${Math.round(tp.ox)}, ${Math.round(tp.oy)}`;
        $("#inTDH").value = tp.dh;
        $("#inTDW").value = tp.dw;
        $("#kvTZones").textContent =
          `${tp.map.size} / ${tp.cols * tp.rows} cells · ${connectedT().length} zona`;
        $$("#segTPreset button").forEach((b) =>
          b.classList.toggle(
            "on",
            +b.dataset.w === tp.W && +b.dataset.h === tp.H,
          ),
        );
      }
      function renderTPalette() {
        const el = $("#tPalette");
        el.innerHTML = "";
        for (const [id, m] of Object.entries(MATS)) {
          const b = document.createElement("button");
          b.className = "swatch" + (tp.mat === id ? " on" : "");
          b.dataset.m = id;
          b.innerHTML = `<span class="dot" style="background:${m.color}"></span>${m.dis}`;
          el.appendChild(b);
        }
      }

