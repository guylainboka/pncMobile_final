import React from 'react';

interface MaterialIconProps {
  name: string;
  filled?: boolean;
  className?: string;
}

export const MaterialIcon: React.FC<MaterialIconProps> = ({
  name,
  filled = false,
  className = 'text-[20px]',
}) => {
  return (
    <span
      className={`material-symbols-outlined ${filled ? 'material-symbols-filled' : ''} ${className}`}
      aria-hidden="true"
    >
      {name}
    </span>
  );
};
