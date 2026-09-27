import { $, $$, RT, S, pv, refreshIcons, toast, tp, view } from './core.js';
import { doRedo, doUndo, fitPreview, pushUndo, renderPreview, updateInspectPanels, updatePrevEmpty } from './inspect.js';
import { buildPreviewPng, canvasBlob, download, loadSample } from './io.js';
import { renderLibrary, updateBrushBox } from './library.js';
import { importManifestJson, loadFile, newProject, saveProject } from './project.js';
import { updateLive } from './source-live.js';
import { renderSource } from './source-render.js';
import { cropSelection, updateSelUI } from './source-select.js';
import { doTRedo, doTUndo, pushTUndo, renderTPalette, updateTInfo } from './template-export.js';
import { applyTLayout, autoDiamond, fitTemplate, renderTemplate } from './template-studio.js';
import { setHint, setMode, setPTool, setTTool, setTool, syncProcInputs, updateStatus } from './ui.js';
import { fitView, zoomCenter } from './view-events.js';

      /* ================================================================
   TOOLBAR / HEADER BINDINGS
   ================================================================ */

      $$("#toolbar [data-tool]").forEach((b) =>
        b.addEventListener("click", () => setTool(b.dataset.tool)),
      );
      $$("#toolbar [data-ptool]").forEach((b) =>
        b.addEventListener("click", () => setPTool(b.dataset.ptool)),
      );
      $$("#toolbar [data-ttool]").forEach((b) =>
        b.addEventListener("click", () => setTTool(b.dataset.ttool)),
      );
      $("#tbZoomIn").addEventListener("click", () => zoomCenter(1.35));
      $("#tbZoomOut").addEventListener("click", () => zoomCenter(1 / 1.35));
      $("#tbFit").addEventListener("click", () => {
        if (S.mode === "source") {
          fitView();
          renderSource();
        } else if (S.mode === "inspect") {
          fitPreview();
          renderPreview();
        } else {
          fitTemplate();
          renderTemplate();
        }
        updateStatus();
      });
      $("#tbGrid").addEventListener("click", () => {
        S.grid.show = !S.grid.show;
        $("#tbGrid").classList.toggle("on", S.grid.show);
        renderSource();
      });
      $("#tbUndo").addEventListener("click", doUndo);
      $("#tbRedo").addEventListener("click", doRedo);
      $("#tbClear").addEventListener("click", () => {
        if (!pv.map.size) return;
        pushUndo();
        pv.map.clear();
        renderPreview();
        toast("Preview dibersihkan — Ctrl+Z untuk undo");
      });
      $("#tbTUndo").addEventListener("click", doTUndo);
      $("#tbTRedo").addEventListener("click", doTRedo);
      $("#tbTClear").addEventListener("click", () => {
        if (!tp.map.size) return;
        pushTUndo();
        tp.map.clear();
        renderTemplate();
        updateTInfo();
        toast("Zona dikosongkan — Ctrl+Z untuk undo");
      });
      $("#modeSource").addEventListener("click", () => setMode("source"));
      $("#modeTemplate").addEventListener("click", () => setMode("template"));
      $("#modeInspect").addEventListener("click", () => setMode("inspect"));
      $("#btnNew").addEventListener("click", newProject);
      $("#btnOpen").addEventListener("click", () => $("#projInput").click());
      $("#btnSave").addEventListener("click", saveProject);
      $("#btnImport").addEventListener("click", () => $("#fileInput").click());
      $("#btnSample").addEventListener("click", loadSample);
      $("#btnExport").addEventListener("click", exportAll);
      $("#btnPrevPng").addEventListener("click", () => {
        if (!pv.map.size) {
          toast("Preview masih kosong.", "warn");
          return;
        }
        canvasBlob(buildPreviewPng()).then((b) =>
          download(b, "ground_preview.png"),
        );
        toast("ground_preview.png didownload");
      });
      $("#fileInput").addEventListener("change", (e) => {
        loadFile(e.target.files[0]);
        e.target.value = "";
      });
      $("#projInput").addEventListener("change", (e) => {
        const f = e.target.files[0];
        e.target.value = "";
        if (!f) return;
        f.text().then((t) => {
          try {
            const j = JSON.parse(t);
            if (j.grid && j.grid.diamond_w && !j.source) importManifestJson(j);
            else loadProject(j);
          } catch (err) {
            toast("File JSON tidak valid.", "warn");
          }
        });
      });
      $("#dzPick").addEventListener("click", (e) => {
        e.stopPropagation();
        $("#fileInput").click();
      });
      $("#dzSample").addEventListener("click", (e) => {
        e.stopPropagation();
        loadSample();
      });
      $("#dropzone").addEventListener("click", () => $("#fileInput").click());

      /* drag & drop */
      ["dragenter", "dragover"].forEach((ev) =>
        window.addEventListener(ev, (e) => {
          e.preventDefault();
          $("#stage").classList.add("drag");
        }),
      );
      window.addEventListener("dragleave", (e) => {
        if (!e.relatedTarget) $("#stage").classList.remove("drag");
      });
      window.addEventListener("drop", (e) => {
        e.preventDefault();
        $("#stage").classList.remove("drag");
        loadFile(e.dataTransfer.files[0]);
      });

      /* keyboard */
      window.addEventListener("keydown", (e) => {
        if (e.target.closest("input,textarea,select")) return;
        const k = e.key.toLowerCase();
        if (e.code === "Space") {
          S.space = true;
          e.preventDefault();
          return;
        }
        if (S.mode === "source") {
          if (k === "v") setTool("hand");
          else if (k === "c") setTool("calib");
          else if (k === "s") setTool("select");
          else if (k === "t") setTool("tile");
          else if (k === "p") setTool("patch");
          else if (k === "o") setTool("origin");
          else if (k === "g") $("#tbGrid").click();
          else if (k === "0") {
            fitView();
            renderSource();
            updateStatus();
          } else if (k === "+" || k === "=") zoomCenter(1.35);
          else if (k === "-") zoomCenter(1 / 1.35);
          else if (k === "enter" && S.sel.size) cropSelection();
          else if (k === "escape") {
            if (RT.patchSel) {
              RT.patchSel = null;
              renderSource();
              updateLive();
            } else if (S.calib.pts.length) {
              S.calib.pts = [];
              renderSource();
            } else if (S.sel.size) {
              S.sel.clear();
              updateSelUI();
              renderSource();
            }
          }
        } else if (S.mode === "template") {
          if ((e.ctrlKey || e.metaKey) && k === "z") {
            e.preventDefault();
            e.shiftKey ? doTRedo() : doTUndo();
          } else if ((e.ctrlKey || e.metaKey) && k === "y") {
            e.preventDefault();
            doTRedo();
          } else if (k === "b") setTTool("paint");
          else if (k === "e") setTTool("erase");
          else if (k === "f") setTTool("fill");
          else if (k === "0") {
            fitTemplate();
            renderTemplate();
            updateStatus();
          } else if (k === "+" || k === "=") zoomCenter(1.35);
          else if (k === "-") zoomCenter(1 / 1.35);
        } else {
          if ((e.ctrlKey || e.metaKey) && k === "z") {
            e.preventDefault();
            e.shiftKey ? doRedo() : doUndo();
          } else if ((e.ctrlKey || e.metaKey) && k === "y") {
            e.preventDefault();
            doRedo();
          } else if (k === "b") setPTool("brush");
          else if (k === "e") setPTool("erase");
        }
      });
      window.addEventListener("keyup", (e) => {
        if (e.code === "Space") S.space = false;
      });
      window.addEventListener("blur", () => {
        S.space = false;
      });

      /* resize */
      new ResizeObserver(() => {
        if (S.mode === "source") {
          if (S.img && !view.moved) fitView();
          renderSource();
        } else if (S.mode === "inspect") {
          if (!pv.moved) fitPreview();
          renderPreview();
        } else {
          if (!tp.moved) fitTemplate();
          renderTemplate();
        }
      }).observe($("#stage"));

      /* ================================================================
   INIT
   ================================================================ */
      refreshIcons();
      renderLibrary();
      updateBrushBox();
      renderTPalette();
      autoDiamond();
      applyTLayout("garden");
      updateTInfo();
      syncProcInputs();
      updateSelUI();
      setHint();
      updateStatus();
      renderSource();
      updatePrevEmpty();
      updateInspectPanels();
      requestAnimationFrame(() => setTimeout(loadSample, 60));
