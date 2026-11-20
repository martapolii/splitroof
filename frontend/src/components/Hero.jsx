import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Hero.css';

const DEFAULT_PHRASES = [
  'Split the rent',
  'Shared bills',
  'Fair shares',
];

const CYCLE_MS = 2600;

const HeroLink = ({ to, children }) => {
  const isHash = typeof to === 'string' && to.startsWith('#');

  const scrollToSection = (event) => {
    const target = document.querySelector(to);
    if (!target) return;
    event.preventDefault();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  if (isHash) {
    return (
      <a className="hero-link" href={to} onClick={scrollToSection}>
        <i />
        {children}
        <span aria-hidden="true">→</span>
      </a>
    );
  }

  return (
    <Link className="hero-link" to={to}>
      <i />
      {children}
      <span aria-hidden="true">→</span>
    </Link>
  );
};

export default function Hero({
  phrases = DEFAULT_PHRASES,
  fixedLine = 'SplitRoof',
  eyebrow = 'SplitRoof',
  eyebrowEnd = 'Shared living',
  label = 'SplitRoof',
  subtext = '',
  sectionLabel = 'Introduction',
  links = [],
  action,
}) {
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState(null);
  const [opening, setOpening] = useState(true);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches) {
      setOpening(false);
      return undefined;
    }

    const handoff = window.setTimeout(() => setOpening(false), 1500);
    const cycle = window.setInterval(() => {
      setOpening(false);
      setIndex((current) => {
        setPrevious(current);
        return (current + 1) % phrases.length;
      });
    }, CYCLE_MS);

    return () => {
      window.clearTimeout(handoff);
      window.clearInterval(cycle);
    };
  }, [phrases.length]);

  const linksToShow = action !== undefined ? null : links;

  return (
    <section className="hero" aria-label={sectionLabel}>
      <div className="hero-inner">
        <p className="hero-eyebrow">{eyebrow} <i /> {eyebrowEnd}</p>
        <h1 aria-label={label}>
          <span className={`hero-line hero-rotor ${opening ? 'is-opening' : ''}`} aria-hidden="true">
            {previous !== null && (
              <span key={`out-${previous}`} className="is-out">{phrases[previous]}</span>
            )}
            <span key={`in-${index}`} className="is-in">{phrases[index]}</span>
          </span>
          <span className="hero-line hero-fixed">
            <span className="hero-rise">{fixedLine}</span>
          </span>
        </h1>
        <div className="hero-runway" aria-hidden="true">
          <span className="track" />
          <span className="draw" />
          <span className="mark" />
        </div>
        <div className="hero-below">
          {subtext ? <p>{subtext}</p> : null}
          {action !== undefined ? action : linksToShow.length > 0 ? (
            <div className="hero-actions">
              {linksToShow.map((link) => (
                <HeroLink key={`${link.to}-${link.label}`} to={link.to}>
                  {link.label}
                </HeroLink>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
