import { Column, Entity, OneToMany, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Citizen } from '../citizen/citizen.entity';

@Entity()
export class Country {
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
  @OneToMany(() => Citizen, citizen => citizen.country, { eager: true }) // or lazy if needed
  citizen: Citizen[]; // Represents children (citizens) of this country

  // Self-referencing relationship for parent-child countries
  @ManyToOne(() => Country, country => country.childCountries, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parentCountryId' })
  parentCountry: Country | null;

  @Column({ type: 'varchar', nullable: true }) // Explicit column for the foreign key
  parentCountryId: string | null;

  @OneToMany(() => Country, country => country.parentCountry, { cascade: true }) // child countries
  childCountries: Country[];
}