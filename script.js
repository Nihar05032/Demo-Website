(() => {
  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav");
  const form = document.querySelector("#callback-form");
  const feedback = document.querySelector("#form-feedback");

  document.querySelector("#year").textContent = new Date().getFullYear();

  const closeMenu = () => {
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open menu");
    nav.classList.remove("is-open");
  };

  menuButton.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Open menu" : "Close menu");
    nav.classList.toggle("is-open", !isOpen);
  });

  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
  });

  document.querySelectorAll("[data-service]").forEach((card) => {
    card.addEventListener("click", () => {
      const service = document.querySelector("#service");
      const option = [...service.options].find((item) => item.value === card.dataset.service || item.textContent === card.dataset.service);
      if (option) service.value = option.value;
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const firstName = form.elements.name.value.trim().split(/\s+/)[0];
    feedback.textContent = `Thanks, ${firstName}. This preview form is ready to connect to APP Plumbing’s inbox before launch.`;
    feedback.classList.add("is-visible");
    feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
    form.reset();
  });

  const revealItems = document.querySelectorAll(".feature, .service-card, .process-step, .faq-item");
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    revealItems.forEach((item, index) => {
      item.classList.add("reveal");
      item.style.transitionDelay = `${(index % 3) * 70}ms`;
    });
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          currentObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });
    revealItems.forEach((item) => observer.observe(item));
  }

  const canvas = document.querySelector("#valve-model");
  const stage = document.querySelector("#model-stage");
  if (canvas && stage) {
    const context = canvas.getContext("2d");
    const controls = {
      explode: document.querySelector("#explode-toggle"),
      labels: document.querySelector("#labels-toggle"),
      spin: document.querySelector("#spin-toggle"),
      reset: document.querySelector("#model-reset"),
    };
    const model = { yaw: -0.58, pitch: 0.3, zoom: 1, exploded: false, labels: true, spinning: false, dragging: false, lastX: 0, lastY: 0, frame: 0 };
    const colors = { pipe: "#73a99a", pipeDark: "#386d61", brass: "#d2ab68", brassLight: "#e6c783", brassDark: "#947142", body: "#5f9a88", bodyDark: "#376e61", dark: "#183f37", foot: "#97b1a3" };
    let width = 0;
    let height = 0;
    let pixelRatio = 1;

    const rotate = ([x, y, z]) => {
      const cy = Math.cos(model.yaw), sy = Math.sin(model.yaw);
      const cp = Math.cos(model.pitch), sp = Math.sin(model.pitch);
      const rx = x * cy - z * sy;
      const rz = x * sy + z * cy;
      return [rx, y * cp - rz * sp, y * sp + rz * cp];
    };
    const project = (point) => {
      const rotated = rotate(point);
      const scale = Math.min(width / 7.1, height / 4.7) * model.zoom;
      return { x: width / 2 + rotated[0] * scale, y: height * 0.55 - rotated[1] * scale, depth: rotated[2] };
    };

    const createParts = () => {
      const faces = [];
      const addFace = (points, color) => faces.push({ points, color });
      const addBox = (center, size, color, lift = 0) => {
        const [cx, cy, cz] = center;
        const [sx, sy, sz] = size;
        const x0 = cx - sx / 2, x1 = cx + sx / 2;
        const y0 = cy + lift - sy / 2, y1 = cy + lift + sy / 2;
        const z0 = cz - sz / 2, z1 = cz + sz / 2;
        const p = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
        [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]].forEach((idx) => addFace(idx.map((i) => p[i]), color));
      };
      const addCylinder = (axis, center, radius, length, color, segments = 14, lift = 0) => {
        const [cx, cy, cz] = center;
        const rings = [];
        for (const offset of [-length / 2, length / 2]) {
          const ring = [];
          for (let i = 0; i < segments; i += 1) {
            const angle = (i / segments) * Math.PI * 2;
            if (axis === "x") ring.push([cx + offset, cy + lift + Math.cos(angle) * radius, cz + Math.sin(angle) * radius]);
            else if (axis === "y") ring.push([cx + Math.cos(angle) * radius, cy + lift + offset, cz + Math.sin(angle) * radius]);
            else ring.push([cx + Math.cos(angle) * radius, cy + lift + Math.sin(angle) * radius, cz + offset]);
          }
          rings.push(ring);
        }
        addFace(rings[0], color);
        addFace([...rings[1]].reverse(), color);
        for (let i = 0; i < segments; i += 1) addFace([rings[0][i], rings[0][(i + 1) % segments], rings[1][(i + 1) % segments], rings[1][i]], color);
      };
      const addRing = (center, radius, tube, color, lift = 0) => {
        const around = 24, tubeSteps = 7;
        const grid = [];
        for (let i = 0; i < around; i += 1) {
          const theta = (i / around) * Math.PI * 2;
          const row = [];
          for (let j = 0; j < tubeSteps; j += 1) {
            const phi = (j / tubeSteps) * Math.PI * 2;
            const ringRadius = radius + tube * Math.cos(phi);
            row.push([center[0] + ringRadius * Math.cos(theta), center[1] + lift + tube * Math.sin(phi), center[2] + ringRadius * Math.sin(theta)]);
          }
          grid.push(row);
        }
        for (let i = 0; i < around; i += 1) for (let j = 0; j < tubeSteps; j += 1) {
          addFace([grid[i][j], grid[(i + 1) % around][j], grid[(i + 1) % around][(j + 1) % tubeSteps], grid[i][(j + 1) % tubeSteps]], color);
        }
      };

      // The pipe run sits behind the serviceable valve body.
      addCylinder("x", [0, 0, 0], 0.2, 5.15, colors.pipe, 18);
      addCylinder("x", [-2.23, 0, 0], 0.27, 0.26, colors.pipeDark, 18);
      addCylinder("x", [2.23, 0, 0], 0.27, 0.26, colors.pipeDark, 18);
      addBox([0, -0.38, 0], [1.95, 0.15, 0.78], colors.foot);
      addBox([-0.63, -0.48, 0], [0.18, 0.32, 0.62], colors.brassDark);
      addBox([0.63, -0.48, 0], [0.18, 0.32, 0.62], colors.brassDark);

      const bodyLift = model.exploded ? 0.2 : 0;
      const upperLift = model.exploded ? 0.3 : 0;
      addBox([0, 0.15, 0], [1.55, 0.72, 0.82], colors.body, bodyLift);
      addBox([0, 0.16, 0.423], [0.78, 0.49, 0.035], colors.bodyDark, bodyLift);
      addCylinder("x", [-1.14, 0, 0], 0.34, 0.42, colors.brass, 18, bodyLift * 0.3);
      addCylinder("x", [1.14, 0, 0], 0.34, 0.42, colors.brass, 18, bodyLift * 0.3);
      addCylinder("x", [-1.49, 0, 0], 0.24, 0.18, colors.brassDark, 18);
      addCylinder("x", [1.49, 0, 0], 0.24, 0.18, colors.brassDark, 18);
      addCylinder("x", [-1.86, 0, 0], 0.16, 0.58, colors.brassLight, 16);
      addCylinder("x", [1.86, 0, 0], 0.16, 0.58, colors.brassLight, 16);

      [-0.42, 0.42].forEach((x) => {
        addCylinder("y", [x, 0.76, 0], 0.28, 0.5, colors.brass, 16, bodyLift);
        addCylinder("y", [x, 1.08, 0], 0.21, 0.18, colors.brassDark, 16, bodyLift + upperLift * 0.45);
        addCylinder("y", [x, 1.32, 0], 0.075, 0.42, colors.brassLight, 12, bodyLift + upperLift);
        addCylinder("y", [x, 1.56, 0], 0.105, 0.09, colors.brassDark, 14, bodyLift + upperLift);
        addRing([x, 1.79, 0], 0.28, 0.045, colors.brassLight, bodyLift + upperLift);
        addCylinder("x", [x, 1.79, 0], 0.025, 0.49, colors.brassLight, 9, bodyLift + upperLift);
        addCylinder("z", [x, 1.79, 0], 0.025, 0.49, colors.brassLight, 9, bodyLift + upperLift);
      });
      [-0.92, 0.92].forEach((x) => {
        addCylinder("y", [x, 0.48, 0.48], 0.075, 0.22, colors.brassLight, 12, bodyLift * 0.55);
        addCylinder("y", [x, 0.61, 0.48], 0.105, 0.07, colors.brassDark, 12, bodyLift * 0.55);
      });
      return faces;
    };

    const shade = (hex, factor) => {
      const value = parseInt(hex.slice(1), 16);
      const red = Math.min(255, Math.round(((value >> 16) & 255) * factor));
      const green = Math.min(255, Math.round(((value >> 8) & 255) * factor));
      const blue = Math.min(255, Math.round((value & 255) * factor));
      return `rgb(${red} ${green} ${blue})`;
    };

    const draw = () => {
      if (!width || !height) return;
      context.clearRect(0, 0, width, height);
      const faces = createParts().map((face) => {
        const vertices = face.points.map((point) => rotate(point));
        const projected = vertices.map(([x, y, z]) => {
          const scale = Math.min(width / 7.1, height / 4.7) * model.zoom;
          return { x: width / 2 + x * scale, y: height * 0.55 - y * scale, depth: z };
        });
        const a = vertices[0], b = vertices[1], c = vertices[2];
        const ab = [b[0]-a[0], b[1]-a[1], b[2]-a[2]], ac = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
        const normal = [ab[1]*ac[2]-ab[2]*ac[1], ab[2]*ac[0]-ab[0]*ac[2], ab[0]*ac[1]-ab[1]*ac[0]];
        const length = Math.hypot(...normal) || 1;
        const light = (normal[0] * 0.24 + normal[1] * 0.83 + normal[2] * 0.49) / length;
        return { projected, color: shade(face.color, 0.63 + Math.max(-0.18, light) * 0.42), depth: projected.reduce((sum, point) => sum + point.depth, 0) / projected.length };
      }).sort((a, b) => a.depth - b.depth);

      // A fine technical grid gives the turntable a quiet sense of depth.
      context.save();
      context.strokeStyle = "rgba(190,226,207,.07)";
      context.lineWidth = 1;
      for (let x = 18; x < width; x += 38) { context.beginPath(); context.moveTo(x, 28); context.lineTo(x, height - 20); context.stroke(); }
      for (let y = 34; y < height; y += 38) { context.beginPath(); context.moveTo(18, y); context.lineTo(width - 18, y); context.stroke(); }
      context.restore();

      faces.forEach(({ projected, color }) => {
        context.beginPath();
        context.moveTo(projected[0].x, projected[0].y);
        projected.slice(1).forEach((point) => context.lineTo(point.x, point.y));
        context.closePath();
        context.fillStyle = color;
        context.fill();
        context.strokeStyle = "rgba(9,31,26,.16)";
        context.lineWidth = 0.7;
        context.stroke();
      });

      if (model.labels) {
        const lift = model.exploded ? 0.5 : 0;
        const anchors = [[-0.42, 1.95 + lift, 0], [1.0, 0.68 + (model.exploded ? 0.2 : 0), 0.56], [0, 0.16 + (model.exploded ? 0.2 : 0), 0.48]];
        anchors.forEach((anchor, index) => {
          const point = project(anchor);
          const bubbleX = Math.max(23, Math.min(width - 23, point.x + (point.x > width * 0.68 ? -27 : 27)));
          const bubbleY = Math.max(22, Math.min(height - 28, point.y - 13));
          context.beginPath(); context.moveTo(point.x, point.y); context.lineTo(bubbleX, bubbleY + 12);
          context.strokeStyle = "rgba(217,240,120,.72)"; context.lineWidth = 1; context.stroke();
          context.beginPath(); context.arc(bubbleX, bubbleY, 12, 0, Math.PI * 2);
          context.fillStyle = "#d9f078"; context.fill();
          context.fillStyle = "#173b36"; context.font = "700 8px DM Sans, sans-serif"; context.textAlign = "center"; context.textBaseline = "middle";
          context.fillText(String(index + 1).padStart(2, "0"), bubbleX, bubbleY + 0.5);
        });
      }
    };

    const resize = () => {
      const bounds = stage.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      draw();
    };
    const setPressed = (button, pressed) => {
      button.setAttribute("aria-pressed", String(pressed));
      const state = button.querySelector(".control-state");
      if (state) state.textContent = pressed ? "ON" : "OFF";
    };
    let resizeObserver;
    if ("ResizeObserver" in window) { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage); }
    else window.addEventListener("resize", resize);
    resize();

    stage.addEventListener("pointerdown", (event) => {
      model.dragging = true;
      model.lastX = event.clientX;
      model.lastY = event.clientY;
      stage.setPointerCapture(event.pointerId);
      stage.focus({ preventScroll: true });
      stage.classList.add("is-dragging");
    });
    stage.addEventListener("pointermove", (event) => {
      if (!model.dragging) return;
      model.yaw += (event.clientX - model.lastX) * 0.009;
      model.pitch = Math.max(-0.62, Math.min(0.78, model.pitch + (event.clientY - model.lastY) * 0.007));
      model.lastX = event.clientX;
      model.lastY = event.clientY;
      draw();
    });
    const stopDrag = () => { model.dragging = false; stage.classList.remove("is-dragging"); };
    stage.addEventListener("pointerup", stopDrag);
    stage.addEventListener("pointercancel", stopDrag);
    stage.addEventListener("keydown", (event) => {
      const rotations = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] };
      if (!rotations[event.key]) return;
      event.preventDefault();
      model.yaw += rotations[event.key][0];
      model.pitch = Math.max(-0.62, Math.min(0.78, model.pitch + rotations[event.key][1]));
      draw();
    });

    controls.explode.addEventListener("click", () => { model.exploded = !model.exploded; setPressed(controls.explode, model.exploded); draw(); });
    controls.labels.addEventListener("click", () => { model.labels = !model.labels; setPressed(controls.labels, model.labels); draw(); });
    const animate = () => {
      if (!model.spinning) return;
      model.yaw += 0.006;
      draw();
      model.frame = requestAnimationFrame(animate);
    };
    controls.spin.addEventListener("click", () => {
      model.spinning = !model.spinning;
      setPressed(controls.spin, model.spinning);
      controls.spin.lastChild.textContent = model.spinning ? " Pause rotate" : " Auto rotate";
      if (model.spinning) animate(); else cancelAnimationFrame(model.frame);
    });
    controls.reset.addEventListener("click", () => {
      model.yaw = -0.58; model.pitch = 0.3; model.zoom = 1; model.exploded = false;
      model.spinning = false;
      cancelAnimationFrame(model.frame);
      setPressed(controls.explode, false);
      setPressed(controls.spin, false);
      controls.spin.lastChild.textContent = " Auto rotate";
      draw();
    });
  }
})();
