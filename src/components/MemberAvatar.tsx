import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface MemberAvatarProps {
  avatarUrl?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: { container: "h-10 w-10", text: "text-sm", emoji: "text-xl" },
  md: { container: "h-12 w-12", text: "text-lg", emoji: "text-2xl" },
  lg: { container: "h-14 w-14", text: "text-xl", emoji: "text-3xl" },
};

const MemberAvatar = ({ avatarUrl, name, size = "md", className = "" }: MemberAvatarProps) => {
  const s = sizeClasses[size];
  const initials = (() => {
    const parts = (name ?? "").trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "—";
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  })();

  const isImage = avatarUrl?.startsWith("data:image") || avatarUrl?.startsWith("http");
  const isEmoji = avatarUrl && !isImage && avatarUrl.length > 0;

  return (
    <Avatar className={`${s.container} border-2 border-secondary shrink-0 ${className}`}>
      {isImage && (
        <AvatarImage src={avatarUrl!} alt={name} className="object-cover" />
      )}
      <AvatarFallback className="bg-secondary/20 text-secondary font-bold">
        {isEmoji ? (
          <span className={`${s.emoji} flex items-center justify-center w-full h-full`}>{avatarUrl}</span>
        ) : (
          <span className={s.text}>{initials}</span>
        )}
      </AvatarFallback>
    </Avatar>
  );
};

export default MemberAvatar;
