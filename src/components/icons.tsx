import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  level?: number;
}

export const BatteryIcon: React.FC<IconProps> = ({ level = 50, className, ...props }) => {
  const fillWidth = Math.min(Math.max(level, 0), 100) * 0.14; // 14px is the width of the battery body
  const fillColor = level > 20 ? 'currentColor' : '#ef4444';
  
  return (
    <svg 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="2" y="7" width="16" height="10" rx="2" ry="2" />
      <rect x="4" y="9" width={fillWidth} height="6" rx="1" ry="1" fill={fillColor} />
      <line x1="22" y1="11" x2="22" y2="13" />
    </svg>
  );
};

export const CheckCircleIcon: React.FC<IconProps> = ({ className, ...props }) => {
  return (
    <svg 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  );
};

export const XCircleIcon: React.FC<IconProps> = ({ className, ...props }) => {
  return (
    <svg 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>
  );
}; 