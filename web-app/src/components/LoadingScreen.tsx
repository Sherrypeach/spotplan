import logo from '@assets/brand/logo.png';

type Props = {
  /** "screen" fills the window; "area" fills the space it's placed in. */
  size?: 'screen' | 'area';
};

// The logo file is white for the brand bar, so here its shape is filled with the title green.
const LOGO_SHAPE = { maskImage: `url(${logo})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' };

const DOTS = [
  { color: 'bg-step-students', delay: '0s' },
  { color: 'bg-step-chart', delay: '0.15s' },
  { color: 'bg-step-seats', delay: '0.3s' },
];

/** The brand and three hopping dots for the moment before a page knows what to show. */
export function LoadingScreen({ size = 'screen' }: Props) {
  const sizeClass = size === 'screen' ? 'bg-dots h-dvh' : 'h-full min-h-60';
  return (
    <div className={`flex flex-col items-center justify-center gap-6 ${sizeClass}`} role="status">
      <div className="aspect-[480/334] w-32 bg-title" style={LOGO_SHAPE} aria-hidden />
      <div className="flex gap-2" aria-hidden>
        {DOTS.map((dot) => (
          <span
            key={dot.delay}
            className={`size-3 rounded-full ${dot.color} animate-hop motion-reduce:animate-none`}
            style={{ animationDelay: dot.delay }}
          />
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
