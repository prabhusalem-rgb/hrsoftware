'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

export const AIRPORTS = [
  { value: 'Salem Airport (SXV) – Salem', label: 'Salem Airport (SXV) – Salem' },
  { value: 'Thoothukkudi Airport (TCR) – Thoothukkudi', label: 'Thoothukkudi Airport (TCR) – Thoothukkudi' },
  { value: 'Puducherry Airport (PNY) – Puducherry', label: 'Puducherry Airport (PNY) – Puducherry' },
  { value: 'Agra Airport (AGR) – Agra', label: 'Agra Airport (AGR) – Agra' },
  { value: 'Aligarh Airport – Aligarh', label: 'Aligarh Airport – Aligarh' },
  { value: 'Azamgarh Airport – Azamgarh', label: 'Azamgarh Airport – Azamgarh' },
  { value: 'Bareilly Airport (BEK) – Bareilly', label: 'Bareilly Airport (BEK) – Bareilly' },
  { value: 'Chitrakoot Airport – Chitrakoot', label: 'Chitrakoot Airport – Chitrakoot' },
  { value: 'Gorakhpur Airport (GOP) – Gorakhpur (civil enclave)', label: 'Gorakhpur Airport (GOP) – Gorakhpur (civil enclave)' },
  { value: 'Kanpur Airport (KNU) – Kanpur (civil enclave)', label: 'Kanpur Airport (KNU) – Kanpur (civil enclave)' },
  { value: 'Prayagraj Airport (IXD) – Prayagraj (civil enclave)', label: 'Prayagraj Airport (IXD) – Prayagraj (civil enclave)' },
  { value: 'Saharanpur Airport (SWN) – Saharanpur (civil enclave)', label: 'Saharanpur Airport (SWN) – Saharanpur (civil enclave)' },
  { value: 'Shravasti Airport (VSV) – Shravasti', label: 'Shravasti Airport (VSV) – Shravasti' },
  { value: 'Amravati Airport – Amravati', label: 'Amravati Airport – Amravati' },
  { value: 'Gondia Airport (GDB) – Gondia', label: 'Gondia Airport (GDB) – Gondia' },
  { value: 'Jalgaon Airport (JLG) – Jalgaon', label: 'Jalgaon Airport (JLG) – Jalgaon' },
  { value: 'Kolhapur Airport (KLH) – Kolhapur', label: 'Kolhapur Airport (KLH) – Kolhapur' },
  { value: 'Kishangarh Airport (KQH) – Ajmer', label: 'Kishangarh Airport (KQH) – Ajmer' },
  { value: 'Bikaner Airport (BKB) – Bikaner (civil enclave)', label: 'Bikaner Airport (BKB) – Bikaner (civil enclave)' },
  { value: 'Jaisalmer Airport (JSA) – Jaisalmer (civil enclave)', label: 'Jaisalmer Airport (JSA) – Jaisalmer (civil enclave)' },
  { value: 'Jodhpur Airport (JDH) – Jodhpur (civil enclave)', label: 'Jodhpur Airport (JDH) – Jodhpur (civil enclave)' },
  { value: 'Udaipur Airport (UDR) – Udaipur', label: 'Udaipur Airport (UDR) – Udaipur' },
  { value: 'Chennai International Airport (MAA) – Chennai', label: 'Chennai International Airport (MAA) – Chennai' },
  { value: 'Coimbatore International Airport (CJB) – Coimbatore', label: 'Coimbatore International Airport (CJB) – Coimbatore' },
  { value: 'Madurai International Airport (IXM) – Madurai', label: 'Madurai International Airport (IXM) – Madurai' },
  { value: 'Tiruchirappalli International Airport (TRZ) – Tiruchirappalli', label: 'Tiruchirappalli International Airport (TRZ) – Tiruchirappalli' },
  { value: 'Cochin International Airport (COK) – Kochi', label: 'Cochin International Airport (COK) – Kochi' },
  { value: 'Kozhikode International Airport (CCJ) – Kozhikode', label: 'Kozhikode International Airport (CCJ) – Kozhikode' },
  { value: 'Kannur International Airport (CNN) – Kannur', label: 'Kannur International Airport (CNN) – Kannur' },
  { value: 'Thiruvananthapuram International Airport (TRV) – Thiruvananthapuram', label: 'Thiruvananthapuram International Airport (TRV) – Thiruvananthapuram' },
  { value: 'Chaudhary Charan Singh International Airport (LKO) – Lucknow', label: 'Chaudhary Charan Singh International Airport (LKO) – Lucknow' },
  { value: 'Lal Bahadur Shastri International Airport (VNS) – Varanasi', label: 'Lal Bahadur Shastri International Airport (VNS) – Varanasi' },
  { value: 'Kushinagar International Airport (KBK) – Kushinagar', label: 'Kushinagar International Airport (KBK) – Kushinagar' },
  { value: 'Maharishi Valmiki International Airport (AYJ) – Ayodhya', label: 'Maharishi Valmiki International Airport (AYJ) – Ayodhya' },
  { value: 'Noida International Airport (DXN) – Jewar (Greater Noida)', label: 'Noida International Airport (DXN) – Jewar (Greater Noida)' },
  { value: 'Chhatrapati Shivaji Maharaj International Airport (BOM) – Mumbai', label: 'Chhatrapati Shivaji Maharaj International Airport (BOM) – Mumbai' },
  { value: 'Dr. Babasaheb Ambedkar International Airport (NAG) – Nagpur', label: 'Dr. Babasaheb Ambedkar International Airport (NAG) – Nagpur' },
  { value: 'Nashik International Airport (ISK) – Nashik', label: 'Nashik International Airport (ISK) – Nashik' },
  { value: 'Navi Mumbai International Airport (NMI) – Navi Mumbai', label: 'Navi Mumbai International Airport (NMI) – Navi Mumbai' },
  { value: 'Jaipur International Airport (JAI) – Jaipur', label: 'Jaipur International Airport (JAI) – Jaipur' },
  { value: 'Indira Gandhi International Airport (DEL) – Delhi', label: 'Indira Gandhi International Airport (DEL) – Delhi' },
  { value: 'Kempegowda International Airport (BLR) – Bengaluru', label: 'Kempegowda International Airport (BLR) – Bengaluru' },
  { value: 'Rajiv Gandhi International Airport (HYD) – Hyderabad', label: 'Rajiv Gandhi International Airport (HYD) – Hyderabad' },
  { value: 'Netaji Subhas Chandra Bose International Airport (CCU) – Kolkata', label: 'Netaji Subhas Chandra Bose International Airport (CCU) – Kolkata' },
  { value: 'Hazrat Shahjalal International Airport (DAC) – Dhaka', label: 'Hazrat Shahjalal International Airport (DAC) – Dhaka' },
  { value: 'Shah Amanat International Airport (CGP) – Chittagong', label: 'Shah Amanat International Airport (CGP) – Chittagong' },
  { value: 'Sylhet Osmani International Airport (ZYL) – Sylhet', label: 'Sylhet Osmani International Airport (ZYL) – Sylhet' },
  { value: 'Barishal Airport – Barishal (limited international flights)', label: 'Barishal Airport – Barishal (limited international flights)' },
  { value: 'Cox’s Bazar Airport (CXB) – Cox’s Bazar (emerging international services)', label: 'Cox’s Bazar Airport (CXB) – Cox’s Bazar (emerging international services)' },
  { value: 'Jinnah International Airport (KHI) – Karachi', label: 'Jinnah International Airport (KHI) – Karachi' },
  { value: 'Allama Iqbal International Airport (LHE) – Lahore', label: 'Allama Iqbal International Airport (LHE) – Lahore' },
  { value: 'Islamabad International Airport (ISB) – Islamabad', label: 'Islamabad International Airport (ISB) – Islamabad' },
  { value: 'Peshawar International Airport (PEW) – Peshawar', label: 'Peshawar International Airport (PEW) – Peshawar' },
  { value: 'Faisalabad International Airport (LYP) – Faisalabad', label: 'Faisalabad International Airport (LYP) – Faisalabad' },
  { value: 'Multan International Airport (MUX) – Multan', label: 'Multan International Airport (MUX) – Multan' },
  { value: 'Tribhuvan International Airport (KTM) – Kathmandu', label: 'Tribhuvan International Airport (KTM) – Kathmandu' },
  { value: 'Gautam Buddha International Airport – Bhairahawa (near Lumbini)', label: 'Gautam Buddha International Airport – Bhairahawa (near Lumbini)' },
  { value: 'Pokhara International Airport – Pokhara', label: 'Pokhara International Airport – Pokhara' },
  { value: 'Bandaranaike International Airport (CMB) – Colombo (Katunayake)', label: 'Bandaranaike International Airport (CMB) – Colombo (Katunayake)' },
];

interface AirportSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function AirportSelect({ value, onChange, className }: AirportSelectProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', className)}
        >
          {value
            ? AIRPORTS.find((airport) => airport.value === value)?.label
            : 'Select sector...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search airport or city..." />
          <CommandEmpty>No airport found.</CommandEmpty>
          <CommandGroup>
            <ScrollArea className="h-72">
              {AIRPORTS.map((airport) => (
                <CommandItem
                  key={airport.value}
                  value={airport.value}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? '' : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === airport.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {airport.label}
                </CommandItem>
              ))}
            </ScrollArea>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
