import React, { useEffect, useRef } from 'react';
import { isGameActive, onGameActive } from '../game/activity';

const Background = ({ children }) => {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animationFrameRef = useRef();

  class Particle {
    constructor(canvas) {
      this.canvas = canvas;
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.velocity = {
        x: (Math.random() - 0.5) , // Reduced speed
        y: (Math.random() - 0.5)   // Reduced speed
      };
      this.radius = 2;
    }

    update() {
      if (this.x + this.radius > this.canvas.width || this.x - this.radius < 0) {
        this.velocity.x = -this.velocity.x;
      }
      if (this.y + this.radius > this.canvas.height || this.y - this.radius < 0) {
        this.velocity.y = -this.velocity.y;
      }

      this.x += this.velocity.x;
      this.y += this.velocity.y;
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const particleCount = 40; // Reduced number of particles

    // The canvas is fixed to the viewport, so size it to the viewport.
    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    const mouse = { x: -9999, y: -9999 };
    const onMouseMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onMouseOut = () => { mouse.x = -9999; mouse.y = -9999; };
    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseOut);

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    // Create particles
    particlesRef.current = Array.from({ length: particleCount }, () => new Particle(canvas));

    const animate = () => {
      if (paused) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach(particle => {
        particle.update();

        // Link to the cursor and drift away from it.
        const md = Math.hypot(particle.x - mouse.x, particle.y - mouse.y);
        if (md > 0 && md < 160) {
          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(255, 120, 30, ${(1 - md / 160) * 0.45})`;
          ctx.stroke();
          particle.x += ((particle.x - mouse.x) / md) * 0.6;
          particle.y += ((particle.y - mouse.y) / md) * 0.6;
          particle.x = Math.min(Math.max(particle.x, particle.radius), canvas.width - particle.radius);
          particle.y = Math.min(Math.max(particle.y, particle.radius), canvas.height - particle.radius);
        }

        // Draw the glow
        const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, 15);
        gradient.addColorStop(0, 'rgba(255, 69, 0, 0.1)'); // Reduced opacity
        gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 15, 0, Math.PI * 2);
        ctx.fill();

        // Draw the particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 69, 0, 0.3)'; // Reduced opacity
        ctx.fill();

        // Draw connecting lines
        particlesRef.current.forEach(otherParticle => {
          const distance = Math.hypot(particle.x - otherParticle.x, particle.y - otherParticle.y);
          if (distance < 100) { // Reduced connection distance
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            const alpha = 1 - (distance / 100);
            ctx.strokeStyle = `rgba(255, 69, 0, ${alpha * 0.1})`; // Reduced opacity
            ctx.stroke();
          }
        });
      });

      // Draw triangles between nearby particles (fewer triangles)
      for (let i = 0; i < particlesRef.current.length - 2; i += 2) { // Increased step
        const p1 = particlesRef.current[i];
        for (let j = i + 1; j < particlesRef.current.length - 1; j += 2) { // Increased step
          const p2 = particlesRef.current[j];
          const d1 = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (d1 < 100) { // Reduced triangle formation distance
            for (let k = j + 1; k < particlesRef.current.length; k += 2) { // Increased step
              const p3 = particlesRef.current[k];
              const d2 = Math.hypot(p2.x - p3.x, p2.y - p3.y);
              const d3 = Math.hypot(p1.x - p3.x, p1.y - p3.y);
              if (d2 < 100 && d3 < 100) {
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.closePath();
                ctx.strokeStyle = 'rgba(255, 69, 0, 0.1)'; // Reduced opacity
                ctx.stroke();
              }
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Stop the particle loop entirely while Block Dodge is open.
    let paused = isGameActive();
    const setPaused = (value) => {
      if (value === paused) return;
      paused = value;
      if (paused) {
        cancelAnimationFrame(animationFrameRef.current);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        animate();
      }
    };
    const offActive = onGameActive(setPaused);
    if (!paused) animate();

    return () => {
      offActive();
      paused = true;
      window.removeEventListener('resize', updateCanvasSize);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseOut);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  return (
    <div className="relative min-h-screen">
      <div aria-hidden className="aurora pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: -2 }}>
        <span className="aurora-blob bg-orange-600/20" style={{ top: '-10%', left: '-10%' }} />
        <span className="aurora-blob bg-red-700/20" style={{ top: '40%', right: '-15%', animationDelay: '-7s' }} />
        <span className="aurora-blob bg-amber-500/10" style={{ bottom: '-20%', left: '30%', animationDelay: '-14s' }} />
      </div>
      <canvas
        ref={canvasRef}
        className="fixed top-0 left-0 w-full h-full pointer-events-none"
        style={{ zIndex: -1 }}
      />
      {children}
    </div>
  );
};

export default Background;