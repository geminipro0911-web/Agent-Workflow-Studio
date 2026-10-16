import React from 'react';
import {
  Briefcase,
  Compass,
  Database,
  Server,
  Layout,
  CheckSquare,
  ShieldAlert,
  Bot,
  Terminal,
  Code,
  FileCode,
} from 'lucide-react';

interface IconMapperProps {
  name: string;
  className?: string;
  size?: number;
}

export const IconMapper: React.FC<IconMapperProps> = ({ name, className = 'w-4 h-4', size = 16 }) => {
  const props = { className, size };

  switch (name?.toLowerCase()) {
    case 'briefcase':
    case 'pm':
      return <Briefcase {...props} />;
    case 'compass':
    case 'architect':
      return <Compass {...props} />;
    case 'database':
      return <Database {...props} />;
    case 'server':
    case 'backend':
      return <Server {...props} />;
    case 'layout':
    case 'frontend':
      return <Layout {...props} />;
    case 'checksquare':
    case 'qa':
      return <CheckSquare {...props} />;
    case 'shieldalert':
    case 'security':
      return <ShieldAlert {...props} />;
    case 'terminal':
      return <Terminal {...props} />;
    case 'filecode':
      return <FileCode {...props} />;
    case 'code':
      return <Code {...props} />;
    case 'bot':
    default:
      return <Bot {...props} />;
  }
};
