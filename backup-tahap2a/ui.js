      /* ================================================================
   TOOLS, MODE, HINTS, STATUS
   ================================================================ */
      const HINTS = {
        hand: "Drag untuk pan · scroll untuk zoom · 0 = fit · G = grid",
        calib:
          "Klik 4 vertex SATU diamond: atas → kanan → bawah → kiri · Esc = batal",
        select:
          "Klik = toggle cell · drag = marquee · Enter = crop selection · Esc = clear",
        tile: "Klik diamond untuk crop tile → langsung masuk library",
        patch:
          "Drag dari satu diamond ke diamond lain untuk mengambil patch besar · Esc = batal",
        origin: "Klik pada gambar untuk memindahkan origin grid",
        tpaint:
          "Klik / drag cell untuk mengisi material aktif · klik kanan = kosongkan",
        terase: "Klik / drag cell untuk mengosongkan zona",
        tfill:
          "Klik satu zona untuk mengganti seluruh zona menjadi material aktif",
        brush:
          "Klik / drag untuk melukis · klik kanan = hapus · tahan Spasi untuk pan",
        erase: "Klik / drag untuk menghapus tile dari preview",
      };
      function setHint() {
        const map = {
          source: HINTS[S.tool],
          template: HINTS["t" + tp.tool],
          inspect: HINTS[pv.tool],
        };
        stHint.textContent = map[S.mode];
      }
      function updateStatus() {
        if (S.mode === "template") {
          stImg.textContent = `${tp.W}×${tp.H}`;
          const wd = tp.mouse ? toWorldT(tp.mouse) : null;
          stCur.textContent = wd
            ? `${Math.round(wd[0])}, ${Math.round(wd[1])}`
            : "—";
          stCell.textContent = tp.hover ? `${tp.hover.c},${tp.hover.r}` : "—";
          stZoom.textContent = Math.round(tpv.scale * 100) + "%";
          stGrid.textContent = `${tp.dw}×${tp.dh}`;
          return;
        }
        stImg.textContent = S.img ? `${S.iw}×${S.ih}` : "—";
        if (S.mode === "source") {
          const wd = S.mouse ? toWorld(S.mouse) : null;
          stCur.textContent = wd
            ? `${Math.round(wd[0])}, ${Math.round(wd[1])}`
            : "—";
          stCell.textContent = S.hoverCell
            ? `${S.hoverCell.c},${S.hoverCell.r}`
            : "—";
          stZoom.textContent = Math.round(view.scale * 100) + "%";
          stGrid.textContent = `${S.grid.w}×${S.grid.h}`;
        } else {
          const wd = pv.mouse ? toWorldP(pv.mouse) : null;
          stCur.textContent = wd
            ? `${Math.round(wd[0])}, ${Math.round(wd[1])}`
            : "—";
          stCell.textContent = pv.hover ? `${pv.hover.c},${pv.hover.r}` : "—";
          stZoom.textContent = Math.round(pv.scale * 100) + "%";
          stGrid.textContent = `out ${S.out.w}×${S.out.h}`;
        }
      }
      function setTool(t) {
        S.tool = t;
        patchSel = null;
        S.hoverCell = null;
        $$("#toolbar [data-tool]").forEach((b) =>
          b.classList.toggle("on", b.dataset.tool === t),
        );
        cvSrc.style.cursor = t === "hand" ? "grab" : "crosshair";
        setHint();
        updateLive();
        renderSource();
      }
      function setPTool(t) {
        pv.tool = t;
        $$("#toolbar [data-ptool]").forEach((b) =>
          b.classList.toggle("on", b.dataset.ptool === t),
        );
        setHint();
        renderPreview();
      }
      function setTTool(t) {
        tp.tool = t;
        $$("#toolbar [data-ttool]").forEach((b) =>
          b.classList.toggle("on", b.dataset.ttool === t),
        );
        setHint();
      }
      function setMode(m) {
        S.mode = m;
        document.body.className = "mode-" + m;
        $("#modeSource").classList.toggle("on", m === "source");
        $("#modeTemplate").classList.toggle("on", m === "template");
        $("#modeInspect").classList.toggle("on", m === "inspect");
        cvSrc.classList.toggle("hidden", m !== "source");
        cvTmpl.classList.toggle("hidden", m !== "template");
        cvPrev.classList.toggle("hidden", m !== "inspect");
        if (m === "inspect") {
          if (!pvFitted) {
            fitPreview();
            pvFitted = true;
          }
          renderPreview();
          updateInspectPanels();
        } else if (m === "template") {
          if (!tpFitted) {
            fitTemplate();
            tpFitted = true;
          }
          renderTemplate();
        } else renderSource();
        updateStatus();
        setHint();
        updatePrevEmpty();
      }

      /* ================================================================
   INSPECTOR BINDINGS — source
   ================================================================ */
      function syncInputs() {
        $("#inGW").value = S.grid.w;
        $("#inGH").value = S.grid.h;
        $("#inOX").value = Math.round(S.grid.ox);
        $("#inOY").value = Math.round(S.grid.oy);
        $("#inOW").value = S.out.w;
        $("#inOH").value = S.out.h;
        $("#inPCols").value = pv.cols;
        $("#inPRows").value = pv.rows;
        updateRatioWarn();
      }
      function updateRatioWarn() {
        const off = Math.abs(S.grid.w / S.grid.h - 2) > 0.02;
        $("#ratioWarn").hidden = !off;
        if (off)
          $("#ratioWarn").textContent =
            `Rasio source diamond ${(S.grid.w / S.grid.h).toFixed(2)}:1 — bukan 2:1. Jika dipaksa ke output, bentuk akan terdistorsi.`;
      }
      function syncProcInputs() {
        $$("#segBg button").forEach((b) =>
          b.classList.toggle("on", b.dataset.v === S.proc.bg),
        );
        $("#inBgTol").value = S.proc.tol;
        $("#inATh").value = S.proc.ath;
        $("#inBinA").checked = S.proc.bin;
      }
      const num = (el, fallback) => {
        const v = parseInt(el.value, 10);
        return isNaN(v) ? fallback : v;
      };

      $("#inGW").addEventListener("change", () => {
        S.grid.w = clamp(num($("#inGW"), S.grid.w), 4, 8192);
        if (S.grid.lock) S.grid.h = Math.max(2, Math.round(S.grid.w / 2));
        syncInputs();
        renderSource();
        updateLive();
        updateStatus();
        updateInspectPanels();
      });
      $("#inGH").addEventListener("change", () => {
        S.grid.h = clamp(num($("#inGH"), S.grid.h), 2, 8192);
        if (S.grid.lock) S.grid.w = S.grid.h * 2;
        syncInputs();
        renderSource();
        updateLive();
        updateStatus();
        updateInspectPanels();
      });
      $("#inLock").addEventListener("change", (e) => {
        S.grid.lock = e.target.checked;
        if (S.grid.lock) S.grid.h = Math.max(2, Math.round(S.grid.w / 2));
        syncInputs();
        renderSource();
      });
      $$(".chip[data-gw]").forEach((ch) =>
        ch.addEventListener("click", () => {
          S.grid.w = +ch.dataset.gw;
          S.grid.h = +ch.dataset.gh;
          syncInputs();
          renderSource();
          updateLive();
          updateStatus();
        }),
      );
      $("#inOX").addEventListener("change", () => {
        S.grid.ox = num($("#inOX"), S.grid.ox);
        renderSource();
        updateLive();
      });
      $("#inOY").addEventListener("change", () => {
        S.grid.oy = num($("#inOY"), S.grid.oy);
        renderSource();
        updateLive();
      });
      $("#btnCalib").addEventListener("click", () => setTool("calib"));
      $("#btnCropSel").addEventListener("click", cropSelection);
      $("#btnClearSel").addEventListener("click", () => {
        S.sel.clear();
        updateSelUI();
        renderSource();
      });

      function applyOut() {
        S.out.w = clamp(num($("#inOW"), S.out.w), 8, 1024);
        S.out.h = clamp(num($("#inOH"), S.out.h), 4, 1024);
        syncInputs();
        retileTiles();
        if (S.mode === "inspect") {
          fitPreview();
          renderPreview();
        }
        updateLive();
        renderSource();
      }
      $("#inOW").addEventListener("change", applyOut);
      $("#inOH").addEventListener("change", applyOut);
      $$(".chip[data-ow]").forEach((ch) =>
        ch.addEventListener("click", () => {
          $("#inOW").value = ch.dataset.ow;
          $("#inOH").value = ch.dataset.oh;
          applyOut();
        }),
      );
      $$("#segResample button").forEach((b) =>
        b.addEventListener("click", () => {
          S.out.resample = b.dataset.v;
          $$("#segResample button").forEach((x) =>
            x.classList.toggle("on", x === b),
          );
          retileTiles();
          updateLive();
        }),
      );
      $$("#segBg button").forEach((b) =>
        b.addEventListener("click", () => {
          S.proc.bg = b.dataset.v;
          syncProcInputs();
          retileTiles();
          updateLive();
        }),
      );
      $("#inBgTol").addEventListener("change", () => {
        S.proc.tol = clamp(num($("#inBgTol"), S.proc.tol), 0, 128);
        syncProcInputs();
        retileTiles();
        updateLive();
      });
      $("#inATh").addEventListener("change", () => {
        S.proc.ath = clamp(num($("#inATh"), S.proc.ath), 0, 254);
        syncProcInputs();
        retileTiles();
        updateLive();
      });
      $("#inBinA").addEventListener("change", (e) => {
        S.proc.bin = e.target.checked;
        retileTiles();
        updateLive();
      });
      $("#btnManifest").addEventListener("click", () =>
        $("#manifestInput").click(),
      );
      $("#manifestInput").addEventListener("change", (e) => {
        const f = e.target.files[0];
        e.target.value = "";
        if (!f) return;
        f.text().then((t) => {
          try {
            importManifestJson(JSON.parse(t));
          } catch (err) {
            toast("Manifest tidak valid.", "warn");
          }
        });
      });

      /* ================================================================
   INSPECTOR BINDINGS — inspect
   ================================================================ */
      $("#inPCols").addEventListener("change", () => {
        pv.cols = clamp(num($("#inPCols"), pv.cols), 2, 40);
        prunePreview();
      });
      $("#inPRows").addEventListener("change", () => {
        pv.rows = clamp(num($("#inPRows"), pv.rows), 2, 40);
        prunePreview();
      });
      function prunePreview() {
        let willChange = false;
        for (const [k, e] of pv.map) {
          const i = k.indexOf(","),
            c = +k.slice(0, i),
            r = +k.slice(i + 1);
          if (c + e.wc > pv.cols || r + e.hc > pv.rows) {
            willChange = true;
            break;
          }
        }
        if (willChange) {
          pushUndo();
          for (const [k, e] of [...pv.map]) {
            const i = k.indexOf(","),
              c = +k.slice(0, i),
              r = +k.slice(i + 1);
            if (c + e.wc > pv.cols || r + e.hc > pv.rows) pv.map.delete(k);
          }
        }
        syncInputs();
        if (S.mode === "inspect") {
          fitPreview();
          renderPreview();
        }
      }
      $("#inPGrid").addEventListener("change", (e) => {
        pv.showGrid = e.target.checked;
        renderPreview();
      });
      $$("#segSeam button").forEach((b) =>
        b.addEventListener("click", () => {
          seamN = +b.dataset.n;
          $$("#segSeam button").forEach((x) =>
            x.classList.toggle("on", x === b),
          );
          renderSeamless();
        }),
      );
      $$("#segPix button").forEach((b) =>
        b.addEventListener("click", () => {
          pixZ = +b.dataset.z;
          $$("#segPix button").forEach((x) =>
            x.classList.toggle("on", x === b),
          );
          renderPixelZoom();
        }),
      );

      /* ================================================================
   INSPECTOR BINDINGS — template
   ================================================================ */
      $$("#segTPreset button").forEach((b) =>
        b.addEventListener("click", () => {
          tp.W = +b.dataset.w;
          tp.H = +b.dataset.h;
          $("#inTW").value = tp.W;
          $("#inTH").value = tp.H;
          autoDiamond();
          updateTInfo();
          fitTemplate();
          renderTemplate();
          updateStatus();
        }),
      );
      function onTCanvasSize() {
        tp.W = clamp(num($("#inTW"), tp.W), 256, 4096);
        tp.H = clamp(num($("#inTH"), tp.H), 256, 4096);
        autoDiamond();
        updateTInfo();
        fitTemplate();
        renderTemplate();
        updateStatus();
      }
      $("#inTW").addEventListener("change", onTCanvasSize);
      $("#inTH").addEventListener("change", onTCanvasSize);
      function onTGrid() {
        tp.cols = clamp(num($("#inTCols"), tp.cols), 2, 24);
        tp.rows = clamp(num($("#inTRows"), tp.rows), 2, 24);
        autoDiamond();
        pruneTMap();
        updateTInfo();
        fitTemplate();
        renderTemplate();
        updateStatus();
      }
      $("#inTCols").addEventListener("change", onTGrid);
      $("#inTRows").addEventListener("change", onTGrid);
      $("#inTDH").addEventListener("change", () => {
        tp.dh = clamp(num($("#inTDH"), tp.dh), 4, 512);
        updateTGeom();
        updateTInfo();
        fitTemplate();
        renderTemplate();
        updateStatus();
      });
      $$("#segTLayout button").forEach((b) =>
        b.addEventListener("click", () => {
          $$("#segTLayout button").forEach((x) =>
            x.classList.toggle("on", x === b),
          );
          applyTLayout(b.dataset.l);
        }),
      );
      $("#tPalette").addEventListener("click", (e) => {
        const b = e.target.closest(".swatch");
        if (!b) return;
        tp.mat = b.dataset.m;
        if (tp.tool === "erase" || tp.tool === "fill") setTTool("paint");
        renderTPalette();
        setHint();
      });
      $("#inTLabels").addEventListener("change", (e) => {
        tp.labels = e.target.checked;
        renderTemplate();
      });
      $("#inTBorders").addEventListener("change", (e) => {
        tp.borders = e.target.checked;
        renderTemplate();
      });
      $("#btnExportZones").addEventListener("click", () => {
        canvasBlob(buildTemplateImage("zones")).then((b) =>
          download(b, `zone_map_${tp.W}x${tp.H}.png`),
        );
        toast("zone_map.png didownload");
      });
      $("#btnExportLines").addEventListener("click", () => {
        canvasBlob(buildTemplateImage("lines")).then((b) =>
          download(b, `grid_lines_${tp.W}x${tp.H}.png`),
        );
        toast("grid_lines.png didownload");
      });
      $("#btnCopyPZ").addEventListener("click", () =>
        copyText(buildTemplatePrompt("zones")),
      );
      $("#btnCopyPL").addEventListener("click", () =>
        copyText(buildTemplatePrompt("lines")),
      );
      $("#btnExportTemplate").addEventListener("click", exportTemplateAll);
      $("#btnGenPrompt").addEventListener("click", () => {
        $("#pmOut").value = buildMaterialPrompt();
      });
      $("#btnCopyPM").addEventListener("click", () => {
        if (!$("#pmOut").value) $("#pmOut").value = buildMaterialPrompt();
        copyText($("#pmOut").value);
      });
      $("#btnDlPM").addEventListener("click", () => {
        if (!$("#pmOut").value) $("#pmOut").value = buildMaterialPrompt();
        download(
          new Blob([$("#pmOut").value], { type: "text/plain" }),
          "material_prompt.txt",
        );
        toast("material_prompt.txt didownload");
      });

