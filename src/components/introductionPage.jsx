import { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { TypeAnimation } from 'react-type-animation';  // Importing the TypeAnimation component

const IntroductionPage = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.2,
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Every couple of seconds two random tiles trade places (framer layout animation).
  const reduceMotion = useReducedMotion();
  const [order, setOrder] = useState(() => Array.from({ length: 12 }, (_, i) => i));
  const [swapping, setSwapping] = useState([]);
  const orderRef = useRef(order);
  orderRef.current = order;
  useEffect(() => {
    if (!isVisible || reduceMotion) return;
    let clear;
    const swap = () => {
      const a = Math.floor(Math.random() * 12);
      let b = Math.floor(Math.random() * 11);
      if (b >= a) b += 1;
      const current = orderRef.current;
      setSwapping([current[a], current[b]]);
      setOrder((prev) => {
        const next = [...prev];
        [next[a], next[b]] = [next[b], next[a]];
        return next;
      });
      clearTimeout(clear);
      clear = setTimeout(() => setSwapping([]), 1000);
    };
    let interval;
    const start = setTimeout(() => {
      swap();
      interval = setInterval(swap, 2200);
    }, 3000); // after the tiles finish fading in
    return () => {
      clearTimeout(start);
      clearInterval(interval);
      clearTimeout(clear);
    };
  }, [isVisible, reduceMotion]);

  const skills = [
    { src: '/images/javascript-logo.png', alt: 'JavaScript', label: 'JavaScript' },
    { src: '/images/python-logo.png', alt: 'Python', label: 'Python' },
    { src: '/images/java-logo.png', alt: 'Java', label: 'Java' },
    { src: '/images/cpp-logo.webp', alt: 'C++', label: 'C++' },
    { src: '/images/React-logo.webp', alt: 'React', label: 'React' },
    { src: '/images/tailwind-logo.png', alt: 'Tailwind CSS', label: 'Tailwind CSS' },
    { src: '/images/flask-logo.png', alt: 'Flask', label: 'Flask' },
    { src: '/images/Linux-Logo.png', alt: 'Linux', label: 'Linux' },
    { src: '/images/raspberry-logo.png', alt: 'Raspberry Pi', label: 'Raspberry Pi' },
    { src: '/images/arduino-logo.png', alt: 'Arduino', label: 'Arduino' },
    { src: '/images/kivy-logo.png', alt: 'Kivy', label: 'Kivy' },
    { src: '/images/Matlab_Logo.png', alt: 'MATLAB', label: 'MATLAB' },
  ];

  return (
    <div
      ref={sectionRef}
      id="feature-section"
      className="relative mt-35 border-b border-neutral-800 min-h-[400px]"
    >
      <style jsx>{`
        @keyframes gradientBG {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        .animated-bg {
          background: linear-gradient(
            45deg, 
            rgba(59, 130, 246, 0.1),
            rgba(16, 185, 129, 0.1),
            rgba(99, 102, 241, 0.1)
          );
          background-size: 200% 200%;
          animation: gradientBG 15s ease infinite;
        }

        .card-hover {
          position: relative;
          overflow: hidden;
        }

        .card-hover::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 200%;
          height: 100%;
          background: linear-gradient(
            115deg,
            transparent,
            rgba(255, 255, 255, 0.3),
            transparent
          );
          transform: translateX(-100%);
        }

        .card-hover:hover::before {
          transition: transform 0.8s;
          transform: translateX(100%);
        }

        /* Neon Orange Glow Effect */
        .neon-text {
          color: white; /* Neon Orange */
          text-shadow: 0 0 5px #ff6f00, 0 0 10px #ff6f00, 0 0 20px #ff6f00, 0 0 30px #ff6f00, 0 0 40px #ff6f00;
        }
      `}</style>

      <div className="text-left px-5 sm:px-20 md:px-40">
        <h3 className="text-2xl sm:text-5xl lg:text-3xl mt-10 lg:mt-20 tracking-wide text-center opacity-80">
          {/* Add TypeAnimation for the "Technical Skills" text */}
          {isVisible && (
            <TypeAnimation
              sequence={[
                'Technical Skills', // Typing out "Technical Skills"
                1000, // Pause for 1s after typing
              ]}
              wrapper="span"
              speed={30} // Speed of typing
              style={{ fontSize: '2em' }} // Style of the typed text
              repeat={false} // Do not repeat the animation
              className="neon-text" // Apply the neon text class
            />
          )}
        </h3>

        <div className="mt-5 mb-48 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {order.map((index) => {
            const item = skills[index];
            const isSwapping = swapping.includes(index);
            return (
              <motion.div
                key={item.label}
                layout
                transition={{ type: 'spring', stiffness: 120, damping: 16, mass: 0.8 }}
                style={{ zIndex: isSwapping ? 10 : 0, position: 'relative' }}
              >
                <div
                  className={`flex flex-col items-center justify-center h-24 
                    bg-white/30 backdrop-blur-sm text-gray-500 rounded-lg shadow-lg 
                    transition-all duration-700 transform card-hover animated-bg
                    hover:shadow-xl hover:scale-105
                    ${isSwapping ? 'ring-2 ring-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.7)]' : ''}
                    ${isVisible 
                      ? 'opacity-100 translate-y-0 scale-100' 
                      : 'opacity-0 translate-y-10 scale-95'}`}
                  style={{
                    transitionDelay: `${index * 130}ms`,
                  }}
                >
                  <div className="relative z-10">
                    <img src={item.src} alt={item.alt} className="h-12 w-auto" />
                    <span className="text-xl mt-2">{item.label}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default IntroductionPage;
