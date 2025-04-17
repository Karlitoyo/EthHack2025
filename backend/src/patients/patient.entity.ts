import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Hospital } from '../hospitals/hospital.entity';

@Entity()
export class Patient {
  @PrimaryGeneratedColumn()
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  age: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  dateOfBirth?: string;

  @Column({ nullable: true })
  treatment?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  contactNumber?: string;
  
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ManyToOne(() => Hospital, hospital => hospital.patients)
  hospital: Hospital;
}