import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, Check, Copy, Github, Linkedin, Mail, Youtube } from 'lucide-react';
import { EMAIL, LINKEDIN_URL } from '../constants';
import { Magnetic, SectionTitle, TiltCard } from './fx';

const socials = [
  { name: 'GitHub', handle: '@AumkarMali', href: 'https://github.com/AumkarMali', icon: Github, c1: '#3b82f6', c2: '#1e3a8a', blurb: 'Source for every project on this page' },
  { name: 'YouTube', handle: '@AumkarMali', href: 'https://www.youtube.com/@AumkarMali', icon: Youtube, c1: '#ef4444', c2: '#7f1d1d', blurb: 'Robotics builds and tutorials' },
  { name: 'LinkedIn', handle: 'Aumkar Mali', href: LINKEDIN_URL, icon: Linkedin, c1: '#f97316', c2: '#7c2d12', blurb: 'Experience and updates' },
  { name: 'Email', handle: EMAIL, href: `mailto:${EMAIL}`, icon: Mail, c1: '#eab308', c2: '#78350f', blurb: 'The fastest way to reach me' },
];

const Social = () => {
  const [copied, setCopied] = useState(false);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.location.href = `mailto:${EMAIL}`;
    }
  };

  return (
    <section className="relative px-5 pb-10 lg:px-20">
      <SectionTitle text="Socials" id="socials" />

      <div className="mx-auto mt-16 grid max-w-6xl gap-6 sm:grid-cols-2">
        {socials.map(({ name, handle, href, icon: Icon, c1, c2, blurb }, i) => (
          <motion.div
            key={name}
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            <TiltCard max={8} className="rounded-2xl">
              <a
                href={href}
                target={name === 'Email' ? undefined : '_blank'}
                rel="noopener noreferrer"
                className="spin-border group block rounded-2xl"
                style={{ '--c1': c1, '--c2': c2 }}
              >
                <div className="relative flex items-center gap-5 rounded-2xl bg-gray-950/90 p-6 backdrop-blur-md">
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110"
                    style={{ background: `linear-gradient(135deg, ${c1}, ${c2})`, boxShadow: `0 0 30px ${c1}55` }}
                  >
                    <Icon size={30} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xl font-semibold text-white">{name}</h4>
                    <p className="truncate text-sm" style={{ color: c1 }}>{handle}</p>
                    <p className="mt-1 text-sm text-gray-400">{blurb}</p>
                  </div>
                  <ArrowUpRight className="shrink-0 text-gray-500 transition-all duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-white" />
                </div>
              </a>
            </TiltCard>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9 }}
        className="mx-auto mt-24 max-w-3xl text-center"
      >
        <h3 className="shimmer-text text-4xl font-bold sm:text-6xl">Let&apos;s build something.</h3>
        <p className="mt-4 text-gray-400">Open to embedded, robotics and ML infrastructure roles.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Magnetic>
            <a
              href={`mailto:${EMAIL}`}
              className="shine inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 px-6 py-3 font-semibold text-white shadow-[0_0_30px_rgba(249,115,22,0.4)]"
            >
              <Mail size={18} /> Say hello
            </a>
          </Magnetic>
          <Magnetic>
            <button
              onClick={copyEmail}
              className="inline-flex items-center gap-2 rounded-lg border border-orange-500/40 px-6 py-3 text-orange-200 transition-colors hover:bg-orange-500/10"
            >
              {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
              {copied ? 'Copied!' : 'Copy email'}
            </button>
          </Magnetic>
        </div>
      </motion.div>
    </section>
  );
};

export default Social;
