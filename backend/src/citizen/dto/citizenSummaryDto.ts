// src/patients/dto/treatment-summary.dto.ts
export class TreatmentSummaryDto {
  treatment: string;
  hospitals: {
    id: string;
    name: string;
    location: string;
    patients: {
      id: string;
      firstName: string;
      lastName: string;
      age: string;
      treatment: string;
    }[];
  }[];
}
