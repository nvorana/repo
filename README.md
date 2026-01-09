# Interactive Form - Typeform-Inspired Web App

A modern, mobile-first web application with smooth animations and an engaging one-question-at-a-time flow, inspired by Typeform's user experience.

## Features

- **One-Question-at-a-Time Flow**: Focused user experience that guides users through each question sequentially
- **Smooth Animations**: Framer Motion-powered transitions that feel natural and engaging
- **Mobile-First Design**: Optimized for mobile devices with touch-friendly interactions
- **Progress Tracking**: Visual progress bar showing completion status
- **Multiple Question Types**:
  - Text input
  - Email input
  - Multiple choice (with instant selection)
  - Textarea for long-form responses
- **Keyboard Navigation**: Press Enter to advance through questions
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Beautiful Gradients**: Eye-catching color schemes that enhance the visual experience

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Smooth animations

## Getting Started

### Prerequisites

- Node.js 16+ installed
- npm or yarn package manager

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`)

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory, ready to deploy to any static hosting service.

## Customizing the Form

### Adding/Modifying Questions

Edit the `sampleQuestions` array in `src/App.tsx`:

```typescript
const sampleQuestions: Question[] = [
  {
    id: 'unique-id',
    type: 'text', // 'text' | 'email' | 'choice' | 'textarea'
    question: 'Your question here?',
    placeholder: 'Optional placeholder',
    required: true,
    options: ['Option 1', 'Option 2'], // Only for type: 'choice'
  },
  // Add more questions...
];
```

### Handling Form Submissions

The `handleSubmit` function in `src/App.tsx` receives all answers when the form is completed:

```typescript
const handleSubmit = (answers: Record<string, string>) => {
  console.log('Form submitted:', answers);

  // Send to your backend
  fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(answers),
  });
};
```

### Customizing Colors

Update the gradient colors in:
- `src/components/FormContainer.tsx` - Main form background
- `src/components/SuccessScreen.tsx` - Success screen background
- `tailwind.config.js` - Global theme colors

## Project Structure

```
src/
├── components/
│   ├── FormContainer.tsx      # Main form wrapper with state management
│   ├── QuestionSlide.tsx      # Individual question component
│   └── SuccessScreen.tsx      # Completion screen
├── App.tsx                     # Main application component
├── main.tsx                    # Application entry point
└── index.css                   # Global styles with Tailwind
```

## Performance Considerations

With 150-300 daily submissions, consider:

1. **Backend Integration**: Set up a proper API endpoint to handle submissions
2. **Database**: Use PostgreSQL, MongoDB, or a service like Supabase/Firebase
3. **Analytics**: Track completion rates and drop-off points
4. **Validation**: Add server-side validation for all inputs
5. **Rate Limiting**: Prevent spam submissions
6. **Error Handling**: Add retry logic for failed submissions

## Mobile Optimization

The app is optimized for mobile with:
- Touch-friendly button sizes (minimum 44x44px)
- Disabled pinch-to-zoom for app-like experience
- Apple mobile web app meta tags
- Responsive font sizes and spacing
- Smooth touch interactions

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Next Steps

1. Set up a backend API for form submissions
2. Add database to store responses
3. Create an admin dashboard to view submissions
4. Add conditional logic (skip questions based on answers)
5. Implement form analytics
6. Add multi-language support

## License

MIT
