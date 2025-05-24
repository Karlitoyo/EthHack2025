// You can include shared interfaces/types in a separate file
// and then use them in any component by importing them. For
// example, to import the interface below do:
//
// import { User } from 'path/to/interfaces';

export type User = {
  id: number;
  name: string;
};

export interface Relation {
  id: string;
  firstName: string;
  lastName: string;
  merkleRoot: string;
  // Add other relevant fields for a Relation
  citizenId?: string | null; // Added from backend structure
  age?: string; // Added from backend structure
  email?: string | null; // Added from backend structure
  address?: string | null; // Added from backend structure
  contactNumber?: string | null; // Added from backend structure
  relationshipToFamily?: string | null; // Added from backend structure
}

export interface FamilySummary {
  id: string; // DB primary key of the Family entity
  familyId: string | null; // User-facing ID (countryId)
  name: string;
  location: string;
  roleInFamily?: string | null; // The 'relationship' field of the Family (e.g., Grandfather)
}

export interface Family { // New Family interface
  id: string;
  countryId: string | null;
  name: string;
  location: string;
  relationship?: string | null;
  contactNumber?: string | null;
  adminName?: string | null;
  capacity?: string | null;
  createdAt: Date;
  relation: Relation[];
  parentFamilyId: string | null;
  // childFamilies: Family[]; // Not including childFamilies for now, assuming the /families endpoint returns a flat list or summary
}

export interface LineageData {
  targetRelation: Relation;
  lineagePath: FamilySummary[]; // Corrected type
  siblings: Relation[];
  // Add other fields returned by the backend
}
