      /* ================================================================
   ASSET LIBRARY
   ================================================================ */
      const byUid = (uid) => S.tiles.find((t) => t.uid === uid) || null;

      function drawThumb(cv, t) {
        const c = cv.getContext("2d");
        drawCheckerTo(c, 0, 0, cv.width, cv.height, 8);
        const s = Math.min(
          (cv.width - 8) / t.canvas.width,
          (cv.height - 8) / t.canvas.height,
        );
        const dw = t.canvas.width * s,
          dh = t.canvas.height * s;
        c.imageSmoothingEnabled = s < 1;
        c.drawImage(
          t.canvas,
          (cv.width - dw) / 2,
          (cv.height - dh) / 2,
          dw,
          dh,
        );
      }
      function renderLibrary() {
        libCount.textContent = S.tiles.length;
        if (!S.tiles.length) {
          libList.innerHTML =
            '<p class="empty">Belum ada asset. Gunakan tool <em>Crop tile</em> (T) atau <em>Select</em> (S) + batch crop, lalu hasilnya masuk sini.</p>';
          return;
        }
        const q = S.libQuery.toLowerCase();
        const list = S.tiles.filter(
          (t) =>
            (S.libFilter === "all" || t.type === S.libFilter) &&
            (!q || t.name.toLowerCase().includes(q)),
        );
        if (!list.length) {
          libList.innerHTML =
            '<p class="empty">Tidak ada yang cocok dengan filter.</p>';
          S.lastAdded = null;
          return;
        }
        libList.innerHTML = "";
        for (const t of list) {
          const item = document.createElement("div");
          item.className =
            "lib-item" +
            (t.uid === S.active ? " on" : "") +
            (t.uid === S.lastAdded ? " fresh" : "");
          item.dataset.uid = t.uid;
          item.innerHTML = `
      <canvas class="thumb" width="112" height="72"></canvas>
      <div class="li-meta">
        <span class="li-name">${t.name}</span>
        <span class="li-sub">${t.type} · ${t.wc}×${t.hc} cell · ${t.canvas.width}×${t.canvas.height}px</span>
      </div>
      <div class="li-act">
        <button data-act="dup" title="Duplikat"><i data-lucide="copy"></i></button>
        <button data-act="dl" title="Download PNG"><i data-lucide="download"></i></button>
        <button data-act="del" class="danger" title="Hapus"><i data-lucide="x"></i></button>
      </div>`;
          drawThumb(item.querySelector(".thumb"), t);
          libList.appendChild(item);
        }
        S.lastAdded = null;
        refreshIcons();
      }
      function setActive(uid) {
        S.active = uid;
        renderLibrary();
        updateBrushBox();
        updatePrevEmpty();
        updateInspectPanels();
        if (S.mode === "inspect") renderPreview();
      }
      function deleteTile(t) {
        S.tiles = S.tiles.filter((x) => x.uid !== t.uid);
        for (const [k, e] of [...pv.map]) if (e.uid === t.uid) pv.map.delete(k);
        if (S.active === t.uid) S.active = S.tiles[0] ? S.tiles[0].uid : null;
        renderLibrary();
        updateBrushBox();
        renderPreview();
        updatePrevEmpty();
        updateInspectPanels();
        toast(`${t.name} dihapus`);
      }
      function duplicateTile(t) {
        const cv = makeCanvas(t.canvas.width, t.canvas.height);
        cv.getContext("2d").drawImage(t.canvas, 0, 0);
        const nt = {
          uid: S.uidSeq++,
          name: t.name + "_copy",
          type: t.type,
          wc: t.wc,
          hc: t.hc,
          canvas: cv,
          ax: t.ax,
          ay: t.ay,
          src: t.src,
        };
        S.tiles.push(nt);
        S.lastAdded = nt.uid;
        setActive(nt.uid);
        toast(`${nt.name} diduplikasi`);
      }
      function startRename(t, span) {
        const inp = document.createElement("input");
        inp.value = t.name;
        span.textContent = "";
        span.appendChild(inp);
        inp.focus();
        inp.select();
        let done = false;
        const commit = (ok) => {
          if (done) return;
          done = true;
          if (ok) {
            const v = inp.value.trim();
            if (v) t.name = v;
          }
          renderLibrary();
          updateBrushBox();
        };
        inp.addEventListener("blur", () => commit(true));
        inp.addEventListener("click", (e) => e.stopPropagation());
        inp.addEventListener("keydown", (e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit(true);
          if (e.key === "Escape") commit(false);
        });
      }
      libList.addEventListener("click", (e) => {
        const item = e.target.closest(".lib-item");
        if (!item) return;
        const t = byUid(+item.dataset.uid);
        if (!t) return;
        const btn = e.target.closest("button[data-act]");
        if (btn) {
          if (btn.dataset.act === "del") deleteTile(t);
          else if (btn.dataset.act === "dup") duplicateTile(t);
          else t.canvas.toBlob((b) => download(b, t.name + ".png"));
          e.stopPropagation();
          return;
        }
        setActive(t.uid);
      });
      libList.addEventListener("dblclick", (e) => {
        const span = e.target.closest(".li-name");
        if (!span) return;
        const t = byUid(+e.target.closest(".lib-item").dataset.uid);
        if (t) startRename(t, span);
      });
      $("#libSearch").addEventListener("input", (e) => {
        S.libQuery = e.target.value;
        renderLibrary();
      });
      $$("#libFilter button").forEach((b) =>
        b.addEventListener("click", () => {
          S.libFilter = b.dataset.f;
          $$("#libFilter button").forEach((x) =>
            x.classList.toggle("on", x === b),
          );
          renderLibrary();
        }),
      );

      function updateBrushBox() {
        const box = $("#brushBox"),
          t = byUid(S.active);
        box.innerHTML = t
          ? `<canvas class="thumb" width="112" height="72"></canvas>
       <div class="li-meta"><span class="li-name">${t.name}</span><span class="li-sub">${t.type} · ${t.canvas.width}×${t.canvas.height}px</span></div>`
          : '<span class="empty">Pilih tile di Asset Library untuk jadi brush.</span>';
        if (t) drawThumb(box.querySelector(".thumb"), t);
      }

