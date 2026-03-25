export function getBPClassification(sys: number, dia: number) {
  if (sys < 30) {
    sys *= 10;
    dia *= 10;
  }

  if (sys < 90 || dia < 60)
    return { label: "Baixa", colorClass: "bg-blue-100 text-blue-800" };
  if (sys >= 140 || dia >= 90)
    return { label: "Alta", colorClass: "bg-red-100 text-red-800" };
  if ((sys >= 130 && sys <= 139) || (dia >= 85 && dia <= 89))
    return { label: "Atenção", colorClass: "bg-yellow-100 text-yellow-800" };

  return { label: "Normal", colorClass: "bg-green-100 text-green-800" };
}
