import { Link } from 'react-router-dom';
import { Users, HandHeart, Calendar, Shield, ArrowRight, Heart, ChevronDown } from 'lucide-react';
import useReveal from '../../hooks/useReveal.js';

const FEATURES = [
  {
    icon: Users,
    title: 'Gestion des membres',
    desc: 'Suivi complet des membres, leurs rôles et participations.'
  },
  {
    icon: HandHeart,
    title: 'Finances transparentes',
    desc: 'Cotisations, dons et collectes suivis en temps réel.'
  },
  {
    icon: Calendar,
    title: 'Réunions & comptes rendus',
    desc: 'Planification des réunions et suivi des présences.'
  },
  {
    icon: Shield,
    title: 'Rôles & permissions',
    desc: 'Accès sécurisé avec gestion des droits par rôle.'
  }
];

function FeatureCard({ f, i }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} group relative overflow-hidden rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 p-6 shadow-sm hover:shadow-lg hover:shadow-primary-900/5 hover:border-amber-300/50 dark:hover:border-amber-500/30 transition-[box-shadow,border-color,transform] hover:-translate-y-1`}
      style={{ transitionDelay: visible ? `${i * 90}ms` : '0ms' }}
    >
      <span className="absolute top-4 right-5 text-3xl font-black text-gray-100 dark:text-gray-800 select-none">
        {String(i + 1).padStart(2, '0')}
      </span>
      <div className="relative mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-100 to-amber-100 dark:from-primary-900/40 dark:to-amber-900/20 text-primary-700 dark:text-primary-400 ring-1 ring-amber-400/0 group-hover:ring-amber-400/40 transition-all group-hover:-rotate-6 group-hover:scale-110">
        <f.icon className="h-6 w-6" />
      </div>
      <h3 className="relative text-base font-bold text-gray-900 dark:text-white">{f.title}</h3>
      <p className="relative mt-1.5 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
    </div>
  );
}

function FeaturesSection() {
  const [headingRef, headingVisible] = useReveal();
  return (
    <section id="fonctionnalites" className="bg-gray-50 dark:bg-gray-950 py-20 px-6 scroll-mt-4">
      <div className="mx-auto max-w-5xl">
        <div ref={headingRef} className={`reveal ${headingVisible ? 'is-visible' : ''} text-center mb-14`}>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Tout pour gérer notre fondation
          </h2>
          <p className="mt-3 text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
            Un outil simple et efficace pour coordonner nos activités et notre financement.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} f={f} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

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

        {/* Texture géométrique subtile */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
          <pattern id="star-grid" width="56" height="56" patternUnits="userSpaceOnUse">
            <path d="M28 14l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="none" stroke="#fff" strokeWidth="1" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#star-grid)" />
        </svg>

        {/* Grain fin — texture premium discrète */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.035] mix-blend-overlay pointer-events-none">
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>

        <div className="relative z-10 mx-auto max-w-4xl px-6 py-24 text-center">
          <div className="landing-fade mb-8 flex items-center justify-center">
            <div className="relative">
              <div className="pulse-ring absolute inset-0 rounded-3xl bg-amber-300/25" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-white p-2.5 shadow-2xl shadow-black/30 ring-1 ring-white/40">
                <img src="/logo.jpeg" alt="Fondation 18 Safar" className="h-full w-full object-contain rounded-2xl" />
              </div>
            </div>
          </div>

          <h1 className="landing-fade-delay-1 text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter text-white">
            Fondation
            <span className="block bg-gradient-to-r from-amber-200 via-white to-amber-200 bg-clip-text text-transparent text-shimmer">
              18 Safar
            </span>
          </h1>

          <p className="landing-fade-delay-2 mx-auto mt-6 max-w-xl text-lg text-primary-100/80 leading-relaxed">
            La plateforme de gestion collaborative pour les membres de la fondation.
            Suivez vos cotisations, participez aux réunions et contribuez à notre mission.
          </p>

          <div className="landing-fade-delay-3 mt-10 flex flex-col items-center gap-3">
            <Link
              to="/login"
              className="group btn-shine inline-flex items-center gap-2.5 rounded-2xl bg-white px-8 py-4 text-base font-bold text-primary-700 shadow-2xl shadow-black/20 transition-all hover:bg-primary-50 hover:shadow-black/30 hover:scale-105"
            >
              Se connecter
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <p className="text-xs text-primary-100/50">Accès réservé aux membres de la fondation</p>

            {/* Indicateur de scroll — dans le flux, aligné et toujours sous le bouton */}
            <a
              href="#fonctionnalites"
              className="mt-6 text-white/50 hover:text-white/80 transition-colors"
              aria-label="Voir les fonctionnalités"
            >
              <span className="float-animation flex flex-col items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-widest">Découvrir</span>
                <ChevronDown className="h-4 w-4" />
              </span>
            </a>
          </div>
        </div>

        {/* Decorative wave */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-14 sm:h-16 md:h-20 block">
            <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" className="fill-gray-50 dark:fill-gray-950"/>
          </svg>
          <div className="h-[3px] bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
        </div>
      </section>

      {/* Features */}
      <FeaturesSection />

      {/* Footer */}
      <footer className="relative bg-gray-50 dark:bg-gray-950 border-t border-gray-200/70 dark:border-gray-800 py-8 px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-24 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-gray-400 dark:text-gray-600">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-800 overflow-hidden">
              <img src="/logo-transparent.png" alt="" className="h-full w-full object-contain" />
            </div>
            <span className="text-sm">&copy; {new Date().getFullYear()} Fondation 18 Safar</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-600">
            Fait avec <Heart className="h-3.5 w-3.5 text-red-400 fill-red-400" /> pour la communauté
          </div>
        </div>
      </footer>
    </div>
  );
}