import { useState } from 'react';
import { CombinedUpload } from './components/CombinedUpload';
import { TailoredResumeView } from './components/TailoredResumeView';
import { ParsedResume, TailoredData } from './types';

type AppView = 'upload' | 'tailored';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('upload');
  const [resume, setResume] = useState<ParsedResume | null>(null);
  const [tailoredData, setTailoredData] = useState<TailoredData | null>(null);

  const handleTailoringComplete = (resumeData: ParsedResume, tailored: TailoredData) => {
    setResume(resumeData);
    setTailoredData(tailored);
    setCurrentView('tailored');
  };

  const handleBackToUpload = () => {
    setCurrentView('upload');
    setResume(null);
    setTailoredData(null);
  };

  return (
    <div className="App">
      {currentView === 'upload' && (
        <CombinedUpload onTailoringComplete={handleTailoringComplete} />
      )}
      
      {currentView === 'tailored' && resume && tailoredData && (
        <TailoredResumeView
          resume={resume}
          tailoredData={tailoredData}
          onBack={handleBackToUpload}
        />
      )}
    </div>
  );
}

export default App;
