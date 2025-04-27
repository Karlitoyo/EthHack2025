// src/merkle/utils.ts
import { Patient } from '../patients/patient.entity';
import { PatientRow } from './interfaces/merkleTree';


export const FIELD_MODULUS = BigInt(
  '0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001',
);

export function toMerklePatientRow(p: Patient): PatientRow | null {
  if (!p.hospital?.hospitalId) {
    console.warn('Skipping patient with missing hospital/hospitalId', p);
    return null;
  }
  if (!p.treatment || !p.patientId) {
    console.warn('Skipping patient missing treatment or patientId', p);
    return null;
  }
  return {
    hospital_id: String(p.hospital.hospitalId),
    treatment: String(p.treatment),
    patient_id: String(p.patientId),
  };
}

export function assertIs32ByteHex(label: string, value: string) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${label} is not a valid 32-byte hex string: ${value}`);
  }
}

export function toHex32(n: bigint | string): string {
  let h = (typeof n === "bigint" ? n.toString(16) : n.replace(/^0x/, ""));
  if (h.length > 64) throw new Error("Value too large for 32 bytes");
  return "0x" + h.padStart(64, "0");
}

export function hexToBytesBE(hex) {
  let s = hex.replace(/^0x/, '');
  if (s.length !== 64) throw new Error(`must be 32-byte hex`);
  const arr = new Uint8Array(32);
  for (let i = 0; i < 32; ++i) arr[i] = parseInt(s.substr(i*2,2),16);
  return arr;
}