import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import HeadlineAnalyzer from './pages/HeadlineAnalyzer';
import ReadabilityScorer from './pages/ReadabilityScorer';
import ColorContrastChecker from './pages/ColorContrastChecker';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/tools/headline-analyzer" element={<HeadlineAnalyzer />} />
      <Route path="/tools/readability-scorer" element={<ReadabilityScorer />} />
      <Route path="/tools/color-contrast-checker" element={<ColorContrastChecker />} />
    </Routes>
  );
}

export default App;
