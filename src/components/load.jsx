import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import PropTypes from 'prop-types';

const ParticleLoadingPage = ({ onLoadingComplete }) => {
  const canvasRef = useRef(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const particlesRef = useRef([]);
  const animationFrameRef = useRef();

  // Particle class to manage individual particles
  class Particle {
    constructor(canvas) {
      this.canvas = canvas;
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.velocity = {
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2
      };
      this.radius = 3;
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

  // Initialize particles and animation
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const particleCount = 150;

    // Set canvas size
    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    // Create particles
    particlesRef.current = Array.from({ length: particleCount }, () => new Particle(canvas));

    // Animation function
    const animate = () => {
      // Clear the entire canvas each frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particlesRef.current.forEach(particle => {
        particle.update();

        // Draw particle
        ctx.beginPath();
        
        // Draw the glow
        const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, 15);
        gradient.addColorStop(0, 'rgba(255, 69, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.arc(particle.x, particle.y, 15, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw the particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#FF4500';
        ctx.fill();

        // Draw connecting lines
        particlesRef.current.forEach(otherParticle => {
          const distance = Math.hypot(particle.x - otherParticle.x, particle.y - otherParticle.y);
          if (distance < 150) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            const alpha = 1 - (distance / 150);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = `rgba(255, 69, 0, ${alpha * 0.3})`;
            ctx.stroke();
          }
        });
      });

      // Draw triangles between nearby particles
      for (let i = 0; i < particlesRef.current.length - 2; i++) {
        const p1 = particlesRef.current[i];
        for (let j = i + 1; j < particlesRef.current.length - 1; j++) {
          const p2 = particlesRef.current[j];
          const d1 = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (d1 < 150) {
            for (let k = j + 1; k < particlesRef.current.length; k++) {
              const p3 = particlesRef.current[k];
              const d2 = Math.hypot(p2.x - p3.x, p2.y - p3.y);
              const d3 = Math.hypot(p1.x - p3.x, p1.y - p3.y);
              if (d2 < 150 && d3 < 150) {
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.closePath();
                ctx.strokeStyle = 'rgba(255, 69, 0, 0.2)';
                ctx.stroke();
              }
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Loading progress simulation
    let startTime = Date.now();
    const totalDuration = 2500; // 2.5 seconds total loading time

    const loadingInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(Math.floor((elapsed / totalDuration) * 100), 100);
      
      setLoadingProgress(progress);
      
      if (progress === 100) {
        clearInterval(loadingInterval);
        setTimeout(() => {
          setIsLoaded(true);
          setTimeout(() => {
            if (onLoadingComplete) {
              onLoadingComplete();
            }
          }, 500); // Wait for fade out animation
        }, 1000); // Show 100% for a second
      }
    }, 50);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      cancelAnimationFrame(animationFrameRef.current);
      clearInterval(loadingInterval);
    };
  }, [onLoadingComplete]);

  return (
    <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        backgroundColor: 'black',
        transition: 'opacity 0.5s ease-out',
        opacity: isLoaded ? 0 : 1
      }}>
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full"
      />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
        <Loader2 
          className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4"
        />
        <div className="text-orange-500 text-xl font-bold">
          {loadingProgress}%
        </div>
      </div>
    </div>
  );
};

export default ParticleLoadingPage;

ParticleLoadingPage.propTypes = {
  onLoadingComplete: PropTypes.func.isRequired
};