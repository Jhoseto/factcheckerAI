import React from 'react';

const MobileSafeArea: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  const hasFlex = className.includes('flex');
  return (
    <div className={`h-full mobile-root ${hasFlex ? '' : 'flex flex-col'} pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] ${className}`}>
      {children}
    </div>
  );
};

export default MobileSafeArea;
