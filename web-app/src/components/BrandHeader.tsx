import logo from '@assets/brand/logo.png';

type Props = {
  logoClassName?: string;
};

/** The SpotPlan logo on the brand color, with the accent bar under it. */
export function BrandHeader({ logoClassName = 'w-28' }: Props) {
  return (
    <div className="shrink-0">
      <div className="flex justify-center bg-brand-green px-3 py-4">
        <img src={logo} alt="SpotPlan" className={logoClassName} />
      </div>
      <div className="h-2 bg-action" />
    </div>
  );
}
