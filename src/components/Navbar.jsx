import { Menu, X, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { navItems } from "../constants";
import BinaryText from "./BinaryText";

const CustomCursor = () => {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { stiffness: 350, damping: 28, mass: 0.5 });
  const ringY = useSpring(y, { stiffness: 350, damping: 28, mass: 0.5 });
  const [isClicking, setIsClicking] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const move = (e) => {
      x.set(e.clientX);
      y.set(e.clientY);
      setIsHovering(!!e.target.closest?.('a, button, [role="button"]'));
    };
    const down = () => setIsClicking(true);
    const up = () => setIsClicking(false);
    document.addEventListener('mousemove', move);
    document.addEventListener('mousedown', down);
    document.addEventListener('mouseup', up);
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mousedown', down);
      document.removeEventListener('mouseup', up);
    };
  }, [x, y]);

  return (
    <>
      <motion.div
        className="fixed left-0 top-0 pointer-events-none z-[9999] rounded-full border-2 border-orange-500 mix-blend-screen"
        style={{ x: ringX, y: ringY, translateX: '-50%', translateY: '-50%' }}
        animate={{
          width: isHovering ? 56 : 32,
          height: isHovering ? 56 : 32,
          scale: isClicking ? 0.75 : 1,
          backgroundColor: isHovering ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0)',
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      />
      <motion.div
        className="fixed left-0 top-0 pointer-events-none z-[9999] h-2 w-2 rounded-full"
        style={{ x, y, translateX: '-50%', translateY: '-50%' }}
        animate={{ scale: isClicking ? 2 : 1, backgroundColor: isClicking ? '#ef4444' : '#f97316' }}
        transition={{ duration: 0.15 }}
      />
    </>
  );
};

// Only replace the cursor on devices with a real mouse.
const hasFinePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;

const Navbar = () => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      return savedTheme === 'dark' || 
        (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const handleNavigation = (e, href) => {
    e.preventDefault();
    const element = document.getElementById(href);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      setMobileDrawerOpen(false); // Close mobile menu after clicking
    }
  };

  const toggleNavbar = () => {
    setMobileDrawerOpen(!mobileDrawerOpen);
  };

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  return (
    <>
      {hasFinePointer() && (
        <>
          <CustomCursor />
          <style>{`* { cursor: none !important; }`}</style>
        </>
      )}
      <nav className={`sticky top-0 z-50 py-3 border-b transition-colors duration-300
        ${darkMode ? 'border-orange-500/20 bg-black/80' : 'border-neutral-200 bg-white/80'}
        backdrop-blur-lg`}>
        <div className="container px-4 mx-auto relative lg:text-sm">
          <div className="flex justify-between items-center">
            <div className="flex items-center flex-shrink-0">
              <span className={`text-xl tracking-tight 
                ${darkMode ? 'text-orange-100' : 'text-neutral-900'}`}>
                <BinaryText as="span" text="Aumkar Mali" band={2} speed={4} decodeMs={1000} />
              </span>
            </div>
            
            <div className="flex items-center gap-8">
              <ul className="hidden lg:flex space-x-12">
                {navItems.map((item, index) => (
                  <li key={index}>
                    <a 
                      href={`#${item.href}`}
                      onClick={(e) => handleNavigation(e, item.href)}
                      className={`transition-colors duration-300
                        ${darkMode 
                          ? 'text-orange-200 hover:text-orange-400' 
                          : 'text-neutral-600 hover:text-neutral-900'
                        }`}
                    >
                      <BinaryText as="span" text={item.label} band={1} speed={3} decodeMs={900} delay={index * 120} />
                    </a>
                  </li>
                ))}
              </ul>
              
              <button 
                onClick={toggleTheme} 
                className={`p-2 rounded-full transition-all duration-300
                  ${darkMode 
                    ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 hover:text-orange-300' 
                    : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                  }`}
                aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <button 
                onClick={toggleNavbar} 
                className={`lg:hidden transition-colors duration-300
                  ${darkMode ? 'text-orange-400' : 'text-neutral-700'}`}
              >
                {mobileDrawerOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>

          {mobileDrawerOpen && (
            <div className={`fixed inset-x-0 top-[calc(100%+1px)] z-20 p-6 
              flex flex-col items-center lg:hidden transition-colors duration-300
              ${darkMode 
                ? 'bg-gradient-to-b from-black to-neutral-900 border-b border-orange-500/20' 
                : 'bg-white border-b border-neutral-200'
              }`}>
              <ul className="flex flex-col space-y-4">
                {navItems.map((item, index) => (
                  <li key={index}>
                    <a 
                      href={`#${item.href}`}
                      onClick={(e) => handleNavigation(e, item.href)}
                      className={`text-lg transition-colors duration-300
                        ${darkMode 
                          ? 'text-orange-200 hover:text-orange-400' 
                          : 'text-neutral-600 hover:text-neutral-900'
                        }`}
                    >
                      <BinaryText as="span" text={item.label} band={1} speed={3} decodeMs={900} delay={index * 120} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </nav>
    </>
  );
};

export default Navbar;