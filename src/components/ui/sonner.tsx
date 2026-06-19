import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  // App is light-mode only — no dark CSS variables defined.
  // next-themes defaults to "system" which follows OS dark mode and
  // makes Sonner render black toasts on iOS/Android in dark mode.
  // Forcing "light" keeps toasts consistent with the app's design system.
  const { theme } = useTheme();
  const resolvedTheme = "light" as ToasterProps["theme"];

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xs",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary/10 group-[.toast]:text-primary group-[.toast]:font-semibold group-[.toast]:rounded-lg",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
