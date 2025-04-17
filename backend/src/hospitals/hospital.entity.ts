import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Patient } from '../patients/patient.entity';

@Entity()
export class Hospital {
  @PrimaryGeneratedColumn()
  id: string;

  @Column()
  name: string;

  @Column()
  location: string;

  @Column({ nullable: true })
  treatment?: string;

  @Column({ nullable: true })
  contactNumber?: string;

  @Column({ nullable: true })
  adminName?: string;

  @Column({ nullable: true })
  capacity?: string;

  @OneToMany(() => Patient, patient => patient.hospital)
  patients: Patient[];
}