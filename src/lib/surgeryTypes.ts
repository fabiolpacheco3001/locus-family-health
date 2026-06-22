export interface SurgeryType {
  value: string;
  label: string;
  category: string;
}

export const SURGERY_TYPES: SurgeryType[] = [
  // Obstetrícia
  { value: "cesariana", label: "Cesariana", category: "Obstetrícia" },
  { value: "parto_normal_forceps", label: "Parto (fórceps/vácuo)", category: "Obstetrícia" },

  // Geral / Digestivo
  { value: "apendicectomia", label: "Apendicectomia", category: "Geral" },
  { value: "colecistectomia", label: "Colecistectomia (vesícula)", category: "Geral" },
  { value: "hernia_inguinal", label: "Correção de Hérnia Inguinal", category: "Geral" },
  { value: "hernia_umbilical", label: "Correção de Hérnia Umbilical", category: "Geral" },
  { value: "hemorroidectomia", label: "Hemorroidectomia", category: "Geral" },
  { value: "colostomia", label: "Colostomia", category: "Geral" },
  { value: "gastrectomia", label: "Gastrectomia", category: "Geral" },

  // Bariátrica
  { value: "bypass_gastrico", label: "Bypass Gástrico (Roux-en-Y)", category: "Bariátrica" },
  { value: "sleeve", label: "Gastrectomia Vertical (Sleeve)", category: "Bariátrica" },
  { value: "banda_gastrica", label: "Banda Gástrica Ajustável", category: "Bariátrica" },

  // Ortopedia
  { value: "artroplastia_joelho", label: "Artroplastia de Joelho (PTJ)", category: "Ortopedia" },
  { value: "artroplastia_quadril", label: "Artroplastia de Quadril (PTQ)", category: "Ortopedia" },
  { value: "artroscopia", label: "Artroscopia", category: "Ortopedia" },
  { value: "fixacao_fratura", label: "Fixação de Fratura (ORIF)", category: "Ortopedia" },
  { value: "coluna_discectomia", label: "Discectomia / Artrodese de Coluna", category: "Ortopedia" },

  // Oncologia
  { value: "mastectomia", label: "Mastectomia", category: "Oncologia" },
  { value: "reconstrucao_mama", label: "Reconstrução de Mama", category: "Oncologia" },
  { value: "prostatectomia", label: "Prostatectomia", category: "Oncologia" },
  { value: "tireoidectomia", label: "Tireoidectomia", category: "Oncologia" },
  { value: "colectomia", label: "Colectomia", category: "Oncologia" },

  // Cardiovascular
  { value: "revascularizacao_miocardio", label: "Revascularização do Miocárdio (Ponte)", category: "Cardiovascular" },
  { value: "implante_stent", label: "Implante de Stent Coronário", category: "Cardiovascular" },
  { value: "troca_valva", label: "Troca de Válva Cardíaca", category: "Cardiovascular" },
  { value: "marcapasso", label: "Implante de Marcapasso", category: "Cardiovascular" },

  // Urologia
  { value: "nefrolitotripsia", label: "Nefrolitotripsia (rim)", category: "Urologia" },
  { value: "prostatectomia_benigna", label: "RTU de Próstata (HBP)", category: "Urologia" },
  { value: "nefrectomia", label: "Nefrectomia", category: "Urologia" },

  // Ginecologia
  { value: "histerectomia", label: "Histerectomia", category: "Ginecologia" },
  { value: "laparoscopia_ginecologica", label: "Laparoscopia Ginecológica", category: "Ginecologia" },
  { value: "miomectomia", label: "Miomectomia", category: "Ginecologia" },
  { value: "ooforectomia", label: "Ooforectomia (ovário)", category: "Ginecologia" },

  // Oftalmologia
  { value: "catarata", label: "Cirurgia de Catarata", category: "Oftalmologia" },
  { value: "lasik", label: "LASIK / PRK (visão)", category: "Oftalmologia" },
  { value: "vitrectomia", label: "Vitrectomia", category: "Oftalmologia" },

  // ORL
  { value: "amigdalectomia", label: "Amigdalectomia", category: "ORL" },
  { value: "adenoidectomia", label: "Adenoidectomia", category: "ORL" },
  { value: "septoplastia", label: "Septoplastia (desvio de septo)", category: "ORL" },
  { value: "timpanoplastia", label: "Timpanoplastia", category: "ORL" },
  { value: "implante_coclear", label: "Implante Coclear", category: "ORL" },

  // Plástica
  { value: "rinoplastia", label: "Rinoplastia", category: "Plástica" },
  { value: "abdominoplastia", label: "Abdominoplastia", category: "Plástica" },
  { value: "lipoaspiracao", label: "Lipoaspiração", category: "Plástica" },
  { value: "mamoplastia_aumento", label: "Mamoplastia de Aumento", category: "Plástica" },
  { value: "blefaroplastia", label: "Blefaroplastia", category: "Plástica" },

  // Transplante
  { value: "transplante_renal", label: "Transplante Renal", category: "Transplante" },
  { value: "transplante_hepatico", label: "Transplante Hepático", category: "Transplante" },
  { value: "transplante_cardiaco", label: "Transplante Cardíaco", category: "Transplante" },

  // Outro
  { value: "outro", label: "Outro (especificar)", category: "Outro" },
];

export const SURGERY_TYPES_LIST = SURGERY_TYPES.map((t) => t.value);

export function getSurgeryLabel(value: string): string {
  return SURGERY_TYPES.find((t) => t.value === value)?.label ?? value;
}
