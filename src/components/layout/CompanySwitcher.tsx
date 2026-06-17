import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCompany } from "@/contexts/CompanyContext";
import { useLanguage } from "@/contexts/LanguageContext";

export function CompanySwitcher() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { selectedCompany, setSelectedCompany, companies, isLoading } = useCompany();
  const { language } = useLanguage();
  const emptyLabel = language === "es" ? "Sin companias asignadas" : "No assigned companies";
  const selectLabel = language === "es" ? "Seleccionar compania..." : "Select company...";
  const loadingLabel = language === "es" ? "Cargando companias..." : "Loading companies...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[280px] justify-between bg-card/50 hover:bg-card"
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            {selectedCompany ? (
              <div className="flex flex-col items-start">
                <span className="font-medium text-sm">
                  {selectedCompany.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {selectedCompany.juridical_id}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">
                {isLoading ? loadingLabel : companies.length === 0 ? emptyLabel : selectLabel}
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0">
        {companies.length === 0 ? (
          <div className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? loadingLabel
                : language === "es"
                  ? "Tu usuario todavia no tiene companias asignadas."
                  : "Your user does not have any assigned companies yet."}
            </p>
            {!isLoading && (
              <Button
                className="w-full"
                onClick={() => {
                  setOpen(false);
                  navigate("/create-company");
                }}
              >
                {language === "es" ? "Crear empresa" : "Create company"}
              </Button>
            )}
          </div>
        ) : (
          <Command>
            <CommandInput 
              placeholder={language === 'es' ? 'Buscar compania...' : 'Search company...'}
            />
            <CommandList>
              <CommandEmpty>
                {language === 'es' ? 'No se encontraron companias.' : 'No companies found.'}
              </CommandEmpty>
              <CommandGroup>
                {companies.map((company) => (
                  <CommandItem
                    key={company.id}
                    value={company.name}
                    onSelect={() => {
                      setSelectedCompany(company);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedCompany?.id === company.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{company.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {company.juridical_id}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
