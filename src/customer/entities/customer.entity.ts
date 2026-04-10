import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity()
@Index(['email', 'organizationId'], { unique: true })
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  googleId: string;

  @Column({ nullable: true })
  provider: 'google';

  @Column({ default: false })
  emailVerified: boolean;

  @Column()
  organizationId: string;

  @Column({ nullable: true })
  passwordHash: string;

  @Column()
  name: string;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
