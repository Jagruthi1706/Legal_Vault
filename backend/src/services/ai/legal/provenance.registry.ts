import provenanceFile from './corpus/provenance.json';

export interface ProvenanceRegistryEntry {
  id: string;
  datasetName: string;
  url: string;
  license: string;
  attribution: string;
  ingestedAt: string;
  version: string;
  permittedUseNotes: string;
}

const registries = (provenanceFile as { registries: ProvenanceRegistryEntry[] }).registries;

export const listProvenanceRegistries = (): ProvenanceRegistryEntry[] => registries;

export const getProvenanceRegistry = (id: string): ProvenanceRegistryEntry | undefined =>
  registries.find((entry) => entry.id === id);

export const assertCompatibleLicense = (license: string, sourceId: string): void => {
  const allowed = new Set(registries.map((entry) => entry.license));
  if (!allowed.has(license)) {
    throw new Error(`Refusing to ingest source ${sourceId}: license "${license}" is not in the approved provenance registry.`);
  }
};
