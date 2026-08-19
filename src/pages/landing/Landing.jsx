import { Link } from 'react-router-dom';
import { Landmark, Users, HandHeart, Calendar, Shield, ArrowRight, Heart } from 'lucide-react';

const FEATURES = [
  {
    icon: Users,
    title: 'Gestion des membres',
    desc: 'Suivi complet des membres, leurs roles et participations.'
  },
  {
    icon: HandHeart,
    title: 'Finances transparentes',
    desc: 'Cotisations, dons et collectes suivis en temps reel.'
  },
  {
    icon: Calendar,
    title: 'Reunions & comptes rendus',
    desc: 'Planification des reunions et suivi des presences.'
  },
  {
    icon: Shield,
    title: 'Roles & permissions',
    desc: 'Acces securise avec gestion des droits par role.'
  }
];

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="relative flex-1 flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 gradient-shift">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-6 py-20 text-center">
          <div className="landing-fade mb-8 inline-flex items-center justify-center">
            <div className="relative">
              <div className="pulse-ring absolute inset-0 rounded-3xl bg-white/20" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white/15 backdrop-blur-sm shadow-2xl shadow-black/20 border border-white/20">
                <Landmark className="h-10 w-10 text-white" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          <h1 className="landing-fade-delay-1 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white">
            Fondation
            <span className="block bg-gradient-to-r from-white via-primary-100 to-primary-200 bg-clip-text text-transparent">
              18 Safar
            </span>
          </h1>

          <p className="landing-fade-delay-2 mx-auto mt-6 max-w-xl text-lg text-primary-100/80 leading-relaxed">
            La plateforme de gestion collaborative pour les membres de la fondation. 
            Suivez vos cotisations, participez aux reunions et contribuez a notre mission.
          </p>

          <div className="landing-fade-delay-3 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="group inline-flex items-center gap-2.5 rounded-2xl bg-white px-8 py-4 text-base font-bold text-primary-700 shadow-2xl shadow-black/20 transition-all hover:bg-primary-50 hover:shadow-black/30 hover:scale-105"
            >
              Se connecter
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* Decorative wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" className="fill-gray-50 dark:fill-gray-950"/>
          </svg>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 dark:bg-gray-950 py-20 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="landing-slide-up text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Tout pour gerger notre fondation
            </h2>
            <p className="mt-3 text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
              Un outil simple et efficace pour coordonner les activities et financement.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="landing-slide-up group rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
                style={{ animationDelay: `${0.55 + i * 0.1}s` }}
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 group-hover:bg-primary-200 dark:group-hover:bg-primary-800/40 transition-colors">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">{f.title}</h3>
                <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-950 border-t border-gray-200/70 dark:border-gray-800 py-8 px-6">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-600">
            <Landmark className="h-4 w-4" />
            <span className="text-sm">&copy; {new Date().getFullYear()} Fondation 18 Safar</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-600">
            Fait avec <Heart className="h-3.5 w-3.5 text-red-400 fill-red-400" /> pour la communaute
          </div>
        </div>
      </footer>
    </div>
  );
}
