/**
 * VaccineFormDrawer — Drawer de formulário para adicionar/editar vacinas.
 * Extraído de Vacinas.tsx (M3).
 */
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";

const INPUT_CLASSES =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none";

type Vaccine = {
  id: string;
  name: string;
};

type FormState = {
  name: string;
  customName: string;
  applied_date: string;
  booster_date: string;
  batch: string;
  side_effects: string;
  details: string;
  dose_type: string;
  facility: string;
  city: string;
  state: string;
};

type UF = { sigla: string };
type City = { id: number; nome: string };

type Props = {
  open: boolean;
  onClose: () => void;
  editingVaccine: Vaccine | null;
  form: FormState;
  setForm: (form: FormState) => void;
  isPending: boolean;
  onSubmit: () => void;
  vaccineOptions: string[];
  isCustom: boolean;
  ufs: UF[];
  cities: City[];
  loadingCities: boolean;
};

export function VaccineFormDrawer({
  open,
  onClose,
  editingVaccine,
  form,
  setForm,
  isPending,
  onSubmit,
  vaccineOptions,
  isCustom,
  ufs,
  cities,
  loadingCities,
}: Props) {
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} repositionInputs={false}>
      <DrawerContent className="fixed bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-background outline-hidden">
        <DrawerHeader>
          <DrawerTitle>{editingVaccine ? "Editar Vacina" : "Nova Vacina"}</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain no-scrollbar">
          {/* Vacina + Dose */}
          <div className="flex gap-4">
            <div className="w-[70%]">
              <label className="text-sm font-medium text-foreground mb-1 block">Vacina</label>
              <select
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value, customName: "" })}
                className={INPUT_CLASSES}
              >
                <option value="">Selecione...</option>
                {vaccineOptions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div className="w-[30%]">
              <label className="text-sm font-medium text-foreground mb-1 block">Dose</label>
              <select
                value={form.dose_type}
                onChange={(e) => setForm({ ...form, dose_type: e.target.value })}
                className={INPUT_CLASSES}
              >
                <option value="">Selecione...</option>
                <option value="1ª Dose">1ª Dose</option>
                <option value="2ª Dose">2ª Dose</option>
                <option value="3ª Dose">3ª Dose</option>
                <option value="Reforço">Reforço</option>
                <option value="Única">Única</option>
              </select>
            </div>
          </div>

          {isCustom && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome da Vacina</label>
              <input
                type="text"
                placeholder="Ex: Febre Tifoide, Herpes Zóster..."
                value={form.customName}
                onChange={(e) => setForm({ ...form, customName: e.target.value })}
                className={INPUT_CLASSES}
              />
            </div>
          )}

          {/* Data + Lote */}
          <div className="flex gap-4">
            <div className="w-[50%]">
              <label className="text-sm font-medium text-foreground mb-1 block">Data da aplicação</label>
              <DatePickerField
                value={form.applied_date}
                onChange={(val) => setForm({ ...form, applied_date: val })}
                mode="date"
              />
            </div>
            <div className="w-[50%]">
              <label className="text-sm font-medium text-foreground mb-1 block">Lote</label>
              <input
                type="text"
                placeholder="Ex: FA123/2026"
                value={form.batch}
                onChange={(e) => setForm({ ...form, batch: e.target.value })}
                className={INPUT_CLASSES}
              />
            </div>
          </div>

          {/* Informações Adicionais */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Informações Adicionais</label>
            <input
              type="text"
              placeholder="Ex: Pfizer, Coronavac..."
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
              className={INPUT_CLASSES}
            />
          </div>

          {/* UF + Município */}
          <div className="flex gap-4">
            <div className="w-[30%]">
              <label className="text-sm font-medium text-foreground mb-1 block">UF</label>
              <select
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value, city: "" })}
                className={INPUT_CLASSES}
              >
                <option value="">UF...</option>
                {ufs.map((uf) => (
                  <option key={uf.sigla} value={uf.sigla}>{uf.sigla}</option>
                ))}
              </select>
            </div>
            <div className="w-[70%]">
              <label className="text-sm font-medium text-foreground mb-1 block">Município</label>
              <select
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className={INPUT_CLASSES}
                disabled={!form.state || loadingCities}
              >
                <option value="">{loadingCities ? "Carregando..." : "Selecione..."}</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.nome}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Estabelecimento */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Estabelecimento de Saúde</label>
            <input
              type="text"
              placeholder="Ex: UBS Centro"
              value={form.facility}
              onChange={(e) => setForm({ ...form, facility: e.target.value })}
              className={INPUT_CLASSES}
            />
          </div>

          {/* Efeitos Colaterais */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Efeitos colaterais</label>
            <textarea
              placeholder="Ex: Dor no braço, febre leve..."
              value={form.side_effects}
              onChange={(e) => setForm({ ...form, side_effects: e.target.value })}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none resize-none"
            />
          </div>
        </div>

        <div className="p-4 border-t mt-auto bg-background space-y-3">
          <Button onClick={onSubmit} disabled={isPending} className="w-full">
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} className="w-full">
            Cancelar
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
