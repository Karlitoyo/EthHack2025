export class TreatmentSummaryDto {
  treatment: string;
  hospitals: {
    id: string;
    name: string;
    location: string;
    patients: any[];
  }[];
}
