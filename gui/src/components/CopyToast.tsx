import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';

export function CopyToast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none absolute right-5 top-5 z-20 flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-100 shadow-lg shadow-emerald-500/10"
        >
          <span className="rounded-full bg-emerald-500/20 p-1 text-emerald-200">
            <Check size={12} />
          </span>
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
