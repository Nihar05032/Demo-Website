(() => {
  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav");
  const form = document.querySelector("#booking-form");
  const feedback = document.querySelector("#form-feedback");
  document.querySelector("#year").textContent = new Date().getFullYear();

  const closeMenu = () => {
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open menu");
    nav.classList.remove("is-open");
  };
  menuButton.addEventListener("click", () => {
    const open = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!open));
    menuButton.setAttribute("aria-label", open ? "Open menu" : "Close menu");
    nav.classList.toggle("is-open", !open);
  });
  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });
  document.addEventListener("click", (event) => { if (!nav.contains(event.target) && !menuButton.contains(event.target)) closeMenu(); });

  document.querySelectorAll("[data-service]").forEach((card) => {
    card.addEventListener("click", () => {
      const select = document.querySelector("#service");
      const option = [...select.options].find((item) => item.textContent === card.dataset.service);
      if (option) select.value = option.value;
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const firstName = form.elements.name.value.trim().split(/\s+/)[0];
    feedback.textContent = `Thanks, ${firstName}. This preview form is ready to connect to High Fire Heating’s inbox before launch.`;
    feedback.classList.add("is-visible");
    feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
    form.reset();
  });

  const canvas = document.querySelector("#damper-model");
  const stage = document.querySelector("#damper-stage");
  if (!canvas || !stage) return;
  const ctx = canvas.getContext("2d");
  const stateToggle = document.querySelector("#state-toggle");
  const labelsToggle = document.querySelector("#labels-toggle");
  const stateText = document.querySelector("#state-text");
  const stateReadout = document.querySelector("#damper-state");
  const resetButton = document.querySelector("#model-reset");
  const model = { yaw: -0.52, pitch: 0.24, zoom: 1, closed: false, angle: 0.06, labels: true, dragging: false, lastX: 0, lastY: 0 };
  const colors = { casing: "#82918a", casingLight: "#bcc5bb", casingDark: "#53615b", interior: "#293330", frame: "#a95536", blade: "#b98663", bladeLight: "#d3b79d", steel: "#b4bdb5", actuator: "#bd593b", actuatorDark: "#82412d", motor: "#68756d" };
  let width = 0, height = 0, dpr = 1;

  const rotate = ([x, y, z]) => {
    const cy = Math.cos(model.yaw), sy = Math.sin(model.yaw), cp = Math.cos(model.pitch), sp = Math.sin(model.pitch);
    const rx = x * cy - z * sy, rz = x * sy + z * cy;
    return [rx, y * cp - rz * sp, y * sp + rz * cp];
  };
  const scaleValue = () => Math.min(width / 5.95, height / 4.25) * model.zoom;
  const project = (point) => { const [x,y,z] = rotate(point), scale = scaleValue(); return { x: width / 2 + x * scale, y: height * .55 - y * scale, depth: z }; };

  const buildFaces = () => {
    const faces = [];
    const face = (points, color) => faces.push({ points, color });
    const box = (center, size, color) => {
      const [x,y,z] = center, [sx,sy,sz] = size;
      const x0=x-sx/2,x1=x+sx/2,y0=y-sy/2,y1=y+sy/2,z0=z-sz/2,z1=z+sz/2;
      const p=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
      [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]].forEach((ids)=>face(ids.map(i=>p[i]),color));
    };
    const cylinder = (axis, center, radius, length, color, steps=12) => {
      const [cx,cy,cz]=center, rings=[];
      for(const offset of [-length/2,length/2]){
        const ring=[];
        for(let i=0;i<steps;i++){
          const a=i/steps*Math.PI*2;
          if(axis==="y") ring.push([cx+Math.cos(a)*radius,cy+offset,cz+Math.sin(a)*radius]);
          else if(axis==="x") ring.push([cx+offset,cy+Math.cos(a)*radius,cz+Math.sin(a)*radius]);
          else ring.push([cx+Math.cos(a)*radius,cy+Math.sin(a)*radius,cz+offset]);
        }
        rings.push(ring);
      }
      face(rings[0],color);face([...rings[1]].reverse(),color);
      for(let i=0;i<steps;i++) face([rings[0][i],rings[0][(i+1)%steps],rings[1][(i+1)%steps],rings[1][i]],color);
    };
    const bar=(a,b,thickness,color)=>{
      const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2];
      const len=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
      // The actuator link and braces are short rectangular members aligned to their dominant axis.
      const dx=Math.abs(a[0]-b[0]),dy=Math.abs(a[1]-b[1]),dz=Math.abs(a[2]-b[2]);
      if(dx>=dy&&dx>=dz) box(mid,[len,thickness,thickness],color);
      else if(dy>=dz) box(mid,[thickness,len,thickness],color);
      else box(mid,[thickness,thickness,len],color);
    };

    // Duct casing with an open front so the blade assembly stays visible.
    face([[-1.45,1.08,-1.15],[1.45,1.08,-1.15],[1.45,1.08,1.05],[-1.45,1.08,1.05]],colors.casingLight);
    face([[-1.45,-1.08,-1.15],[1.45,-1.08,-1.15],[1.45,-1.08,1.05],[-1.45,-1.08,1.05]],colors.casing);
    face([[-1.45,-1.08,-1.15],[-1.45,1.08,-1.15],[-1.45,1.08,1.05],[-1.45,-1.08,1.05]],colors.casingDark);
    face([[1.45,-1.08,-1.15],[1.45,1.08,-1.15],[1.45,1.08,1.05],[1.45,-1.08,1.05]],colors.casing);
    face([[-1.45,-1.08,-1.15],[1.45,-1.08,-1.15],[1.45,1.08,-1.15],[-1.45,1.08,-1.15]],colors.interior);
    // Orange inspection flange around the duct opening.
    box([0,1.14,1.06],[3.05,.16,.18],colors.frame);
    box([0,-1.14,1.06],[3.05,.16,.18],colors.frame);
    box([-1.52,0,1.06],[.16,2.24,.18],colors.frame);
    box([1.52,0,1.06],[.16,2.24,.18],colors.frame);
    // Linked parallel blades turn from edge-on to closed across the duct opening.
    const half=.31, zCenter=.2, rows=[-.76,-.38,0,.38,.76];
    rows.forEach((row)=>{
      const yDepth=Math.sin(model.angle)*half,zDepth=Math.cos(model.angle)*half;
      face([[-1,row-yDepth,zCenter-zDepth],[1,row-yDepth,zCenter-zDepth],[1,row+yDepth,zCenter+zDepth],[-1,row+yDepth,zCenter+zDepth]],colors.blade);
      bar([-1,row,zCenter],[1,row,zCenter],.025,colors.bladeLight);
      cylinder("x",[0,row+Math.sin(model.angle)*half,zCenter],.032,2.12,colors.steel,12);
    });
    // Shaft, actuator, and the external indicator/linkage.
    box([0,1.43,-.16],[.62,.48,.72],colors.actuator);
    box([0,1.47,.22],[.37,.22,.04],colors.actuatorDark);
    cylinder("y",[0,1.74,-.16],.16,.18,colors.motor,14);
    box([0,1.13,.29],[.08,.48,.07],colors.steel);
    cylinder("z",[0,1.39,.34],.06,.13,colors.steel,10);
    [-1.25,1.25].forEach((x)=>cylinder("y",[x,-1.25,.84],.06,.19,colors.steel,10));
    return faces;
  };

  const shade = (hex,amount) => {
    const n=parseInt(hex.slice(1),16),r=Math.min(255,Math.round(((n>>16)&255)*amount)),g=Math.min(255,Math.round(((n>>8)&255)*amount)),b=Math.min(255,Math.round((n&255)*amount));
    return `rgb(${r} ${g} ${b})`;
  };
  const draw = () => {
    if(!width||!height)return;
    ctx.clearRect(0,0,width,height);
    ctx.save();ctx.strokeStyle="rgba(220,234,224,.032)";ctx.lineWidth=1;
    for(let x=18;x<width;x+=42){ctx.beginPath();ctx.moveTo(x,18);ctx.lineTo(x,height-16);ctx.stroke();}
    for(let y=20;y<height;y+=42){ctx.beginPath();ctx.moveTo(18,y);ctx.lineTo(width-18,y);ctx.stroke();}
    ctx.restore();
    const faces=buildFaces().map((item)=>{
      const verts=item.points.map(rotate),scale=scaleValue();
      const points=verts.map(([x,y,z])=>({x:width/2+x*scale,y:height*.55-y*scale,depth:z}));
      const a=verts[0],b=verts[1],c=verts[2],ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
      const n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],len=Math.hypot(...n)||1,light=(n[0]*.23+n[1]*.82+n[2]*.5)/len;
      return {points,color:shade(item.color,.64+Math.max(-.18,light)*.42),depth:points.reduce((sum,p)=>sum+p.depth,0)/points.length};
    }).sort((a,b)=>a.depth-b.depth);
    faces.forEach(({points,color})=>{
      ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);points.slice(1).forEach((p)=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle="rgba(8,16,17,.22)";ctx.lineWidth=.7;ctx.stroke();
    });
    if(model.labels){
      const points=[[0,1.78,-.15],[0,.06,.42],[1.55,.16,1.06]];
      points.forEach((p,i)=>{
        const q=project(p),x=Math.max(23,Math.min(width-23,q.x+(q.x>width*.68?-24:24))),y=Math.max(25,Math.min(height-26,q.y-14));
        ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(x,y+11);ctx.strokeStyle="rgba(255,144,103,.8)";ctx.lineWidth=1;ctx.stroke();
        ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fillStyle="#e3a084";ctx.fill();ctx.fillStyle="#2c302c";ctx.font="700 7px DM Sans, sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(String(i+1).padStart(2,"0"),x,y+.4);
      });
    }
  };
  const resize=()=>{const r=stage.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();};
  if("ResizeObserver" in window){new ResizeObserver(resize).observe(stage);}else window.addEventListener("resize",resize);
  resize();

  stage.addEventListener("pointerdown",(event)=>{model.dragging=true;model.lastX=event.clientX;model.lastY=event.clientY;stage.setPointerCapture(event.pointerId);stage.focus({preventScroll:true});});
  stage.addEventListener("pointermove",(event)=>{if(!model.dragging)return;model.yaw+=(event.clientX-model.lastX)*.009;model.pitch=Math.max(-.58,Math.min(.7,model.pitch+(event.clientY-model.lastY)*.007));model.lastX=event.clientX;model.lastY=event.clientY;draw();});
  const stopDrag=()=>{model.dragging=false;};stage.addEventListener("pointerup",stopDrag);stage.addEventListener("pointercancel",stopDrag);
  stage.addEventListener("keydown",(event)=>{const move={ArrowLeft:[-.12,0],ArrowRight:[.12,0],ArrowUp:[0,.1],ArrowDown:[0,-.1]}[event.key];if(!move)return;event.preventDefault();model.yaw+=move[0];model.pitch=Math.max(-.58,Math.min(.7,model.pitch+move[1]));draw();});
  let bladeAnimation=0;
  const setBladeAngle=(target)=>{
    cancelAnimationFrame(bladeAnimation);
    const startAngle=model.angle,startTime=performance.now(),duration=420;
    const animate=(now)=>{const progress=Math.min(1,(now-startTime)/duration),ease=progress*progress*(3-2*progress);model.angle=startAngle+(target-startAngle)*ease;draw();if(progress<1)bladeAnimation=requestAnimationFrame(animate);};
    bladeAnimation=requestAnimationFrame(animate);
  };
  stateToggle.addEventListener("click",()=>{model.closed=!model.closed;stateToggle.setAttribute("aria-pressed",String(model.closed));stateText.textContent=model.closed?"CLOSED":"OPEN";stateReadout.textContent=`BLADE POSITION · ${model.closed?"CLOSED":"OPEN"}`;setBladeAngle(model.closed?1.48:0.06);});
  labelsToggle.addEventListener("click",()=>{model.labels=!model.labels;labelsToggle.setAttribute("aria-pressed",String(model.labels));labelsToggle.lastElementChild.textContent=model.labels?"ON":"OFF";draw();});
  resetButton.addEventListener("click",()=>{model.yaw=-.52;model.pitch=.24;model.zoom=1;model.closed=false;model.labels=true;stateToggle.setAttribute("aria-pressed","false");stateText.textContent="OPEN";stateReadout.textContent="BLADE POSITION · OPEN";labelsToggle.setAttribute("aria-pressed","true");labelsToggle.lastElementChild.textContent="ON";setBladeAngle(0.06);draw();});
})();
