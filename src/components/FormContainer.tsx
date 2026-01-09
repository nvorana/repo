import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QuestionSlide from './QuestionSlide';

export interface Question {
  id: string;
  type: 'text' | 'email' | 'choice' | 'textarea';
  question: string;
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

interface FormContainerProps {
  questions: Question[];
  onSubmit: (answers: Record<string, string>) => void;
}

const FormContainer = ({ questions, onSubmit }: FormContainerProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for backward

  const currentQuestion = questions[currentStep];
  const isLastQuestion = currentStep === questions.length - 1;

  const handleNext = (answer: string) => {
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);

    if (isLastQuestion) {
      onSubmit(newAnswers);
    } else {
      setDirection(1);
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(currentStep - 1);
    }
  };

  const progress = ((currentStep + 1) / questions.length) * 100;

  return (
    <div className="h-full w-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex flex-col">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-white/20 z-50">
        <motion.div
          className="h-full bg-white"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Question Slides */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <QuestionSlide
            key={currentQuestion.id}
            question={currentQuestion}
            currentAnswer={answers[currentQuestion.id] || ''}
            onNext={handleNext}
            onBack={handleBack}
            showBack={currentStep > 0}
            isLastQuestion={isLastQuestion}
            questionNumber={currentStep + 1}
            totalQuestions={questions.length}
            direction={direction}
          />
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FormContainer;
