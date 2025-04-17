import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Patient } from '../patients/patient.entity';

@Entity()
export class Hospital {
  @PrimaryGeneratedColumn()
  id: string;

  @Column({ nullable: true })
  hospitalId: string;

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

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @OneToMany(() => Patient, patient => patient.hospital, { eager: true }) // or lazy if needed
  patients: Patient[];
}