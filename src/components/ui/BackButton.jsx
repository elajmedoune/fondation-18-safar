import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function BackButton({ to = '/', label = 'Retour' }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-4"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}
