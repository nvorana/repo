import { useState, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import type { Question } from './FormContainer';

interface QuestionSlideProps {
  question: Question;
  currentAnswer: string;
  onNext: (answer: string) => void;
  onBack: () => void;
  showBack: boolean;
  isLastQuestion: boolean;
  questionNumber: number;
  totalQuestions: number;
  direction: number;
}

const QuestionSlide = ({
  question,
  currentAnswer,
  onNext,
  onBack,
  showBack,
  isLastQuestion,
  questionNumber,
  totalQuestions,
  direction,
}: QuestionSlideProps) => {
  const [answer, setAnswer] = useState(currentAnswer);

  useEffect(() => {
    setAnswer(currentAnswer);
  }, [currentAnswer]);

  const handleSubmit = () => {
    if (answer.trim() || !question.required) {
      onNext(answer);
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && question.type !== 'textarea') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -1000 : 1000,
      opacity: 0,
    }),
  };

  return (
    <motion.div
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{
        x: { type: 'spring', stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
      }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 md:p-12">
        {/* Question Number */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-sm font-medium text-gray-400 mb-4"
        >
          {questionNumber} → {totalQuestions}
        </motion.div>

        {/* Question Text */}
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-8"
        >
          {question.question}
        </motion.h2>

        {/* Input Field */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {question.type === 'choice' && question.options ? (
            <div className="space-y-3">
              {question.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setAnswer(option);
                    setTimeout(() => onNext(option), 200);
                  }}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                    answer === option
                      ? 'border-indigo-500 bg-indigo-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <span className="text-lg font-medium text-gray-700">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="ml-4 text-lg text-gray-800">{option}</span>
                </button>
              ))}
            </div>
          ) : question.type === 'textarea' ? (
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={question.placeholder || 'Type your answer here...'}
              className="w-full p-4 text-lg border-b-2 border-gray-300 focus:border-indigo-500 outline-none transition-colors resize-none"
              rows={4}
              autoFocus
            />
          ) : (
            <input
              type={question.type}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={question.placeholder || 'Type your answer here...'}
              className="w-full p-4 text-lg border-b-2 border-gray-300 focus:border-indigo-500 outline-none transition-colors"
              autoFocus
            />
          )}
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-between mt-8"
        >
          {showBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span className="font-medium">Back</span>
            </button>
          )}

          {question.type !== 'choice' && (
            <button
              onClick={handleSubmit}
              disabled={question.required && !answer.trim()}
              className={`ml-auto flex items-center gap-2 px-8 py-3 rounded-full font-medium transition-all ${
                question.required && !answer.trim()
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg hover:shadow-xl'
              }`}
            >
              <span>{isLastQuestion ? 'Submit' : 'OK'}</span>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </button>
          )}
        </motion.div>

        {/* Keyboard Hint */}
        {question.type !== 'choice' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 text-center text-sm text-gray-400"
          >
            Press <kbd className="px-2 py-1 bg-gray-100 rounded">Enter ↵</kbd>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default QuestionSlide;
