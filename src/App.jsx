import React, { useState, useEffect, useRef, useCallback } from 'react';

// Define the complex functions and their analytical mixed-axis solutions
const functions = {
  z2: {
    name: "f(z) = z²",
    description: "u = x² - y², v = 2xy",
    getStandard: (x, y) => ({ u: x * x - y * y, v: 2 * x * y }),
    getVectors: (x, u) => {
      const diff = x * x - u;
      if (diff < 0) return []; // Void: No real solution for y
      const y = Math.sqrt(diff);
      // Returns two branches (sheets)
      return [
        { y: y, v: 2 * x * y, branch: 0 },
        { y: -y, v: -2 * x * y, branch: 1 }
      ];
    }
  },
  z3: {
    name: "f(z) = z³",
    description: "u = x³ - 3xy², v = 3x²y - y³",
    getVectors: (x, u) => {
      if (Math.abs(x) < 0.001) return []; // Avoid singularity at x=0 for drawing purposes
      const diff = (x * x * x - u) / (3 * x);
      if (diff < 0) return []; // Void
      const y = Math.sqrt(diff);
      return [
        { y: y, v: 3 * x * x * y - y * y * y, branch: 0 },
        { y: -y, v: 3 * x * x * (-y) - (-y) * (-y) * (-y), branch: 1 }
      ];
    },
    getStandard: (x, y) => ({ u: x * x * x - 3 * x * y * y, v: 3 * x * x * y - y * y * y })
  },
  ez: {
    name: "f(z) = eᶻ",
    description: "u = eˣ cos(y), v = eˣ sin(y)",
    getVectors: (x, u) => {
      const cosY = u / Math.exp(x);
      if (Math.abs(cosY) > 1) return []; // Void
      const y = Math.acos(cosY); // Principal branch
      // We only show the principal branches k=0 for clarity, though infinitely many exist
      return [
        { y: y, v: Math.exp(x) * Math.sin(y), branch: 0 },
        { y: -y, v: Math.exp(x) * Math.sin(-y), branch: 1 }
      ];
    },
    getStandard: (x, y) => ({ u: Math.exp(x) * Math.cos(y), v: Math.exp(x) * Math.sin(y) })
  }
};

const colors = ["#06b6d4", "#ec4899", "#8b5cf6", "#eab308"]; // Cyan, Pink, Purple, Yellow

// A lightweight Complex Number class to handle f(z) mathematics
class Complex {
  constructor(re, im) { this.re = re; this.im = im; }
  add(c) { return new Complex(this.re + c.re, this.im + c.im); }
  sub(c) { return new Complex(this.re - c.re, this.im - c.im); }
  mul(c) { return new Complex(this.re * c.re - this.im * c.im, this.re * c.im + this.im * c.re); }
  div(c) {
    const den = c.re * c.re + c.im * c.im;
    if (den === 0) return new Complex(0,0);
    return new Complex((this.re * c.re + this.im * c.im) / den, (this.im * c.re - this.re * c.im) / den);
  }
  pow(c) {
    const r = Math.sqrt(this.re * this.re + this.im * this.im);
    if (r === 0) return new Complex(0,0);
    const theta = Math.atan2(this.im, this.re);
    const lnRe = Math.log(r);
    const lnIm = theta;
    const multRe = c.re * lnRe - c.im * lnIm;
    const multIm = c.re * lnIm + c.im * lnRe;
    const expR = Math.exp(multRe);
    return new Complex(expR * Math.cos(multIm), expR * Math.sin(multIm));
  }
  exp() {
    const r = Math.exp(this.re);
    return new Complex(r * Math.cos(this.im), r * Math.sin(this.im));
  }
  sin() {
    return new Complex(Math.sin(this.re) * Math.cosh(this.im), Math.cos(this.re) * Math.sinh(this.im));
  }
  cos() {
    return new Complex(Math.cos(this.re) * Math.cosh(this.im), -Math.sin(this.re) * Math.sinh(this.im));
  }
}

// Custom Shunting-Yard parser to evaluate string expressions like "z^2 + sin(z)"
const evaluateComplex = (expr, zRe, zIm) => {
  try {
    // Replace unary minus (e.g., "-z" -> "0-z") to keep parsing simple
    const cleanExpr = expr.replace(/(^|[(+\-*/^])\s*-/g, '$10-');
    const tokens = cleanExpr.match(/([a-zA-Z]+|\d+(?:\.\d+)?|\+|\-|\*|\/|\^|\(|\))/g);
    if (!tokens) return new Complex(0,0);

    const prec = {'+':1, '-':1, '*':2, '/':2, '^':3};
    const isRightAssoc = {'^':true};
    
    const outQ = [];
    const opStack = [];

    for (const t of tokens) {
      if (!isNaN(t)) {
        outQ.push(new Complex(parseFloat(t), 0));
      } else if (t === 'z') {
        outQ.push(new Complex(zRe, zIm));
      } else if (t === 'i') {
        outQ.push(new Complex(0, 1));
      } else if (['sin', 'cos', 'exp'].includes(t)) {
        opStack.push(t);
      } else if (prec[t]) {
        while (opStack.length > 0) {
          const top = opStack[opStack.length - 1];
          if (prec[top] > prec[t] || (prec[top] === prec[t] && !isRightAssoc[t])) {
            outQ.push(opStack.pop());
          } else {
            break;
          }
        }
        opStack.push(t);
      } else if (t === '(') {
        opStack.push(t);
      } else if (t === ')') {
        while (opStack.length > 0 && opStack[opStack.length - 1] !== '(') {
          outQ.push(opStack.pop());
        }
        opStack.pop(); 
        if (opStack.length > 0 && ['sin', 'cos', 'exp'].includes(opStack[opStack.length - 1])) {
          outQ.push(opStack.pop());
        }
      }
    }
    while (opStack.length > 0) outQ.push(opStack.pop());

    const evalStack = [];
    for (const t of outQ) {
      if (t instanceof Complex) {
        evalStack.push(t);
      } else {
        if (['sin', 'cos', 'exp'].includes(t)) {
          const a = evalStack.pop() || new Complex(0,0);
          evalStack.push(a[t]());
        } else {
          const b = evalStack.pop() || new Complex(0,0);
          const a = evalStack.pop() || new Complex(0,0);
          if (t === '+') evalStack.push(a.add(b));
          if (t === '-') evalStack.push(a.sub(b));
          if (t === '*') evalStack.push(a.mul(b));
          if (t === '/') evalStack.push(a.div(b));
          if (t === '^') evalStack.push(a.pow(b));
        }
      }
    }
    return evalStack[0] || new Complex(0,0);
  } catch (e) {
    return new Complex(0,0);
  }
};

// numerical root finder for custom mixed-axis functions
const findRoots = (uFunc, x, targetU, yMin = -10, yMax = 10, steps = 100) => {
  const roots = [];
  const dy = (yMax - yMin) / steps;
  let prevY = yMin;
  let prevVal = uFunc(x, prevY) - targetU;

  for (let i = 1; i <= steps; i++) {
    const y = yMin + i * dy;
    const val = uFunc(x, y) - targetU;
    
    if (val === 0) {
      roots.push(y);
    } else if (prevVal * val < 0) {
      let low = prevY;
      let high = y;
      let mid = low;
      for (let j = 0; j < 15; j++) {
        mid = (low + high) / 2;
        if ((uFunc(x, mid) - targetU) * prevVal > 0) {
          low = mid;
        } else {
          high = mid;
        }
      }
      roots.push(mid);
    }
    prevY = y;
    prevVal = val;
  }
  return roots;
};

export default function App() {
  const canvasRef = useRef(null);
  const reCanvasRef = useRef(null);
  const imCanvasRef = useRef(null);
  const [viewMode, setViewMode] = useState("mixed");
  const [selectedFn, setSelectedFn] = useState("z2");
  const [gridDensity, setGridDensity] = useState(25);
  const [vectorScale, setVectorScale] = useState(0.15);
  const [showVoids, setShowVoids] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [customFStr, setCustomFStr] = useState("z^2 + i*z");
  const [componentMode, setComponentMode] = useState("heatmap"); // "heatmap" | "realLine"
  
  const particlesRef = useRef([]);

  const activeFunction = React.useMemo(() => {
    if (selectedFn !== 'custom') return functions[selectedFn];
    
    // We create wrapper functions that pass (x, y) into our Complex evaluator
    const uFunc = (x, y) => evaluateComplex(customFStr, x, y).re;
    const vFunc = (x, y) => evaluateComplex(customFStr, x, y).im;

    return {
      name: "Custom",
      getStandard: (x, y) => {
        const c = evaluateComplex(customFStr, x, y);
        return { u: c.re, v: c.im };
      },
      getVectors: (x, u) => {
        const roots = findRoots(uFunc, x, u);
        return roots.map((y, i) => ({ y, v: vFunc(x, y), branch: i }));
      }
    };
  }, [selectedFn, customFStr]);

  const drawField = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Viewport bounds (-5 to 5 on both axes)
    const bounds = { xMin: -5, xMax: 5, uMin: -5, uMax: 5 };

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Coordinate mapping functions
    const mapX = (x) => ((x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * width;
    const mapVertical = (u) => height - ((u - bounds.uMin) / (bounds.uMax - bounds.uMin)) * height;

    // Draw grid & axes
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mapX(0), 0);
    ctx.lineTo(mapX(0), height);
    ctx.moveTo(0, mapVertical(0));
    ctx.lineTo(width, mapVertical(0));
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px monospace";
    
    if (viewMode === 'mixed') {
      ctx.fillText("u (Real Output)", width / 2 + 10, 20);
      ctx.fillText("x (Real Input)", width - 120, height / 2 - 10);
    } else {
      ctx.fillText("y (Imaginary Input)", width / 2 + 10, 20);
      ctx.fillText("x (Real Input)", width - 120, height / 2 - 10);
    }

    const fn = activeFunction;
    const dx = (bounds.xMax - bounds.xMin) / gridDensity;
    const du = (bounds.uMax - bounds.uMin) / gridDensity;

    // Draw Voids (background shading)
    if (showVoids && viewMode === 'mixed') {
      ctx.fillStyle = "rgba(15, 23, 42, 0.6)"; // Dark shading for voids
      for (let x = bounds.xMin; x <= bounds.xMax; x += dx / 2) {
        for (let u = bounds.uMin; u <= bounds.uMax; u += du / 2) {
          const vectors = fn.getVectors(x, u);
          if (vectors.length === 0) {
             const px = mapX(x);
             const pu = mapVertical(u);
             ctx.fillRect(px - 2, pu - 2, 4, 4);
          }
        }
      }
    }

    if (isAnimating) return; // Skip drawing static arrows when animating

    // Draw Vectors
    const drawArrow = (fromX, fromY, toX, toY, color) => {
      const headlen = 6;
      const dx = toX - fromX;
      const dy = toY - fromY;
      const angle = Math.atan2(dy, dx);
      
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1.5;
      
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
      ctx.lineTo(toX, toY);
      ctx.fill();
    };

    if (viewMode === 'mixed') {
      for (let x = bounds.xMin; x <= bounds.xMax; x += dx) {
        for (let u = bounds.uMin; u <= bounds.uMax; u += du) {
          const vectors = fn.getVectors(x, u);
          
          vectors.forEach((vec) => {
            const px = mapX(x);
            const pu = mapVertical(u);
            
            // Map the vector components (y, v) onto the canvas, scaled
            const vxPx = vec.y * vectorScale * (width / (bounds.xMax - bounds.xMin));
            // Note: subtract v because canvas Y is inverted
            const vuPx = vec.v * vectorScale * (height / (bounds.uMax - bounds.uMin));
            
            const color = colors[vec.branch % colors.length];
            drawArrow(px, pu, px + vxPx, pu - vuPx, color);
          });
        }
      }
    } else {
      for (let x = bounds.xMin; x <= bounds.xMax; x += dx) {
        for (let y = bounds.uMin; y <= bounds.uMax; y += du) {
          const vec = fn.getStandard(x, y);
          let { u, v } = vec;
          
          if (viewMode === 'polya') {
             v = -v;
          }
          
          const px = mapX(x);
          const py = mapVertical(y);
          
          // Map the vector components (u, v) onto the canvas, scaled
          const vxPx = u * vectorScale * (width / (bounds.xMax - bounds.xMin));
          const vyPx = v * vectorScale * (height / (bounds.uMax - bounds.uMin));
          
          drawArrow(px, py, px + vxPx, py - vyPx, colors[0]); // Cyan for standard fields
        }
      }
    }
  }, [activeFunction, gridDensity, vectorScale, showVoids, viewMode, isAnimating]);

  // Draws a scalar heatmap of either Re(f(z)) or Im(f(z)) over the (x, y) plane.
  // This is independent of viewMode / branch selection: it always evaluates the
  // standard f(z) = u + iv at each (x, y) and colors the cell by the chosen part.
  const drawComponentField = useCallback((canvas, part) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const bounds = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };

    ctx.clearRect(0, 0, width, height);

    const fn = activeFunction;
    const samples = Math.max(40, gridDensity * 2); // finer than the arrow grid for a smooth-looking heatmap
    const cellW = width / samples;
    const cellH = height / samples;
    const dxField = (bounds.xMax - bounds.xMin) / samples;
    const dyField = (bounds.yMax - bounds.yMin) / samples;

    // First pass: compute all values so we can normalize color intensity sensibly.
    const values = new Float64Array(samples * samples);
    let maxAbs = 1e-6;
    for (let j = 0; j < samples; j++) {
      const y = bounds.yMax - (j + 0.5) * dyField; // top row = max y
      for (let i = 0; i < samples; i++) {
        const x = bounds.xMin + (i + 0.5) * dxField;
        const std = fn.getStandard(x, y);
        const val = part === 're' ? std.u : std.v;
        const v = Number.isFinite(val) ? val : 0;
        values[j * samples + i] = v;
        const av = Math.abs(v);
        if (av > maxAbs && Number.isFinite(av)) maxAbs = av;
      }
    }
    // Clamp normalization so a few outliers don't wash out the whole map
    const norm = Math.min(maxAbs, 25);

    for (let j = 0; j < samples; j++) {
      for (let i = 0; i < samples; i++) {
        const v = values[j * samples + i];
        const t = Math.max(-1, Math.min(1, v / norm)); // -1..1

        // Diverging colormap: negative -> blue, zero -> near-black, positive -> red/orange
        let r, g, b;
        if (t >= 0) {
          r = Math.round(15 + t * 225);
          g = Math.round(23 + t * 70);
          b = Math.round(42 - t * 30);
        } else {
          const s = -t;
          r = Math.round(15 - s * 9);
          g = Math.round(23 + s * 95);
          b = Math.round(42 + s * 170);
        }
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(i * cellW, j * cellH, cellW + 1, cellH + 1);
      }
    }

    // Axes
    const mapX = (x) => ((x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * width;
    const mapY = (y) => height - ((y - bounds.yMin) / (bounds.yMax - bounds.yMin)) * height;
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mapX(0), 0);
    ctx.lineTo(mapX(0), height);
    ctx.moveTo(0, mapY(0));
    ctx.lineTo(width, mapY(0));
    ctx.stroke();

    // Zero contour: draw where sign flips between neighboring samples (cheap marching-squares-lite)
    ctx.fillStyle = "#0f172a";
    for (let j = 0; j < samples - 1; j++) {
      for (let i = 0; i < samples - 1; i++) {
        const v00 = values[j * samples + i];
        const v10 = values[j * samples + (i + 1)];
        const v01 = values[(j + 1) * samples + i];
        const signSet = new Set([Math.sign(v00), Math.sign(v10), Math.sign(v01)]);
        if (signSet.has(1) && signSet.has(-1)) {
          ctx.fillRect(i * cellW + cellW / 2 - 0.5, j * cellH + cellH / 2 - 0.5, 1, 1);
        }
      }
    }

    // Label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px monospace";
    ctx.fillText(part === 're' ? "Re(f(z)) = u(x,y)" : "Im(f(z)) = v(x,y)", 8, 18);
  }, [activeFunction, gridDensity]);

  // Draws a standard R -> R line graph: restricts z to the real axis (z = x + 0i)
  // and plots either Re(f(x)) or Im(f(x)) against x, exactly like a normal function plot.
  const drawRealLineGraph = useCallback((canvas, part) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const bounds = { xMin: -5, xMax: 5 };

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    const fn = activeFunction;
    const samples = Math.max(200, gridDensity * 10); // smooth curve, independent of arrow grid density
    const dxField = (bounds.xMax - bounds.xMin) / samples;

    const xs = new Float64Array(samples + 1);
    const ys = new Float64Array(samples + 1);
    let maxAbs = 1e-6;
    for (let i = 0; i <= samples; i++) {
      const x = bounds.xMin + i * dxField;
      const std = fn.getStandard(x, 0); // z = x + 0i, purely real input
      const val = part === 're' ? std.u : std.v;
      const v = Number.isFinite(val) ? val : NaN;
      xs[i] = x;
      ys[i] = v;
      if (Number.isFinite(v)) maxAbs = Math.max(maxAbs, Math.abs(v));
    }
    // Clamp the y-range so a single blow-up point doesn't flatten the whole curve
    const yRange = Math.min(maxAbs * 1.15, 50);
    const yBounds = { yMin: -yRange, yMax: yRange };

    const mapX = (x) => ((x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * width;
    const mapY = (y) => height - ((y - yBounds.yMin) / (yBounds.yMax - yBounds.yMin)) * height;

    // Gridlines
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    for (let gx = Math.ceil(bounds.xMin); gx <= bounds.xMax; gx++) {
      ctx.beginPath();
      ctx.moveTo(mapX(gx), 0);
      ctx.lineTo(mapX(gx), height);
      ctx.stroke();
    }
    const yStep = yRange > 10 ? Math.ceil(yRange / 5) : 1;
    for (let gy = Math.ceil(yBounds.yMin / yStep) * yStep; gy <= yBounds.yMax; gy += yStep) {
      ctx.beginPath();
      ctx.moveTo(0, mapY(gy));
      ctx.lineTo(width, mapY(gy));
      ctx.stroke();
    }

    // Axes (x-axis at y=0, y-axis at x=0)
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, mapY(0));
    ctx.lineTo(width, mapY(0));
    ctx.moveTo(mapX(0), 0);
    ctx.lineTo(mapX(0), height);
    ctx.stroke();

    // The curve itself — break the path wherever the value is non-finite (asymptotes)
    ctx.strokeStyle = part === 're' ? "#06b6d4" : "#ec4899";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= samples; i++) {
      const y = ys[i];
      if (!Number.isFinite(y) || Math.abs(y) > yBounds.yMax * 1.5) {
        started = false;
        continue;
      }
      const px = mapX(xs[i]);
      const py = mapY(y);
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();

    // Axis tick labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    for (let gx = Math.ceil(bounds.xMin); gx <= bounds.xMax; gx++) {
      if (gx === 0) continue;
      ctx.fillText(String(gx), mapX(gx) + 2, mapY(0) - 4);
    }
    ctx.fillText("0", mapX(0) + 4, mapY(0) + 12);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px monospace";
    ctx.fillText(
      part === 're' ? "Re(f(x)),  z = x + 0i" : "Im(f(x)),  z = x + 0i",
      8, 18
    );
  }, [activeFunction, gridDensity]);

  useEffect(() => {
    drawField();
    const drawSide = componentMode === 'heatmap' ? drawComponentField : drawRealLineGraph;
    drawSide(reCanvasRef.current, 're');
    drawSide(imCanvasRef.current, 'im');

    const handleResize = () => {
      drawField();
      drawSide(reCanvasRef.current, 're');
      drawSide(imCanvasRef.current, 'im');
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawField, drawComponentField, drawRealLineGraph, componentMode]);

  useEffect(() => {
    if (!isAnimating) return;

    let animationId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const bounds = { xMin: -5, xMax: 5, uMin: -5, uMax: 5 };

    const initParticle = () => ({
      x: bounds.xMin + Math.random() * (bounds.xMax - bounds.xMin),
      y: bounds.uMin + Math.random() * (bounds.uMax - bounds.uMin),
      age: 0,
      maxAge: 50 + Math.random() * 100,
      branch: Math.floor(Math.random() * 2)
    });

    if (particlesRef.current.length === 0) {
      particlesRef.current = Array.from({ length: 2000 }, initParticle);
    } else {
       particlesRef.current.forEach(p => Object.assign(p, initParticle()));
    }

    const animate = () => {
      ctx.fillStyle = "rgba(15, 23, 42, 0.12)"; // Fading effect for trails
      ctx.fillRect(0, 0, width, height);
      
      const fn = activeFunction;
      
      particlesRef.current.forEach(p => {
        let vx, vy;
        let speed = 0;
        
        if (viewMode === 'mixed') {
           const vectors = fn.getVectors(p.x, p.y); 
           const vec = vectors[p.branch % Math.max(1, vectors.length)];
           if (!vec) {
             p.age = p.maxAge; // kill particle in void
           } else {
             vx = vec.y;
             vy = vec.v;
           }
        } else {
           let vec = fn.getStandard(p.x, p.y);
           if (viewMode === 'polya') vec.v = -vec.v;
           vx = vec.u;
           vy = vec.v;
        }
        
        if (vx !== undefined && vy !== undefined) {
           speed = Math.sqrt(vx*vx + vy*vy);
           const dt = 0.015; // Time step
           
           const newX = p.x + vx * dt;
           const newY = p.y + vy * dt;
           
           const px = ((p.x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * width;
           const py = height - ((p.y - bounds.uMin) / (bounds.uMax - bounds.uMin)) * height;
           const npx = ((newX - bounds.xMin) / (bounds.xMax - bounds.xMin)) * width;
           const npy = height - ((newY - bounds.uMin) / (bounds.uMax - bounds.uMin)) * height;
           
           // Color by speed (magnitude) using HSL mapping
           const hue = Math.max(0, 240 - speed * 30); // 240 is blue (slow), 0 is red (fast)
           ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
           ctx.lineWidth = 1.5;
           ctx.beginPath();
           ctx.moveTo(px, py);
           ctx.lineTo(npx, npy);
           ctx.stroke();
           
           p.x = newX;
           p.y = newY;
        }
        
        p.age++;
        if (p.age > p.maxAge || p.x < bounds.xMin || p.x > bounds.xMax || p.y < bounds.uMin || p.y > bounds.uMax) {
           Object.assign(p, initParticle());
        }
      });
      
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(animationId);
  }, [isAnimating, activeFunction, viewMode]);

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans">
      <div className="p-6 border-b border-slate-700 bg-slate-800 shadow-md z-10">
        <h1 className="text-2xl font-bold text-white mb-2">Complex Vector Space Visualizer</h1>
        <p className="text-slate-400 text-sm mb-6 max-w-3xl">
          {viewMode === 'mixed' ? (
            <>Visualizing the space where position is defined by real parts <b>(x, u)</b> and vectors by imaginary parts <b>⟨y, v⟩</b>. Notice the "voids" where no vectors exist, and "multi-valued" regions where multiple colored arrows (different branches) sprout from the exact same point.</>
          ) : viewMode === 'polya' ? (
            <>Visualizing the <b>Pólya Vector Field</b>. Position is the complex input <b>(x, y)</b> and the vector is the conjugate output <b>⟨u, -v⟩</b>. This mapping magically creates perfectly zero-divergence and zero-curl ideal fluid flows.</>
          ) : (
            <>Visualizing the <b>Direct Vector Field</b>. Position is the complex input <b>(x, y)</b> and the vector is the direct output <b>⟨u, v⟩</b>. While intuitive, this mapping rarely describes elegant physical systems.</>
          )}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">View Mode</label>
            <select 
              className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 outline-none focus:border-cyan-400"
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
            >
              <option value="mixed">Mixed-Axis (x,u → y,v)</option>
              <option value="polya">Pólya Field (x,y → u,-v)</option>
              <option value="direct">Direct Field (x,y → u,v)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Complex Function</label>
            <select 
              className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 outline-none focus:border-cyan-400"
              value={selectedFn}
              onChange={(e) => setSelectedFn(e.target.value)}
            >
              {Object.entries(functions).map(([key, fn]) => (
                <option key={key} value={key}>{fn.name} : {fn.description}</option>
              ))}
              <option value="custom">Custom Function...</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Vector Scale: {vectorScale.toFixed(2)}
            </label>
            <input 
              type="range" 
              min="0.01" max="0.5" step="0.01" 
              value={vectorScale} 
              onChange={(e) => setVectorScale(parseFloat(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Grid Density: {gridDensity}
            </label>
            <input 
              type="range" 
              min="10" max="50" step="1" 
              value={gridDensity} 
              onChange={(e) => setGridDensity(parseInt(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          <div className="flex flex-col gap-2 justify-center">
            <label className="flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={isAnimating} 
                onChange={(e) => setIsAnimating(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500 relative"></div>
              <span className="ml-3 text-sm font-medium text-slate-300">Animate Flow</span>
            </label>

            {viewMode === 'mixed' && (
              <label className="flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showVoids} 
                  onChange={(e) => setShowVoids(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500 relative"></div>
                <span className="ml-3 text-sm font-medium text-slate-300">Highlight Voids</span>
              </label>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm font-medium text-slate-300">Side Panels:</span>
          <div className="inline-flex rounded-lg border border-slate-600 overflow-hidden">
            <button
              type="button"
              onClick={() => setComponentMode('heatmap')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                componentMode === 'heatmap'
                  ? 'bg-cyan-500 text-slate-900'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              2D Heatmap (x,y)
            </button>
            <button
              type="button"
              onClick={() => setComponentMode('realLine')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-slate-600 ${
                componentMode === 'realLine'
                  ? 'bg-cyan-500 text-slate-900'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Real-Axis Plot f(x)
            </button>
          </div>
          <span className="text-xs text-slate-500">
            {componentMode === 'heatmap'
              ? 'Shows Re(f) and Im(f) as color fields over the full complex plane.'
              : 'Restricts z to the real axis (z = x + 0i) and plots Re(f(x)), Im(f(x)) as ordinary R → R graphs.'}
          </span>
        </div>
        
        {selectedFn === 'custom' && (
          <div className="mt-4 bg-slate-800 p-4 rounded border border-slate-700">
            <label className="block text-sm font-medium text-slate-300 mb-2">Define Complex Function:</label>
            <div className="flex items-center">
              <span className="text-xl font-mono text-cyan-400 mr-3">f(z) =</span>
              <input 
                type="text" 
                value={customFStr} 
                onChange={e => setCustomFStr(e.target.value)} 
                className="flex-1 bg-slate-900 border border-slate-600 text-white rounded px-4 py-2 font-mono text-lg focus:border-cyan-400 outline-none" 
              />
            </div>
            <div className="mt-2 text-xs text-slate-500">
              * Use <b>z</b> as your variable and <b>i</b> for the imaginary unit. Use explicit multiplication (e.g., <b>2*z</b> instead of 2z). Supports <b>sin(z)</b>, <b>cos(z)</b>, <b>exp(z)</b>.
            </div>
          </div>
        )}

        {viewMode === 'mixed' && !isAnimating && (
          <div className="mt-4 flex gap-4 text-sm">
            <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-cyan-500 mr-2"></span> Branch 1 (+y solutions)</div>
            <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-pink-500 mr-2"></span> Branch 2 (-y solutions)</div>
          </div>
        )}
      </div>

      <div className="flex-1 relative bg-slate-950 overflow-hidden w-full h-full p-4 flex flex-col lg:flex-row gap-4 justify-center items-center">
        <div className="flex flex-col items-center gap-2 flex-1 min-w-0 h-full">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Combined Field</span>
          <canvas
            ref={canvasRef}
            width={800}
            height={800}
            className="bg-slate-900 border border-slate-700 shadow-2xl max-w-full max-h-full object-contain rounded"
          />
        </div>
        <div className="flex flex-col items-center gap-2 flex-1 min-w-0 h-full">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Real Part Only {componentMode === 'realLine' ? '— f(x), x real' : ''}
          </span>
          <canvas
            ref={reCanvasRef}
            width={500}
            height={500}
            className="bg-slate-900 border border-slate-700 shadow-2xl max-w-full max-h-full object-contain rounded"
          />
        </div>
        <div className="flex flex-col items-center gap-2 flex-1 min-w-0 h-full">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Imaginary Part Only {componentMode === 'realLine' ? '— f(x), x real' : ''}
          </span>
          <canvas
            ref={imCanvasRef}
            width={500}
            height={500}
            className="bg-slate-900 border border-slate-700 shadow-2xl max-w-full max-h-full object-contain rounded"
          />
        </div>
      </div>
    </div>
  );
}
