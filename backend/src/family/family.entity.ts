import { Column, Entity, OneToMany, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Relation } from '../relation/relation.entity';

@Entity()
export class Family {
  @PrimaryGeneratedColumn()
  id: string;

  @Column({ nullable: true })
  countryId: string;

  @Column()
  name: string;

  @Column()
  location: string;

  @Column({ nullable: true })
  relationship?: string; // This might represent the role of this country, e.g., "father"

  @Column({ nullable: true })
  contactNumber?: string;

  @Column({ nullable: true })
  adminName?: string;

  @Column({ nullable: true })
  capacity?: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  // Relation to citizens (this country is a parent to these citizens)
  @OneToMany(() => Relation, relation => relation.family, { eager: true }) // or lazy if needed
  relation: Relation[]; // Represents children (relations) of this family

  // Self-referencing relationship for parent-child families
  @ManyToOne(() => Family, family => family.childFamilies, { nullable: true, onDelete: 'SET NULL' }) // Changed: family => family.childFamilies
  @JoinColumn({ name: 'parentFamilyId' }) // Changed: parentCountryId to parentFamilyId for clarity
  parentFamily: Family | null; // Changed: Type to Family | null, renamed from parentCountry

  @Column({ type: 'varchar', nullable: true }) // Explicit column for the foreign key
  parentFamilyId: string | null; // Changed: parentCountryId to parentFamilyId

  @OneToMany(() => Family, family => family.parentFamily, { cascade: true }) // Changed: Relation to Family, family.parentCountry to family.parentFamily
  childFamilies: Family[]; // Renamed from childOfFamily, type to Family[]
}