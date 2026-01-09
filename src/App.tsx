import { useState } from 'react';
import FormContainer from './components/FormContainer';
import type { Question } from './components/FormContainer';
import SuccessScreen from './components/SuccessScreen';

// Sample questions - customize these for your needs
const sampleQuestions: Question[] = [
  {
    id: 'name',
    type: 'text',
    question: 'What is your name?',
    placeholder: 'John Doe',
    required: true,
  },
  {
    id: 'email',
    type: 'email',
    question: 'What is your email address?',
    placeholder: 'john@example.com',
    required: true,
  },
  {
    id: 'experience',
    type: 'choice',
    question: 'How would you describe your experience level?',
    options: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
    required: true,
  },
  {
    id: 'interests',
    type: 'choice',
    question: 'What interests you most?',
    options: [
      'Web Development',
      'Mobile Apps',
      'Data Science',
      'Machine Learning',
      'Design',
    ],
    required: true,
  },
  {
    id: 'feedback',
    type: 'textarea',
    question: 'Tell us more about what you are looking for',
    placeholder: 'Share your thoughts here',
    required: false,
  },
];

function App() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (answers: Record<string, string>) => {
    console.log('Form submitted:', answers);
    setIsSubmitted(true);

    // Here you would typically send the data to your backend
    // fetch('/api/submit', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(answers),
    // });
  };

  const handleReset = () => {
    setIsSubmitted(false);
  };

  return (
    <div className="h-screen w-screen overflow-hidden">
      {isSubmitted ? (
        <SuccessScreen onReset={handleReset} />
      ) : (
        <FormContainer questions={sampleQuestions} onSubmit={handleSubmit} />
      )}
    </div>
  );
}

export default App;
