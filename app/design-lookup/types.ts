export type WilcomThread = {
  index: number;
  code: string | null;
  brand: string | null;
  description: string | null;
  rgb: number | null;
  density: number | null;
};

export type WilcomColorway = {
  colorwayId: number;
  colorway: string | null;
  backgroundFabric: string | null;
  threads: WilcomThread[];
};

export type WilcomDesign = {
  id: number;
  name: string;
  tapeName: string | null;
  description: string | null;
  version: string | null;
  stitches: number | null;
  colors: number | null;
  width: number | null;
  height: number | null;
  stops: number | null;
  trims: number | null;
  appliques: number | null;
  repeat: string | null;
  price: number | null;
  review: string | null;
  classified: string | null;
  fileLocation: string | null;
  fileExtension: string | null;
  thumbnail: string | null;
  trueView: string | null;
  stitchOut: string | null;
  dateCreated: string | null;
  dateModified: string | null;
  dateDue: string | null;
  lastChange: string | null;
  generalNotes: string | null;
  sewingNotes: string | null;
  customer: string | null;
  category: string | null;
  status: string | null;
  digitizer: string | null;
  style: string | null;
  typeOfWork: string | null;
  colorways: WilcomColorway[];
};

export type WilcomDesignSearchResponse = {
  count: number;
  results: WilcomDesign[];
};