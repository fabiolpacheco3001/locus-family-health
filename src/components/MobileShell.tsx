import { ReactNode } from "react";

interface MobileShellProps {
  children: ReactNode;
}

const MobileShell = ({ children }: MobileShellProps) => {
  return (
    <div className="w-full min-h-[100dvh] flex flex-col bg-background text-foreground overflow-x-hidden">
      {children}
    </div>
  );
};

export default MobileShell;
