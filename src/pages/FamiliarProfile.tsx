import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const FamiliarProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="px-5 pt-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} />
        </Button>
        <h1 className="text-xl font-bold text-foreground">Perfil do Familiar</h1>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm">Perfil em construção...</p>
        <p className="text-xs text-muted-foreground/60 mt-2">ID: {id}</p>
      </div>
    </div>
  );
};

export default FamiliarProfile;
