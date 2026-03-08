import { PropsWithChildren } from 'react';
export default function StickyBar({children}: PropsWithChildren) {
  return <div className="sticky-bar">{children}</div>;
}
