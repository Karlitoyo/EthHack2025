export type User = {
  id: number;
  name: string;
};

export interface Relation {
  id: string;
  firstName: string;
  lastName: string;
  merkleRoot: string;
  citizenId?: string | null; // Added from backend structure
  age?: string; // Added from backend structure
  email?: string | null; // Added from backend structure
  address?: string | null; // Added from backend structure
  contactNumber?: string | null; // Added from backend structure
  relationshipToFamily?: string | null; // Added from backend structure
}

export interface FamilySummary {
  id: string; // DB primary key of the Family entity
  familyId: string | null;
  name: string;
  location: string;
  roleInFamily?: string | null;
}

export interface Family {
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
}

export interface LineageData {
  targetRelation: Relation;
  lineagePath: FamilySummary[];
  siblings: Relation[];
}
