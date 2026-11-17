import { ArrowUp, Github, Linkedin, Mail, Youtube } from 'lucide-react';
import { EMAIL, LINKEDIN_URL } from '../constants';
import { Magnetic } from './fx';

const links = [
  { href: 'https://github.com/AumkarMali', icon: Github, label: 'GitHub' },
  { href: 'https://www.youtube.com/@AumkarMali', icon: Youtube, label: 'YouTube' },
  { href: LINKEDIN_URL, icon: Linkedin, label: 'LinkedIn' },
  { href: `mailto:${EMAIL}`, icon: Mail, label: 'Email' },
];

const Footer = () => (
  <footer className="relative mt-20 border-t border-neutral-800">
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/70 to-transparent" />
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 py-10 sm:flex-row lg:px-20">
      <span className="text-gray-400">© {new Date().getFullYear()} Aumkar Mali</span>
      <div className="flex items-center gap-2">
        {links.map(({ href, icon: Icon, label }) => (
          <Magnetic key={label} strength={0.5}>
            <a
              href={href}
              target={label === 'Email' ? undefined : '_blank'}
              rel="noopener noreferrer"
              aria-label={label}
              className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-orange-500/15 hover:text-orange-400"
            >
              <Icon size={20} />
            </a>
          </Magnetic>
        ))}
      </div>
      <Magnetic>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2 rounded-full border border-orange-500/40 px-4 py-2 text-sm text-orange-200 transition-colors hover:bg-orange-500/10"
        >
          <ArrowUp size={16} /> Back to top
        </button>
      </Magnetic>
    </div>
  </footer>
);

export default Footer;
