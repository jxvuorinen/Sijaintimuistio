export interface Sijainti {
  id: number;
  tunniste: string;
  ohjeistus: string;
  latitude: number;
  longitude: number;
  pvm: string;
  aika: string;
}

export interface DialogiData {
  auki: boolean;
  tunnisteTeksti: string;
  ohjeTeksti: string;
}

export interface ModalData {
  auki: boolean;
  poistaYksi: boolean | undefined;
  poistettava: number | undefined;
}