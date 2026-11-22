import { AnimatePresence, motion } from 'framer-motion';
import { TypeAnimation } from 'react-type-animation';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Gamepad2, Loader2 } from 'lucide-react';
import Game from './Game';
import { useGameActive } from '../game/activity';
import { LINKEDIN_URL } from '../constants';
import { Magnetic, TiltCard } from './fx';

const VideoPlayer = ({ src, loop = false, onClick, badge }) => {
  const [loadingState, setLoadingState] = useState('loading');
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const play = () => video.play().catch(() => {});
    const ready = () => setLoadingState('ready');
    video.addEventListener('loadedmetadata', play);
    video.addEventListener('canplay', ready);
    video.load();
    return () => {
      video.removeEventListener('loadedmetadata', play);
      video.removeEventListener('canplay', ready);
    };
  }, []);

  return (
    <div
      className={`relative w-[45%] mx-2 group rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-4 focus-visible:ring-offset-black ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-red-500/30 to-orange-500/30 rounded-lg blur-2xl transform scale-110 -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <TiltCard max={8} className="rounded-lg">
        {loadingState === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg z-20">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        )}
        <video
          ref={videoRef}
          muted
          playsInline
          loop={loop}
          className={`rounded-lg border border-orange-700 w-full relative z-10 transition-shadow duration-300 group-hover:shadow-lg group-hover:shadow-orange-500/50 ${
            loadingState === 'ready' ? 'opacity-100' : 'opacity-0'
          }`}
          preload="metadata"
        >
          <source src={src} type="video/webm" />
          Your browser does not support the video tag.
        </video>
        {badge && (
          <div className="absolute inset-0 z-20 flex items-end justify-center p-4 pointer-events-none">
            <span className="flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-orange-200 backdrop-blur-md border border-orange-500/40 shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-transform duration-300 group-hover:scale-110 animate-pulse group-hover:animate-none">
              <Gamepad2 size={16} />
              <span className="hidden sm:inline">{badge}</span>
              <span className="sm:hidden">Play</span>
            </span>
          </div>
        )}
      </TiltCard>
    </div>
  );
};

const buttons = [
  { label: 'GitHub', href: 'https://github.com/AumkarMali', className: 'from-blue-500 to-blue-700 dark:to-transparent px-5' },
  { label: 'YouTube', href: 'https://www.youtube.com/@AumkarMali', className: 'from-red-500 to-red-700 dark:to-transparent px-4' },
  { label: 'LinkedIn', href: LINKEDIN_URL, className: 'from-orange-500 to-orange-700 dark:to-transparent px-4' },
];

const HeroSection = () => {
  const [showGame, setShowGame] = useState(false);
  const gameActive = useGameActive(); // stop the floating chevron while playing

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 2 }}
      id="start"
      className="flex flex-col items-center mt-6 lg:mt-20"
    >
      <AnimatePresence>{showGame && <Game onClose={() => setShowGame(false)} />}</AnimatePresence>

      <motion.h1
        className="text-4xl sm:text-6xl lg:text-7xl text-center tracking-wide"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 2 }}
      >
        <TypeAnimation
          sequence={['Developer Portfolio', 1000]}
          wrapper="span"
          speed={20}
          style={{ fontSize: '1em' }}
          repeat={false}
        />
        <span className="name-gradient bg-gradient-to-r from-red-500 via-orange-500 to-red-900 text-transparent bg-clip-text">
          {' '}Aumkar Mali
        </span>
      </motion.h1>

      <motion.div
        className="flex justify-center my-10"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.15, delayChildren: 0.6 } } }}
      >
        {buttons.map((b) => (
          <motion.div
            key={b.label}
            variants={{ hidden: { opacity: 0, y: 30, scale: 0.8 }, show: { opacity: 1, y: 0, scale: 1 } }}
            className="mx-3"
          >
            <Magnetic>
              <a
                href={b.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`shine block bg-gradient-to-r ${b.className} py-3 rounded-md text-white transition-all duration-300 hover:shadow-[0_0_25px_rgba(249,115,22,0.5)]`}
              >
                {b.label}
              </a>
            </Magnetic>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        className="flex mt-10 justify-center relative w-full"
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <VideoPlayer src="/assets/video1.webm" loop />
        <VideoPlayer src="/assets/video2.webm" loop onClick={() => setShowGame(true)} badge="Click to play Block Dodge" />
      </motion.div>

      <motion.button
        onClick={() => document.getElementById('aboutSec')?.scrollIntoView({ behavior: 'smooth' })}
        className="mt-16 mb-8 flex flex-col items-center gap-1 text-orange-700/80 hover:text-orange-800 dark:text-orange-300/70 dark:hover:text-orange-300"
        animate={gameActive ? { y: 0 } : { y: [0, 10, 0] }}
        transition={gameActive ? { duration: 0 } : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        aria-label="Scroll to About"
      >
        <span className="text-xs tracking-[0.3em]">SCROLL</span>
        <ChevronDown />
      </motion.button>
    </motion.div>
  );
};

export default HeroSection;
