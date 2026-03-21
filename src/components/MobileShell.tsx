import { ReactNode } from "react";

interface MobileShellProps {
  children: ReactNode;
}

const MobileShell = ({ children }: MobileShellProps) => {
  return (
    <div className="min-h-screen flex justify-center bg-muted">
      <div className="app-shell flex flex-col relative overflow-x-hidden">
        {children}
      </div>
    </div>
  );
};

export default MobileShell;
