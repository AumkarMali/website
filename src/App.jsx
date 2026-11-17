import { useState } from 'react';
import Navbar from "./components/Navbar";
import Intro from "./components/introductionPage";
import Footer from "./components/Footer";
import HeroSection from "./components/HeroSection";
import Projects from "./components/projectTimeline";
import Social from "./components/social";
import About from "./components/about";
import LoadingPage from './components/load';
import Background from './components/Background';
import CareerTimeline from './components/CareerTimeline';
import SkillRadar from './components/SkillRadar';
import { ScrollProgress } from './components/fx';

const App = () => {
  const [isLoading, setIsLoading] = useState(true);

  const handleLoadingComplete = () => {
    setIsLoading(false);
  };

  return (
    <>
      {isLoading ? (
        <LoadingPage onLoadingComplete={handleLoadingComplete} />
      ) : (
        <Background>
          <div className="min-h-screen bg-transparent">
            <ScrollProgress />
            <Navbar />
            <HeroSection />
            <About />
            <CareerTimeline />
            <Intro />
            <Projects />
            <SkillRadar />
            <Social />
            <Footer />
          </div>
        </Background>
      )}
    </>
  );
};

export default App;
