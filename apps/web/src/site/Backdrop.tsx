import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useEffect } from 'react';

/**
 * The landing pages' background: a deep ink base, three soft colour glows that drift slowly, a fine dot grid that
 * fades out toward the edges, and a faint light from the top. Scrolling eases the glows across the page.
 * Pure CSS and transforms, so it stays smooth; reduced motion keeps the colours but stops the drift.
 */
export function Backdrop() {
  const still = useReducedMotion();
  useEffect(() => {
    // The site wrapper's solid background steps aside so this shows behind the content.
    document.documentElement.classList.add('scene-on');
    return () => document.documentElement.classList.remove('scene-on');
  }, []);
  const { scrollYProgress } = useScroll();
  const y1 = useTransform(scrollYProgress, [0, 1], ['0vh', '-30vh']),
    y2 = useTransform(scrollYProgress, [0, 1], ['0vh', '25vh']),
    y3 = useTransform(scrollYProgress, [0, 1], ['0vh', '-15vh']),
    hue = useTransform(scrollYProgress, [0, 1], ['hue-rotate(0deg)', 'hue-rotate(-35deg)']);
  const drift = (dx: number, dy: number, s: number, dur: number) =>
    still
      ? {}
      : {
          animate: { x: [0, dx, -dx * 0.6, 0], y: [0, dy, dy * 0.4, 0], scale: [1, s, 1 / s, 1] },
          transition: { duration: dur, repeat: Infinity, ease: 'easeInOut' as const },
        };
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-0 overflow-hidden"
      style={{ background: '#05060d' }}
    >
      <motion.div className="absolute inset-0" style={{ filter: hue }}>
        <motion.div style={{ y: y1 }} className="absolute -left-[12vw] -top-[18vh]">
          <motion.div
            {...drift(60, 40, 1.08, 26)}
            className="h-[62vh] w-[62vh] rounded-full opacity-[0.55] blur-[110px]"
            style={{ background: 'radial-gradient(circle, #7c5cff 0%, #5b3df5 45%, transparent 70%)' }}
          />
        </motion.div>
        <motion.div style={{ y: y2 }} className="absolute -right-[10vw] top-[8vh]">
          <motion.div
            {...drift(-50, 60, 1.1, 32)}
            className="h-[56vh] w-[56vh] rounded-full opacity-[0.42] blur-[120px]"
            style={{ background: 'radial-gradient(circle, #22d3ee 0%, #0ea5e9 45%, transparent 70%)' }}
          />
        </motion.div>
        <motion.div style={{ y: y3 }} className="absolute bottom-[-22vh] left-[28vw]">
          <motion.div
            {...drift(70, -30, 1.06, 38)}
            className="h-[58vh] w-[70vh] rounded-full opacity-[0.32] blur-[130px]"
            style={{ background: 'radial-gradient(circle, #e879f9 0%, #c026d3 45%, transparent 70%)' }}
          />
        </motion.div>
      </motion.div>
      {/* Fine dot grid, strongest near the top centre and fading out. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
          maskImage: 'radial-gradient(ellipse 75% 60% at 50% 20%, #000 30%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 60% at 50% 20%, #000 30%, transparent 85%)',
        }}
      />
      {/* Soft light from above, and a vignette so text at the edges stays readable. */}
      <div
        className="absolute inset-x-0 top-0 h-[55vh]"
        style={{
          background: 'radial-gradient(ellipse 50% 70% at 50% 0%, rgba(167,139,250,0.16), transparent 70%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 120% 90% at 50% 40%, transparent 55%, rgba(0,0,0,0.55) 100%)',
        }}
      />
    </div>
  );
}
