import { useState, useEffect } from "react";

interface UfOption {
  id: number;
  sigla: string;
  nome: string;
}

interface CityOption {
  id: number;
  nome: string;
}

export function useIbgeLocations(selectedUf: string) {
  const [ufs, setUfs] = useState<UfOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  useEffect(() => {
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome")
      .then((r) => r.json())
      .then((data: UfOption[]) => setUfs(data))
      .catch(() => setUfs([]));
  }, []);

  useEffect(() => {
    if (!selectedUf) {
      setCities([]);
      return;
    }
    setLoadingCities(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${selectedUf}/municipios?orderBy=nome`)
      .then((r) => r.json())
      .then((data: CityOption[]) => setCities(data))
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [selectedUf]);

  return { ufs, cities, loadingCities };
}
