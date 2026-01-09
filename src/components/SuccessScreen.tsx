import { motion } from 'framer-motion';

interface SuccessScreenProps {
  onReset?: () => void;
}

const SuccessScreen = ({ onReset }: SuccessScreenProps) => {
  return (
    <div className="h-full w-full bg-gradient-to-br from-green-400 via-teal-500 to-blue-500 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="bg-white rounded-2xl shadow-2xl p-8 sm:p-12 md:p-16 max-w-2xl text-center"
      >
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="mx-auto w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6"
        >
          <svg
            className="w-12 h-12 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </motion.div>

        {/* Success Message */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4"
        >
          Thank you!
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-lg text-gray-600 mb-8"
        >
          Your response has been recorded successfully.
        </motion.p>

        {onReset && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            onClick={onReset}
            className="px-8 py-3 bg-indigo-500 text-white rounded-full font-medium hover:bg-indigo-600 shadow-lg hover:shadow-xl transition-all"
          >
            Submit another response
          </motion.button>
        )}
      </motion.div>
    </div>
  );
};

export default SuccessScreen;
